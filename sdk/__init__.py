"""
ModernTensor SDK — Full Marketplace Protocol on Hedera

Four-layer architecture:
  1. sdk.hedera       — Hedera service layer (HCS, HTS, HSCS)
  2. sdk.protocol     — Protocol core (tasks, miners, fees, matching)
  3. sdk.scoring      — Scoring engine (multi-dim, consensus, PoI)
  4. sdk.marketplace  — Orchestrator (unifies all layers)

For Hedera Hello Future Apex Hackathon 2026.
"""

# -----------------------------------------------------------------------
# Layer 1: Hedera Service Layer
# -----------------------------------------------------------------------
from .hedera import (
    # Config
    HederaConfig,
    NetworkType,
    load_hedera_config,
    # Client
    HederaClient,
    connect_hedera,
    async_connect_hedera,
    # HCS
    HCSService,
    HCSMessageType,
    MinerRegistration,
    ScoreSubmission,
    TaskSubmission,
    # HTS
    HTSService,
    # Smart Contracts
    SmartContractService,
    TaskStatus as HederaTaskStatus,
    TaskInfo,
    # Subnets
    SubnetService,
    SubnetConfig,
    SubnetInfo as HederaSubnetInfo,
    SubnetStatus,
    create_subnet_service,
    # Errors
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

# -----------------------------------------------------------------------
# Layer 2: Protocol Core
# -----------------------------------------------------------------------
from .protocol import (
    # Types
    TaskStatus,
    TaskPriority,
    MinerStatus,
    TaskRequest,
    TaskResult,
    TaskAssignment,
    MinerInfo,
    MinerReputation,
    ValidatorScore,
    ScoreBreakdown,
    FeeBreakdown,
    PaymentInfo,
    ProtocolConfig,
    # Engines
    FeeEngine,
    MinerRegistry,
    TaskManager,
    ValidationOrchestrator,
    TaskMatcher,
    # Reward System
    RewardDistributor,
    RewardTransaction,
    RewardBatch,
    EscrowManager,
    EscrowDeposit,
    EscrowStatus,
    Treasury,
    PayoutRecord,
    TreasurySnapshot,
)

# -----------------------------------------------------------------------
# Layer 3: Scoring Engine
# -----------------------------------------------------------------------
from .scoring import (
    ScoringDimension,
    DimensionConfig,
    MultiDimensionScorer,
    ScoreConsensus,
    ConsensusResult,
    WeightCalculator,
    WeightMatrix,
    ProofOfIntelligence,
    PoIResult,
)

# -----------------------------------------------------------------------
# Layer 4: Marketplace Orchestrator
# -----------------------------------------------------------------------
from .marketplace import (
    MarketplaceProtocol,
    SubnetManager,
    ProtocolAnalytics,
)

__all__ = [
    # --- Hedera Service Layer ---
    "HederaConfig",
    "NetworkType",
    "load_hedera_config",
    "HederaClient",
    "connect_hedera",
    "async_connect_hedera",
    "HCSService",
    "HCSMessageType",
    "MinerRegistration",
    "ScoreSubmission",
    "TaskSubmission",
    "HTSService",
    "SmartContractService",
    "HederaTaskStatus",
    "TaskInfo",
    "SubnetService",
    "SubnetConfig",
    "HederaSubnetInfo",
    "SubnetStatus",
    "create_subnet_service",
    "HederaError",
    "HederaConnectionError",
    "HederaTransactionError",
    "TopicNotFoundError",
    "InsufficientBalanceError",
    "TokenNotFoundError",
    "ContractNotFoundError",
    "ContractCallError",
    "ContractExecuteError",
    # --- Protocol Core ---
    "TaskStatus",
    "TaskPriority",
    "MinerStatus",
    "TaskRequest",
    "TaskResult",
    "TaskAssignment",
    "MinerInfo",
    "MinerReputation",
    "ValidatorScore",
    "ScoreBreakdown",
    "FeeBreakdown",
    "PaymentInfo",
    "ProtocolConfig",
    "FeeEngine",
    "MinerRegistry",
    "TaskManager",
    "ValidationOrchestrator",
    "TaskMatcher",
    # --- Reward System ---
    "RewardDistributor",
    "RewardTransaction",
    "RewardBatch",
    "EscrowManager",
    "EscrowDeposit",
    "EscrowStatus",
    "Treasury",
    "PayoutRecord",
    "TreasurySnapshot",
    # --- Scoring Engine ---
    "ScoringDimension",
    "DimensionConfig",
    "MultiDimensionScorer",
    "ScoreConsensus",
    "ConsensusResult",
    "WeightCalculator",
    "WeightMatrix",
    "ProofOfIntelligence",
    "PoIResult",
    # --- Marketplace ---
    "MarketplaceProtocol",
    "SubnetManager",
    "ProtocolAnalytics",
]
