"""
Smart Contract Service - PaymentEscrow Integration

Uses HederaClient which returns SDK types directly.
For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

import logging
from typing import Optional, Any, TYPE_CHECKING
from enum import IntEnum

from hiero_sdk_python import (
    ContractFunctionParameters,
    ContractFunctionResult,
)

if TYPE_CHECKING:
    from .client import HederaClient
    from hiero_sdk_python import TransactionReceipt

logger = logging.getLogger(__name__)


class TaskStatus(IntEnum):
    """Task status matching PaymentEscrow.sol"""
    CREATED = 0
    IN_PROGRESS = 1
    PENDING_REVIEW = 2
    COMPLETED = 3
    CANCELLED = 4
    EXPIRED = 5
    DISPUTED = 6


class SmartContractService:
    """
    Service for PaymentEscrow contract operations.

    Returns SDK types directly.

    Usage:
        from sdk.hedera import HederaClient
        from sdk.hedera.contracts import SmartContractService

        client = HederaClient.from_env()
        contracts = SmartContractService(client)

        # Deploy contract
        contract_id = contracts.deploy_payment_escrow(mdt_token_address)

        # Create task - returns SDK TransactionReceipt
        receipt = contracts.create_task(
            task_hash="QmXxx...",
            reward_amount=100_00000000,
            duration=86400
        )
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self.config = client.config
        self._bytecode: Optional[bytes] = None

    @property
    def contract_id(self) -> Optional[str]:
        """Get PaymentEscrow contract ID."""
        return self.config.smart_contracts.get("payment_escrow_contract_id")

    @contract_id.setter
    def contract_id(self, value: str):
        self.config.smart_contracts["payment_escrow_contract_id"] = value

    # =========================================================================
    # Deployment
    # =========================================================================

    def load_bytecode(self, path: str = "./contracts/artifacts/PaymentEscrow.bin"):
        """Load compiled contract bytecode."""
        with open(path, 'r') as f:
            self._bytecode = bytes.fromhex(f.read().strip())
        logger.info("Loaded contract bytecode")

    def deploy_payment_escrow(self, mdt_token_address: str, gas: int = 500_000) -> str:
        """
        Deploy PaymentEscrow contract.

        Args:
            mdt_token_address: EVM address of MDT token
            gas: Gas limit

        Returns:
            Contract ID string
        """
        if not self._bytecode:
            raise ValueError("Bytecode not loaded. Call load_bytecode() first.")

        # Encode constructor: constructor(address _mdtToken)
        constructor_params = self._encode_address(mdt_token_address)

        contract_id = self.client.deploy_contract(
            bytecode=self._bytecode + constructor_params,
            gas=gas,
        )

        self.contract_id = contract_id
        logger.info(f"Deployed PaymentEscrow: {contract_id}")
        return contract_id

    # =========================================================================
    # Task Management - Returns SDK TransactionReceipt
    # =========================================================================

    def create_task(
        self,
        task_hash: str,
        reward_amount: int,
        duration: int,
        gas: int = 200_000,
    ) -> "TransactionReceipt":
        """
        Create a new task.

        Args:
            task_hash: IPFS hash of task details
            reward_amount: MDT reward (smallest unit)
            duration: Duration in seconds
            gas: Gas limit

        Returns:
            SDK TransactionReceipt
        """
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

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

    def cancel_task(self, task_id: int, gas: int = 100_000) -> "TransactionReceipt":
        """Cancel a task."""
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

        params = ContractFunctionParameters()
        params.add_uint256(task_id)

        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="cancelTask",
            params=params,
            gas=gas,
        )

    def accept_task(self, task_id: int, gas: int = 100_000) -> "TransactionReceipt":
        """Accept a task as miner."""
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

        params = ContractFunctionParameters()
        params.add_uint256(task_id)

        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="acceptTask",
            params=params,
            gas=gas,
        )

    def submit_result(
        self,
        task_id: int,
        result_hash: str,
        gas: int = 150_000,
    ) -> "TransactionReceipt":
        """Submit result for a task."""
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_string(result_hash)

        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="submitResult",
            params=params,
            gas=gas,
        )

    # =========================================================================
    # Validation - Returns SDK TransactionReceipt
    # =========================================================================

    def validate_submission(
        self,
        task_id: int,
        miner_index: int,
        score: int,
        gas: int = 150_000,
    ) -> "TransactionReceipt":
        """
        Submit validation score.

        Args:
            task_id: Task ID
            miner_index: Index of miner in submissions
            score: Score 0-10000 (basis points)
            gas: Gas limit
        """
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

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

    def finalize_task(self, task_id: int, gas: int = 200_000) -> "TransactionReceipt":
        """Finalize task and pay winner."""
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

        params = ContractFunctionParameters()
        params.add_uint256(task_id)

        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="finalizeTask",
            params=params,
            gas=gas,
        )

    # =========================================================================
    # Admin - Returns SDK TransactionReceipt
    # =========================================================================

    def add_validator(self, validator_address: str, gas: int = 100_000) -> "TransactionReceipt":
        """Add a validator."""
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

        params = ContractFunctionParameters()
        params.add_address(validator_address)

        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="addValidator",
            params=params,
            gas=gas,
        )

    def remove_validator(self, validator_address: str, gas: int = 100_000) -> "TransactionReceipt":
        """Remove a validator."""
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

        params = ContractFunctionParameters()
        params.add_address(validator_address)

        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="removeValidator",
            params=params,
            gas=gas,
        )

    def expire_task(self, task_id: int, gas: int = 200_000) -> "TransactionReceipt":
        """Expire a task that has passed its deadline and refund the depositor.

        Called by EscrowManager.refund_escrow() when a task times out.

        Args:
            task_id: On-chain numeric task identifier
            gas: Gas budget for the transaction

        Returns:
            SDK TransactionReceipt
        """
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

        params = ContractFunctionParameters()
        params.add_uint256(task_id)

        return self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="expireTask",
            params=params,
            gas=gas,
        )

    # =========================================================================
    # Queries - Returns SDK ContractFunctionResult
    # =========================================================================

    def get_total_tasks(self, gas: int = 50_000) -> ContractFunctionResult:
        """Get total tasks created."""
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="totalTasks",
            gas=gas,
        )

    def is_validator(self, address: str, gas: int = 50_000) -> ContractFunctionResult:
        """Check if address is a validator."""
        if not self.contract_id:
            raise ValueError("Contract not deployed.")

        params = ContractFunctionParameters()
        params.add_address(address)

        return self.client.call_contract(
            contract_id=self.contract_id,
            function_name="isValidator",
            params=params,
            gas=gas,
        )

    # =========================================================================
    # Utilities
    # =========================================================================

    @staticmethod
    def _encode_address(address: str) -> bytes:
        """Encode address for constructor."""
        if address.startswith("0x"):
            address = address[2:]
        return bytes.fromhex(address.zfill(64))


# Alias for backwards compatibility
TaskInfo = None  # Not needed - use SDK ContractFunctionResult directly
