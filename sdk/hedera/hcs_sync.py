"""
HCS ↔ MinerRegistry Sync Bridge

Bridges the on-chain Hedera Consensus Service (HCS) with the in-memory
MinerRegistry. Enables two-way synchronization:

1. sync_from_chain()       — Read HCS registrations → auto-register in MinerRegistry
2. publish_registration()  — Register locally + publish to HCS for on-chain audit

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .hcs import HCSService, MinerRegistration
    from ..protocol.miner_registry import MinerRegistry
    from ..protocol.types import MinerInfo

logger = logging.getLogger(__name__)


class HCSRegistrySync:
    """
    Bridge between HCS on-chain registrations and the in-memory MinerRegistry.

    Keeps the two systems in sync:
    - When a miner registers via CLI/API → also publish to HCS
    - When reviewing on-chain data → auto-register any new miners

    Example:
        from sdk.hedera.hcs import HCSService
        from sdk.protocol.miner_registry import MinerRegistry
        from sdk.hedera.hcs_sync import HCSRegistrySync

        sync = HCSRegistrySync(hcs_service, miner_registry)

        # Pull on-chain registrations into local registry
        new_miners = sync.sync_from_chain()

        # Register + publish to HCS
        miner = sync.publish_registration(
            miner_id="0.0.12345",
            account_id="0.0.12345",
            subnet_ids=[1],
            stake=500.0,
            capabilities=["code_review"],
        )
    """

    def __init__(
        self,
        hcs_service: "HCSService",
        miner_registry: "MinerRegistry",
    ):
        self.hcs = hcs_service
        self.registry = miner_registry
        self._last_sequence: int = 0  # Track last synced HCS sequence number

        logger.info("HCSRegistrySync initialized")

    def sync_from_chain(self, limit: int = 100) -> List["MinerInfo"]:
        """
        Pull miner registrations from HCS Mirror Node and register
        any new miners into the local MinerRegistry.

        Only processes messages after the last synced sequence number
        to avoid re-processing.

        Args:
            limit: Max messages to fetch per call

        Returns:
            List of newly registered MinerInfo objects
        """
        registrations = self.hcs.get_registrations(limit=limit)
        new_miners: List["MinerInfo"] = []
        skipped = 0

        for reg in registrations:
            seq = reg.get("sequence_number", 0)
            if seq <= self._last_sequence:
                continue  # Already processed

            miner_id = reg.get("miner_id") or reg.get("account_id")
            if not miner_id:
                logger.warning("HCS registration missing miner_id, skipping")
                continue

            # Check if already registered
            existing = self.registry.get_miner(miner_id)
            if existing is not None:
                skipped += 1
                self._last_sequence = max(self._last_sequence, seq)
                continue

            # Extract fields from HCS message
            account_id = reg.get("account_id", miner_id)
            capabilities = reg.get("capabilities", [])
            stake_amount = float(reg.get("stake_amount", 0))
            subnet_ids = reg.get("subnet_ids", [0])

            # Ensure minimum stake for registration
            min_stake = self.registry.config.min_stake_amount
            if stake_amount < min_stake:
                logger.warning(
                    "HCS miner %s has stake %.1f < min %.1f, "
                    "registering with min stake",
                    miner_id, stake_amount, min_stake,
                )
                stake_amount = min_stake

            try:
                miner = self.registry.register(
                    miner_id=miner_id,
                    subnet_ids=subnet_ids,
                    stake_amount=stake_amount,
                    capabilities=capabilities,
                    metadata={
                        "source": "hcs",
                        "account_id": account_id,
                        "hcs_sequence": seq,
                        "hcs_timestamp": reg.get("consensus_timestamp"),
                    },
                )
                new_miners.append(miner)
                logger.info(
                    "Synced miner %s from HCS (seq=%d, stake=%.1f)",
                    miner_id, seq, stake_amount,
                )
            except ValueError as e:
                logger.warning("Failed to sync miner %s: %s", miner_id, e)

            self._last_sequence = max(self._last_sequence, seq)

        logger.info(
            "HCS sync complete: %d new miners, %d skipped (already registered)",
            len(new_miners), skipped,
        )
        return new_miners

    def publish_registration(
        self,
        miner_id: str,
        account_id: Optional[str] = None,
        subnet_ids: Optional[List[int]] = None,
        stake: float = 0.0,
        capabilities: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Register a miner locally AND publish to HCS for on-chain audit trail.

        This is the unified registration flow:
        1. Register in MinerRegistry (in-memory)
        2. Publish MinerRegistration message to HCS topic

        Args:
            miner_id: Unique miner/account ID
            account_id: Hedera account ID (defaults to miner_id)
            subnet_ids: Subnets to join
            stake: Stake amount in MDT
            capabilities: Task types this miner supports

        Returns:
            Dict with 'miner' (MinerInfo) and 'hcs_receipt' (transaction receipt or None)
        """
        from .hcs import MinerRegistration

        # Step 1: Register in local MinerRegistry
        miner = self.registry.register(
            miner_id=miner_id,
            subnet_ids=subnet_ids,
            stake_amount=stake,
            capabilities=capabilities,
            metadata={"source": "local+hcs"},
        )

        # Step 2: Publish to HCS
        hcs_receipt = None
        try:
            registration = MinerRegistration(
                miner_id=miner_id,
                account_id=account_id or miner_id,
                capabilities=capabilities or [],
                stake_amount=int(stake),
                subnet_ids=subnet_ids or [0],
            )
            hcs_receipt = self.hcs.register_miner(registration)
            logger.info(
                "Miner %s registered on-chain via HCS", miner_id,
            )
        except Exception as e:
            logger.error(
                "HCS publish failed for %s (local registration kept): %s",
                miner_id, e,
            )

        return {
            "miner": miner,
            "hcs_receipt": hcs_receipt,
            "on_chain": hcs_receipt is not None,
        }

    def get_sync_status(self) -> Dict[str, Any]:
        """Get current sync status."""
        return {
            "last_sequence": self._last_sequence,
            "local_miners": self.registry.total_miners,
            "active_miners": self.registry.active_miners,
            "hcs_topic": self.hcs.registration_topic_id,
        }
