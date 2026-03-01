"""
ModernTensor Fee Engine

Handles all fee calculations for the marketplace protocol:
- Protocol fee (5% of all volume → DAO treasury)
- Subnet fee (0-20%, set by subnet owner)
- Priority multipliers
- Dynamic fee adjustment based on network congestion
- Miner reward distribution
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .types import FeeBreakdown, ProtocolConfig, TaskPriority, TaskRequest

logger = logging.getLogger(__name__)


@dataclass
class NetworkLoad:
    """Tracks network load for dynamic fee adjustment."""
    tasks_last_minute: int = 0
    tasks_last_hour: int = 0
    capacity_utilization: float = 0.0  # 0.0 to 1.0
    _task_timestamps: List[float] = field(default_factory=list)

    def record_task(self) -> None:
        """Record a new task submission."""
        now = time.time()
        self._task_timestamps.append(now)
        # Prune old timestamps (keep last hour)
        cutoff = now - 3600
        self._task_timestamps = [t for t in self._task_timestamps if t > cutoff]
        self._update_metrics()

    def _update_metrics(self) -> None:
        now = time.time()
        minute_cutoff = now - 60
        self.tasks_last_minute = sum(
            1 for t in self._task_timestamps if t > minute_cutoff
        )
        self.tasks_last_hour = len(self._task_timestamps)
        # Assume capacity of 100 tasks/min for utilization calculation
        self.capacity_utilization = min(1.0, self.tasks_last_minute / 100.0)


class FeeEngine:
    """
    Fee calculation engine for the ModernTensor marketplace.

    Fee Structure (matches PaymentEscrow.sol):
        protocol_fee     = reward * 5%   → DAO treasury
        validator_reward  = reward * 15%  → Validator pool
        subnet_fee       = reward * 0-20% → Subnet owner
        miner_reward     = reward - protocol_fee - validator_reward - subnet_fee

    Priority multipliers adjust the effective reward:
        LOW:    0.8x
        NORMAL: 1.0x
        HIGH:   1.5x
        URGENT: 2.0x

    Dynamic adjustment (optional):
        When network utilization > 70%, fees scale linearly up to 2.0x
        at 100% utilization.  Maximum total fee is capped to protect miners.

    Example:
        engine = FeeEngine(config)
        breakdown = engine.calculate(
            reward_amount=100.0,
            subnet_fee_rate=0.03,
            priority=TaskPriority.NORMAL,
        )
        # breakdown.protocol_fee     = 5.0
        # breakdown.validator_reward = 15.0
        # breakdown.subnet_fee       = 3.0
        # breakdown.miner_reward     = 77.0
    """

    def __init__(
        self,
        config: Optional[ProtocolConfig] = None,
        enable_dynamic_fees: bool = False,
    ):
        self.config = config or ProtocolConfig()
        self.enable_dynamic_fees = enable_dynamic_fees
        self.network_load = NetworkLoad()
        self._total_fees_collected = 0.0
        self._total_volume = 0.0
        logger.info(
            "FeeEngine initialized — protocol_fee=%.1f%%, dynamic=%s",
            self.config.protocol_fee_rate * 100,
            enable_dynamic_fees,
        )

    def calculate(
        self,
        reward_amount: float,
        subnet_fee_rate: float,
        priority: TaskPriority = TaskPriority.NORMAL,
    ) -> FeeBreakdown:
        """
        Calculate all fees for a task.

        On-chain split (matches PaymentEscrow.sol):
            - 80% → Miner reward
            - 15% → Validator reward pool
            -  5% → Protocol treasury
            - Subnet fee is additional (set by subnet owner)

        Args:
            reward_amount: Base reward offered by the task submitter
            subnet_fee_rate: Fee rate set by the subnet owner (0 to 0.20)
            priority: Task priority level

        Returns:
            FeeBreakdown with all fee components

        Raises:
            ValueError: If fee rates are out of bounds
        """
        self._validate_inputs(reward_amount, subnet_fee_rate)

        # Apply priority multiplier to effective reward
        effective_reward = reward_amount * priority.multiplier

        # Calculate protocol fee (5% of effective reward)
        protocol_fee_rate = self.config.protocol_fee_rate
        protocol_fee = effective_reward * protocol_fee_rate

        # Calculate validator reward (15% of effective reward)
        validator_reward_rate = self.config.validator_reward_rate
        validator_reward = effective_reward * validator_reward_rate

        # Calculate subnet fee (additional, on top)
        subnet_fee = effective_reward * subnet_fee_rate

        # Apply dynamic fee adjustment if enabled
        if self.enable_dynamic_fees:
            dynamic_multiplier = self._get_dynamic_multiplier()
            protocol_fee *= dynamic_multiplier
            subnet_fee *= dynamic_multiplier

        # Miner gets the remainder (80% base minus subnet fee)
        miner_reward = effective_reward - protocol_fee - validator_reward - subnet_fee

        # Record metrics
        self.network_load.record_task()
        self._total_volume += effective_reward

        breakdown = FeeBreakdown(
            reward_amount=effective_reward,
            protocol_fee=round(protocol_fee, 6),
            subnet_fee=round(subnet_fee, 6),
            miner_reward=round(miner_reward, 6),
            protocol_fee_rate=protocol_fee_rate,
            subnet_fee_rate=subnet_fee_rate,
            validator_reward=round(validator_reward, 6),
            validator_reward_rate=validator_reward_rate,
        )

        logger.debug(
            "Fee calculated: reward=%.4f, protocol=%.4f, validator=%.4f, "
            "subnet=%.4f, miner=%.4f",
            effective_reward,
            protocol_fee,
            validator_reward,
            subnet_fee,
            miner_reward,
        )
        return breakdown

    def calculate_for_task(
        self,
        task: TaskRequest,
        subnet_fee_rate: float,
    ) -> FeeBreakdown:
        """Calculate fees for a TaskRequest object."""
        return self.calculate(
            reward_amount=task.reward_amount,
            subnet_fee_rate=subnet_fee_rate,
            priority=task.priority,
        )

    def distribute_miner_rewards(
        self,
        total_miner_reward: float,
        miner_scores: Dict[str, float],
    ) -> Dict[str, float]:
        """
        Distribute miner rewards proportional to their scores.

        Args:
            total_miner_reward: Total reward pool for miners
            miner_scores: Mapping of miner_id → normalized score (0-1)

        Returns:
            Mapping of miner_id → reward amount

        Example:
            rewards = engine.distribute_miner_rewards(
                total_miner_reward=94.0,
                miner_scores={
                    "miner_A": 0.9,
                    "miner_B": 0.7,
                    "miner_C": 0.4,
                },
            )
            # miner_A gets 42.3, miner_B gets 32.9, miner_C gets 18.8
        """
        if not miner_scores:
            return {}

        total_score = sum(miner_scores.values())
        if total_score == 0:
            # Equal distribution if all scores are zero
            equal_share = total_miner_reward / len(miner_scores)
            return {m: round(equal_share, 6) for m in miner_scores}

        rewards = {}
        for miner_id, score in miner_scores.items():
            share = (score / total_score) * total_miner_reward
            rewards[miner_id] = round(share, 6)

        # Adjust for rounding errors
        total_distributed = sum(rewards.values())
        if abs(total_distributed - total_miner_reward) > 0.000001:
            # Add the rounding difference to the top scorer
            top_miner = max(miner_scores, key=miner_scores.get)
            rewards[top_miner] += round(total_miner_reward - total_distributed, 6)

        self._total_fees_collected += (
            total_miner_reward
            * (self.config.protocol_fee_rate / (1 - self.config.protocol_fee_rate))
        )

        return rewards

    def _get_dynamic_multiplier(self) -> float:
        """
        Calculate dynamic fee multiplier based on network load.

        When utilization > 70%, fees increase linearly up to 2.0x at 100%.
        Capped to prevent excessive fee inflation.
        """
        util = self.network_load.capacity_utilization
        if util <= 0.7:
            return 1.0
        # Linear from 1.0x at 70% to 2.0x at 100%, capped at 2.0x
        multiplier = 1.0 + ((util - 0.7) / 0.3) * 1.0
        return min(2.0, multiplier)

    def _validate_inputs(
        self,
        reward_amount: float,
        subnet_fee_rate: float,
    ) -> None:
        """Validate fee calculation inputs."""
        if reward_amount <= 0:
            raise ValueError(f"reward_amount must be positive, got {reward_amount}")
        if subnet_fee_rate < self.config.min_subnet_fee_rate:
            raise ValueError(
                f"subnet_fee_rate {subnet_fee_rate} below minimum "
                f"{self.config.min_subnet_fee_rate}"
            )
        if subnet_fee_rate > self.config.max_subnet_fee_rate:
            raise ValueError(
                f"subnet_fee_rate {subnet_fee_rate} above maximum "
                f"{self.config.max_subnet_fee_rate}"
            )

    def get_metrics(self) -> Dict[str, float]:
        """Get fee engine metrics."""
        return {
            "total_volume": round(self._total_volume, 4),
            "total_fees_collected": round(self._total_fees_collected, 4),
            "protocol_fee_rate": self.config.protocol_fee_rate,
            "tasks_last_minute": self.network_load.tasks_last_minute,
            "tasks_last_hour": self.network_load.tasks_last_hour,
            "capacity_utilization": round(
                self.network_load.capacity_utilization, 4
            ),
            "dynamic_multiplier": (
                round(self._get_dynamic_multiplier(), 4)
                if self.enable_dynamic_fees
                else 1.0
            ),
        }
