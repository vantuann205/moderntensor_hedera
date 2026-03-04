"""
Smart Contract Service — SubnetRegistryV2 + StakingVaultV2 Integration

Targets the CORRECT deployed contracts:
  - SubnetRegistryV2: Task management, subnet operations, miner/validator registration
  - StakingVaultV2: Staking, dynamic reg fee, passive rewards

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import logging
from typing import Optional, TYPE_CHECKING
from enum import IntEnum
from dataclasses import dataclass

from hiero_sdk_python import (
    ContractFunctionParameters,
    ContractFunctionResult,
)

if TYPE_CHECKING:
    from .client import HederaClient
    from hiero_sdk_python import TransactionReceipt

logger = logging.getLogger(__name__)


class TaskStatus(IntEnum):
    """Task status matching SubnetRegistryV2.sol"""

    CREATED = 0
    IN_PROGRESS = 1
    PENDING_REVIEW = 2
    COMPLETED = 3
    CANCELLED = 4
    EXPIRED = 5


class StakeRole(IntEnum):
    """Staking roles matching StakingVaultV2.sol"""

    NONE = 0
    MINER = 1
    VALIDATOR = 2
    HOLDER = 3


@dataclass
class TaskInfo:
    """Task information from contract"""

    id: int
    subnet_id: int
    requester: str
    task_hash: str
    reward_amount: int
    protocol_fee: int
    subnet_fee: int
    deadline: int
    status: TaskStatus
    winning_miner: Optional[str]
    winning_score: int
    created_at: int


# ===========================================================================
# SubnetRegistryV2 Service
# ===========================================================================


class SubnetRegistryService:
    """
    Service for SubnetRegistryV2 contract (task management, subnets).

    Usage:
        from sdk.hedera import HederaClient
        from sdk.hedera.contracts import SubnetRegistryService

        client = HederaClient.from_env()
        registry = SubnetRegistryService(client)
        registry.contract_id = "0.0.8054359"

        # Register miner (must stake first in StakingVaultV2)
        registry.register_miner(subnet_id=0)

        # Create task
        registry.create_task(subnet_id=0, task_hash="QmXxx...", reward=100*1e8, duration=86400)
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self._contract_id: Optional[str] = None

    @property
    def contract_id(self) -> Optional[str]:
        if self._contract_id:
            return self._contract_id
        import os

        return os.getenv("CONTRACT_ID_SUBNET_REGISTRY_V2") or os.getenv(
            "CONTRACT_ID_SUBNET_REGISTRY"
        )

    @contract_id.setter
    def contract_id(self, value: str):
        self._contract_id = value

    def _require_contract(self):
        if not self.contract_id:
            raise ValueError(
                "SubnetRegistry contract ID not set. Set CONTRACT_ID_SUBNET_REGISTRY_V2 in .env"
            )

    # ── Subnet Management ──

    def register_subnet(
        self, name: str, description: str, fee_rate: int, gas: int = 300_000
    ) -> "TransactionReceipt":
        """Register a new subnet. Costs 1000 MDT."""
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

    # ── Miner/Validator Registration ──

    def register_miner(
        self, subnet_id: int, gas: int = 150_000
    ) -> "TransactionReceipt":
        """Register as miner in a subnet. Must have staked as Miner in StakingVaultV2 first."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="registerMiner",
            params=params,
            gas=gas,
        )

    def add_validator(
        self, subnet_id: int, validator_address: str, gas: int = 150_000
    ) -> "TransactionReceipt":
        """Add validator to subnet. Must have staked as Validator in StakingVaultV2."""
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

    # ── Task Management ──

    def create_task(
        self,
        subnet_id: int,
        task_hash: str,
        reward_amount: int,
        duration: int,
        gas: int = 300_000,
    ) -> "TransactionReceipt":
        """Create a task. User pays reward + fees (2% protocol + 8% validator + 5% staking + subnet fee)."""
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
        """Submit result for a task as a miner."""
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

    def validate_submission(
        self, task_id: int, submission_index: int, score: int, gas: int = 200_000
    ) -> "TransactionReceipt":
        """Score a miner submission (0-10000 basis points)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_uint256(submission_index)
        params.add_uint256(score)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="validateSubmission",
            params=params,
            gas=gas,
        )

    def finalize_task(self, task_id: int, gas: int = 300_000) -> "TransactionReceipt":
        """Finalize task: pay miner, validators, fund staking pool."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="finalizeTask",
            params=params,
            gas=gas,
        )

    def expire_task(self, task_id: int, gas: int = 200_000) -> "TransactionReceipt":
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

    def withdraw_earnings(self, gas: int = 150_000) -> "TransactionReceipt":
        """Withdraw pending earnings (miners/validators/subnet owners)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id, function_name="withdrawEarnings", gas=gas
        )

    # ── Queries ──

    def get_subnet(self, subnet_id: int, gas: int = 80_000) -> ContractFunctionResult:
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getSubnet",
            params=params,
            gas=gas,
        )

    def get_task(self, task_id: int, gas: int = 80_000) -> ContractFunctionResult:
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getTask",
            params=params,
            gas=gas,
        )

    def is_miner(
        self, subnet_id: int, address: str, gas: int = 50_000
    ) -> ContractFunctionResult:
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_address(address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isMiner",
            params=params,
            gas=gas,
        )

    def is_validator(
        self, subnet_id: int, address: str, gas: int = 50_000
    ) -> ContractFunctionResult:
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_address(address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isValidator",
            params=params,
            gas=gas,
        )

    def get_validator_reputation(
        self, address: str, gas: int = 80_000
    ) -> ContractFunctionResult:
        """Get validator reputation: totalValidations, accurateValidations, reputationScore, lastActiveAt."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getValidatorReputation",
            params=params,
            gas=gas,
        )

    def port_reputation(
        self, from_subnet: int, to_subnet: int, gas: int = 150_000
    ) -> "TransactionReceipt":
        """Port reputation from one subnet to another (50% decay, 1-day cooldown)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(from_subnet)
        params.add_uint256(to_subnet)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="portReputation",
            params=params,
            gas=gas,
        )

    def get_adaptive_min_validations(
        self, subnet_id: int, reward: int, gas: int = 50_000
    ) -> ContractFunctionResult:
        """Get adaptive min validations for a task reward amount."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_uint256(reward)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getAdaptiveMinValidations",
            params=params,
            gas=gas,
        )


# ===========================================================================
# StakingVaultV2 Service
# ===========================================================================


class StakingVaultService:
    """
    Service for StakingVaultV2 contract (staking, rewards, dynamic reg fee).

    Usage:
        staking = StakingVaultService(client)
        staking.contract_id = "0.0.8054430"

        # Stake as miner (need to approve MDT first)
        staking.stake(amount=10*1e8, role=StakeRole.MINER)

        # Check pending rewards
        result = staking.pending_rewards(address)

        # Claim rewards
        staking.claim_rewards()
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self._contract_id: Optional[str] = None

    @property
    def contract_id(self) -> Optional[str]:
        if self._contract_id:
            return self._contract_id
        import os

        return os.getenv("CONTRACT_ID_STAKING_VAULT_V2") or os.getenv(
            "CONTRACT_ID_STAKING_VAULT"
        )

    @contract_id.setter
    def contract_id(self, value: str):
        self._contract_id = value

    def _require_contract(self):
        if not self.contract_id:
            raise ValueError(
                "StakingVault contract ID not set. Set CONTRACT_ID_STAKING_VAULT_V2 in .env"
            )

    def stake(self, amount: int, role: int, gas: int = 300_000) -> "TransactionReceipt":
        """
        Stake MDT for a role. First stake charges dynamic registration fee (burned).

        Args:
            amount: MDT to stake (in smallest unit, 8 decimals)
            role: StakeRole.MINER(1), StakeRole.VALIDATOR(2), or StakeRole.HOLDER(3)
            gas: Gas limit
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(amount)
        params.add_uint8(role)
        return self.client.execute_contract(
            contract_id=self.contract_id, function_name="stake", params=params, gas=gas
        )

    def request_unstake(self, gas: int = 150_000) -> "TransactionReceipt":
        """Request unstake. Starts 7-day cooldown."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id, function_name="requestUnstake", gas=gas
        )

    def withdraw(self, gas: int = 150_000) -> "TransactionReceipt":
        """Withdraw staked amount after cooldown."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id, function_name="withdraw", gas=gas
        )

    def claim_rewards(self, gas: int = 150_000) -> "TransactionReceipt":
        """Claim accumulated passive staking rewards."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id, function_name="claimRewards", gas=gas
        )

    # ── Queries ──

    def get_current_reg_fee(self, gas: int = 50_000) -> ContractFunctionResult:
        """Get current dynamic registration fee."""
        self._require_contract()
        return self.client.call_contract(
            contract_id=self.contract_id, function_name="getCurrentRegFee", gas=gas
        )

    def pending_rewards(
        self, address: str, gas: int = 50_000
    ) -> ContractFunctionResult:
        """Get pending passive staking rewards."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="pendingRewards",
            params=params,
            gas=gas,
        )

    def get_stake_info(self, address: str, gas: int = 80_000) -> ContractFunctionResult:
        """Get staking info (amount, role, status, pending rewards)."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="getStakeInfo",
            params=params,
            gas=gas,
        )

    def get_pool_stats(self, gas: int = 80_000) -> ContractFunctionResult:
        """Get pool statistics (totalStaked, totalRewards, totalBurned, etc)."""
        self._require_contract()
        return self.client.call_contract(
            contract_id=self.contract_id, function_name="getPoolStats", gas=gas
        )

    def is_miner(self, address: str, gas: int = 50_000) -> ContractFunctionResult:
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isMiner",
            params=params,
            gas=gas,
        )

    def is_validator(self, address: str, gas: int = 50_000) -> ContractFunctionResult:
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(address)
        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isValidator",
            params=params,
            gas=gas,
        )


# ===========================================================================
# Backwards compatibility alias
# ===========================================================================

# Old name → new name
SmartContractService = SubnetRegistryService
