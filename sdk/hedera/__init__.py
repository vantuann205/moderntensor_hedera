"""
ModernTensor Hedera Integration

Uses official hiero-sdk-python SDK.
All methods return SDK types directly (TransactionReceipt, TokenInfo, etc.)

For Hedera Hello Future Apex Hackathon 2026
"""

from .config import (
    HederaConfig,
    NetworkType,
    load_hedera_config,
)
from .client import (
    HederaClient,
    connect_hedera,
    async_connect_hedera,
)
from .hcs import (
    HCSService,
    HCSMessageType,
    MinerRegistration,
    ScoreSubmission,
    TaskSubmission,
)
from .hcs_sync import (
    HCSRegistrySync,
)
from .hts import (
    HTSService,
)
from .contracts import (
    SmartContractService,
    TaskStatus,
    TaskInfo,
)
from .subnet_registry import (
    SubnetRegistryService,
)
from .staking_vault import (
    StakingVaultService,
    StakeRole,
)
from .governor import (
    MDTGovernorService,
    ProposalState,
)
from .guard import (
    OnChainGuard,
    GuardResult,
)
from .subnets import (
    SubnetService,
    SubnetConfig,
    SubnetInfo,
    SubnetStatus,
    create_subnet_service,
)
from .errors import (
    HederaError,
    HederaConnectionError,
    HederaTransactionError,
    TopicNotFoundError,
    InsufficientBalanceError,
    TokenNotFoundError,
    ContractNotFoundError,
    ContractCallError,
    ContractExecuteError,
)

__all__ = [
    # Config
    "HederaConfig",
    "NetworkType",
    "load_hedera_config",
    # Client
    "HederaClient",
    "connect_hedera",
    "async_connect_hedera",
    # HCS
    "HCSService",
    "HCSMessageType",
    "MinerRegistration",
    "ScoreSubmission",
    "TaskSubmission",
    "HCSRegistrySync",
    # HTS
    "HTSService",
    # Smart Contracts
    "SmartContractService",
    "TaskStatus",
    "TaskInfo",
    "SubnetRegistryService",
    "StakingVaultService",
    "StakeRole",
    "MDTGovernorService",
    "ProposalState",
    "OnChainGuard",
    "GuardResult",
    # Subnets
    "SubnetService",
    "SubnetConfig",
    "SubnetInfo",
    "SubnetStatus",
    "create_subnet_service",
    # Errors
    "HederaError",
    "HederaConnectionError",
    "HederaTransactionError",
    "TopicNotFoundError",
    "InsufficientBalanceError",
    "TokenNotFoundError",
    "ContractNotFoundError",
    "ContractCallError",
    "ContractExecuteError",
]

