"""
Subnet Registry Service - SubnetRegistry Integration

Uses HederaClient which returns SDK types directly.
For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

import logging
from typing import Optional, TYPE_CHECKING

from hiero_sdk_python import ContractFunctionParameters

if TYPE_CHECKING:
    from .client import HederaClient
    from hiero_sdk_python import TransactionReceipt

logger = logging.getLogger(__name__)


class SubnetRegistryService:
    """
    Service for SubnetRegistry contract operations.

    Manages subnet registration, miner enrollment, and subnet-level
    task management on-chain.

    Usage:
        from sdk.hedera import HederaClient
        from sdk.hedera.subnet_registry import SubnetRegistryService

        client = HederaClient.from_env()
        registry = SubnetRegistryService(client)

        # Register a subnet
        receipt = registry.register_subnet("AI Code Review", 3, 100_00000000)
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self.config = client.config
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

    # =========================================================================
    # Subnet Management
    # =========================================================================

    def register_subnet(
        self,
        name: str,
        min_validations: int = 3,
        min_stake: int = 100_00000000,
        gas: int = 300_000,
    ) -> "TransactionReceipt":
        """Register a new subnet."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_string(name)
        params.add_uint256(min_validations)
        params.add_uint256(min_stake)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="registerSubnet",
            params=params,
            gas=gas,
        )

    def unregister_subnet(self, subnet_id: int, gas: int = 100_000) -> "TransactionReceipt":
        """Unregister a subnet."""
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
        new_name: str,
        new_min_stake: int,
        gas: int = 150_000,
    ) -> "TransactionReceipt":
        """Update subnet metadata."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        params.add_string(new_name)
        params.add_uint256(new_min_stake)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="updateSubnet",
            params=params,
            gas=gas,
        )

    # =========================================================================
    # Miner Management
    # =========================================================================

    def register_miner(self, subnet_id: int, gas: int = 150_000) -> "TransactionReceipt":
        """Register as a miner in a subnet."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(subnet_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="registerMiner",
            params=params,
            gas=gas,
        )

    # =========================================================================
    # Validator Management
    # =========================================================================

    def add_validator(
        self, subnet_id: int, validator_address: str, gas: int = 100_000
    ) -> "TransactionReceipt":
        """Add a validator to a subnet."""
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
        """Remove a validator from a subnet."""
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

    # =========================================================================
    # Task Management (Subnet-level)
    # =========================================================================

    def create_task(
        self,
        subnet_id: int,
        task_hash: str,
        reward_amount: int,
        duration: int,
        gas: int = 300_000,
    ) -> "TransactionReceipt":
        """Create a task within a subnet."""
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
        self,
        task_id: int,
        result_hash: str,
        gas: int = 200_000,
    ) -> "TransactionReceipt":
        """Submit a result for a task."""
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
        self,
        task_id: int,
        miner_index: int,
        score: int,
        gas: int = 200_000,
    ) -> "TransactionReceipt":
        """Score a submission (direct scoring mode)."""
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

    def finalize_task(self, task_id: int, gas: int = 300_000) -> "TransactionReceipt":
        """Finalize a task and distribute rewards."""
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
        """Expire a timed-out task and refund."""
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="expireTask",
            params=params,
            gas=gas,
        )

    # =========================================================================
    # Earnings
    # =========================================================================

    def withdraw_earnings(self, gas: int = 150_000) -> "TransactionReceipt":
        """Withdraw accumulated earnings."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="withdrawEarnings",
            gas=gas,
        )

    def withdraw_protocol_fees(self, gas: int = 150_000) -> "TransactionReceipt":
        """Withdraw protocol fees (owner only)."""
        self._require_contract()
        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="withdrawProtocolFees",
            gas=gas,
        )
