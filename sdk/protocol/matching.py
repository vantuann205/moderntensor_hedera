"""
ModernTensor Task-to-Miner Matching

Assigns tasks to the most suitable miners based on:
- Reputation-weighted random selection (not purely deterministic)
- Subnet and capability filtering
- Load balancing across miners
- Anti-sybil protections
"""

from __future__ import annotations

import hashlib
import logging
import random
from typing import Dict, List, Optional

from .types import MinerInfo, TaskRequest

logger = logging.getLogger(__name__)


class TaskMatcher:
    """
    Task-to-miner matching engine.

    Uses reputation-weighted random selection to assign tasks to miners.
    This ensures that higher-reputation miners get more tasks, but does
    not completely exclude lower-reputation miners (giving them a chance
    to improve).

    Anti-sybil: Effective weight is capped per miner, preventing any
    single entity from dominating task assignment.

    Example:
        matcher = TaskMatcher(min_miners=2, max_miners=5)
        selected = matcher.match(
            task=task_request,
            available_miners=active_miners,
        )
    """

    def __init__(
        self,
        min_miners: int = 1,
        max_miners: int = 5,
        weight_cap: float = 10.0,
        seed: Optional[int] = None,
    ):
        """
        Args:
            min_miners: Minimum miners needed for a valid assignment
            max_miners: Maximum miners to assign per task
            weight_cap: Maximum effective weight per miner (anti-sybil)
            seed: Optional random seed for reproducibility
        """
        self.min_miners = min_miners
        self.max_miners = max_miners
        self.weight_cap = weight_cap
        self._rng = random.Random(seed)
        self._assignment_counts: Dict[str, int] = {}
        logger.info(
            "TaskMatcher initialized — min=%d, max=%d, weight_cap=%.1f",
            min_miners, max_miners, weight_cap,
        )

    def match(
        self,
        task: TaskRequest,
        available_miners: List[MinerInfo],
    ) -> List[MinerInfo]:
        """
        Match a task to suitable miners.

        Selection algorithm:
        1. Filter by subnet and capability
        2. Calculate effective weights (with cap)
        3. Apply load-balancing penalty
        4. Weighted random selection without replacement

        Args:
            task: The task to assign
            available_miners: Pool of available miners

        Returns:
            Selected miners for this task

        Raises:
            ValueError: If insufficient miners available
        """
        # Step 1: Filter eligible miners
        eligible = self._filter_eligible(task, available_miners)

        if len(eligible) < self.min_miners:
            raise ValueError(
                f"Need at least {self.min_miners} eligible miners, "
                f"only {len(eligible)} available for subnet {task.subnet_id}"
            )

        # Step 2: Determine how many miners to select
        num_to_select = min(
            task.max_miners,
            self.max_miners,
            len(eligible),
        )

        # Step 3: Calculate selection weights
        weights = self._calculate_weights(eligible)

        # Step 4: Weighted selection without replacement
        selected = self._weighted_sample(eligible, weights, num_to_select)

        # Record assignments for load balancing
        for miner in selected:
            self._assignment_counts[miner.miner_id] = (
                self._assignment_counts.get(miner.miner_id, 0) + 1
            )

        logger.info(
            "Matched task %s to %d miners: %s",
            task.task_id[:8],
            len(selected),
            [m.miner_id for m in selected],
        )
        return selected

    def _filter_eligible(
        self,
        task: TaskRequest,
        miners: List[MinerInfo],
    ) -> List[MinerInfo]:
        """Filter miners by subnet membership and capability."""
        eligible = []
        for miner in miners:
            # Must be active
            if not miner.is_active:
                continue
            # Must be in the task's subnet
            if task.subnet_id not in miner.subnet_ids:
                continue
            # Must have required capability (empty = accepts all)
            if miner.capabilities and task.task_type not in miner.capabilities:
                continue
            eligible.append(miner)
        return eligible

    def _calculate_weights(self, miners: List[MinerInfo]) -> List[float]:
        """
        Calculate selection weights with anti-sybil cap and load balancing.

        Weight formula:
            base_weight = min(effective_weight, weight_cap)
            load_penalty = 1 / (1 + assignments_count * 0.1)
            final_weight = base_weight * load_penalty
        """
        weights = []
        for miner in miners:
            # Base weight from reputation + stake
            base = min(miner.effective_weight, self.weight_cap)
            # Ensure minimum weight so new miners get a chance
            base = max(base, 0.01)

            # Load-balancing penalty
            assignments = self._assignment_counts.get(miner.miner_id, 0)
            load_penalty = 1.0 / (1.0 + assignments * 0.1)

            weights.append(base * load_penalty)

        return weights

    def _weighted_sample(
        self,
        miners: List[MinerInfo],
        weights: List[float],
        k: int,
    ) -> List[MinerInfo]:
        """
        Weighted random sampling without replacement.

        Uses iterative selection: pick one, remove from pool, re-normalize, repeat.
        """
        pool = list(zip(miners, weights))
        selected = []

        for _ in range(k):
            if not pool:
                break

            total_weight = sum(w for _, w in pool)
            if total_weight == 0:
                # Fallback to uniform random
                idx = self._rng.randint(0, len(pool) - 1)
            else:
                # Weighted random choice
                r = self._rng.uniform(0, total_weight)
                cumulative = 0.0
                idx = 0
                for i, (_, w) in enumerate(pool):
                    cumulative += w
                    if cumulative >= r:
                        idx = i
                        break

            selected.append(pool[idx][0])
            pool.pop(idx)

        return selected

    def get_deterministic_match(
        self,
        task: TaskRequest,
        available_miners: List[MinerInfo],
    ) -> List[MinerInfo]:
        """
        Deterministic matching based on task ID hash.

        Used for verification — given the same task and miners,
        always produces the same assignment.
        """
        eligible = self._filter_eligible(task, available_miners)
        if not eligible:
            return []

        # Sort by a hash of (task_id + miner_id) for deterministic ordering
        def sort_key(miner: MinerInfo) -> str:
            combined = f"{task.task_id}:{miner.miner_id}"
            return hashlib.sha256(combined.encode()).hexdigest()

        eligible.sort(key=sort_key)

        num = min(task.max_miners, self.max_miners, len(eligible))
        return eligible[:num]

    def reset_load_counters(self) -> None:
        """Reset load-balancing counters (call at epoch boundaries)."""
        self._assignment_counts.clear()
        logger.debug("Load counters reset")

    def get_stats(self) -> Dict:
        """Get matcher statistics."""
        return {
            "total_assignments": sum(self._assignment_counts.values()),
            "unique_miners_assigned": len(self._assignment_counts),
            "assignment_distribution": dict(
                sorted(
                    self._assignment_counts.items(),
                    key=lambda x: x[1],
                    reverse=True,
                )[:10]
            ),
        }
