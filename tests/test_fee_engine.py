#!/usr/bin/env python3
"""
Tests for the FeeEngine module.

Verifies:
- 5% protocol fee + 15% validator reward (80/15/5 split)
- Subnet fee calculation (0-20%)
- Miner reward = remainder after all fees
- Priority multipliers
- Dynamic fee capping at 2.0x
- Input validation (negative amounts, out-of-range rates)
- Miner reward distribution proportional to scores
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sdk.protocol.types import ProtocolConfig, TaskPriority
from sdk.protocol.fee_engine import FeeEngine


def test_basic_fee_calculation():
    """5% protocol + 15% validator + 3% subnet = 23% total, miner gets 77%."""
    config = ProtocolConfig(protocol_fee_rate=0.05, validator_reward_rate=0.15)
    engine = FeeEngine(config=config)

    breakdown = engine.calculate(
        reward_amount=100.0,
        subnet_fee_rate=0.03,
    )

    assert abs(breakdown.protocol_fee - 5.0) < 1e-6, f"Protocol fee: {breakdown.protocol_fee}"
    assert abs(breakdown.validator_reward - 15.0) < 1e-6, f"Validator reward: {breakdown.validator_reward}"
    assert abs(breakdown.subnet_fee - 3.0) < 1e-6, f"Subnet fee: {breakdown.subnet_fee}"
    assert abs(breakdown.miner_reward - 77.0) < 1e-6, f"Miner reward: {breakdown.miner_reward}"
    assert abs(breakdown.total_fee - 23.0) < 1e-6, f"Total fee: {breakdown.total_fee}"
    assert breakdown.protocol_fee_rate == 0.05
    assert breakdown.validator_reward_rate == 0.15
    assert breakdown.subnet_fee_rate == 0.03


def test_zero_subnet_fee():
    """Subnet fee = 0: 5% protocol + 15% validator, miner gets 80%."""
    engine = FeeEngine(config=ProtocolConfig())
    breakdown = engine.calculate(reward_amount=200.0, subnet_fee_rate=0.0)

    assert abs(breakdown.protocol_fee - 10.0) < 1e-6
    assert abs(breakdown.validator_reward - 30.0) < 1e-6
    assert abs(breakdown.subnet_fee - 0.0) < 1e-6
    assert abs(breakdown.miner_reward - 160.0) < 1e-6


def test_max_subnet_fee():
    """Max subnet fee = 20%: 5% protocol + 15% validator + 20% subnet."""
    engine = FeeEngine(config=ProtocolConfig())
    breakdown = engine.calculate(reward_amount=100.0, subnet_fee_rate=0.20)

    assert abs(breakdown.protocol_fee - 5.0) < 1e-6
    assert abs(breakdown.validator_reward - 15.0) < 1e-6
    assert abs(breakdown.subnet_fee - 20.0) < 1e-6
    assert abs(breakdown.miner_reward - 60.0) < 1e-6


def test_priority_multiplier():
    """High priority (1.5x) increases effective reward."""
    engine = FeeEngine(config=ProtocolConfig())
    breakdown = engine.calculate(
        reward_amount=100.0,
        subnet_fee_rate=0.03,
        priority=TaskPriority.HIGH,
    )

    # Effective reward = 100 * 1.5 = 150
    assert abs(breakdown.reward_amount - 150.0) < 1e-6
    assert abs(breakdown.protocol_fee - 7.5) < 1e-6  # 5% of 150
    assert abs(breakdown.validator_reward - 22.5) < 1e-6  # 15% of 150
    assert abs(breakdown.subnet_fee - 4.5) < 1e-6  # 3% of 150
    assert abs(breakdown.miner_reward - 115.5) < 1e-6  # 150 - 7.5 - 22.5 - 4.5


def test_invalid_negative_reward():
    """Negative reward should raise ValueError."""
    engine = FeeEngine(config=ProtocolConfig())
    try:
        engine.calculate(reward_amount=-10.0, subnet_fee_rate=0.03)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass


def test_invalid_subnet_fee_rate():
    """Subnet fee > 20% should raise ValueError."""
    engine = FeeEngine(config=ProtocolConfig())
    try:
        engine.calculate(reward_amount=100.0, subnet_fee_rate=0.25)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass


def test_miner_reward_distribution():
    """Rewards distributed proportional to scores."""
    engine = FeeEngine(config=ProtocolConfig())
    scores = {"miner_a": 0.9, "miner_b": 0.6, "miner_c": 0.3}
    rewards = engine.distribute_miner_rewards(80.0, scores)

    assert len(rewards) == 3
    total = sum(rewards.values())
    assert abs(total - 80.0) < 0.01, f"Total rewards: {total}"
    assert rewards["miner_a"] > rewards["miner_b"] > rewards["miner_c"]


def test_fee_breakdown_to_dict():
    """FeeBreakdown.to_dict() includes all fields including validator_reward."""
    engine = FeeEngine(config=ProtocolConfig())
    breakdown = engine.calculate(reward_amount=100.0, subnet_fee_rate=0.05)
    d = breakdown.to_dict()

    assert "reward_amount" in d
    assert "protocol_fee" in d
    assert "subnet_fee" in d
    assert "validator_reward" in d
    assert "miner_reward" in d
    assert "total_fee" in d
    assert "total_deposit" in d
    assert "protocol_fee_rate" in d
    assert "subnet_fee_rate" in d
    assert "validator_reward_rate" in d
    assert "subnet_owner_id" in d
    assert "total_fee_rate" in d


def test_dynamic_fee_capped():
    """Dynamic fees should be capped at 2.0x multiplier."""
    engine = FeeEngine(
        config=ProtocolConfig(),
        enable_dynamic_fees=True,
    )
    # Even under extreme load, fees should not exceed 2x
    for _ in range(1000):
        engine.network_load.record_task()

    breakdown = engine.calculate(reward_amount=100.0, subnet_fee_rate=0.03)
    # Protocol fee should be at most 10.0 (5% * 2x cap)
    assert breakdown.protocol_fee <= 10.0 + 1e-6, f"Dynamic fee too high: {breakdown.protocol_fee}"


def test_total_deposit_matches():
    """total_deposit = miner + validator + protocol + subnet."""
    engine = FeeEngine(config=ProtocolConfig())
    breakdown = engine.calculate(reward_amount=100.0, subnet_fee_rate=0.05)

    expected = (
        breakdown.miner_reward
        + breakdown.validator_reward
        + breakdown.protocol_fee
        + breakdown.subnet_fee
    )
    assert abs(breakdown.total_deposit - expected) < 1e-6
    assert abs(breakdown.total_deposit - 100.0) < 1e-6  # Should equal input
