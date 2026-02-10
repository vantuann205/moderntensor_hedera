"""
Tests for MinerWorker and per-miner task queries.

Covers the full miner lifecycle:
    Register → Match → Worker polls → Handler runs → Submit → Validate → Pay
"""

import time
from unittest.mock import MagicMock

import pytest

from sdk.protocol.types import ProtocolConfig, TaskStatus
from sdk.marketplace.orchestrator import MarketplaceProtocol
from sdk.protocol.miner_worker import MinerWorker


# ── Helpers ──────────────────────────────────────────────────────────

def make_protocol(n_miners=3):
    """Create a protocol with N pre-registered miners."""
    protocol = MarketplaceProtocol(
        config=ProtocolConfig(min_stake_amount=100),
        dry_run=True,
    )
    for i in range(n_miners):
        protocol.register_miner(
            miner_id=f"0.0.{1000 + i}",
            subnet_ids=[1],
            stake=500.0,
            capabilities=["code_review"],
        )
    return protocol


def dummy_handler(payload, task_type):
    """Simple handler that returns a deterministic result."""
    return {
        "analysis": f"Reviewed {task_type}",
        "findings": ["test-finding"],
        "score": 0.85,
    }


SAMPLE_CODE = """
pragma solidity ^0.8.0;
contract Vault {
    mapping(address => uint) public balances;
    function deposit() public payable { balances[msg.sender] += msg.value; }
    function withdraw(uint amount) public {
        require(balances[msg.sender] >= amount);
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
}
"""


# ── Tests: Per-miner queries ────────────────────────────────────────

def test_get_assignments_for_miner_empty():
    """Miner with no assignments returns empty list."""
    protocol = make_protocol(1)
    result = protocol.task_manager.get_assignments_for_miner("0.0.1000")
    assert result == []


def test_get_assignments_for_miner_after_match():
    """After task is matched, miner should see its assignment."""
    protocol = make_protocol(3)

    # Submit and match a task
    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={"code": SAMPLE_CODE, "language": "solidity"},
        reward_amount=50.0,
        requester_id="0.0.9999",
        max_miners=3,
    )
    protocol.match_task(task.task_id)

    # Each registered miner should have an assignment
    for i in range(3):
        assignments = protocol.task_manager.get_assignments_for_miner(
            f"0.0.{1000 + i}"
        )
        assert len(assignments) >= 1
        assert assignments[0].task_id == task.task_id


def test_get_miner_history_empty():
    """No completed tasks returns empty history."""
    protocol = make_protocol(1)
    history = protocol.task_manager.get_miner_history("0.0.1000")
    assert history == []


def test_get_miner_earnings():
    """Earnings for a miner with no completed tasks."""
    protocol = make_protocol(1)
    earnings = protocol.get_miner_earnings("0.0.1000")
    assert earnings["total_earned"] == 0.0
    assert earnings["tasks_completed"] == 0
    assert earnings["win_rate"] == 0.0


# ── Tests: MinerWorker ──────────────────────────────────────────────

def test_worker_init_requires_registered_miner():
    """Worker should refuse to init with unregistered miner."""
    protocol = MarketplaceProtocol(dry_run=True)
    with pytest.raises(ValueError, match="not registered"):
        MinerWorker(protocol, "0.0.9999", dummy_handler)


def test_worker_run_once_no_tasks():
    """Worker run_once returns 0 when no tasks assigned."""
    protocol = make_protocol(1)
    worker = MinerWorker(protocol, "0.0.1000", dummy_handler)
    assert worker.run_once() == 0


def test_worker_full_lifecycle():
    """Full lifecycle: submit → match → worker processes → validate."""
    protocol = make_protocol(1)

    # Create worker
    worker = MinerWorker(
        protocol=protocol,
        miner_id="0.0.1000",
        handler=dummy_handler,
        auto_validate=True,
    )

    # Submit a task
    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={"code": SAMPLE_CODE, "language": "solidity"},
        reward_amount=50.0,
        requester_id="0.0.9999",
        max_miners=1,
    )

    # Match task to miner
    assignments = protocol.match_task(task.task_id)
    assert len(assignments) == 1
    assert assignments[0].miner_id == "0.0.1000"

    # Worker polls and processes
    processed = worker.run_once()
    assert processed == 1

    # Task should be completed (auto_validate=True)
    updated_task = protocol.task_manager.get_task(task.task_id)
    assert updated_task.status == TaskStatus.COMPLETED

    # Worker stats should reflect the work
    stats = worker.get_stats()
    assert stats["tasks_processed"] == 1
    assert stats["errors"] == 0


def test_worker_handler_error():
    """Worker handles handler exceptions gracefully."""
    protocol = make_protocol(1)

    def failing_handler(payload, task_type):
        raise RuntimeError("AI model crashed")

    worker = MinerWorker(protocol, "0.0.1000", failing_handler)

    # Submit + match
    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={"code": SAMPLE_CODE, "language": "solidity"},
        reward_amount=50.0,
        requester_id="0.0.9999",
        max_miners=1,
    )
    protocol.match_task(task.task_id)

    # Worker should handle error gracefully
    processed = worker.run_once()
    assert processed == 0

    stats = worker.get_stats()
    assert stats["errors"] == 1


def test_worker_start_with_max_iterations():
    """Worker start() respects max_iterations."""
    protocol = make_protocol(1)
    worker = MinerWorker(protocol, "0.0.1000", dummy_handler)

    # start() with max_iterations=2 should stop after 2 iterations
    worker.start(poll_interval=0.01, max_iterations=2)
    # If we get here, it didn't hang — test passes


# ── Tests: Timeout penalty fix ──────────────────────────────────────

def test_timeout_penalty_in_successful_validation():
    """
    Timed-out miners should be penalized even when the overall
    task validation succeeds (other miners provided valid results).
    """
    protocol = make_protocol(2)

    # Submit + match
    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={"code": SAMPLE_CODE, "language": "solidity"},
        reward_amount=50.0,
        requester_id="0.0.9999",
        max_miners=2,
    )
    assignments = protocol.match_task(task.task_id)

    # Only one miner submits a result; the other times out
    submitting_miner = assignments[0].miner_id
    timeout_miner = assignments[1].miner_id

    protocol.submit_result(
        task_id=task.task_id,
        miner_id=submitting_miner,
        output={"analysis": "good code", "score": 0.9},
        execution_time=5.0,
    )

    # Mark the second assignment as timed out
    assignments[1].is_timeout = True

    # Get initial timeout count for the timed-out miner
    miner_info = protocol.get_miner(timeout_miner)
    initial_timeouts = miner_info.reputation.timeout_tasks

    # Validate (should succeed because one result is valid)
    validation = protocol.validate_and_pay(task.task_id)

    # The timed-out miner should have been penalized
    miner_info = protocol.get_miner(timeout_miner)
    assert miner_info.reputation.timeout_tasks > initial_timeouts
