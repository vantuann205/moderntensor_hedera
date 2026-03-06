"""
Payment Escrow Service — PaymentEscrow Contract Integration

Wraps the deployed PaymentEscrow contract on Hedera testnet.
Multi-validator consensus escrow with commit-reveal scoring and dispute resolution.

Contract ABI (PaymentEscrow.sol):
  Task lifecycle: createTask, cancelTask, expireTask, acceptTask, submitResult,
    validateSubmission, commitScore, revealScore, finalizeTask, claimTaskReward
  Dispute: openDispute, resolveDispute
  Commit-reveal: getCommitHash, setCommitRevealConfig, resolveUnrevealedCommits
  Earnings: withdrawEarnings
  Admin: addValidator, removeValidator, setMinValidations, setPlatformFeeRate,
    setDisputeGracePeriod, withdrawFees, pause, unpause
  View: getTask, getSubmissions, getSubmissionCount, isValidator, totalTasks,
    getAdaptiveMinValidations, getValidatorScore

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import hashlib
import logging
from dataclasses import dataclass
from enum import IntEnum
from typing import Optional, TYPE_CHECKING

from hiero_sdk_python import ContractFunctionParameters

if TYPE_CHECKING:
    from .client import HederaClient
    from hiero_sdk_python import ContractFunctionResult

logger = logging.getLogger(__name__)


class EscrowTaskStatus(IntEnum):
    """Task status matching PaymentEscrow.sol"""

    CREATED = 0
    IN_PROGRESS = 1
    PENDING_REVIEW = 2
    COMPLETED = 3
    CANCELLED = 4
    EXPIRED = 5
    DISPUTED = 6


@dataclass
class EscrowEntry:
    """Simplified task info for backward compat."""

    task_id: int
    requester: str
    reward_amount: int
    deadline: int
    status: int
    winner: str


class PaymentEscrowService:
    """
    Service for PaymentEscrow contract operations.

    Multi-validator escrow with commit-reveal scoring:
    - Requester creates task with MDT reward
    - Miners submit results
    - Validators score via direct or commit-reveal
    - Task finalized, winner gets reward
    - Dispute resolution available

    Usage:
        from sdk.hedera.payment_escrow import PaymentEscrowService
        escrow = PaymentEscrowService(client)
        escrow.contract_id = "0.0.8045890"

        escrow.create_task("QmTaskHash...", reward_amount=100*10**8, duration=86400)
        escrow.submit_result(task_id=0, result_hash="QmResultHash...")
        escrow.validate_submission(task_id=0, miner_index=0, score=8500)
        escrow.finalize_task(task_id=0)
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self._contract_id: Optional[str] = None

    @property
    def contract_id(self) -> Optional[str]:
        if self._contract_id:
            return self._contract_id
        import os

        cid = os.getenv("HEDERA_PAYMENT_ESCROW_CONTRACT_ID")
        if cid and cid != "None":
            return cid
        return None

    @contract_id.setter
    def contract_id(self, value: str):
        self._contract_id = value

    def _require_contract(self):
        if not self.contract_id:
            raise ValueError(
                "PaymentEscrow contract ID not set. "
                "Set HEDERA_PAYMENT_ESCROW_CONTRACT_ID env var or "
                "assign escrow.contract_id = '0.0.xxxx'"
            )

    @staticmethod
    def make_request_id(task_id: str) -> bytes:
        """Generate a deterministic bytes32 ID from a task string (SHA-256)."""
        return hashlib.sha256(task_id.encode("utf-8")).digest()

    # ── Task Lifecycle ───────────────────────────────────────────

    def create_task(
        self, task_hash: str, reward_amount: int, duration: int, gas: int = 800_000
    ):
        """Create a task with MDT reward. Caller must approve MDT first."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_string(task_hash)
        params.add_uint256(reward_amount)
        params.add_uint256(duration)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="createTask",
            params=params,
            gas=gas,
        )

    def cancel_task(self, task_id: int, gas: int = 200_000):
        """Cancel a task (requester only, before any submissions)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="cancelTask",
            params=params,
            gas=gas,
        )

    def expire_task(self, task_id: int, gas: int = 200_000):
        """Expire a timed-out task and refund requester."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="expireTask",
            params=params,
            gas=gas,
        )

    def accept_task(self, task_id: int, gas: int = 200_000):
        """Accept a task (miner)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="acceptTask",
            params=params,
            gas=gas,
        )

    def submit_result(self, task_id: int, result_hash: str, gas: int = 200_000):
        """Submit a result for a task (miner)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_string(result_hash)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="submitResult",
            params=params,
            gas=gas,
        )

    # ── Scoring ──────────────────────────────────────────────────

    def validate_submission(
        self, task_id: int, miner_index: int, score: int, gas: int = 200_000
    ):
        """Score a submission directly (0-10000 bps). Validator only."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_uint256(miner_index)
        params.add_uint256(score)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="validateSubmission",
            params=params,
            gas=gas,
        )

    def commit_score(
        self, task_id: int, miner_index: int, commit_hash: bytes, gas: int = 200_000
    ):
        """Commit a hashed score (commit-reveal mode). Validator only."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_uint256(miner_index)
        params.add_bytes32(commit_hash)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="commitScore",
            params=params,
            gas=gas,
        )

    def reveal_score(
        self,
        task_id: int,
        miner_index: int,
        score: int,
        salt: bytes,
        gas: int = 200_000,
    ):
        """Reveal a previously committed score."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_uint256(miner_index)
        params.add_uint256(score)
        params.add_bytes32(salt)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="revealScore",
            params=params,
            gas=gas,
        )

    def get_commit_hash(
        self, score: int, salt: bytes, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Compute commit hash for a score+salt (pure helper)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(score)
        params.add_bytes32(salt)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getCommitHash",
            params=params,
            gas=gas,
        )

    def set_commit_reveal_config(
        self, commit_duration: int, reveal_duration: int, gas: int = 100_000
    ):
        """Set commit and reveal duration in seconds (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(commit_duration)
        params.add_uint256(reveal_duration)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setCommitRevealConfig",
            params=params,
            gas=gas,
        )

    def resolve_unrevealed_commits(
        self, task_id: int, miner_index: int, gas: int = 200_000
    ):
        """Resolve unrevealed commits after reveal deadline."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_uint256(miner_index)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="resolveUnrevealedCommits",
            params=params,
            gas=gas,
        )

    # ── Finalization & Rewards ───────────────────────────────────

    def finalize_task(self, task_id: int, gas: int = 800_000):
        """Finalize task: determine winner, distribute rewards."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="finalizeTask",
            params=params,
            gas=gas,
        )

    def claim_task_reward(self, task_id: int, gas: int = 500_000):
        """Claim reward for a specific completed task (winner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="claimTaskReward",
            params=params,
            gas=gas,
        )

    def withdraw_earnings(self, gas: int = 500_000):
        """Withdraw accumulated earnings (miners/validators)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="withdrawEarnings",
            gas=gas,
        )

    # ── Dispute ──────────────────────────────────────────────────

    def open_dispute(self, task_id: int, gas: int = 200_000):
        """Open a dispute on a completed task (requester only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="openDispute",
            params=params,
            gas=gas,
        )

    def resolve_dispute(self, task_id: int, requester_wins: bool, gas: int = 300_000):
        """Resolve a dispute (owner only). requester_wins=True refunds requester."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_bool(requester_wins)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="resolveDispute",
            params=params,
            gas=gas,
        )

    # ── Admin Functions ──────────────────────────────────────────

    def add_validator(self, validator_address: str, gas: int = 100_000):
        """Add a validator (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(validator_address)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="addValidator",
            params=params,
            gas=gas,
        )

    def remove_validator(self, validator_address: str, gas: int = 100_000):
        """Remove a validator (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(validator_address)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="removeValidator",
            params=params,
            gas=gas,
        )

    def set_min_validations(self, new_min: int, gas: int = 100_000):
        """Set minimum validations required (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(new_min)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setMinValidations",
            params=params,
            gas=gas,
        )

    def set_platform_fee_rate(self, new_rate: int, gas: int = 100_000):
        """Set platform fee rate in basis points (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(new_rate)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setPlatformFeeRate",
            params=params,
            gas=gas,
        )

    def set_dispute_grace_period(self, new_period: int, gas: int = 100_000):
        """Set dispute grace period in seconds (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(new_period)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setDisputeGracePeriod",
            params=params,
            gas=gas,
        )

    def withdraw_fees(self, to_address: str, gas: int = 200_000):
        """Withdraw accumulated protocol fees (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(to_address)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="withdrawFees",
            params=params,
            gas=gas,
        )

    def pause(self, gas: int = 50_000):
        """Pause contract (owner only)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id, function_name="pause", gas=gas
        )

    def unpause(self, gas: int = 50_000):
        """Unpause contract (owner only)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id, function_name="unpause", gas=gas
        )

    # ── View / Query Functions ───────────────────────────────────

    def get_task(self, task_id: int, gas: int = 100_000) -> "ContractFunctionResult":
        """Query task info by ID."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getTask",
            params=params,
            gas=gas,
        )

    def get_submissions(
        self, task_id: int, gas: int = 100_000
    ) -> "ContractFunctionResult":
        """Get all submissions for a task."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getSubmissions",
            params=params,
            gas=gas,
        )

    def get_submission_count(
        self, task_id: int, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Get number of submissions for a task."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getSubmissionCount",
            params=params,
            gas=gas,
        )

    def is_validator(self, account: str, gas: int = 50_000) -> "ContractFunctionResult":
        """Check if an address is a registered validator."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(account)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isValidator",
            params=params,
            gas=gas,
        )

    def total_tasks(self, gas: int = 50_000) -> "ContractFunctionResult":
        """Get total number of tasks created."""
        self._require_contract()
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="totalTasks",
            gas=gas,
        )

    def get_adaptive_min_validations(
        self, reward_amount: int, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Get adaptive minimum validations for a reward amount."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(reward_amount)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getAdaptiveMinValidations",
            params=params,
            gas=gas,
        )

    def get_validator_score(
        self, task_id: int, miner_index: int, validator: str, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Get a specific validator's score for a submission."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_uint256(miner_index)
        params.add_address(validator)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getValidatorScore",
            params=params,
            gas=gas,
        )

    def __repr__(self) -> str:
        return f"<PaymentEscrowService contract={self.contract_id}>"
