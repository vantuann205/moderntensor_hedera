"""
ModernTensor Escrow Manager

Manages the smart contract escrow lifecycle for task payments:

    1. Customer submits task → Escrow locks funds
    2. Miner completes task → Validator scores
    3. Score passes → Escrow releases funds to miner
    4. Score fails / timeout → Escrow refunds customer

Integrates with PaymentEscrow.sol via SmartContractService.

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..hedera.contracts import SmartContractService
    from ..hedera.hts import HTSService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data Types
# ---------------------------------------------------------------------------

class EscrowStatus(str, Enum):
    """Status of an escrow deposit."""
    CREATED = "created"
    FUNDED = "funded"
    IN_PROGRESS = "in_progress"
    PENDING_REVIEW = "pending_review"
    RELEASED = "released"
    REFUNDED = "refunded"
    DISPUTED = "disputed"
    EXPIRED = "expired"


@dataclass
class EscrowDeposit:
    """Represents a locked escrow deposit for a task."""
    escrow_id: str = ""
    task_id: str = ""
    depositor_id: str = ""  # Customer who paid
    amount: float = 0.0     # Total locked MDT
    miner_reward: float = 0.0
    protocol_fee: float = 0.0
    subnet_fee: float = 0.0
    status: EscrowStatus = EscrowStatus.CREATED
    on_chain_task_id: Optional[int] = None  # Contract task ID
    created_at: float = field(default_factory=time.time)
    released_at: Optional[float] = None
    release_tx_id: Optional[str] = None

    @property
    def is_active(self) -> bool:
        return self.status in (
            EscrowStatus.CREATED,
            EscrowStatus.FUNDED,
            EscrowStatus.IN_PROGRESS,
            EscrowStatus.PENDING_REVIEW,
        )

    @property
    def is_settled(self) -> bool:
        return self.status in (
            EscrowStatus.RELEASED,
            EscrowStatus.REFUNDED,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "escrow_id": self.escrow_id,
            "task_id": self.task_id,
            "depositor_id": self.depositor_id,
            "amount": round(self.amount, 6),
            "miner_reward": round(self.miner_reward, 6),
            "protocol_fee": round(self.protocol_fee, 6),
            "subnet_fee": round(self.subnet_fee, 6),
            "status": self.status.value,
            "on_chain_task_id": self.on_chain_task_id,
            "created_at": self.created_at,
            "released_at": self.released_at,
            "release_tx_id": self.release_tx_id,
        }


# ---------------------------------------------------------------------------
# Escrow Manager
# ---------------------------------------------------------------------------

class EscrowManager:
    """
    Manages smart contract escrow for task payments.

    Lifecycle:
        ┌──────────────┐       ┌──────────────┐       ┌─────────────┐
        │   CREATED    │ ────→ │   FUNDED     │ ────→ │ IN_PROGRESS │
        └──────────────┘       └──────────────┘       └─────────────┘
                                                            │
                                                   ┌───────┴────────┐
                                                   ▼                ▼
                                          ┌──────────────┐  ┌────────────┐
                                          │  RELEASED    │  │  REFUNDED  │
                                          │  (miner paid)│  │  (customer)│
                                          └──────────────┘  └────────────┘

    Usage:
        escrow_mgr = EscrowManager(
            contract_service=contract_service,
            hts_service=hts_service,
        )

        # Lock funds when task is submitted
        deposit = escrow_mgr.create_escrow(
            task_id="task-abc",
            depositor_id="0.0.1234",
            amount=100.0,
            protocol_fee=1.0,
            subnet_fee=3.0,
        )

        # Release when task is validated
        escrow_mgr.release_escrow(task_id="task-abc")

        # Or refund on failure
        escrow_mgr.refund_escrow(task_id="task-abc")
    """

    def __init__(
        self,
        contract_service: Optional["SmartContractService"] = None,
        hts_service: Optional["HTSService"] = None,
        dry_run: bool = False,
        state_dir: Optional[str] = None,
    ):
        """
        Args:
            contract_service: SmartContractService for PaymentEscrow operations
            hts_service: HTSService for token operations
            dry_run: If True, simulate without on-chain execution
            state_dir: Directory for persistent state (optional)
        """
        self.contracts = contract_service
        self.hts = hts_service
        self.dry_run = dry_run

        # State
        self._escrows: Dict[str, EscrowDeposit] = {}
        self._total_locked: float = 0.0
        self._total_released: float = 0.0
        self._total_refunded: float = 0.0

        # Persistence
        self._state_file: Optional[Path] = None
        if state_dir:
            self._state_file = Path(state_dir) / "escrow_state.json"
            self._state_file.parent.mkdir(parents=True, exist_ok=True)
            self.load_state()

        logger.info("EscrowManager initialized (dry_run=%s, persistence=%s)", dry_run, self._state_file is not None)

    # -----------------------------------------------------------------------
    # Escrow Lifecycle
    # -----------------------------------------------------------------------

    def create_escrow(
        self,
        task_id: str,
        depositor_id: str,
        amount: float,
        protocol_fee: float = 0.0,
        subnet_fee: float = 0.0,
        duration_seconds: int = 3600,
    ) -> EscrowDeposit:
        """
        Create and fund an escrow deposit for a task.

        Locks the total amount (reward + fees) in the PaymentEscrow contract.

        Args:
            task_id: Task identifier
            depositor_id: Customer's Hedera account ID
            amount: Total MDT (reward + fees)
            protocol_fee: Protocol fee portion
            subnet_fee: Subnet fee portion
            duration_seconds: How long before escrow expires

        Returns:
            EscrowDeposit with on-chain task ID
        """
        miner_reward = amount - protocol_fee - subnet_fee

        deposit = EscrowDeposit(
            escrow_id=f"escrow_{task_id[:8]}_{int(time.time())}",
            task_id=task_id,
            depositor_id=depositor_id,
            amount=amount,
            miner_reward=miner_reward,
            protocol_fee=protocol_fee,
            subnet_fee=subnet_fee,
            status=EscrowStatus.CREATED,
        )

        if not self.dry_run and self.contracts:
            try:
                # Create on-chain escrow
                raw_amount = int(amount * 10**8)  # Convert to smallest unit
                receipt = self.contracts.create_task(
                    task_hash=task_id,
                    reward_amount=raw_amount,
                    duration=duration_seconds,
                )
                deposit.on_chain_task_id = self._deterministic_task_id(task_id)
                deposit.status = EscrowStatus.FUNDED
                logger.info(
                    "Escrow created on-chain: task=%s, amount=%.4f MDT",
                    task_id[:8], amount,
                )
            except Exception as e:
                logger.error("On-chain escrow creation failed: %s", e)
                deposit.status = EscrowStatus.CREATED
        else:
            # Simulate
            deposit.on_chain_task_id = self._deterministic_task_id(task_id)
            deposit.status = EscrowStatus.FUNDED
            if self.dry_run:
                logger.info(
                    "[DRY RUN] Escrow created: task=%s, amount=%.4f MDT",
                    task_id[:8], amount,
                )

        self._escrows[task_id] = deposit
        self._total_locked += amount
        self._auto_save()
        return deposit

    def release_escrow(self, task_id: str) -> EscrowDeposit:
        """
        Release escrowed funds to the winner (called after validation).

        Args:
            task_id: Task identifier

        Returns:
            Updated EscrowDeposit

        Raises:
            KeyError: If no escrow exists for this task
            ValueError: If escrow is not in a releasable state
        """
        deposit = self._get_escrow_or_raise(task_id)

        if deposit.is_settled:
            raise ValueError(
                f"Escrow already settled: {deposit.status.value}"
            )

        if not self.dry_run and self.contracts:
            try:
                receipt = self.contracts.finalize_task(
                    task_id=deposit.on_chain_task_id or 0,
                )
                deposit.release_tx_id = str(
                    getattr(receipt, 'transaction_id', 'unknown')
                )
                logger.info(
                    "Escrow released on-chain: task=%s [tx: %s]",
                    task_id[:8], deposit.release_tx_id,
                )
            except Exception as e:
                logger.error("On-chain release failed: %s", e)
        else:
            deposit.release_tx_id = f"0.0.0@{int(time.time())}.release"
            if self.dry_run:
                logger.info(
                    "[DRY RUN] Escrow released: task=%s", task_id[:8],
                )

        deposit.status = EscrowStatus.RELEASED
        deposit.released_at = time.time()
        self._total_released += deposit.amount
        self._total_locked = max(0.0, self._total_locked - deposit.amount)
        self._auto_save()
        return deposit

    def refund_escrow(self, task_id: str) -> EscrowDeposit:
        """
        Refund escrowed funds to the customer (called on task failure/timeout).

        Args:
            task_id: Task identifier

        Returns:
            Updated EscrowDeposit
        """
        deposit = self._get_escrow_or_raise(task_id)

        if deposit.is_settled:
            raise ValueError(
                f"Escrow already settled: {deposit.status.value}"
            )

        if not self.dry_run and self.contracts:
            try:
                receipt = self.contracts.cancel_task(
                    task_id=deposit.on_chain_task_id or 0,
                )
                logger.info("Escrow refunded on-chain: task=%s", task_id[:8])
            except Exception as e:
                logger.error("On-chain refund failed: %s", e)
        else:
            if self.dry_run:
                logger.info("[DRY RUN] Escrow refunded: task=%s", task_id[:8])

        deposit.status = EscrowStatus.REFUNDED
        deposit.released_at = time.time()
        self._total_refunded += deposit.amount
        self._total_locked = max(0.0, self._total_locked - deposit.amount)
        self._auto_save()
        return deposit

    def mark_in_progress(self, task_id: str) -> EscrowDeposit:
        """Mark escrow as in-progress (miner accepted task)."""
        deposit = self._get_escrow_or_raise(task_id)
        deposit.status = EscrowStatus.IN_PROGRESS
        return deposit

    def mark_pending_review(self, task_id: str) -> EscrowDeposit:
        """Mark escrow as pending review (result submitted)."""
        deposit = self._get_escrow_or_raise(task_id)
        deposit.status = EscrowStatus.PENDING_REVIEW
        return deposit

    # -----------------------------------------------------------------------
    # Queries
    # -----------------------------------------------------------------------

    def get_escrow(self, task_id: str) -> Optional[EscrowDeposit]:
        """Get escrow deposit for a task."""
        return self._escrows.get(task_id)

    def get_active_escrows(self) -> List[EscrowDeposit]:
        """Get all active (not yet settled) escrows."""
        return [e for e in self._escrows.values() if e.is_active]

    def get_stats(self) -> Dict[str, Any]:
        """Get escrow statistics."""
        active = sum(1 for e in self._escrows.values() if e.is_active)
        settled = sum(1 for e in self._escrows.values() if e.is_settled)
        return {
            "total_escrows": len(self._escrows),
            "active_escrows": active,
            "settled_escrows": settled,
            "total_locked_mdt": round(self._total_locked, 6),
            "total_released_mdt": round(self._total_released, 6),
            "total_refunded_mdt": round(self._total_refunded, 6),
            "dry_run": self.dry_run,
        }

    # -----------------------------------------------------------------------
    # Internal
    # -----------------------------------------------------------------------

    def _get_escrow_or_raise(self, task_id: str) -> EscrowDeposit:
        deposit = self._escrows.get(task_id)
        if not deposit:
            raise KeyError(f"No escrow found for task: {task_id[:8]}")
        return deposit

    @staticmethod
    def _deterministic_task_id(task_id: str) -> int:
        """Convert a task UUID to a deterministic on-chain int32 ID.

        Uses SHA-256 instead of Python's built-in hash() which is
        randomized across processes (PYTHONHASHSEED).
        """
        digest = hashlib.sha256(task_id.encode()).hexdigest()
        return int(digest[:8], 16) % (2**31)

    # -----------------------------------------------------------------------
    # Persistence
    # -----------------------------------------------------------------------

    def save_state(self) -> None:
        """Persist escrow state to JSON file."""
        if not self._state_file:
            return
        state = {
            "total_locked": self._total_locked,
            "total_released": self._total_released,
            "total_refunded": self._total_refunded,
            "escrows": {k: v.to_dict() for k, v in self._escrows.items()},
        }
        try:
            self._state_file.write_text(json.dumps(state, indent=2))
            logger.debug("Escrow state saved to %s", self._state_file)
        except Exception as e:
            logger.error("Failed to save escrow state: %s", e)

    def load_state(self) -> None:
        """Load escrow state from JSON file."""
        if not self._state_file or not self._state_file.exists():
            return
        try:
            state = json.loads(self._state_file.read_text())
            self._total_locked = state.get("total_locked", 0.0)
            self._total_released = state.get("total_released", 0.0)
            self._total_refunded = state.get("total_refunded", 0.0)
            for task_id, esc_data in state.get("escrows", {}).items():
                self._escrows[task_id] = EscrowDeposit(
                    escrow_id=esc_data.get("escrow_id", ""),
                    task_id=esc_data.get("task_id", ""),
                    depositor_id=esc_data.get("depositor_id", ""),
                    amount=esc_data.get("amount", 0.0),
                    miner_reward=esc_data.get("miner_reward", 0.0),
                    protocol_fee=esc_data.get("protocol_fee", 0.0),
                    subnet_fee=esc_data.get("subnet_fee", 0.0),
                    status=EscrowStatus(esc_data.get("status", "created")),
                    on_chain_task_id=esc_data.get("on_chain_task_id"),
                    created_at=esc_data.get("created_at", 0.0),
                    released_at=esc_data.get("released_at"),
                    release_tx_id=esc_data.get("release_tx_id"),
                )
            logger.info(
                "Escrow state loaded: %d escrows, locked=%.4f MDT",
                len(self._escrows), self._total_locked,
            )
        except Exception as e:
            logger.error("Failed to load escrow state: %s", e)

    def _auto_save(self) -> None:
        """Auto-save state after mutations (non-blocking)."""
        try:
            self.save_state()
        except Exception:
            pass
