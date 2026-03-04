"""
ModernTensor On-Chain Guard

Circuit-breaker and rate-limiter for Hedera on-chain operations.
Prevents excessive gas/HBAR spend and enforces cooldowns after failures.

Features:
- Max transactions per minute (configurable)
- Max HBAR spend per epoch (configurable)
- Exponential cooldown after consecutive failures
- Emergency pause capability

For Hedera Hello Future Apex Hackathon 2026
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data Types
# ---------------------------------------------------------------------------

@dataclass
class GuardResult:
    """
    Result of a guard check — whether an on-chain operation is allowed.

    Attributes:
        allowed: Whether the operation may proceed
        reason: Human-readable explanation (empty if allowed)
        cooldown_seconds: How long to wait before retrying (0 if allowed)
        remaining_budget: Remaining HBAR budget in the current epoch
        tx_count_this_minute: Number of transactions sent in the last minute
    """
    allowed: bool = True
    reason: str = ""
    cooldown_seconds: float = 0.0
    remaining_budget: float = 0.0
    tx_count_this_minute: int = 0

    def to_dict(self) -> Dict:
        return {
            "allowed": self.allowed,
            "reason": self.reason,
            "cooldown_seconds": round(self.cooldown_seconds, 2),
            "remaining_budget": round(self.remaining_budget, 6),
            "tx_count_this_minute": self.tx_count_this_minute,
        }


# ---------------------------------------------------------------------------
# On-Chain Guard
# ---------------------------------------------------------------------------

class OnChainGuard:
    """
    Circuit-breaker / rate-limiter for Hedera on-chain operations.

    Enforces safety limits to prevent runaway HBAR spend during
    development, testing, and production operation.

    Limits:
        - Transaction rate: max N transactions per minute
        - Spend cap: max HBAR spend per epoch (configurable window)
        - Failure cooldown: exponential backoff after consecutive errors
        - Emergency pause: manual kill-switch

    Example:
        guard = OnChainGuard(max_tx_per_minute=30, max_hbar_per_epoch=50.0)

        result = guard.check()
        if result.allowed:
            # proceed with on-chain tx
            receipt = client.submit_message(...)
            guard.record_success(cost_hbar=0.01)
        else:
            logger.warning(f"Guard blocked: {result.reason}")

        # After a failure:
        guard.record_failure()

        # Emergency stop:
        guard.pause()
    """

    def __init__(
        self,
        max_tx_per_minute: int = 30,
        max_hbar_per_epoch: float = 50.0,
        epoch_seconds: float = 3600.0,
        base_cooldown: float = 2.0,
        max_cooldown: float = 120.0,
    ):
        """
        Args:
            max_tx_per_minute: Maximum transactions allowed per minute
            max_hbar_per_epoch: Maximum HBAR spend per epoch
            epoch_seconds: Length of a spend-tracking epoch (default 1 hour)
            base_cooldown: Base cooldown after first failure (seconds)
            max_cooldown: Maximum cooldown cap (seconds)
        """
        self.max_tx_per_minute = max_tx_per_minute
        self.max_hbar_per_epoch = max_hbar_per_epoch
        self.epoch_seconds = epoch_seconds
        self.base_cooldown = base_cooldown
        self.max_cooldown = max_cooldown

        # Internal state
        self._tx_timestamps: List[float] = []
        self._epoch_start: float = time.time()
        self._epoch_spend: float = 0.0
        self._consecutive_failures: int = 0
        self._cooldown_until: float = 0.0
        self._paused: bool = False
        self._lock = threading.Lock()

        # Metrics
        self._total_allowed: int = 0
        self._total_blocked: int = 0
        self._total_spend: float = 0.0

        logger.info(
            "OnChainGuard initialized — rate=%d/min, budget=%.1f HBAR/epoch",
            max_tx_per_minute, max_hbar_per_epoch,
        )

    # -------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------

    def check(self, estimated_cost: float = 0.01) -> GuardResult:
        """
        Check whether an on-chain operation is allowed right now.

        Args:
            estimated_cost: Estimated HBAR cost of the operation

        Returns:
            GuardResult indicating whether to proceed
        """
        with self._lock:
            now = time.time()

            # 1. Emergency pause
            if self._paused:
                self._total_blocked += 1
                return GuardResult(
                    allowed=False,
                    reason="Guard is paused (emergency stop)",
                    cooldown_seconds=0.0,
                    remaining_budget=self.max_hbar_per_epoch - self._epoch_spend,
                    tx_count_this_minute=self._count_recent_tx(now),
                )

            # 2. Cooldown after failures
            if now < self._cooldown_until:
                remaining = self._cooldown_until - now
                self._total_blocked += 1
                return GuardResult(
                    allowed=False,
                    reason=f"Cooling down after {self._consecutive_failures} consecutive failures",
                    cooldown_seconds=remaining,
                    remaining_budget=self.max_hbar_per_epoch - self._epoch_spend,
                    tx_count_this_minute=self._count_recent_tx(now),
                )

            # 3. Epoch rollover
            self._maybe_reset_epoch(now)

            # 4. Rate limit (transactions per minute)
            tx_count = self._count_recent_tx(now)
            if tx_count >= self.max_tx_per_minute:
                self._total_blocked += 1
                return GuardResult(
                    allowed=False,
                    reason=f"Rate limit exceeded: {tx_count}/{self.max_tx_per_minute} tx/min",
                    cooldown_seconds=1.0,
                    remaining_budget=self.max_hbar_per_epoch - self._epoch_spend,
                    tx_count_this_minute=tx_count,
                )

            # 5. Spend cap
            if self._epoch_spend + estimated_cost > self.max_hbar_per_epoch:
                self._total_blocked += 1
                return GuardResult(
                    allowed=False,
                    reason=f"Spend cap reached: {self._epoch_spend:.4f}/{self.max_hbar_per_epoch} HBAR",
                    cooldown_seconds=max(0, self._epoch_start + self.epoch_seconds - now),
                    remaining_budget=max(0, self.max_hbar_per_epoch - self._epoch_spend),
                    tx_count_this_minute=tx_count,
                )

            # All checks passed
            self._total_allowed += 1
            return GuardResult(
                allowed=True,
                reason="",
                cooldown_seconds=0.0,
                remaining_budget=self.max_hbar_per_epoch - self._epoch_spend - estimated_cost,
                tx_count_this_minute=tx_count,
            )

    def record_success(self, cost_hbar: float = 0.01) -> None:
        """Record a successful on-chain transaction."""
        with self._lock:
            now = time.time()
            self._tx_timestamps.append(now)
            self._epoch_spend += cost_hbar
            self._total_spend += cost_hbar
            self._consecutive_failures = 0
            self._cooldown_until = 0.0

    def record_failure(self) -> None:
        """
        Record a failed on-chain transaction.

        Applies exponential backoff: cooldown = base * 2^(failures-1),
        capped at max_cooldown.
        """
        with self._lock:
            self._consecutive_failures += 1
            cooldown = min(
                self.base_cooldown * (2 ** (self._consecutive_failures - 1)),
                self.max_cooldown,
            )
            self._cooldown_until = time.time() + cooldown
            logger.warning(
                "Guard: failure #%d — cooldown %.1fs",
                self._consecutive_failures, cooldown,
            )

    def pause(self) -> None:
        """Emergency pause — block all operations."""
        with self._lock:
            self._paused = True
            logger.warning("OnChainGuard PAUSED — all operations blocked")

    def resume(self) -> None:
        """Resume after emergency pause."""
        with self._lock:
            self._paused = False
            self._consecutive_failures = 0
            self._cooldown_until = 0.0
            logger.info("OnChainGuard RESUMED")

    def reset(self) -> None:
        """Full reset of all counters and state."""
        with self._lock:
            self._tx_timestamps.clear()
            self._epoch_start = time.time()
            self._epoch_spend = 0.0
            self._consecutive_failures = 0
            self._cooldown_until = 0.0
            self._paused = False
            logger.info("OnChainGuard reset")

    @property
    def is_paused(self) -> bool:
        return self._paused

    def get_stats(self) -> Dict:
        """Get guard statistics."""
        with self._lock:
            now = time.time()
            return {
                "is_paused": self._paused,
                "total_allowed": self._total_allowed,
                "total_blocked": self._total_blocked,
                "total_spend_hbar": round(self._total_spend, 6),
                "epoch_spend_hbar": round(self._epoch_spend, 6),
                "epoch_budget_remaining": round(
                    max(0, self.max_hbar_per_epoch - self._epoch_spend), 6
                ),
                "consecutive_failures": self._consecutive_failures,
                "tx_last_minute": self._count_recent_tx(now),
                "config": {
                    "max_tx_per_minute": self.max_tx_per_minute,
                    "max_hbar_per_epoch": self.max_hbar_per_epoch,
                    "epoch_seconds": self.epoch_seconds,
                },
            }

    # -------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------

    def _count_recent_tx(self, now: float) -> int:
        """Count transactions in the last 60 seconds."""
        cutoff = now - 60.0
        # Prune old timestamps
        self._tx_timestamps = [
            ts for ts in self._tx_timestamps if ts > cutoff
        ]
        return len(self._tx_timestamps)

    def _maybe_reset_epoch(self, now: float) -> None:
        """Reset epoch counters if the epoch has elapsed."""
        if now - self._epoch_start >= self.epoch_seconds:
            logger.debug(
                "Epoch reset — spent %.4f HBAR in last epoch",
                self._epoch_spend,
            )
            self._epoch_start = now
            self._epoch_spend = 0.0
