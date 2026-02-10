"""
Hedera Configuration Module

Configuration management for Hedera network connections.
Supports testnet, mainnet, and previewnet.
"""

import os
import logging
from enum import Enum
from typing import Optional
from dataclasses import dataclass, field

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class NetworkType(str, Enum):
    """Hedera network types."""
    MAINNET = "mainnet"
    TESTNET = "testnet"
    PREVIEWNET = "previewnet"


@dataclass
class HCSTopicConfig:
    """Configuration for HCS topics."""
    registration_topic_id: Optional[str] = None
    scoring_topic_id: Optional[str] = None
    task_topic_id: Optional[str] = None


@dataclass
class HTSTokenConfig:
    """Configuration for HTS tokens."""
    mdt_token_id: Optional[str] = None
    token_decimals: int = 8
    initial_supply: int = 1_000_000_000  # 1 billion MDT


@dataclass
class SmartContractConfig:
    """Configuration for smart contracts."""
    payment_escrow_contract_id: Optional[str] = None
    payment_escrow_evm_address: Optional[str] = None


class HederaSettings(BaseSettings):
    """
    Hedera configuration from environment variables.

    Environment Variables:
        HEDERA_NETWORK: Network type (testnet, mainnet, previewnet)
        HEDERA_ACCOUNT_ID: Account ID (e.g., 0.0.12345)
        HEDERA_PRIVATE_KEY: Private key for signing transactions
        HEDERA_OPERATOR_KEY: Operator key (alias for private key)

        # HCS Topics (created once, then stored)
        HEDERA_REGISTRATION_TOPIC_ID: Topic for miner registration
        HEDERA_SCORING_TOPIC_ID: Topic for scoring messages
        HEDERA_TASK_TOPIC_ID: Topic for task submissions

        # HTS Token
        HEDERA_MDT_TOKEN_ID: MDT token ID

        # Smart Contracts
        HEDERA_PAYMENT_ESCROW_CONTRACT_ID: Payment escrow contract ID
    """

    model_config = SettingsConfigDict(
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # Network Configuration
    HEDERA_NETWORK: str = Field(
        default="testnet",
        description="Hedera network: testnet, mainnet, or previewnet"
    )

    # Account Configuration
    HEDERA_ACCOUNT_ID: str = Field(
        default="",
        description="Hedera account ID (e.g., 0.0.12345)"
    )

    HEDERA_PRIVATE_KEY: str = Field(
        default="",
        description="Hedera private key for signing transactions"
    )

    HEDERA_OPERATOR_KEY: Optional[str] = Field(
        default=None,
        description="Operator key (alternative to private key)"
    )

    # HCS Topics
    HEDERA_REGISTRATION_TOPIC_ID: Optional[str] = Field(
        default=None,
        description="HCS topic for miner registration"
    )

    HEDERA_SCORING_TOPIC_ID: Optional[str] = Field(
        default=None,
        description="HCS topic for scoring"
    )

    HEDERA_TASK_TOPIC_ID: Optional[str] = Field(
        default=None,
        description="HCS topic for task submissions"
    )

    # HTS Token
    HEDERA_MDT_TOKEN_ID: Optional[str] = Field(
        default=None,
        description="MDT token ID on HTS"
    )

    # Smart Contracts
    HEDERA_PAYMENT_ESCROW_CONTRACT_ID: Optional[str] = Field(
        default=None,
        description="Payment escrow smart contract ID"
    )

    # API Configuration
    HEDERA_MIRROR_NODE_URL: Optional[str] = Field(
        default=None,
        description="Custom mirror node URL (optional)"
    )

    # Transaction Settings
    HEDERA_MAX_TRANSACTION_FEE: int = Field(
        default=10_000_000,  # 0.1 HBAR in tinybars
        description="Maximum transaction fee in tinybars"
    )

    HEDERA_TRANSACTION_TIMEOUT: int = Field(
        default=30,
        description="Transaction timeout in seconds"
    )


@dataclass
class HederaConfig:
    """
    Complete Hedera configuration for ModernTensor.

    Usage:
        config = HederaConfig.from_env()
        # or
        config = load_hedera_config()
    """

    # Network
    network: NetworkType = NetworkType.TESTNET

    # Account
    account_id: str = ""
    private_key: str = ""

    # Service Configurations
    hcs_topics: HCSTopicConfig = field(default_factory=HCSTopicConfig)
    hts_token: HTSTokenConfig = field(default_factory=HTSTokenConfig)
    smart_contracts: SmartContractConfig = field(default_factory=SmartContractConfig)

    # Mirror Node
    mirror_node_url: Optional[str] = None

    # Transaction Settings
    max_transaction_fee: int = 10_000_000  # 0.1 HBAR
    transaction_timeout: int = 30

    @classmethod
    def from_env(cls) -> "HederaConfig":
        """Load configuration from environment variables."""
        settings = HederaSettings()

        # Parse network
        network = NetworkType.TESTNET
        network_str = settings.HEDERA_NETWORK.lower()
        if network_str == "mainnet":
            network = NetworkType.MAINNET
        elif network_str == "previewnet":
            network = NetworkType.PREVIEWNET

        # HCS Topics
        hcs_topics = HCSTopicConfig(
            registration_topic_id=settings.HEDERA_REGISTRATION_TOPIC_ID,
            scoring_topic_id=settings.HEDERA_SCORING_TOPIC_ID,
            task_topic_id=settings.HEDERA_TASK_TOPIC_ID,
        )

        # HTS Token
        hts_token = HTSTokenConfig(
            mdt_token_id=settings.HEDERA_MDT_TOKEN_ID,
        )

        # Smart Contracts
        smart_contracts = SmartContractConfig(
            payment_escrow_contract_id=settings.HEDERA_PAYMENT_ESCROW_CONTRACT_ID,
        )

        # Determine mirror node URL
        if settings.HEDERA_MIRROR_NODE_URL:
            mirror_url = settings.HEDERA_MIRROR_NODE_URL
        else:
            # Default mirror node URLs
            mirror_urls = {
                NetworkType.MAINNET: "https://mainnet-public.mirrornode.hedera.com",
                NetworkType.TESTNET: "https://testnet.mirrornode.hedera.com",
                NetworkType.PREVIEWNET: "https://previewnet.mirrornode.hedera.com",
            }
            mirror_url = mirror_urls.get(network, mirror_urls[NetworkType.TESTNET])

        return cls(
            network=network,
            account_id=settings.HEDERA_ACCOUNT_ID,
            private_key=settings.HEDERA_PRIVATE_KEY or settings.HEDERA_OPERATOR_KEY or "",
            hcs_topics=hcs_topics,
            hts_token=hts_token,
            smart_contracts=smart_contracts,
            mirror_node_url=mirror_url,
            max_transaction_fee=settings.HEDERA_MAX_TRANSACTION_FEE,
            transaction_timeout=settings.HEDERA_TRANSACTION_TIMEOUT,
        )

    def validate(self) -> bool:
        """
        Validate configuration is complete for basic operations.

        Returns:
            True if valid, raises ValueError otherwise.
        """
        if not self.account_id:
            raise ValueError("HEDERA_ACCOUNT_ID is required")

        if not self.private_key:
            raise ValueError("HEDERA_PRIVATE_KEY is required")

        # Validate account ID format (0.0.XXXXX)
        if not self._is_valid_entity_id(self.account_id):
            raise ValueError(f"Invalid account ID format: {self.account_id}")

        return True

    @staticmethod
    def _is_valid_entity_id(entity_id: str) -> bool:
        """Check if entity ID has valid format (shard.realm.num)."""
        if not entity_id:
            return False
        parts = entity_id.split(".")
        if len(parts) != 3:
            return False
        try:
            for part in parts:
                int(part)
            return True
        except ValueError:
            return False

    @property
    def is_testnet(self) -> bool:
        return self.network == NetworkType.TESTNET

    @property
    def is_mainnet(self) -> bool:
        return self.network == NetworkType.MAINNET

    def __repr__(self) -> str:
        return (
            f"HederaConfig("
            f"network={self.network.value}, "
            f"account_id={self.account_id}, "
            f"mdt_token={self.hts_token.mdt_token_id or 'Not Created'}"
            f")"
        )


def load_hedera_config() -> HederaConfig:
    """
    Load Hedera configuration from environment.

    Returns:
        HederaConfig instance

    Example:
        config = load_hedera_config()
        print(f"Network: {config.network}")
        print(f"Account: {config.account_id}")
    """
    config = HederaConfig.from_env()
    logger.info(f"Loaded Hedera config: {config}")
    return config
