"""
ModernTensor Dynamic Weight Calculator

Calculates weights for miners and validators:
- Miners: weight = performance × reliability (MERIT-BASED, no stake)
- Validators: weight = stake × reliability (SKIN-IN-THE-GAME)

Miners earn incentive rewards based on quality of work.
Validators earn by staking + honest scoring.
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
    Calculates dynamic weights — merit-based for miners.

    Miner weight formula:
        raw = performance × reliability + new_miner_bonus
        performance = reputation_score ^ exponent
        reliability = success_rate × (1 - timeout_rate × penalty)

    Validators use a separate formula where stake matters:
        raw = sqrt(stake / min_stake) × reliability

    Anti-sybil: weight_cap prevents any single node from dominating.

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
            min_stake: Minimum stake for validator weight calculation
            weight_cap: Maximum weight any single node can have (anti-sybil)
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
        Calculate weight matrix for a set of miners (merit-based).

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
            raw = self._compute_miner_weight(miner)
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

    def calculate_validator_weights(
        self,
        validators: List[Dict[str, Any]],
        epoch: Optional[int] = None,
    ) -> WeightMatrix:
        """
        Calculate weight matrix for validators (stake + reliability).

        Validators need skin-in-the-game: their weight depends on both
        the amount staked and their reliability as honest scorers.

        Args:
            validators: List of validator dicts with keys:
                        validator_id, stake_amount, reliability_score,
                        total_validations, dishonesty_rate
        """
        if epoch is not None:
            self._epoch = epoch

        raw_weights: Dict[str, float] = {}

        for v in validators:
            vid = v["validator_id"]
            raw = self._compute_validator_weight(v)
            capped = min(raw, self.weight_cap * (len(validators) or 1))
            raw_weights[vid] = capped

        total = sum(raw_weights.values())
        if total > 0:
            normalized = {vid: w / total for vid, w in raw_weights.items()}
        else:
            n = len(validators)
            normalized = {v["validator_id"]: 1.0 / n for v in validators} if n > 0 else {}

        normalized = self._enforce_cap(normalized)

        return WeightMatrix(
            weights=normalized,
            raw_weights=raw_weights,
            epoch=self._epoch,
        )

    def _compute_miner_weight(self, miner: Dict[str, Any]) -> float:
        """
        Compute weight for a miner — MERIT-BASED ONLY.

        Miners earn weight through quality of work, NOT amount staked.
        Stake is only an "agent bond" (slash-able deposit for bad behavior).

        Formula: performance × reliability + new_miner_bonus
        """
        # Performance (quality of past outputs)
        rep_score = miner.get("reputation_score", 0.5)
        performance = rep_score ** self.performance_exponent

        # Reliability (consistency + uptime)
        success_rate = miner.get("success_rate", 0.5)
        timeout_rate = miner.get("timeout_rate", 0.0)
        reliability = success_rate * (1.0 - timeout_rate * self.timeout_penalty)
        reliability = max(0.01, reliability)  # Floor

        # New miner bonus (give newcomers a fair chance)
        total_tasks = miner.get("total_tasks", 0)
        new_bonus = self.new_miner_bonus if total_tasks < 5 else 0.0

        raw_weight = performance * reliability + new_bonus
        return max(0.0, raw_weight)

    def _compute_validator_weight(self, validator: Dict[str, Any]) -> float:
        """
        Compute weight for a validator — STAKE + RELIABILITY.

        Validators must have skin-in-the-game. Their influence in
        consensus is proportional to their stake and track record.

        Formula: sqrt(stake / min_stake) × reliability
        """
        stake = max(validator.get("stake_amount", 0), 0)
        if stake >= self.min_stake:
            stake_weight = math.sqrt(stake / self.min_stake)
        else:
            stake_weight = stake / self.min_stake  # Linear below minimum

        reliability = validator.get("reliability_score", 0.5)
        dishonesty = validator.get("dishonesty_rate", 0.0)
        reliability = reliability * (1.0 - dishonesty)
        reliability = max(0.01, reliability)

        return max(0.0, stake_weight * reliability)

    def _enforce_cap(self, weights: Dict[str, float]) -> Dict[str, float]:
        """
        Enforce weight cap to prevent any single node from dominating.

        If any node exceeds the cap, redistribute excess to others.
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

            excess = 0.0
            under_cap = {}
            for mid, w in weights.items():
                if w > self.weight_cap:
                    excess += w - self.weight_cap
                    weights[mid] = self.weight_cap
                else:
                    under_cap[mid] = w

            if under_cap:
                total_under = sum(under_cap.values())
                if total_under > 0:
                    for mid in under_cap:
                        share = (under_cap[mid] / total_under) * excess
                        weights[mid] += share

            iterations += 1

        if iterations >= max_iterations:
            logger.warning(
                "Weight cap enforcement did not converge in %d iterations",
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
        success_rate = miner.get("success_rate", 0.5)
        timeout_rate = miner.get("timeout_rate", 0.0)
        total_tasks = miner.get("total_tasks", 0)

        performance = rep_score ** self.performance_exponent
        reliability = success_rate * (1.0 - timeout_rate * self.timeout_penalty)
        new_bonus = self.new_miner_bonus if total_tasks < 5 else 0.0

        return {
            "reputation_score": round(rep_score, 4),
            "performance_weight": round(performance, 4),
            "reliability_weight": round(max(0.01, reliability), 4),
            "new_miner_bonus": round(new_bonus, 4),
            "raw_weight": round(
                performance * max(0.01, reliability) + new_bonus, 4,
            ),
        }
