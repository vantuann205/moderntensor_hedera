"""
Tests for Requester flow and Subnet Owner functionality.

Covers:
- Requester: submit → match → validate → payment, task detail query
- Subnet Owner: create, list, deactivate, metrics, fee rate
"""

import pytest

from sdk.protocol.types import ProtocolConfig, TaskStatus
from sdk.marketplace.orchestrator import MarketplaceProtocol
from sdk.marketplace.subnet_manager import SubnetManager, SubnetInfo


SAMPLE_CODE = """
pragma solidity ^0.8.0;
contract Token {
    mapping(address => uint) public balances;
    function transfer(address to, uint amount) public {
        require(balances[msg.sender] >= amount);
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}
"""


def make_protocol_with_miners(n=2):
    """Protocol with N miners ready."""
    protocol = MarketplaceProtocol(
        config=ProtocolConfig(min_stake_amount=100),
        dry_run=True,
    )
    for i in range(n):
        protocol.register_miner(
            miner_id=f"0.0.{1000 + i}",
            subnet_ids=[1],
            stake=500.0,
            capabilities=["code_review"],
        )
    return protocol


# ══════════════════════════════════════════════════════════════════════
# REQUESTER FLOW TESTS
# ══════════════════════════════════════════════════════════════════════

def test_requester_submit_task():
    """Requester can submit a task, task enters pending state."""
    protocol = make_protocol_with_miners(2)

    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={"code": SAMPLE_CODE, "language": "solidity"},
        reward_amount=50.0,
        requester_id="0.0.9999",
        max_miners=2,
    )

    assert task.task_id is not None
    assert task.status in (TaskStatus.PENDING, TaskStatus.MATCHING)
    assert task.reward_amount == 50.0
    assert task.requester_id == "0.0.9999"


def test_requester_full_flow():
    """Full requester lifecycle: submit → match → results → validate → payment."""
    protocol = make_protocol_with_miners(1)

    # 1. Submit
    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={"code": SAMPLE_CODE, "language": "solidity"},
        reward_amount=50.0,
        requester_id="0.0.9999",
        max_miners=1,
    )

    # 2. Match
    assignments = protocol.match_task(task.task_id)
    assert len(assignments) == 1

    # 3. Miner submits result
    protocol.submit_result(
        task_id=task.task_id,
        miner_id=assignments[0].miner_id,
        output={"analysis": "Code looks good", "score": 0.9},
        execution_time=3.5,
    )

    # 4. Validate and pay
    validation = protocol.validate_and_pay(task.task_id)
    assert validation.is_valid
    assert validation.winner_miner_id == "0.0.1000"

    # 5. Check task status
    updated = protocol.task_manager.get_task(task.task_id)
    assert updated.status == TaskStatus.COMPLETED

    # 6. Check payment
    payment = protocol.task_manager.get_payment(task.task_id)
    assert payment is not None
    assert payment.amount > 0
    assert payment.is_paid


def test_requester_get_task_detail():
    """get_task_detail returns comprehensive info for requester."""
    protocol = make_protocol_with_miners(1)

    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={"code": SAMPLE_CODE, "language": "solidity"},
        reward_amount=50.0,
        requester_id="0.0.9999",
        max_miners=1,
    )
    protocol.match_task(task.task_id)
    protocol.submit_result(
        task_id=task.task_id,
        miner_id="0.0.1000",
        output={"analysis": "secure", "score": 0.85},
        execution_time=2.0,
    )
    protocol.validate_and_pay(task.task_id)

    detail = protocol.get_task_detail(task.task_id)

    assert detail["task_id"] == task.task_id
    assert detail["status"] == "completed"
    assert detail["requester_id"] == "0.0.9999"
    assert len(detail["assignments"]) == 1
    assert len(detail["results"]) == 1
    assert detail["results"][0]["output"]["analysis"] == "secure"
    assert detail["validation"]["is_valid"] is True
    assert detail["validation"]["winner_miner_id"] == "0.0.1000"
    assert detail["payment"]["amount"] > 0
    assert detail["fee_breakdown"] is not None


def test_requester_get_task_detail_not_found():
    """get_task_detail returns empty dict for unknown task."""
    protocol = make_protocol_with_miners(0)
    assert protocol.get_task_detail("nonexistent") == {}


def test_requester_task_with_fee_breakdown():
    """Fee breakdown is correctly calculated in task detail."""
    protocol = make_protocol_with_miners(1)

    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={"code": SAMPLE_CODE, "language": "solidity"},
        reward_amount=100.0,
        requester_id="0.0.9999",
        max_miners=1,
    )

    detail = protocol.get_task_detail(task.task_id)
    fb = detail["fee_breakdown"]
    assert fb is not None
    assert fb["reward_amount"] > 0
    assert fb["protocol_fee"] >= 0
    assert fb["subnet_fee"] >= 0


# ══════════════════════════════════════════════════════════════════════
# SUBNET OWNER TESTS
# ══════════════════════════════════════════════════════════════════════

def test_subnet_default_subnets():
    """SubnetManager has 2 default subnets."""
    manager = SubnetManager()
    subnets = manager.list_subnets()
    assert len(subnets) == 2
    assert subnets[0].name == "General AI"
    assert subnets[1].name == "AI Code Review"


def test_subnet_create():
    """Creating a new subnet returns valid SubnetInfo."""
    manager = SubnetManager()

    subnet = manager.create_subnet(
        name="NLP Translation",
        owner_id="0.0.5555",
        task_type="translation",
        fee_rate=0.04,
        min_stake=200.0,
        max_miners=50,
    )

    assert subnet.subnet_id == 2  # 0 and 1 are defaults
    assert subnet.name == "NLP Translation"
    assert subnet.owner_id == "0.0.5555"
    assert subnet.fee_rate == 0.04
    assert subnet.min_stake == 200.0
    assert subnet.max_miners == 50
    assert subnet.is_active


def test_subnet_create_invalid_fee():
    """Creating subnet with invalid fee rate raises ValueError."""
    manager = SubnetManager()
    with pytest.raises(ValueError, match="Fee rate"):
        manager.create_subnet(
            name="Bad",
            owner_id="0.0.1",
            task_type="x",
            fee_rate=0.50,  # too high
        )


def test_subnet_get_by_id():
    """Get subnet by ID."""
    manager = SubnetManager()
    subnet = manager.get_subnet(1)
    assert subnet is not None
    assert subnet.name == "AI Code Review"

    assert manager.get_subnet(999) is None


def test_subnet_deactivate():
    """Deactivating a subnet removes it from active list."""
    manager = SubnetManager()
    manager.deactivate_subnet(0)

    active = manager.list_subnets(active_only=True)
    all_subnets = manager.list_subnets(active_only=False)

    assert len(active) == 1  # only subnet 1 is active
    assert len(all_subnets) == 2  # both exist


def test_subnet_update_metrics():
    """Updating metrics tracks tasks and volume."""
    manager = SubnetManager()
    manager.update_metrics(1, tasks_delta=5, volume_delta=250.0, miners_count=3)

    subnet = manager.get_subnet(1)
    assert subnet.total_tasks == 5
    assert subnet.total_volume == 250.0
    assert subnet.active_miners == 3


def test_subnet_fee_rate():
    """get_fee_rate returns correct rate or default."""
    manager = SubnetManager()
    assert manager.get_fee_rate(1) == 0.03  # AI Code Review
    assert manager.get_fee_rate(0) == 0.05  # General AI
    assert manager.get_fee_rate(999) == 0.05  # default


def test_subnet_stats():
    """get_stats returns aggregated info."""
    manager = SubnetManager()
    stats = manager.get_stats()
    assert stats["total_subnets"] >= 2
    assert stats["active_subnets"] >= 1
    assert "subnets" in stats


def test_subnet_to_dict():
    """SubnetInfo.to_dict serializes correctly."""
    manager = SubnetManager()
    subnet = manager.get_subnet(1)
    d = subnet.to_dict()
    assert d["subnet_id"] == 1
    assert d["name"] == "AI Code Review"
    assert d["fee_rate"] == 0.03
    assert "scoring_dimensions" in d
