"""
Subnet Miner Node

A miner that:
  1. Connects to Hedera testnet
  2. Stakes MDT on StakingVault (on-chain)
  3. Registers on HCS (on-chain)
  4. Starts Axon HTTP server to receive tasks
  5. Processes tasks with configurable AI handler
  6. Returns results to validators via HTTP

Can run standalone:
    python -m subnet.miner_node --port 9001 --skill 0.95 --name Alpha

Or be instantiated by the subnet orchestrator.
"""

from __future__ import annotations

import logging
import os
import random
import sys
import time
from typing import Any, Callable, Dict, List, Optional

# Ensure project root on path
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from sdk.protocol.axon import Axon

logger = logging.getLogger(__name__)

# Type alias
TaskHandler = Callable[[Dict[str, Any], str], Dict[str, Any]]


def make_code_review_handler(skill: float, name: str) -> TaskHandler:
    """
    Create a deterministic code-review handler with a given skill level.

    Higher skill → higher score, more findings, better analysis.
    """

    def handler(payload: dict, task_type: str) -> dict:
        code = payload.get("code", "")
        # Score varies slightly around the skill level
        score = min(1.0, max(0.0, skill + random.uniform(-0.04, 0.04)))
        num_findings = max(1, int(skill * 5))

        return {
            "analysis": (
                f"[{name}] Reviewed {len(code)} chars — "
                f"{task_type} — skill={skill:.2f}"
            ),
            "findings": [
                {
                    "severity": "warning" if i == 0 else "info",
                    "message": f"Finding #{i + 1} from {name}",
                }
                for i in range(num_findings)
            ],
            "score": round(score, 3),
            "confidence": round(0.7 + skill * 0.25, 2),
        }

    return handler


class SubnetMiner:
    """
    A subnet miner that registers on-chain and serves tasks via Axon.

    Lifecycle:
        miner = SubnetMiner(...)
        miner.stake_onchain(client, staking)      # StakingVault tx
        miner.register_hcs(hcs, operator_id)       # HCS message
        miner.start()                              # Axon HTTP server
        ...
        miner.stop()
    """

    def __init__(
        self,
        miner_id: str,
        name: str,
        port: int,
        host: str = "127.0.0.1",
        skill: float = 0.8,
        stake_amount: float = 200.0,
        subnet_ids: Optional[List[int]] = None,
        capabilities: Optional[List[str]] = None,
        handler: Optional[TaskHandler] = None,
    ):
        self.miner_id = miner_id
        self.name = name
        self.port = port
        self.host = host
        self.skill = skill
        self.stake_amount = stake_amount
        self.subnet_ids = subnet_ids or [1]
        self.capabilities = capabilities or ["code_review", "text_analysis"]

        # Build handler
        self.handler = handler or make_code_review_handler(skill, name)

        # Axon server (created but not started)
        self._axon = Axon(
            miner_id=miner_id,
            handler=self.handler,
            host="0.0.0.0",  # bind all interfaces
            port=port,
            subnet_ids=self.subnet_ids,
            capabilities=self.capabilities,
        )

        self._staked = False
        self._registered = False

    # ── Properties ──

    @property
    def endpoint(self) -> str:
        return f"http://{self.host}:{self.port}"

    @property
    def is_running(self) -> bool:
        return self._axon.is_running()

    # ── On-Chain Operations ──

    def stake_onchain(self, staking_service) -> bool:
        """Stake MDT on StakingVault contract (on-chain)."""
        try:
            from sdk.hedera.staking_vault import StakeRole

            staking_service.stake(
                amount=int(self.stake_amount * 1e8),
                role=StakeRole.MINER,
            )
            self._staked = True
            logger.info(
                "%s staked %,.0f MDT as MINER (on-chain)",
                self.name,
                self.stake_amount,
            )
            return True
        except Exception as e:
            logger.warning("Stake failed for %s: %s", self.name, e)
            return False

    def register_hcs(self, hcs_service, operator_id: str) -> bool:
        """Register miner on HCS (on-chain)."""
        try:
            from sdk.hedera.hcs import MinerRegistration

            reg = MinerRegistration(
                miner_id=self.miner_id,
                account_id=operator_id,
                stake_amount=int(self.stake_amount),
                capabilities=self.capabilities,
                subnet_ids=self.subnet_ids,
            )
            hcs_service.register_miner(reg)
            self._registered = True
            logger.info("%s registered on HCS (on-chain)", self.name)
            return True
        except Exception as e:
            logger.warning("HCS register failed for %s: %s", self.name, e)
            return False

    def register_local(self, miner_registry) -> None:
        """Register in the local MinerRegistry (protocol layer)."""
        info = miner_registry.register(
            miner_id=self.miner_id,
            subnet_ids=self.subnet_ids,
            stake_amount=self.stake_amount,
            capabilities=self.capabilities,
            metadata={
                "name": self.name,
                "axon_host": self.host,
                "axon_port": self.port,
            },
        )
        info.axon_host = self.host
        info.axon_port = self.port

    # ── Axon Server ──

    def start(self) -> None:
        """Start the Axon HTTP server in a background thread."""
        self._axon.start()
        logger.info("%s Axon started at %s", self.name, self.endpoint)

    def stop(self) -> None:
        """Stop the Axon server."""
        self._axon.stop()
        logger.info("%s Axon stopped", self.name)

    def get_stats(self) -> dict:
        return self._axon.get_stats()

    # ── Info ──

    def to_dendrite_entry(self) -> dict:
        """Return dict suitable for Dendrite.broadcast(miners=[...])."""
        return {
            "miner_id": self.miner_id,
            "endpoint": self.endpoint,
        }

    def __repr__(self) -> str:
        status = "ONLINE" if self.is_running else "OFFLINE"
        return (
            f"<SubnetMiner {self.name} id={self.miner_id} "
            f"port={self.port} skill={self.skill:.2f} "
            f"stake={self.stake_amount:.0f} [{status}]>"
        )


# ══════════════════════════════════════════════════════════════
#  Standalone entry point
# ══════════════════════════════════════════════════════════════


def main():
    import argparse
    import signal
    import platform

    parser = argparse.ArgumentParser(description="ModernTensor Subnet Miner Node")
    parser.add_argument("--miner-id", default="0.0.3001")
    parser.add_argument("--name", default="Miner-A")
    parser.add_argument("--port", type=int, default=19701)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--skill", type=float, default=0.85)
    parser.add_argument("--stake", type=float, default=200.0)
    parser.add_argument("--subnets", default="1")
    parser.add_argument(
        "--register",
        action="store_true",
        help="Register on-chain (stake + HCS) before starting",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    subnet_ids = [int(s) for s in args.subnets.split(",")]

    miner = SubnetMiner(
        miner_id=args.miner_id,
        name=args.name,
        port=args.port,
        host=args.host,
        skill=args.skill,
        stake_amount=args.stake,
        subnet_ids=subnet_ids,
    )

    print(f"\n{'=' * 56}")
    print(f"  ModernTensor Subnet Miner — {args.name}")
    print(f"{'=' * 56}")
    print(f"  ID:     {args.miner_id}")
    print(f"  Axon:   {miner.endpoint}")
    print(f"  Skill:  {args.skill:.2f}")
    print(f"  Stake:  {args.stake:.0f} MDT")
    print(f"  Subnet: {subnet_ids}")
    print(f"{'=' * 56}")

    # On-chain registration
    if args.register:
        from dotenv import load_dotenv

        load_dotenv()
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient
        from sdk.hedera.staking_vault import StakingVaultService
        from sdk.hedera.hcs import HCSService

        config = load_hedera_config()
        client = HederaClient(config)
        staking = StakingVaultService(client)
        hcs = HCSService(client)

        print("\n  On-chain registration:")
        if miner.stake_onchain(staking):
            print(f"  [OK] Staked {args.stake:.0f} MDT")
        if miner.register_hcs(hcs, client.operator_id_str):
            print(f"  [OK] Registered on HCS")
        client.close()

    # Start Axon
    miner.start()
    print(f"\n  Axon online at {miner.endpoint}")
    print(f"    POST {miner.endpoint}/task   — receive tasks")
    print(f"    GET  {miner.endpoint}/health — health check")
    print(f"\n  Press Ctrl+C to stop\n")

    # Graceful shutdown
    def shutdown(sig, frame):
        miner.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if platform.system() != "Windows":
        signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        pass
    finally:
        miner.stop()


if __name__ == "__main__":
    main()
