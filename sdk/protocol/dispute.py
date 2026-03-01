"""
ModernTensor Dispute Manager — SDK wrapper for on-chain dispute resolution.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..hedera.client import HederaClient

logger = logging.getLogger(__name__)


class DisputeManager:
    """SDK wrapper for dispute resolution in PaymentEscrow.sol."""

    def __init__(
        self,
        client: Optional["HederaClient"] = None,
        escrow_contract_id: Optional[str] = None,
    ):
        self.client = client
        self._escrow_contract_id = escrow_contract_id
        logger.info("DisputeManager initialized")

    @property
    def escrow_contract_id(self) -> Optional[str]:
        return self._escrow_contract_id

    @escrow_contract_id.setter
    def escrow_contract_id(self, value: str):
        self._escrow_contract_id = value

    def open_dispute(self, task_id: int, gas: int = 200_000) -> Any:
        """Open a dispute on a completed task."""
        self._require_contract()
        from hiero_sdk_python import ContractFunctionParameters
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        receipt = self.client.execute_contract(
            contract_id=self._escrow_contract_id,
            function_name="openDispute",
            params=params,
            gas=gas,
        )
        logger.info("Dispute opened for task %d", task_id)
        return receipt

    def resolve_dispute(self, task_id: int, requester_wins: bool, gas: int = 300_000) -> Any:
        """Resolve a dispute. Owner/governance only."""
        self._require_contract()
        from hiero_sdk_python import ContractFunctionParameters
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        params.add_bool(requester_wins)
        receipt = self.client.execute_contract(
            contract_id=self._escrow_contract_id,
            function_name="resolveDispute",
            params=params,
            gas=gas,
        )
        winner = "requester" if requester_wins else "miner"
        logger.info("Dispute for task %d resolved: %s wins", task_id, winner)
        return receipt

    def is_disputed(self, task_id: int, gas: int = 50_000) -> bool:
        """Check if a task is currently in dispute."""
        self._require_contract()
        from hiero_sdk_python import ContractFunctionParameters
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        result = self.client.call_contract(
            contract_id=self._escrow_contract_id,
            function_name="isDisputed",
            params=params,
            gas=gas,
        )
        return result.get_bool(0) if result else False

    def get_dispute_deadline(self, task_id: int, gas: int = 50_000) -> int:
        """Get dispute resolution deadline timestamp."""
        self._require_contract()
        from hiero_sdk_python import ContractFunctionParameters
        params = ContractFunctionParameters()
        params.add_uint256(task_id)
        result = self.client.call_contract(
            contract_id=self._escrow_contract_id,
            function_name="disputeDeadlines",
            params=params,
            gas=gas,
        )
        return result.get_uint256(0) if result else 0

    def _require_contract(self):
        if not self._escrow_contract_id:
            raise ValueError("Escrow contract ID not set.")
