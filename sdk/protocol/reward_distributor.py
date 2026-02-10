"""
ModernTensor Reward Distributor

The glue code connecting protocol logic to Hedera on-chain token transfers.
Handles the complete reward lifecycle:

    1. Listen for payment-ready events from TaskManager
    2. Execute on-chain MDT transfers via HTSService
    3. Record transactions in Treasury
    4. Log everything to HCS for transparency

Flow:
    TaskManager._prepare_payment() → on_payment_ready callback
        → RewardDistributor.process_payment()
            → HTSService.transfer_mdt() (per miner)
            → SmartContractService.finalize_task() (escrow release)
            → Treasury.record_payout()
            → HCSService.submit_message() (audit log)

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import hashlib
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

from .types import FeeBreakdown, PaymentInfo

if TYPE_CHECKING:
    from ..hedera.hts import HTSService
    from ..hedera.hcs import HCSService
    from ..hedera.contracts import SmartContractService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data Types
# ---------------------------------------------------------------------------

@dataclass
class RewardTransaction:
    """Record of a single on-chain reward transfer."""
    tx_id: str = ""
    task_id: str = ""
    recipient_id: str = ""
    recipient_type: str = ""  # "miner", "subnet_owner", "protocol_treasury"
    amount: float = 0.0
    status: str = "pending"  # pending, confirmed, failed
    hedera_tx_id: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    confirmed_at: Optional[float] = None
    error: Optional[str] = None

    @property
    def is_confirmed(self) -> bool:
        return self.status == "confirmed"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tx_id": self.tx_id,
            "task_id": self.task_id,
            "recipient_id": self.recipient_id,
            "recipient_type": self.recipient_type,
            "amount": round(self.amount, 6),
            "status": self.status,
            "hedera_tx_id": self.hedera_tx_id,
            "created_at": self.created_at,
            "confirmed_at": self.confirmed_at,
            "error": self.error,
        }


@dataclass
class RewardBatch:
    """A batch of reward transactions for a single task."""
    task_id: str = ""
    fee_breakdown: Optional[FeeBreakdown] = None
    miner_rewards: Dict[str, float] = field(default_factory=dict)
    transactions: List[RewardTransaction] = field(default_factory=list)
    total_distributed: float = 0.0
    status: str = "pending"  # pending, processing, completed, failed
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None

    @property
    def is_completed(self) -> bool:
        return self.status == "completed"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "fee_breakdown": self.fee_breakdown.to_dict() if self.fee_breakdown else None,
            "miner_rewards": {k: round(v, 6) for k, v in self.miner_rewards.items()},
            "transactions": [t.to_dict() for t in self.transactions],
            "total_distributed": round(self.total_distributed, 6),
            "status": self.status,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
        }


# ---------------------------------------------------------------------------
# Reward Distributor
# ---------------------------------------------------------------------------

class RewardDistributor:
    """
    Connects protocol payment decisions to real Hedera token transfers.

    Architecture:
        ┌────────────────────┐
        │   TaskManager      │
        │  _prepare_payment()│──→ on_payment_ready callback
        └────────────────────┘              │
                                            ▼
        ┌──────────────────────────────────────────────┐
        │           RewardDistributor                   │
        │                                               │
        │  1. Split rewards (miner / subnet / protocol) │
        │  2. Transfer MDT via HTSService               │
        │  3. Finalize escrow via SmartContractService   │
        │  4. Record in Treasury                         │
        │  5. Log to HCS                                 │
        └──────────────────────────────────────────────┘
                    │            │            │
                    ▼            ▼            ▼
              HTSService   Contracts   HCSService

    Usage:
        from sdk.protocol.reward_distributor import RewardDistributor

        distributor = RewardDistributor(
            hts_service=hts,
            treasury=treasury,
        )

        # Wire into TaskManager
        task_manager.on_payment_ready(distributor.process_payment)

        # Or process manually
        batch = distributor.process_payment(payment_info)
        print(f"Distributed {batch.total_distributed} MDT")
    """

    def __init__(
        self,
        hts_service: Optional["HTSService"] = None,
        hcs_service: Optional["HCSService"] = None,
        contract_service: Optional["SmartContractService"] = None,
        treasury: Optional["Treasury"] = None,
        protocol_treasury_account: str = "0.0.9000",
        hcs_topic_id: Optional[str] = None,
        dry_run: bool = False,
    ):
        """
        Args:
            hts_service: Hedera Token Service for MDT transfers
            hcs_service: Hedera Consensus Service for audit logging
            contract_service: Smart contract service for escrow operations
            treasury: Treasury instance for accounting
            protocol_treasury_account: Account ID for protocol fee collection
            hcs_topic_id: HCS topic ID for audit logging (required if hcs_service is set)
            dry_run: If True, simulate transfers without on-chain execution
        """
        self.hts = hts_service
        self.hcs = hcs_service
        self.contracts = contract_service
        self.treasury = treasury
        self.protocol_treasury_account = protocol_treasury_account
        self.hcs_topic_id = hcs_topic_id
        self.dry_run = dry_run

        # State
        self._batches: Dict[str, RewardBatch] = {}
        self._total_distributed: float = 0.0
        self._total_transactions: int = 0
        self._failed_transactions: int = 0

        # Callbacks
        self._on_reward_distributed: Optional[Callable] = None
        self._on_transfer_failed: Optional[Callable] = None

        logger.info(
            "RewardDistributor initialized (dry_run=%s, treasury=%s)",
            dry_run, protocol_treasury_account,
        )

    # -----------------------------------------------------------------------
    # Main Entry Point
    # -----------------------------------------------------------------------

    def process_payment(self, payment: PaymentInfo) -> RewardBatch:
        """
        Process a PaymentInfo into actual on-chain transfers.

        This is the callback wired into TaskManager.on_payment_ready().

        Steps:
            1. Create reward batch from fee breakdown
            2. Transfer protocol fee → treasury account
            3. Transfer subnet fee → subnet owner account
            4. Transfer miner reward → winning miner(s)
            5. Record all transactions
            6. Log to HCS for audit trail

        Args:
            payment: PaymentInfo from TaskManager._prepare_payment()

        Returns:
            RewardBatch with all transaction details
        """
        batch = RewardBatch(
            task_id=payment.task_id,
            fee_breakdown=payment.fee_breakdown,
        )
        batch.status = "processing"

        logger.info(
            "Processing payment for task %s: %.4f MDT → miner %s",
            payment.task_id[:8], payment.amount, payment.miner_id,
        )

        try:
            # --- Step 1: Protocol fee → Treasury ---
            if payment.fee_breakdown and payment.fee_breakdown.protocol_fee > 0:
                tx = self._transfer(
                    task_id=payment.task_id,
                    recipient_id=self.protocol_treasury_account,
                    recipient_type="protocol_treasury",
                    amount=payment.fee_breakdown.protocol_fee,
                )
                batch.transactions.append(tx)

            # --- Step 2: Subnet fee → Subnet owner ---
            if payment.fee_breakdown and payment.fee_breakdown.subnet_fee > 0:
                subnet_owner = payment.fee_breakdown.subnet_owner_id
                if not subnet_owner:
                    logger.warning(
                        "No subnet_owner_id in FeeBreakdown for task %s, "
                        "skipping subnet fee transfer",
                        payment.task_id[:8],
                    )
                else:
                    tx = self._transfer(
                        task_id=payment.task_id,
                        recipient_id=subnet_owner,
                        recipient_type="subnet_owner",
                        amount=payment.fee_breakdown.subnet_fee,
                    )
                    batch.transactions.append(tx)

            # --- Step 3: Miner reward → Winner(s) ---
            if payment.miner_id and payment.amount > 0:
                tx = self._transfer(
                    task_id=payment.task_id,
                    recipient_id=payment.miner_id,
                    recipient_type="miner",
                    amount=payment.amount,
                )
                batch.transactions.append(tx)
                batch.miner_rewards[payment.miner_id] = payment.amount

            # --- Step 4: Finalize escrow contract ---
            if self.contracts and not self.dry_run:
                try:
                    on_chain_id = self._deterministic_task_id(payment.task_id)
                    self.contracts.finalize_task(task_id=on_chain_id)
                    logger.info("Escrow finalized for task %s", payment.task_id[:8])
                except Exception as e:
                    logger.warning("Escrow finalize failed (non-critical): %s", e)

            # --- Step 5: Record in treasury ---
            if self.treasury:
                self.treasury.record_task_payout(
                    task_id=payment.task_id,
                    fee_breakdown=payment.fee_breakdown,
                    miner_id=payment.miner_id,
                    miner_amount=payment.amount,
                )

            # --- Step 6: Log to HCS ---
            if self.hcs and self.hcs_topic_id and not self.dry_run:
                try:
                    self.hcs.submit_message(
                        topic_id=self.hcs_topic_id,
                        message={
                            "type": "reward_distributed",
                            "task_id": payment.task_id,
                            "miner_id": payment.miner_id,
                            "amount": payment.amount,
                            "protocol_fee": (
                                payment.fee_breakdown.protocol_fee
                                if payment.fee_breakdown else 0
                            ),
                            "timestamp": time.time(),
                        },
                    )
                except Exception as e:
                    logger.warning("HCS logging failed (non-critical): %s", e)

            # --- Finalize batch ---
            confirmed = [t for t in batch.transactions if t.is_confirmed]
            failed = [t for t in batch.transactions if t.status == "failed"]
            batch.total_distributed = sum(t.amount for t in confirmed)

            if failed:
                batch.status = "partial_failure"
                logger.warning(
                    "Partial failure for task %s: %d/%d transfers failed",
                    payment.task_id[:8], len(failed), len(batch.transactions),
                )
            else:
                batch.status = "completed"
            batch.completed_at = time.time()

            # Update payment info
            payment.is_paid = len(failed) == 0
            payment.paid_at = time.time()
            payment.transaction_id = (
                confirmed[0].hedera_tx_id if confirmed else None
            )

        except Exception as e:
            batch.status = "failed"
            logger.error("Reward distribution failed for task %s: %s",
                         payment.task_id[:8], e)
            if self._on_transfer_failed:
                self._on_transfer_failed(payment, e)

        # Store batch
        self._batches[payment.task_id] = batch
        self._total_distributed += batch.total_distributed

        if self._on_reward_distributed:
            self._on_reward_distributed(batch)

        return batch

    # -----------------------------------------------------------------------
    # Batch Distribution (multi-miner)
    # -----------------------------------------------------------------------

    def distribute_to_miners(
        self,
        task_id: str,
        miner_rewards: Dict[str, float],
        fee_breakdown: Optional[FeeBreakdown] = None,
    ) -> RewardBatch:
        """
        Distribute rewards to multiple miners for a single task.

        Used when multiple miners contribute to a task result and
        rewards are split proportionally to their scores.

        Args:
            task_id: Task identifier
            miner_rewards: Dict of miner_id → reward amount in MDT
            fee_breakdown: Fee breakdown for protocol/subnet fees

        Returns:
            RewardBatch with all transactions
        """
        batch = RewardBatch(
            task_id=task_id,
            fee_breakdown=fee_breakdown,
            miner_rewards=miner_rewards,
        )
        batch.status = "processing"

        logger.info(
            "Distributing rewards for task %s to %d miners (total: %.4f MDT)",
            task_id[:8], len(miner_rewards), sum(miner_rewards.values()),
        )

        # Protocol + subnet fees
        if fee_breakdown:
            if fee_breakdown.protocol_fee > 0:
                tx = self._transfer(
                    task_id=task_id,
                    recipient_id=self.protocol_treasury_account,
                    recipient_type="protocol_treasury",
                    amount=fee_breakdown.protocol_fee,
                )
                batch.transactions.append(tx)

            if fee_breakdown.subnet_fee > 0:
                subnet_owner = fee_breakdown.subnet_owner_id
                if subnet_owner:
                    tx = self._transfer(
                        task_id=task_id,
                        recipient_id=subnet_owner,
                        recipient_type="subnet_owner",
                        amount=fee_breakdown.subnet_fee,
                    )
                    batch.transactions.append(tx)
                else:
                    logger.warning(
                        "No subnet_owner_id for task %s, skipping subnet fee",
                        task_id[:8],
                    )

        # Miner rewards
        for miner_id, amount in miner_rewards.items():
            if amount > 0:
                tx = self._transfer(
                    task_id=task_id,
                    recipient_id=miner_id,
                    recipient_type="miner",
                    amount=amount,
                )
                batch.transactions.append(tx)

        # Finalize
        batch.total_distributed = sum(
            t.amount for t in batch.transactions if t.is_confirmed
        )
        batch.status = "completed"
        batch.completed_at = time.time()

        # Record in treasury
        if self.treasury and fee_breakdown:
            for miner_id, amount in miner_rewards.items():
                self.treasury.record_task_payout(
                    task_id=task_id,
                    fee_breakdown=fee_breakdown,
                    miner_id=miner_id,
                    miner_amount=amount,
                )

        self._batches[task_id] = batch
        self._total_distributed += batch.total_distributed
        return batch

    # -----------------------------------------------------------------------
    # Internal Transfer Logic
    # -----------------------------------------------------------------------

    def _transfer(
        self,
        task_id: str,
        recipient_id: str,
        recipient_type: str,
        amount: float,
    ) -> RewardTransaction:
        """
        Execute a single MDT transfer (or simulate in dry_run mode).

        Returns:
            RewardTransaction with status and tx details
        """
        tx = RewardTransaction(
            tx_id=f"tx_{task_id[:8]}_{recipient_type}_{int(time.time()*1000)}",
            task_id=task_id,
            recipient_id=recipient_id,
            recipient_type=recipient_type,
            amount=amount,
        )

        if self.dry_run:
            # Simulate successful transfer
            tx.status = "confirmed"
            tx.hedera_tx_id = f"0.0.0@{int(time.time())}.dry_run"
            tx.confirmed_at = time.time()
            self._total_transactions += 1
            logger.info(
                "[DRY RUN] Transfer %.4f MDT → %s (%s)",
                amount, recipient_id, recipient_type,
            )
            return tx

        # Real on-chain transfer
        if self.hts is None:
            tx.status = "failed"
            tx.error = "HTSService not configured"
            self._failed_transactions += 1
            logger.error("Cannot transfer: HTSService not configured")
            return tx

        try:
            receipt = self.hts.transfer_mdt(
                to_account=recipient_id,
                amount=amount,
            )
            tx.status = "confirmed"
            tx.hedera_tx_id = str(getattr(receipt, 'transaction_id', 'unknown'))
            tx.confirmed_at = time.time()
            self._total_transactions += 1

            logger.info(
                "Transferred %.4f MDT → %s (%s) [tx: %s]",
                amount, recipient_id, recipient_type, tx.hedera_tx_id,
            )

        except Exception as e:
            tx.status = "failed"
            tx.error = str(e)
            self._failed_transactions += 1
            logger.error(
                "Transfer failed: %.4f MDT → %s: %s",
                amount, recipient_id, e,
            )

        return tx

    @staticmethod
    def _deterministic_task_id(task_id: str) -> int:
        """Convert a task UUID to a deterministic on-chain int32 ID.

        Uses SHA-256 instead of Python's built-in hash() which is
        randomized across processes (PYTHONHASHSEED).
        """
        digest = hashlib.sha256(task_id.encode()).hexdigest()
        return int(digest[:8], 16) % (2**31)

    # -----------------------------------------------------------------------
    # Callbacks
    # -----------------------------------------------------------------------

    def on_reward_distributed(self, callback: Callable) -> None:
        """Register callback for successful reward distribution."""
        self._on_reward_distributed = callback

    def on_transfer_failed(self, callback: Callable) -> None:
        """Register callback for failed transfers."""
        self._on_transfer_failed = callback

    # -----------------------------------------------------------------------
    # Queries
    # -----------------------------------------------------------------------

    def get_batch(self, task_id: str) -> Optional[RewardBatch]:
        """Get reward batch for a specific task."""
        return self._batches.get(task_id)

    def get_all_batches(self) -> List[RewardBatch]:
        """Get all reward batches."""
        return list(self._batches.values())

    def get_stats(self) -> Dict[str, Any]:
        """Get distributor statistics."""
        confirmed = sum(
            1 for b in self._batches.values() if b.is_completed
        )
        return {
            "total_batches": len(self._batches),
            "completed_batches": confirmed,
            "failed_batches": len(self._batches) - confirmed,
            "total_distributed_mdt": round(self._total_distributed, 6),
            "total_transactions": self._total_transactions,
            "failed_transactions": self._failed_transactions,
            "dry_run": self.dry_run,
        }
