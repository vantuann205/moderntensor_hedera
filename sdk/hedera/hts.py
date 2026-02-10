"""
HTS Service Module - Hedera Token Service

High-level service for HTS operations.
Uses HederaClient which returns SDK types directly.

For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

import logging
from typing import Optional, Dict, List, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .client import HederaClient
    from hiero_sdk_python import TransactionReceipt, TokenInfo

logger = logging.getLogger(__name__)


class HTSService:
    """
    HTS service for ModernTensor MDT token.

    All methods return SDK types directly.

    Usage:
        from sdk.hedera import HederaClient
        from sdk.hedera.hts import HTSService

        client = HederaClient.from_env()
        hts = HTSService(client)

        # Create token - returns token ID string
        token_id = hts.create_mdt_token()

        # Get token info - returns SDK TokenInfo
        info = hts.get_token_info()
        print(f"Name: {info.name}, Supply: {info.total_supply}")

        # Transfer - returns SDK TransactionReceipt
        receipt = hts.transfer(to_account="0.0.12345", amount=100_00000000)
    """

    # MDT Token configuration
    MDT_NAME = "ModernTensor"
    MDT_SYMBOL = "MDT"
    MDT_DECIMALS = 8
    MDT_INITIAL_SUPPLY = 1_000_000_000_00000000  # 1 billion

    def __init__(self, client: "HederaClient"):
        self.client = client
        self.config = client.config

    @property
    def mdt_token_id(self) -> Optional[str]:
        """Get MDT token ID from config."""
        return self.config.hts_token.mdt_token_id

    @mdt_token_id.setter
    def mdt_token_id(self, value: str):
        self.config.hts_token.mdt_token_id = value

    # =========================================================================
    # Token Creation
    # =========================================================================

    def create_mdt_token(
        self,
        initial_supply: Optional[int] = None,
        memo: str = "ModernTensor Token - Decentralized AI Network",
    ) -> str:
        """
        Create the MDT token.

        Returns:
            Token ID string
        """
        supply = initial_supply or self.MDT_INITIAL_SUPPLY

        token_id = self.client.create_token(
            name=self.MDT_NAME,
            symbol=self.MDT_SYMBOL,
            decimals=self.MDT_DECIMALS,
            initial_supply=supply,
            memo=memo,
        )

        self.mdt_token_id = token_id
        logger.info(f"Created MDT token: {token_id}")
        return token_id

    # =========================================================================
    # Token Operations - Return SDK types
    # =========================================================================

    def associate(self, account_id: Optional[str] = None) -> "TransactionReceipt":
        """
        Associate MDT token with an account.

        Returns:
            SDK TransactionReceipt
        """
        if not self.mdt_token_id:
            raise ValueError("MDT token not created. Call create_mdt_token() first.")

        return self.client.associate_token(self.mdt_token_id, account_id)

    def transfer(self, to_account: str, amount: int) -> "TransactionReceipt":
        """
        Transfer MDT tokens (raw amount in smallest unit).

        Args:
            to_account: Recipient account ID
            amount: Amount in smallest unit (1 MDT = 100000000)

        Returns:
            SDK TransactionReceipt
        """
        if not self.mdt_token_id:
            raise ValueError("MDT token not set.")

        return self.client.transfer_token(self.mdt_token_id, to_account, amount)

    def transfer_mdt(self, to_account: str, amount: float) -> "TransactionReceipt":
        """
        Transfer MDT tokens (decimal amount).

        Args:
            to_account: Recipient account ID
            amount: Amount in MDT (e.g., 100.5 MDT)

        Returns:
            SDK TransactionReceipt
        """
        raw_amount = int(amount * (10 ** self.MDT_DECIMALS))
        return self.transfer(to_account, raw_amount)

    # =========================================================================
    # Queries - Return SDK types
    # =========================================================================

    def get_token_info(self, token_id: Optional[str] = None) -> "TokenInfo":
        """
        Get token information.

        Returns:
            SDK TokenInfo object
        """
        tid = token_id or self.mdt_token_id
        if not tid:
            raise ValueError("No token ID specified.")

        return self.client.get_token_info(tid)

    def get_balance(self, account_id: Optional[str] = None) -> int:
        """
        Get MDT token balance for an account.

        Returns:
            Balance in smallest unit
        """
        if not self.mdt_token_id:
            raise ValueError("MDT token not set.")

        balance = self.client.get_balance(account_id)

        # balance.tokens is a dict of token_id -> amount
        if hasattr(balance, 'tokens') and balance.tokens:
            return balance.tokens.get(self.mdt_token_id, 0)
        return 0

    def get_mdt_balance(self, account_id: Optional[str] = None) -> float:
        """
        Get MDT balance in decimal form.

        Returns:
            Balance as float (e.g., 100.5 MDT)
        """
        raw = self.get_balance(account_id)
        return raw / (10 ** self.MDT_DECIMALS)

    # =========================================================================
    # Reward Distribution
    # =========================================================================

    def distribute_rewards(self, rewards: Dict[str, float]) -> List["TransactionReceipt"]:
        """
        Distribute MDT rewards to multiple miners.

        Args:
            rewards: Dict of account_id -> amount in MDT

        Returns:
            List of SDK TransactionReceipts
        """
        receipts = []

        for account_id, amount in rewards.items():
            try:
                receipt = self.transfer_mdt(account_id, amount)
                receipts.append(receipt)
                logger.info(f"Sent {amount} MDT to {account_id}")
            except Exception as e:
                logger.error(f"Failed to send to {account_id}: {e}")

        return receipts

    # =========================================================================
    # Utilities
    # =========================================================================

    @classmethod
    def to_raw(cls, amount: float) -> int:
        """Convert MDT to smallest unit."""
        return int(amount * (10 ** cls.MDT_DECIMALS))

    @classmethod
    def from_raw(cls, amount: int) -> float:
        """Convert smallest unit to MDT."""
        return amount / (10 ** cls.MDT_DECIMALS)

    @classmethod
    def format_mdt(cls, amount: int) -> str:
        """Format raw amount as MDT string."""
        return f"{cls.from_raw(amount):,.8f} MDT"
