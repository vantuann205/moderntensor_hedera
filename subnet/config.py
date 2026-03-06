"""
Subnet Configuration — All on-chain addresses and protocol parameters.

Centralizes every contract, topic, and token address so all subnet
components (miners, validators, orchestrator) share the same config.
"""

from dataclasses import dataclass, field
from typing import List


@dataclass
class SubnetConfig:
    """Immutable config for one ModernTensor subnet."""

    # ── Identity ──
    subnet_id: int = 1
    subnet_name: str = "ModernTensor-AI-Subnet"
    description: str = "AI code review & text analysis subnet"

    # ── On-Chain Contracts (Hedera Testnet — V3 security-fixed) ──
    payment_escrow: str = "0.0.8101736"
    subnet_registry: str = "0.0.8101733"
    staking_vault: str = "0.0.8101730"
    mdt_governor: str = "0.0.8101737"

    # ── HCS Topics ──
    hcs_registration: str = "0.0.7852335"
    hcs_scoring: str = "0.0.7852336"
    hcs_tasks: str = "0.0.7852337"

    # ── Token ──
    mdt_token: str = "0.0.7852345"

    # ── Fee Split (bps sum = 10000) ──
    miner_share: float = 0.77  # 77 %
    validator_share: float = 0.15  # 15 %
    protocol_share: float = 0.05  # 5 %
    subnet_share: float = 0.03  # 3 %

    # ── Staking Minimums (in MDT, NOT scaled) ──
    min_miner_stake: float = 100.0
    min_validator_stake: float = 50_000.0

    # ── Task Defaults ──
    reward_per_task: float = 100.0  # MDT per task
    task_timeout: int = 3600  # seconds
    max_miners_per_task: int = 4

    # ── Network ──
    miner_base_port: int = 19701
    miner_host: str = "127.0.0.1"

    # ── Epoch ──
    epoch_number: int = 1
    tasks_per_epoch: int = 5

    # ── Capabilities ──
    supported_tasks: List[str] = field(
        default_factory=lambda: ["code_review", "text_analysis"]
    )
