"""
ModernTensor Treasury

Tracks all token flows through the protocol:
- Protocol fees collected into DAO treasury
- Subnet fees paid to subnet owners
- Miner rewards distributed
- Running totals and accounting for analytics

This is the single source of truth for "how much MDT has flowed where."

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .types import FeeBreakdown

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data Types
# ---------------------------------------------------------------------------

@dataclass
class PayoutRecord:
    """A single payout event recorded by Treasury."""
    task_id: str
    miner_id: str
    miner_amount: float
    protocol_fee: float
    subnet_fee: float
    total_volume: float
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "miner_id": self.miner_id,
            "miner_amount": round(self.miner_amount, 6),
            "protocol_fee": round(self.protocol_fee, 6),
            "subnet_fee": round(self.subnet_fee, 6),
            "total_volume": round(self.total_volume, 6),
            "timestamp": self.timestamp,
        }


@dataclass
class TreasurySnapshot:
    """Point-in-time snapshot of treasury state."""
    total_protocol_fees: float = 0.0
    total_subnet_fees: float = 0.0
    total_miner_rewards: float = 0.0
    total_volume: float = 0.0
    total_payouts: int = 0
    unique_miners_paid: int = 0
    unique_tasks_paid: int = 0
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_protocol_fees": round(self.total_protocol_fees, 6),
            "total_subnet_fees": round(self.total_subnet_fees, 6),
            "total_miner_rewards": round(self.total_miner_rewards, 6),
            "total_volume": round(self.total_volume, 6),
            "total_payouts": self.total_payouts,
            "unique_miners_paid": self.unique_miners_paid,
            "unique_tasks_paid": self.unique_tasks_paid,
            "timestamp": self.timestamp,
        }


# ---------------------------------------------------------------------------
# Treasury
# ---------------------------------------------------------------------------

class Treasury:
    """
    Protocol-level accounting for all token flows.

    Tracks every MDT that flows through the protocol:
    - Protocol fees (1% → DAO treasury)
    - Subnet fees (3% default → subnet owners)
    - Miner rewards (96% → winning miners)

    Architecture:
        ┌────────────────────────────────────────────────┐
        │                   Treasury                      │
        │                                                 │
        │  Protocol Fees ──────→ total_protocol_fees      │
        │  Subnet Fees   ──────→ total_subnet_fees        │
        │  Miner Rewards ──────→ total_miner_rewards      │
        │                                                 │
        │  Per-Miner P&L ──────→ miner_earnings[id]       │
        │  Per-Subnet Revenue ─→ subnet_revenue[id]       │
        │  History ────────────→ payout_history[]          │
        └────────────────────────────────────────────────┘

    Usage:
        treasury = Treasury()

        # Record a payout
        treasury.record_task_payout(
            task_id="task-abc",
            fee_breakdown=fee_breakdown,
            miner_id="0.0.12345",
            miner_amount=94.0,
        )

        # Get summary
        snapshot = treasury.get_snapshot()
        print(f"Total volume: {snapshot.total_volume} MDT")

        # Get miner earnings
        earnings = treasury.get_miner_earnings("0.0.12345")
        print(f"Miner earned: {earnings} MDT")
    """

    def __init__(self):
        # Running totals
        self._total_protocol_fees: float = 0.0
        self._total_subnet_fees: float = 0.0
        self._total_miner_rewards: float = 0.0
        self._total_volume: float = 0.0

        # Per-entity tracking
        self._miner_earnings: Dict[str, float] = {}
        self._miner_task_counts: Dict[str, int] = {}
        self._subnet_revenue: Dict[int, float] = {}

        # History (recent payouts)
        self._payout_history: List[PayoutRecord] = []
        self._max_history: int = 10000

        # Unique tracking
        self._unique_miners: set = set()
        self._unique_tasks: set = set()

        logger.info("Treasury initialized")

    # -----------------------------------------------------------------------
    # Recording
    # -----------------------------------------------------------------------

    def record_task_payout(
        self,
        task_id: str,
        fee_breakdown: Optional[FeeBreakdown],
        miner_id: str,
        miner_amount: float,
        subnet_id: Optional[int] = None,
    ) -> PayoutRecord:
        """
        Record a complete task payout in the treasury.

        Args:
            task_id: Task that was paid
            fee_breakdown: Fee breakdown (protocol/subnet/miner split)
            miner_id: Miner who received payment
            miner_amount: Amount in MDT paid to miner
            subnet_id: Optional subnet ID for revenue tracking

        Returns:
            PayoutRecord for this transaction
        """
        protocol_fee = fee_breakdown.protocol_fee if fee_breakdown else 0.0
        subnet_fee = fee_breakdown.subnet_fee if fee_breakdown else 0.0
        total_volume = fee_breakdown.reward_amount if fee_breakdown else miner_amount

        # Update running totals (round to prevent float drift over many txns)
        self._total_protocol_fees = round(self._total_protocol_fees + protocol_fee, 8)
        self._total_subnet_fees = round(self._total_subnet_fees + subnet_fee, 8)
        self._total_miner_rewards = round(self._total_miner_rewards + miner_amount, 8)
        self._total_volume = round(self._total_volume + total_volume, 8)

        # Per-miner tracking
        self._miner_earnings[miner_id] = round(
            self._miner_earnings.get(miner_id, 0.0) + miner_amount, 8
        )
        self._miner_task_counts[miner_id] = (
            self._miner_task_counts.get(miner_id, 0) + 1
        )

        # Per-subnet tracking
        if subnet_id is not None:
            self._subnet_revenue[subnet_id] = round(
                self._subnet_revenue.get(subnet_id, 0.0) + subnet_fee, 8
            )

        # Unique tracking
        self._unique_miners.add(miner_id)
        self._unique_tasks.add(task_id)

        # Create record
        record = PayoutRecord(
            task_id=task_id,
            miner_id=miner_id,
            miner_amount=miner_amount,
            protocol_fee=protocol_fee,
            subnet_fee=subnet_fee,
            total_volume=total_volume,
        )

        # Add to history (with cap)
        self._payout_history.append(record)
        if len(self._payout_history) > self._max_history:
            self._payout_history = self._payout_history[-self._max_history:]

        logger.info(
            "Treasury recorded: task=%s, miner=%s, amount=%.4f MDT "
            "(protocol_fee=%.4f, subnet_fee=%.4f)",
            task_id[:8], miner_id, miner_amount,
            protocol_fee, subnet_fee,
        )

        return record

    # -----------------------------------------------------------------------
    # Queries
    # -----------------------------------------------------------------------

    def get_snapshot(self) -> TreasurySnapshot:
        """Get current treasury state snapshot."""
        return TreasurySnapshot(
            total_protocol_fees=self._total_protocol_fees,
            total_subnet_fees=self._total_subnet_fees,
            total_miner_rewards=self._total_miner_rewards,
            total_volume=self._total_volume,
            total_payouts=len(self._payout_history),
            unique_miners_paid=len(self._unique_miners),
            unique_tasks_paid=len(self._unique_tasks),
        )

    def get_miner_earnings(self, miner_id: str) -> float:
        """Get total earnings for a specific miner."""
        return self._miner_earnings.get(miner_id, 0.0)

    def get_miner_task_count(self, miner_id: str) -> int:
        """Get total paid tasks for a miner."""
        return self._miner_task_counts.get(miner_id, 0)

    def get_all_miner_earnings(self) -> Dict[str, float]:
        """Get earnings for all miners."""
        return {k: round(v, 6) for k, v in self._miner_earnings.items()}

    def get_subnet_revenue(self, subnet_id: int) -> float:
        """Get total subnet fee revenue for a subnet."""
        return self._subnet_revenue.get(subnet_id, 0.0)

    def get_top_earners(self, top_n: int = 10) -> List[Dict[str, Any]]:
        """Get top-earning miners."""
        sorted_miners = sorted(
            self._miner_earnings.items(),
            key=lambda x: x[1],
            reverse=True,
        )[:top_n]

        return [
            {
                "miner_id": miner_id,
                "total_earned": round(earned, 6),
                "task_count": self._miner_task_counts.get(miner_id, 0),
                "avg_per_task": round(
                    earned / max(self._miner_task_counts.get(miner_id, 1), 1), 6
                ),
            }
            for miner_id, earned in sorted_miners
        ]

    def get_recent_payouts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent payout records."""
        return [r.to_dict() for r in self._payout_history[-limit:]]

    def get_revenue_summary(self) -> Dict[str, Any]:
        """Get protocol revenue summary."""
        total_fees = self._total_protocol_fees + self._total_subnet_fees
        return {
            "total_volume": round(self._total_volume, 6),
            "total_fees_collected": round(total_fees, 6),
            "protocol_fees": round(self._total_protocol_fees, 6),
            "subnet_fees": round(self._total_subnet_fees, 6),
            "miner_rewards": round(self._total_miner_rewards, 6),
            "fee_ratio": round(total_fees / max(self._total_volume, 0.0001), 4),
            "total_payouts": len(self._payout_history),
            "unique_miners": len(self._unique_miners),
            "unique_tasks": len(self._unique_tasks),
        }
