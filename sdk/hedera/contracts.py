"""
Smart Contract Services — Backward Compatibility Module

Re-exports all contract services from their canonical modules.
Import from here or directly from the individual modules.

Canonical modules:
  - sdk.hedera.payment_escrow → PaymentEscrowService
  - sdk.hedera.staking_vault  → StakingVaultService, StakeRole
  - sdk.hedera.subnet_registry → SubnetRegistryService, SubnetStatus
  - sdk.hedera.governor → MDTGovernorService, ProposalState

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

from .payment_escrow import (
    PaymentEscrowService,
    EscrowTaskStatus as TaskStatus,
    EscrowEntry as TaskInfo,
)
from .subnet_registry import (
    SubnetRegistryService,
    SubnetStatus,
)
from .staking_vault import (
    StakingVaultService,
    StakeRole,
)
from .governor import (
    MDTGovernorService,
    ProposalState,
)

# Backward compat alias
SmartContractService = SubnetRegistryService

__all__ = [
    "PaymentEscrowService",
    "SubnetRegistryService",
    "StakingVaultService",
    "MDTGovernorService",
    "SmartContractService",
    "TaskStatus",
    "TaskInfo",
    "SubnetStatus",
    "StakeRole",
    "ProposalState",
]
