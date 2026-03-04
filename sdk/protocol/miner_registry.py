"""
ModernTensor Miner Registry

Manages miner registration, reputation tracking, and selection for the protocol.

Features:
- Registration with stake requirements
- EMA-based reputation scoring
- Automatic suspension for low-reputation miners
- Stake-weighted miner selection
- Subnet-specific miner tracking
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional

from .types import (
    MinerInfo,
    MinerReputation,
    MinerStatus,
    ProtocolConfig,
)

logger = logging.getLogger(__name__)


class MinerRegistry:
    """
    Registry for all miners in the protocol.

    Handles registration, deregistration, reputation updates,
    and miner selection for task assignment.

    Example:
        registry = MinerRegistry(config)

        # Register a miner
        miner = registry.register(
            miner_id="0.0.12345",
            subnet_ids=[0, 1],
            stake_amount=500.0,
            capabilities=["code_review", "text_generation"],
        )

        # Get active miners for a subnet
        miners = registry.get_active_miners(subnet_id=1)

        # Update reputation after task
        registry.update_reputation(
            miner_id="0.0.12345",
            task_score=0.85,
            response_time=12.3,
            success=True,
        )
    """

    def __init__(self, config: Optional[ProtocolConfig] = None):
        self.config = config or ProtocolConfig()
        self._miners: Dict[str, MinerInfo] = {}
        self._subnet_miners: Dict[int, List[str]] = {}
        self._lock = threading.Lock()

        # Persistence
        self.data_dir = Path("data")
        self.data_dir.mkdir(exist_ok=True)
        self.state_file = self.data_dir / "miner_registry.json"

        self.load_state()
        logger.info(
            "MinerRegistry initialized — min_stake=%.1f MDT",
            self.config.min_stake_amount,
        )

    @property
    def total_miners(self) -> int:
        """Total number of registered miners (all statuses)."""
        return len(self._miners)

    @property
    def active_miners(self) -> int:
        """Number of currently active miners."""
        return sum(1 for m in self._miners.values() if m.is_active)

    def register(
        self,
        miner_id: str,
        subnet_ids: Optional[List[int]] = None,
        stake_amount: float = 0.0,
        capabilities: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
    ) -> MinerInfo:
        """
        Register a new miner in the protocol.

        Args:
            miner_id: Unique Hedera account ID
            subnet_ids: Subnets to register in
            stake_amount: Amount of MDT to stake
            capabilities: Task types this miner supports
            metadata: Additional miner metadata

        Returns:
            MinerInfo for the newly registered miner

        Raises:
            ValueError: If miner already registered or stake insufficient
        """
        if miner_id in self._miners:
            existing = self._miners[miner_id]
            if existing.status == MinerStatus.DEREGISTERED:
                # Allow re-registration
                logger.info("Re-registering miner %s", miner_id)
            else:
                raise ValueError(f"Miner {miner_id} is already registered")

        if stake_amount < self.config.min_stake_amount:
            raise ValueError(
                f"Stake {stake_amount} MDT below minimum "
                f"{self.config.min_stake_amount} MDT"
            )

        # M5: enforce max miners per subnet
        max_per_subnet = getattr(self.config, "max_miners_per_subnet", 1000)
        for sid in subnet_ids or [0]:
            current_count = len(self._subnet_miners.get(sid, []))
            if current_count >= max_per_subnet:
                raise ValueError(
                    f"Subnet {sid} already has {current_count} miners "
                    f"(max: {max_per_subnet})"
                )

        miner = MinerInfo(
            miner_id=miner_id,
            subnet_ids=subnet_ids or [0],
            stake_amount=stake_amount,
            capabilities=capabilities or [],
            metadata=metadata or {},
            reputation=MinerReputation(
                ema_alpha=self.config.reputation_ema_alpha,
            ),
        )

        with self._lock:
            self._miners[miner_id] = miner

            # Update subnet index
            for sid in miner.subnet_ids:
                if sid not in self._subnet_miners:
                    self._subnet_miners[sid] = []
                if miner_id not in self._subnet_miners[sid]:
                    self._subnet_miners[sid].append(miner_id)

            self.save_state()

        logger.info(
            "Miner %s registered — subnets=%s, stake=%.1f MDT",
            miner_id,
            subnet_ids,
            stake_amount,
        )
        return miner

    def deregister(self, miner_id: str) -> MinerInfo:
        """
        Deregister a miner from the protocol.

        Args:
            miner_id: ID of the miner to deregister

        Returns:
            Updated MinerInfo

        Raises:
            KeyError: If miner not found
        """
        miner = self._get_miner_or_raise(miner_id)
        miner.status = MinerStatus.DEREGISTERED

        # Remove from subnet index
        for sid in miner.subnet_ids:
            if sid in self._subnet_miners:
                self._subnet_miners[sid] = [
                    m for m in self._subnet_miners[sid] if m != miner_id
                ]

        self.save_state()

        logger.info("Miner %s deregistered", miner_id)
        return miner

    def suspend(self, miner_id: str, reason: str = "low reputation") -> MinerInfo:
        """
        Suspend a miner temporarily.

        Args:
            miner_id: ID of the miner to suspend
            reason: Reason for suspension

        Returns:
            Updated MinerInfo
        """
        miner = self._get_miner_or_raise(miner_id)
        miner.status = MinerStatus.SUSPENDED
        miner.metadata["suspension_reason"] = reason
        miner.metadata["suspended_at"] = time.time()

        self.save_state()

        logger.warning("Miner %s suspended — reason: %s", miner_id, reason)
        return miner

    def reactivate(self, miner_id: str) -> MinerInfo:
        """Reactivate a suspended miner."""
        miner = self._get_miner_or_raise(miner_id)
        if miner.status != MinerStatus.SUSPENDED:
            raise ValueError(f"Miner {miner_id} is {miner.status.value}, not suspended")
        miner.status = MinerStatus.ACTIVE
        miner.metadata.pop("suspension_reason", None)
        miner.metadata.pop("suspended_at", None)

        self.save_state()

        logger.info("Miner %s reactivated", miner_id)
        return miner

    def get_miner(self, miner_id: str) -> Optional[MinerInfo]:
        """Get a miner by ID. Returns None if not found."""
        return self._miners.get(miner_id)

    def get_active_miners(self, subnet_id: Optional[int] = None) -> List[MinerInfo]:
        """
        Get all active miners, optionally filtered by subnet.

        Args:
            subnet_id: If provided, only return miners in this subnet

        Returns:
            List of active MinerInfo objects
        """
        if subnet_id is not None:
            miner_ids = self._subnet_miners.get(subnet_id, [])
            return [
                self._miners[mid]
                for mid in miner_ids
                if mid in self._miners and self._miners[mid].is_active
            ]
        return [m for m in self._miners.values() if m.is_active]

    def get_miners_by_capability(
        self,
        capability: str,
        subnet_id: Optional[int] = None,
    ) -> List[MinerInfo]:
        """
        Get active miners that support a specific task type.

        Args:
            capability: Required capability (e.g., "code_review")
            subnet_id: Optional subnet filter

        Returns:
            List of eligible MinerInfo objects
        """
        miners = self.get_active_miners(subnet_id)
        return [m for m in miners if capability in m.capabilities or not m.capabilities]

    def update_reputation(
        self,
        miner_id: str,
        task_score: float,
        response_time: float,
        success: bool,
    ) -> MinerReputation:
        """
        Update a miner's reputation after task completion.

        Automatically suspends miners who fall below the threshold.

        Args:
            miner_id: ID of the miner
            task_score: Score received (0.0 to 1.0)
            response_time: Time taken in seconds
            success: Whether task was completed successfully

        Returns:
            Updated MinerReputation
        """
        miner = self._get_miner_or_raise(miner_id)
        miner.reputation.update(task_score, response_time, success)
        miner.last_active_at = time.time()

        # Auto-suspend if reputation drops too low
        if (
            miner.reputation.score < self.config.miner_suspension_threshold
            and miner.reputation.total_tasks >= 5  # Give new miners a chance
            and miner.is_active
        ):
            self.suspend(
                miner_id,
                reason=f"Reputation {miner.reputation.score:.2f} below "
                f"threshold {self.config.miner_suspension_threshold}",
            )

        logger.debug(
            "Reputation updated for %s: score=%.4f, tasks=%d",
            miner_id,
            miner.reputation.score,
            miner.reputation.total_tasks,
        )
        return miner.reputation

    def save_state(self) -> None:
        """Save registry state to JSON file."""
        try:
            data = {"miners": {mid: m.to_dict() for mid, m in self._miners.items()}}
            with open(self.state_file, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save registry state: {e}")

    def load_state(self) -> None:
        """Load registry state from JSON file."""
        if not self.state_file.exists():
            return

        try:
            with open(self.state_file, "r") as f:
                data = json.load(f)

            with self._lock:
                self._miners.clear()
                self._subnet_miners.clear()

                for mid, m_data in data.get("miners", {}).items():
                    # Reconstruct MinerReputation
                    rep_data = m_data.pop("reputation", {})
                    # Strip computed @property fields that to_dict() includes
                    for prop in ["success_rate", "timeout_rate"]:
                        rep_data.pop(prop, None)
                    reputation = MinerReputation(**rep_data)

                    # Reconstruct MinerInfo
                    status_str = m_data.pop("status", "active")
                    m_data["status"] = MinerStatus(status_str)
                    # Strip computed @property fields
                    m_data.pop("effective_weight", None)
                    m_data.pop("axon_endpoint", None)

                    miner = MinerInfo(reputation=reputation, **m_data)
                    self._miners[mid] = miner

                    # Rebuild index
                    for sid in miner.subnet_ids:
                        if sid not in self._subnet_miners:
                            self._subnet_miners[sid] = []
                        self._subnet_miners[sid].append(mid)

            logger.info(f"Loaded {len(self._miners)} miners from state")
        except Exception as e:
            logger.error(f"Failed to load registry state: {e}")

    def record_timeout(self, miner_id: str) -> MinerReputation:
        """Record a timeout for a miner (heavier penalty)."""
        miner = self._get_miner_or_raise(miner_id)
        miner.reputation.record_timeout()

        # Auto-suspend check
        if (
            miner.reputation.timeout_rate > 0.3
            and miner.reputation.total_tasks >= 5
            and miner.is_active
        ):
            self.suspend(
                miner_id,
                reason=f"Timeout rate {miner.reputation.timeout_rate:.0%} too high",
            )

        return miner.reputation

    def get_leaderboard(
        self,
        subnet_id: Optional[int] = None,
        top_n: int = 20,
    ) -> List[MinerInfo]:
        """
        Get ranked leaderboard of miners by effective weight.

        Args:
            subnet_id: Optional subnet filter
            top_n: Number of entries to return

        Returns:
            Sorted list of MinerInfo (highest weight first)
        """
        miners = self.get_active_miners(subnet_id)
        miners.sort(key=lambda m: m.effective_weight, reverse=True)
        return miners[:top_n]

    def get_stats(self) -> Dict:
        """Get registry statistics."""
        statuses = {}
        for miner in self._miners.values():
            status = miner.status.value
            statuses[status] = statuses.get(status, 0) + 1

        total_stake = sum(m.stake_amount for m in self._miners.values())
        active = [m for m in self._miners.values() if m.is_active]
        avg_reputation = (
            sum(m.reputation.score for m in active) / len(active) if active else 0.0
        )

        return {
            "total_miners": self.total_miners,
            "active_miners": self.active_miners,
            "statuses": statuses,
            "total_stake": round(total_stake, 2),
            "average_reputation": round(avg_reputation, 4),
            "subnets_covered": len(self._subnet_miners),
        }

    def _get_miner_or_raise(self, miner_id: str) -> MinerInfo:
        """Get a miner or raise KeyError."""
        if miner_id not in self._miners:
            raise KeyError(f"Miner {miner_id} not found in registry")
        return self._miners[miner_id]
