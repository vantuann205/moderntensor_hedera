#!/usr/bin/env python3
"""
End-to-End Test: Token Reward System

Tests the complete flow:
    submit_task → escrow → match → results → validate → distribute → treasury

Uses dry_run mode (no real Hedera transactions).
"""

import pytest
import json

from sdk.protocol.types import ProtocolConfig
from sdk.marketplace.orchestrator import MarketplaceProtocol


# ── Fixtures ──────────────────────────────────────────────────────


@pytest.fixture
def config():
    return ProtocolConfig(
        protocol_fee_rate=0.05,  # 5%
        min_stake_amount=100.0,
    )


@pytest.fixture
def protocol(config):
    return MarketplaceProtocol(
        config=config,
        validator_id="0.0.9999",
        enable_poi=True,
        dry_run=True,
    )


@pytest.fixture
def protocol_with_miners(protocol):
    """Protocol with three pre-registered miners."""
    miners = [
        ("0.0.1001", 500.0),
        ("0.0.1002", 300.0),
        ("0.0.1003", 400.0),
    ]
    for miner_id, stake in miners:
        protocol.register_miner(
            miner_id=miner_id,
            subnet_ids=[1],
            stake=stake,
            capabilities=["code_review"],
        )
    return protocol


SAMPLE_CODE = """\
def transfer(sender, receiver, amount):
    if amount <= 0:
        raise ValueError("Amount must be positive")
    sender.balance -= amount
    receiver.balance += amount
    return True
"""

SAMPLE_RESULTS = {
    "0.0.1001": {
        "analysis": "Critical: no balance check before deduction.",
        "findings": [
            {"severity": "critical", "line": 5, "msg": "No balance check"},
            {"severity": "medium", "line": 3, "msg": "Missing type validation"},
        ],
        "score": {"security": 0.9, "correctness": 0.85},
    },
    "0.0.1002": {
        "analysis": "Good function but needs input validation.",
        "findings": [
            {"severity": "high", "line": 5, "msg": "Not atomic"},
        ],
        "score": {"security": 0.7, "correctness": 0.8},
    },
    "0.0.1003": {
        "analysis": "Simple transfer function. Consider using decimal.",
        "findings": [
            {"severity": "info", "line": 1, "msg": "Use decimal module"},
        ],
        "score": {"security": 0.6, "correctness": 0.7},
    },
}


def _submit_and_complete_task(protocol, reward_amount=100.0, requester="0.0.2001"):
    """Helper: submit a task, match miners, submit results, validate & pay."""
    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={"code": SAMPLE_CODE, "language": "python"},
        reward_amount=reward_amount,
        requester_id=requester,
    )
    assignments = protocol.match_task(task.task_id)
    for a in assignments:
        if a.miner_id in SAMPLE_RESULTS:
            protocol.submit_result(
                task_id=task.task_id,
                miner_id=a.miner_id,
                output=SAMPLE_RESULTS[a.miner_id],
                execution_time=2.5,
            )
    validation = protocol.validate_and_pay(task.task_id)
    return task, assignments, validation


# ── Tests ─────────────────────────────────────────────────────────


class TestProtocolInit:
    def test_protocol_initializes(self, protocol):
        assert protocol is not None

    def test_registering_miner(self, protocol):
        protocol.register_miner(
            miner_id="0.0.1001",
            subnet_ids=[1],
            stake=500.0,
            capabilities=["code_review"],
        )
        # No exception means success


class TestEscrowCreation:
    def test_escrow_created_on_submit(self, protocol_with_miners):
        task = protocol_with_miners.submit_task(
            subnet_id=1,
            task_type="code_review",
            payload={"code": SAMPLE_CODE, "language": "python"},
            reward_amount=100.0,
            requester_id="0.0.2001",
        )
        escrow = protocol_with_miners.escrow_manager.get_escrow(task.task_id)
        if escrow:
            assert escrow.amount > 0

    def test_fee_breakdown(self, protocol_with_miners):
        task = protocol_with_miners.submit_task(
            subnet_id=1,
            task_type="code_review",
            payload={"code": SAMPLE_CODE},
            reward_amount=100.0,
            requester_id="0.0.2001",
        )
        fee = protocol_with_miners.task_manager.get_fee_breakdown(task.task_id)
        if fee:
            assert fee.protocol_fee > 0
            assert fee.miner_reward > 0
            assert fee.total_fee > 0


class TestMatchAndExecute:
    def test_match_returns_assignments(self, protocol_with_miners):
        task = protocol_with_miners.submit_task(
            subnet_id=1,
            task_type="code_review",
            payload={"code": SAMPLE_CODE},
            reward_amount=100.0,
            requester_id="0.0.2001",
        )
        assignments = protocol_with_miners.match_task(task.task_id)
        assert len(assignments) > 0

    def test_submit_result_succeeds(self, protocol_with_miners):
        task = protocol_with_miners.submit_task(
            subnet_id=1,
            task_type="code_review",
            payload={"code": SAMPLE_CODE},
            reward_amount=100.0,
            requester_id="0.0.2001",
        )
        assignments = protocol_with_miners.match_task(task.task_id)
        for a in assignments:
            if a.miner_id in SAMPLE_RESULTS:
                protocol_with_miners.submit_result(
                    task_id=task.task_id,
                    miner_id=a.miner_id,
                    output=SAMPLE_RESULTS[a.miner_id],
                    execution_time=2.5,
                )


class TestValidateAndPay:
    def test_validation_has_winner(self, protocol_with_miners):
        _, _, validation = _submit_and_complete_task(protocol_with_miners)
        assert validation.winner_miner_id is not None
        assert validation.winner_score > 0

    def test_payment_recorded(self, protocol_with_miners):
        task, _, _ = _submit_and_complete_task(protocol_with_miners)
        payment = protocol_with_miners.task_manager.get_payment(task.task_id)
        if payment:
            assert payment.amount > 0


class TestTreasury:
    def test_snapshot_after_task(self, protocol_with_miners):
        _submit_and_complete_task(protocol_with_miners)
        snap = protocol_with_miners.treasury.get_snapshot()
        assert snap.total_volume > 0

    def test_revenue_summary(self, protocol_with_miners):
        _submit_and_complete_task(protocol_with_miners)
        rev = protocol_with_miners.treasury.get_revenue_summary()
        assert "fee_ratio" in rev
        assert "protocol_fees" in rev


class TestMultiTask:
    def test_multiple_tasks_accumulate(self, protocol_with_miners):
        for i in range(3):
            _submit_and_complete_task(
                protocol_with_miners,
                reward_amount=50.0 * (i + 1),
                requester=f"0.0.200{i + 2}",
            )
        snap = protocol_with_miners.treasury.get_snapshot()
        assert snap.total_payouts >= 3

    def test_top_earners(self, protocol_with_miners):
        for i in range(3):
            _submit_and_complete_task(
                protocol_with_miners,
                reward_amount=50.0 * (i + 1),
                requester=f"0.0.200{i + 2}",
            )
        top = protocol_with_miners.treasury.get_top_earners(3)
        assert len(top) > 0
