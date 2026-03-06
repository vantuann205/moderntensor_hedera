"""
Subnet Registry Service — SubnetRegistry Contract Integration

Manages subnets, miners, validators, task lifecycle, commit-reveal scoring,
and earnings on-chain.

Contract ABI (SubnetRegistry.sol):
  Subnet: registerSubnet, unregisterSubnet, updateSubnet, setMinValidations
  Miners: registerMiner
  Validators: addValidator, removeValidator
  Tasks: createTask, submitResult, expireTask, finalizeTask
  Scoring: validateSubmission, commitScore, revealScore, getCommitHash,
    setCommitRevealConfig, resolveUnrevealedCommits
  Earnings: withdrawEarnings, withdrawProtocolFees
  Admin: setProtocolTreasury, setStakingVault
  Reputation: portReputation
  View: getSubnet, getTask, getSubmissions, getSubmissionCount, isMiner,
    isValidator, getValidatorScore, getAdaptiveMinValidations, getActiveSubnetCount

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import logging
from enum import IntEnum
from typing import Optional, TYPE_CHECKING

from hiero_sdk_python import ContractFunctionParameters

if TYPE_CHECKING:
    from .client import HederaClient
    from hiero_sdk_python import ContractFunctionResult, TransactionReceipt

logger = logging.getLogger(__name__)


class SubnetStatus(IntEnum):
    """Subnet status matching SubnetRegistry.sol"""

    ACTIVE = 0
    PAUSED = 1
    DEACTIVATED = 2


class SubnetRegistryService:
    """
    Service for SubnetRegistry contract operations.

    Full subnet lifecycle: register subnets, enroll miners/validators,
    create tasks, submit/score/finalize, commit-reveal, withdraw earnings.

    Usage:
        from sdk.hedera.subnet_registry import SubnetRegistryService
        registry = SubnetRegistryService(client)
        registry.contract_id = "0.0.8046035"

        registry.register_subnet("AI Code Review", "Review Solidity code", 300)
        registry.register_miner(subnet_id=0)
        registry.create_task(0, "QmTaskHash...", 100*10**8, 86400)
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self._contract_id: Optional[str] = None

    @property
    def contract_id(self) -> Optional[str]:
        if self._contract_id:
            return self._contract_id
        import os

        cid = os.getenv("HEDERA_SUBNET_REGISTRY_CONTRACT_ID")
        if cid and cid != "None":
            return cid
        return None

    @contract_id.setter
    def contract_id(self, value: str):
        self._contract_id = value

    def _require_contract(self):
        if not self.contract_id:
            raise ValueError("SubnetRegistry contract not set.")

    # ── Subnet Management ────────────────────────────────────────

    def register_subnet(
        self,
        name: str,
        description: str,
        fee_rate: int,
        gas: int = 800_000,
    ) -> "TransactionReceipt":
        """Register a new subnet. fee_rate in basis points (e.g. 300 = 3%)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_string(name)
        params.add_string(description)
        params.add_uint256(fee_rate)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="registerSubnet",
            params=params,
            gas=gas,
        )

    def unregister_subnet(
        self, subnet_id: int, gas: int = 500_000
    ) -> "TransactionReceipt":
        """Unregister a subnet (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="unregisterSubnet",
            params=params,
            gas=gas,
        )

    def update_subnet(
        self,
        subnet_id: int,
        new_fee_rate: int,
        new_status: int = SubnetStatus.ACTIVE,
        gas: int = 150_000,
    ) -> "TransactionReceipt":
        """Update subnet fee rate and status."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_uint256(new_fee_rate)
        params.add_uint8(int(new_status))
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="updateSubnet",
            params=params,
            gas=gas,
        )

    def set_min_validations(
        self, subnet_id: int, new_min: int, gas: int = 100_000
    ) -> "TransactionReceipt":
        """Set minimum validations for a subnet (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_uint256(new_min)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setMinValidations",
            params=params,
            gas=gas,
        )

    # ── Miner Management ─────────────────────────────────────────

    def register_miner(
        self, subnet_id: int, gas: int = 150_000
    ) -> "TransactionReceipt":
        """Register as a miner in a subnet. Must have staked in StakingVault first."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="registerMiner",
            params=params,
            gas=gas,
        )

    # ── Validator Management ─────────────────────────────────────

    def add_validator(
        self, subnet_id: int, validator_address: str, gas: int = 150_000
    ) -> "TransactionReceipt":
        """Add a validator to a subnet. Must have staked in StakingVault first."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_address(validator_address)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="addValidator",
            params=params,
            gas=gas,
        )

    def remove_validator(
        self, subnet_id: int, validator_address: str, gas: int = 100_000
    ) -> "TransactionReceipt":
        """Remove a validator from a subnet (subnet owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_address(validator_address)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="removeValidator",
            params=params,
            gas=gas,
        )

    # ── Task Lifecycle ───────────────────────────────────────────

    def create_task(
        self,
        subnet_id: int,
        task_hash: str,
        reward_amount: int,
        duration: int,
        gas: int = 800_000,
    ) -> "TransactionReceipt":
        """Create a task within a subnet. Caller must approve MDT first."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_string(task_hash)
        params.add_uint256(reward_amount)
        params.add_uint256(duration)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="createTask",
            params=params,
            gas=gas,
        )

    def submit_result(
        self, task_id: int, result_hash: str, gas: int = 200_000
    ) -> "TransactionReceipt":
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

    def expire_task(self, task_id: int, gas: int = 500_000) -> "TransactionReceipt":
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

    def finalize_task(self, task_id: int, gas: int = 800_000) -> "TransactionReceipt":
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

    # ── Scoring ──────────────────────────────────────────────────

    def validate_submission(
        self, task_id: int, miner_index: int, score: int, gas: int = 200_000
    ) -> "TransactionReceipt":
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
    ) -> "TransactionReceipt":
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
    ) -> "TransactionReceipt":
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
        """Compute commit hash for score+salt (pure helper)."""
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
    ) -> "TransactionReceipt":
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
    ) -> "TransactionReceipt":
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

    # ── Earnings ─────────────────────────────────────────────────

    def withdraw_earnings(self, gas: int = 500_000) -> "TransactionReceipt":
        """Withdraw accumulated earnings (miners/validators/subnet owners)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="withdrawEarnings",
            gas=gas,
        )

    def withdraw_protocol_fees(self, gas: int = 500_000) -> "TransactionReceipt":
        """Withdraw protocol fees (protocol owner only)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="withdrawProtocolFees",
            gas=gas,
        )

    # ── Reputation ───────────────────────────────────────────────

    def port_reputation(
        self, from_subnet_id: int, to_subnet_id: int, gas: int = 150_000
    ) -> "TransactionReceipt":
        """Port reputation between subnets (50% decay, 1-day cooldown)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(from_subnet_id)
        params.add_uint256(to_subnet_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="portReputation",
            params=params,
            gas=gas,
        )

    # ── Admin Functions ──────────────────────────────────────────

    def set_protocol_treasury(
        self, new_treasury: str, gas: int = 100_000
    ) -> "TransactionReceipt":
        """Set protocol treasury address (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(new_treasury)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setProtocolTreasury",
            params=params,
            gas=gas,
        )

    def set_staking_vault(
        self, vault_address: str, gas: int = 100_000
    ) -> "TransactionReceipt":
        """Set StakingVault address for cross-contract verification (owner only)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(vault_address)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setStakingVault",
            params=params,
            gas=gas,
        )

    # ── View / Query Functions ───────────────────────────────────

    def get_subnet(self, subnet_id: int, gas: int = 80_000) -> "ContractFunctionResult":
        """Get subnet info by ID."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getSubnet",
            params=params,
            gas=gas,
        )

    def get_task(self, task_id: int, gas: int = 80_000) -> "ContractFunctionResult":
        """Get task info by ID."""
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
        self, task_id: int, gas: int = 80_000
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

    def is_miner(
        self, subnet_id: int, miner_address: str, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Check if address is a registered miner in a subnet."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_address(miner_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isMiner",
            params=params,
            gas=gas,
        )

    def is_validator(
        self, subnet_id: int, validator_address: str, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Check if address is a registered validator in a subnet."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_address(validator_address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isValidator",
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

    def get_adaptive_min_validations(
        self, subnet_id: int, reward_amount: int, gas: int = 50_000
    ) -> "ContractFunctionResult":
        """Get adaptive minimum validations for a reward amount."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_uint256(reward_amount)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getAdaptiveMinValidations",
            params=params,
            gas=gas,
        )

    def get_active_subnet_count(self, gas: int = 50_000) -> "ContractFunctionResult":
        """Get total number of active subnets."""
        self._require_contract()
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getActiveSubnetCount",
            gas=gas,
        )

    def __repr__(self) -> str:
        return f"<SubnetRegistryService contract={self.contract_id}>"
