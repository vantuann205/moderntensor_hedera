"""
Payment Escrow Service — PaymentEscrow Contract Integration

Wraps the deployed PaymentEscrow contract on Hedera testnet.
Handles task deposits, payment releases to miners, refunds, and fee management.

Contract ABI functions:
  - deposit(bytes32 requestId, uint256 amount, uint256 timeout)
  - release(bytes32 requestId, address miner)
  - refund(bytes32 requestId)
  - getEscrow(bytes32 requestId) → EscrowEntry
  - canRefund(bytes32 requestId) → bool
  - setAIOracle(address _aiOracle)   [owner only]
  - setProtocolFee(uint256 _feeBps)   [owner only]
  - withdrawFees(address recipient)   [owner only]

View functions:
  - accumulatedFees() → uint256
  - aiOracle() → address
  - mdtToken() → address
  - minTimeout() → uint256
  - protocolFeeBps() → uint256

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import hashlib
import logging
from dataclasses import dataclass
from typing import Optional, TYPE_CHECKING

from hiero_sdk_python import ContractFunctionParameters

if TYPE_CHECKING:
    from .client import HederaClient

logger = logging.getLogger(__name__)


@dataclass
class EscrowEntry:
    """Escrow entry returned by getEscrow()."""

    depositor: str
    amount: int
    deposited_at: int
    timeout: int
    released: bool
    refunded: bool


class PaymentEscrowService:
    """
    Service for PaymentEscrow contract operations.

    Manages MDT token escrow for task payments:
    - Requester deposits MDT into escrow for a task
    - AI Oracle releases payment to winning miner
    - Depositor can refund after timeout

    Usage:
        from sdk.hedera import HederaClient
        from sdk.hedera.payment_escrow import PaymentEscrowService

        client = HederaClient.from_env()
        escrow = PaymentEscrowService(client)

        # Generate request ID from task string
        request_id = PaymentEscrowService.make_request_id("task-001")

        # Deposit MDT for a task (requires ERC20 approve first)
        escrow.deposit(request_id, amount=100 * 10**8, timeout=3600)

        # Oracle releases payment to miner
        escrow.release(request_id, miner_address="0x...")

        # Query escrow
        entry = escrow.get_escrow(request_id)
    """

    def __init__(self, client: "HederaClient"):
        self.client = client
        self._contract_id: Optional[str] = None

    # ── Contract ID ──────────────────────────────────────────────

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

    # ── Helpers ──────────────────────────────────────────────────

    @staticmethod
    def make_request_id(task_id: str) -> bytes:
        """
        Generate a deterministic bytes32 request ID from a task string.

        Uses SHA-256 (which produces 32 bytes) — same as keccak256 length.

        Args:
            task_id: Human-readable task identifier (e.g. "task-001")

        Returns:
            32-byte hash suitable for the contract's bytes32 requestId
        """
        return hashlib.sha256(task_id.encode("utf-8")).digest()

    # ── State-Changing Functions ─────────────────────────────────

    def deposit(
        self,
        request_id: bytes,
        amount: int,
        timeout: int,
        gas: int = 300_000,
    ):
        """
        Deposit MDT tokens into escrow for a task.

        The caller must have approved the PaymentEscrow contract to spend
        `amount` MDT tokens (via ERC20 approve or HTS allowance) before
        calling this function.

        Args:
            request_id: 32-byte unique task identifier
            amount: MDT amount in smallest unit (8 decimals)
            timeout: Seconds until the deposit can be refunded
            gas: Gas limit

        Returns:
            TransactionReceipt from Hedera
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_bytes32(request_id)
        params.add_uint256(amount)
        params.add_uint256(timeout)

        receipt = self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="deposit",
            params=params,
            gas=gas,
        )
        logger.info(
            f"PaymentEscrow.deposit: request={request_id.hex()[:16]}... "
            f"amount={amount} timeout={timeout}s"
        )
        return receipt

    def release(
        self,
        request_id: bytes,
        miner_address: str,
        gas: int = 300_000,
    ):
        """
        Release escrowed payment to a miner (oracle only).

        Only the configured AI Oracle address can call this function.

        Args:
            request_id: 32-byte unique task identifier
            miner_address: EVM address of the winning miner
            gas: Gas limit

        Returns:
            TransactionReceipt from Hedera
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_bytes32(request_id)
        params.add_address(miner_address)

        receipt = self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="release",
            params=params,
            gas=gas,
        )
        logger.info(
            f"PaymentEscrow.release: request={request_id.hex()[:16]}... "
            f"miner={miner_address}"
        )
        return receipt

    def refund(self, request_id: bytes, gas: int = 200_000):
        """
        Refund escrowed deposit back to the depositor.

        Can only be called by the original depositor after the timeout
        has expired and if the escrow has not been released.

        Args:
            request_id: 32-byte unique task identifier
            gas: Gas limit

        Returns:
            TransactionReceipt from Hedera
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_bytes32(request_id)

        receipt = self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="refund",
            params=params,
            gas=gas,
        )
        logger.info(f"PaymentEscrow.refund: request={request_id.hex()[:16]}...")
        return receipt

    # ── Owner Functions ──────────────────────────────────────────

    def set_ai_oracle(self, oracle_address: str, gas: int = 100_000):
        """
        Set the AI Oracle address (owner only).

        The oracle is the only account authorized to release payments.

        Args:
            oracle_address: EVM address of the AI oracle
            gas: Gas limit

        Returns:
            TransactionReceipt from Hedera
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(oracle_address)

        receipt = self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setAIOracle",
            params=params,
            gas=gas,
        )
        logger.info(f"PaymentEscrow.setAIOracle: {oracle_address}")
        return receipt

    def set_protocol_fee(self, fee_bps: int, gas: int = 100_000):
        """
        Set the protocol fee in basis points (owner only).

        Args:
            fee_bps: Fee in basis points (e.g. 500 = 5%)
            gas: Gas limit

        Returns:
            TransactionReceipt from Hedera
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_uint256(fee_bps)

        receipt = self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="setProtocolFee",
            params=params,
            gas=gas,
        )
        logger.info(f"PaymentEscrow.setProtocolFee: {fee_bps} bps")
        return receipt

    def withdraw_fees(self, recipient_address: str, gas: int = 200_000):
        """
        Withdraw accumulated protocol fees (owner only).

        Args:
            recipient_address: EVM address to receive fees
            gas: Gas limit

        Returns:
            TransactionReceipt from Hedera
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_address(recipient_address)

        receipt = self.client.execute_contract(
            contract_id=self.contract_id,
            function_name="withdrawFees",
            params=params,
            gas=gas,
        )
        logger.info(f"PaymentEscrow.withdrawFees -> {recipient_address}")
        return receipt

    # ── Read-Only Query Functions ────────────────────────────────

    def get_escrow(
        self, request_id: bytes, gas: int = 100_000
    ) -> Optional[EscrowEntry]:
        """
        Query an escrow entry by request ID.

        Args:
            request_id: 32-byte unique task identifier
            gas: Gas limit

        Returns:
            EscrowEntry dataclass or None if query fails
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_bytes32(request_id)

        try:
            result = self.client.call_contract(
                contract_id=self.contract_id,
                function_name="getEscrow",
                params=params,
                gas=gas,
            )
            # Result is a tuple: (depositor, amount, depositedAt, timeout, released, refunded)
            return EscrowEntry(
                depositor=result.get_address(0),
                amount=result.get_uint256(1),
                deposited_at=result.get_uint256(2),
                timeout=result.get_uint256(3),
                released=result.get_bool(4),
                refunded=result.get_bool(5),
            )
        except Exception as e:
            logger.warning(f"PaymentEscrow.getEscrow failed: {e}")
            return None

    def can_refund(self, request_id: bytes, gas: int = 100_000) -> bool:
        """
        Check if an escrow entry can be refunded.

        Args:
            request_id: 32-byte unique task identifier
            gas: Gas limit

        Returns:
            True if the escrow can be refunded
        """
        self._require_contract()
        params = ContractFunctionParameters()
        params.add_bytes32(request_id)

        try:
            result = self.client.call_contract(
                contract_id=self.contract_id,
                function_name="canRefund",
                params=params,
                gas=gas,
            )
            return result.get_bool(0)
        except Exception as e:
            logger.warning(f"PaymentEscrow.canRefund failed: {e}")
            return False

    def get_accumulated_fees(self, gas: int = 100_000) -> int:
        """Query total accumulated protocol fees."""
        self._require_contract()
        try:
            result = self.client.call_contract(
                contract_id=self.contract_id,
                function_name="accumulatedFees",
                gas=gas,
            )
            return result.get_uint256(0)
        except Exception as e:
            logger.warning(f"PaymentEscrow.accumulatedFees failed: {e}")
            return 0

    def get_ai_oracle(self, gas: int = 100_000) -> Optional[str]:
        """Query the current AI Oracle address."""
        self._require_contract()
        try:
            result = self.client.call_contract(
                contract_id=self.contract_id,
                function_name="aiOracle",
                gas=gas,
            )
            return result.get_address(0)
        except Exception as e:
            logger.warning(f"PaymentEscrow.aiOracle query failed: {e}")
            return None

    def get_protocol_fee_bps(self, gas: int = 100_000) -> int:
        """Query the protocol fee in basis points."""
        self._require_contract()
        try:
            result = self.client.call_contract(
                contract_id=self.contract_id,
                function_name="protocolFeeBps",
                gas=gas,
            )
            return result.get_uint256(0)
        except Exception as e:
            logger.warning(f"PaymentEscrow.protocolFeeBps query failed: {e}")
            return 0

    def get_min_timeout(self, gas: int = 100_000) -> int:
        """Query the minimum timeout for deposits."""
        self._require_contract()
        try:
            result = self.client.call_contract(
                contract_id=self.contract_id,
                function_name="minTimeout",
                gas=gas,
            )
            return result.get_uint256(0)
        except Exception as e:
            logger.warning(f"PaymentEscrow.minTimeout query failed: {e}")
            return 0

    def get_mdt_token(self, gas: int = 100_000) -> Optional[str]:
        """Query the MDT token address used by the contract."""
        self._require_contract()
        try:
            result = self.client.call_contract(
                contract_id=self.contract_id,
                function_name="mdtToken",
                gas=gas,
            )
            return result.get_address(0)
        except Exception as e:
            logger.warning(f"PaymentEscrow.mdtToken query failed: {e}")
            return None

    def __repr__(self) -> str:
        return f"<PaymentEscrowService contract={self.contract_id}>"
