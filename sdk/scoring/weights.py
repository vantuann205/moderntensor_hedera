"""
ModernTensor Dynamic Weight Calculator

Calculates miner weights for reward distribution and task matching.
Combines multiple signals:
- Historical performance (EMA of scores)
- Stake amount (with diminishing returns via bonding curve)
- Uptime and reliability
- Anti-sybil cap to prevent dominance

The weight matrix is recalculated periodically (each "epoch") and
determines how much influence each miner has in the network.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class WeightMatrix:
    """
    Weight matrix for all miners in a subnet.

    Contains normalized weights that sum to 1.0.
    """
    weights: Dict[str, float] = field(default_factory=dict)
    raw_weights: Dict[str, float] = field(default_factory=dict)
    epoch: int = 0
    subnet_id: int = 0

    @property
    def total_weight(self) -> float:
        return sum(self.weights.values())

    def get_weight(self, miner_id: str) -> float:
        return self.weights.get(miner_id, 0.0)

    def top_miners(self, n: int = 10) -> List[Tuple[str, float]]:
        """Get top N miners by weight."""
        sorted_miners = sorted(
            self.weights.items(), key=lambda x: x[1], reverse=True
        )
        return sorted_miners[:n]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "weights": {k: round(v, 6) for k, v in self.weights.items()},
            "epoch": self.epoch,
            "subnet_id": self.subnet_id,
            "total_weight": round(self.total_weight, 6),
            "num_miners": len(self.weights),
        }


class WeightCalculator:
    """
    Calculates dynamic weights for miners.

    Weight formula:
        raw_weight = performance_weight * stake_weight * reliability_weight
        final_weight = min(raw_weight, weight_cap)  # Anti-sybil
        normalized = final_weight / sum(all_final_weights)

    Components:
        performance_weight = EMA score ^ performance_exponent
        stake_weight = bonding_curve(stake_amount)
        reliability_weight = success_rate * (1 - timeout_penalty)

    Bonding curve (diminishing returns):
        f(stake) = sqrt(stake / min_stake)
        This means 4x stake only gives 2x weight

    Example:
        calc = WeightCalculator(min_stake=100, weight_cap=0.15)
        matrix = calc.calculate(miners, epoch=1)
        print(matrix.top_miners(5))
    """

    def __init__(
        self,
        min_stake: float = 100.0,
        weight_cap: float = 0.15,
        performance_exponent: float = 2.0,
        timeout_penalty: float = 0.5,
        new_miner_bonus: float = 0.5,
    ):
        """
        Args:
            min_stake: Minimum stake for weight calculation
            weight_cap: Maximum weight any single miner can have (anti-sybil)
            performance_exponent: How aggressively to reward/penalize performance
            timeout_penalty: Penalty multiplier for each timeout
            new_miner_bonus: Bonus weight for new miners (< 5 tasks)
        """
        self.min_stake = min_stake
        self.weight_cap = weight_cap
        self.performance_exponent = performance_exponent
        self.timeout_penalty = timeout_penalty
        self.new_miner_bonus = new_miner_bonus
        self._epoch = 0
        logger.info(
            "WeightCalculator initialized — cap=%.2f, exp=%.1f",
            weight_cap,
            performance_exponent,
        )

    def calculate(
        self,
        miners: List[Dict[str, Any]],
        epoch: Optional[int] = None,
        subnet_id: int = 0,
    ) -> WeightMatrix:
        """
        Calculate weight matrix for a set of miners.

        Args:
            miners: List of miner dicts with keys:
                    miner_id, reputation_score, stake_amount,
                    success_rate, timeout_rate, total_tasks
            epoch: Current epoch number
            subnet_id: Subnet these miners belong to

        Returns:
            WeightMatrix with normalized weights
        """
        if epoch is not None:
            self._epoch = epoch
        else:
            self._epoch += 1

        raw_weights: Dict[str, float] = {}

        for miner in miners:
            miner_id = miner["miner_id"]
            raw = self._compute_raw_weight(miner)
            # Apply anti-sybil cap
            capped = min(raw, self.weight_cap * (len(miners) or 1))
            raw_weights[miner_id] = capped

        # Normalize to sum = 1.0
        total = sum(raw_weights.values())
        if total > 0:
            normalized = {
                mid: w / total for mid, w in raw_weights.items()
            }
        else:
            # Equal weights if all are zero
            n = len(miners)
            normalized = {
                m["miner_id"]: 1.0 / n for m in miners
            } if n > 0 else {}

        # Apply weight cap after normalization
        normalized = self._enforce_cap(normalized)

        matrix = WeightMatrix(
            weights=normalized,
            raw_weights=raw_weights,
            epoch=self._epoch,
            subnet_id=subnet_id,
        )

        logger.info(
            "Weights calculated for epoch %d: %d miners, top=%s",
            self._epoch,
            len(miners),
            matrix.top_miners(3),
        )
        return matrix

    def _compute_raw_weight(self, miner: Dict[str, Any]) -> float:
        """
        Compute raw weight for a single miner.

        Components:
        1. Performance: EMA score raised to exponent
        2. Stake: Bonding curve (sqrt for diminishing returns)
        3. Reliability: Success rate with timeout penalty
        """
        # Performance weight
        rep_score = miner.get("reputation_score", 0.5)
        performance = rep_score ** self.performance_exponent

        # Stake weight (bonding curve — diminishing returns)
        stake = max(miner.get("stake_amount", 0), 0)
        if stake >= self.min_stake:
            stake_weight = math.sqrt(stake / self.min_stake)
        else:
            stake_weight = stake / self.min_stake  # Linear below minimum

        # Reliability weight
        success_rate = miner.get("success_rate", 0.5)
        timeout_rate = miner.get("timeout_rate", 0.0)
        reliability = success_rate * (1.0 - timeout_rate * self.timeout_penalty)
        reliability = max(0.01, reliability)  # Floor

        # New miner bonus (give new miners a fair chance)
        total_tasks = miner.get("total_tasks", 0)
        if total_tasks < 5:
            new_bonus = self.new_miner_bonus
        else:
            new_bonus = 0.0

        raw_weight = performance * stake_weight * reliability + new_bonus

        return max(0.0, raw_weight)

    def _enforce_cap(self, weights: Dict[str, float]) -> Dict[str, float]:
        """
        Enforce weight cap to prevent any single miner from dominating.

        If any miner exceeds the cap, redistribute excess to others.
        """
        iterations = 0
        max_iterations = 10

        while iterations < max_iterations:
            over_cap = {
                mid: w for mid, w in weights.items()
                if w > self.weight_cap
            }
            if not over_cap:
                break

            # Cap overweight miners
            excess = 0.0
            under_cap = {}
            for mid, w in weights.items():
                if w > self.weight_cap:
                    excess += w - self.weight_cap
                    weights[mid] = self.weight_cap
                else:
                    under_cap[mid] = w

            # Redistribute excess proportionally to under-cap miners
            if under_cap:
                total_under = sum(under_cap.values())
                if total_under > 0:
                    for mid in under_cap:
                        share = (under_cap[mid] / total_under) * excess
                        weights[mid] += share

            iterations += 1

        if iterations >= max_iterations:
            logger.warning(
                "Weight cap enforcement did not converge in %d iterations; "
                "weights may not sum exactly to 1.0",
                max_iterations,
            )

        # Renormalize
        total = sum(weights.values())
        if total > 0 and abs(total - 1.0) > 0.001:
            weights = {mid: w / total for mid, w in weights.items()}

        return weights

    def get_miner_weight_breakdown(
        self,
        miner: Dict[str, Any],
    ) -> Dict[str, float]:
        """Get detailed weight breakdown for a single miner (debugging)."""
        rep_score = miner.get("reputation_score", 0.5)
        stake = max(miner.get("stake_amount", 0), 0)
        success_rate = miner.get("success_rate", 0.5)
        timeout_rate = miner.get("timeout_rate", 0.0)
        total_tasks = miner.get("total_tasks", 0)

        performance = rep_score ** self.performance_exponent
        stake_weight = (
            math.sqrt(stake / self.min_stake)
            if stake >= self.min_stake
            else stake / self.min_stake
        )
        reliability = success_rate * (1.0 - timeout_rate * self.timeout_penalty)
        new_bonus = self.new_miner_bonus if total_tasks < 5 else 0.0

        return {
            "reputation_score": round(rep_score, 4),
            "performance_weight": round(performance, 4),
            "stake_weight": round(stake_weight, 4),
            "reliability_weight": round(max(0.01, reliability), 4),
            "new_miner_bonus": round(new_bonus, 4),
            "raw_weight": round(
                performance * stake_weight * max(0.01, reliability) + new_bonus,
                4,
            ),
        }
