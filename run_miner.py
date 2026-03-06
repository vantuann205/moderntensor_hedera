#!/usr/bin/env python3
"""
ModernTensor Miner Node

Starts a miner that:
1. (Optional) Auto-registers on-chain: approve -> stake -> register_miner
2. Starts Axon HTTP server to receive tasks from validators
3. Processes tasks with AI handler
4. Auto-submits results on-chain (SubnetRegistry.submit_result)
5. Periodically withdraws accumulated earnings

Usage:
    # With auto-registration (first time):
    python run_miner.py --subnet 0 --auto-register --stake 1000

    # Without auto-registration (already staked):
    python run_miner.py --subnet 0

    # Skip on-chain entirely (HTTP-only mode):
    python run_miner.py --subnet 0 --offline

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import sys
import os
import argparse
import logging
import time
import json
import hashlib
import signal
import platform

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sdk.protocol.axon import Axon

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("miner")


# ──────────────────────────────────────────────────────────────
# AI Handler — Replace with your actual AI model
# ──────────────────────────────────────────────────────────────


def ai_handler(payload: dict, task_type: str) -> dict:
    """
    Process a task and return results.

    This is the core function that miners implement.
    Replace this with your actual AI model logic.
    """
    if task_type == "code_review":
        code = payload.get("code", "")
        return {
            "analysis": f"Code review completed. Analyzed {len(code)} chars.",
            "findings": [
                {"severity": "info", "message": "Code structure looks good"},
                {"severity": "suggestion", "message": "Consider adding type hints"},
            ],
            "score": 0.82,
            "confidence": 0.90,
        }
    elif task_type == "text_generation":
        prompt = payload.get("prompt", "")
        return {
            "text": f"Generated response for: {prompt[:50]}...",
            "tokens_used": len(prompt.split()) * 3,
            "quality_score": 0.85,
        }
    else:
        return {
            "status": "processed",
            "task_type": task_type,
            "payload_keys": list(payload.keys()),
        }


# ──────────────────────────────────────────────────────────────
# On-chain Integration
# ──────────────────────────────────────────────────────────────


def _init_hedera():
    """Initialize Hedera client and services."""
    from dotenv import load_dotenv

    load_dotenv()
    from sdk.hedera.config import load_hedera_config
    from sdk.hedera.client import HederaClient
    from sdk.hedera.staking_vault import StakingVaultService
    from sdk.hedera.subnet_registry import SubnetRegistryService

    config = load_hedera_config()
    client = HederaClient(config)
    staking = StakingVaultService(client)
    registry = SubnetRegistryService(client)
    return client, staking, registry


def auto_register(subnet_id: int, stake_amount: float):
    """
    Auto-register miner on-chain:
    1. Approve MDT -> StakingVault
    2. Stake as MINER
    3. Register in subnet
    """
    client, staking, registry = _init_hedera()
    token_id = os.getenv("HEDERA_MDT_TOKEN_ID") or os.getenv("HTS_TOKEN_ID_MDT")
    staking_contract = os.getenv("HEDERA_STAKING_VAULT_CONTRACT_ID")

    if not token_id or not staking_contract:
        logger.error(
            "Missing HEDERA_MDT_TOKEN_ID or HEDERA_STAKING_VAULT_CONTRACT_ID in .env"
        )
        client.close()
        return False

    amount_raw = int(stake_amount * 1e8)
    ok = True

    # Step 1: Approve MDT for StakingVault
    try:
        logger.info("Approving %s MDT for StakingVault...", stake_amount)
        client.approve_token_allowance(token_id, staking_contract, amount_raw)
        logger.info("Approved")
    except Exception as e:
        logger.error("Approve failed: %s", e)
        ok = False

    # Step 2: Stake as MINER (role=1)
    if ok:
        try:
            logger.info("Staking %s MDT as MINER...", stake_amount)
            staking.stake(amount_raw, 1)
            logger.info("Staked")
        except Exception as e:
            logger.error("Stake failed: %s", e)
            ok = False

    # Step 3: Register in subnet
    if ok:
        try:
            logger.info("Registering as miner in subnet %d...", subnet_id)
            registry.register_miner(subnet_id)
            logger.info("Registered")
        except Exception as e:
            logger.error("Register miner failed: %s", e)
            ok = False

    client.close()
    return ok


def submit_result_onchain(task_id: int, result: dict):
    """Submit result hash on-chain after processing a task."""
    try:
        client, _, registry = _init_hedera()
        result_hash = hashlib.sha256(
            json.dumps(result, sort_keys=True).encode()
        ).hexdigest()
        logger.info(
            "Submitting result on-chain for task %d (hash=%s...)",
            task_id,
            result_hash[:16],
        )
        registry.submit_result(task_id, result_hash)
        logger.info("On-chain result submitted for task %d", task_id)
        client.close()
        return True
    except Exception as e:
        logger.warning("On-chain submit failed for task %d: %s", task_id, e)
        return False


def withdraw_earnings_onchain():
    """Withdraw accumulated earnings from SubnetRegistry."""
    try:
        client, _, registry = _init_hedera()
        logger.info("Withdrawing accumulated earnings...")
        registry.withdraw_earnings()
        logger.info("Earnings withdrawn")
        client.close()
        return True
    except Exception as e:
        logger.warning("Withdraw earnings failed: %s", e)
        return False


# ──────────────────────────────────────────────────────────────
# On-chain aware handler wrapper
# ──────────────────────────────────────────────────────────────


def make_onchain_handler(base_handler, online: bool):
    """
    Wrap the AI handler to auto-submit results on-chain
    after processing each task.
    """

    def handler(payload: dict, task_type: str) -> dict:
        result = base_handler(payload, task_type)

        if online:
            task_id = payload.get("on_chain_task_id")
            if task_id is not None:
                submit_result_onchain(int(task_id), result)
            else:
                logger.debug("No on_chain_task_id in payload, skipping on-chain submit")

        return result

    return handler


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="ModernTensor Miner Node")
    parser.add_argument("--host", default="0.0.0.0", help="Axon bind address")
    parser.add_argument("--port", type=int, default=8091, help="Axon port")
    parser.add_argument("--subnet", type=int, default=0, help="Subnet ID to join")
    parser.add_argument(
        "--stake",
        type=float,
        default=1000.0,
        help="MDT to stake (with --auto-register)",
    )
    parser.add_argument(
        "--auto-register",
        action="store_true",
        help="Auto stake + register on-chain",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="HTTP-only mode, no on-chain calls",
    )
    parser.add_argument(
        "--withdraw-interval",
        type=int,
        default=3600,
        help="Seconds between auto-withdraw (0=disabled)",
    )
    args = parser.parse_args()

    online = not args.offline
    miner_id = os.getenv("HEDERA_ACCOUNT_ID", "0.0.0")

    print("=" * 60)
    print("  ModernTensor Miner Node")
    print("=" * 60)
    print(f"  Account:   {miner_id}")
    print(f"  Axon:      {args.host}:{args.port}")
    print(f"  Subnet:    {args.subnet}")
    print(f"  On-chain:  {'YES' if online else 'OFFLINE (HTTP-only)'}")
    print("=" * 60)

    # ── Auto-registration ──
    if args.auto_register and online:
        print("\n  Auto-registering on-chain...")
        if auto_register(args.subnet, args.stake):
            print("  Registration complete\n")
        else:
            print("  Registration failed (may already be registered)\n")

    # ── Start Axon server ──
    handler = make_onchain_handler(ai_handler, online)
    axon = Axon(
        miner_id=miner_id,
        handler=handler,
        host=args.host,
        port=args.port,
        subnet_ids=[args.subnet],
        capabilities=["code_review", "text_generation"],
    )

    def shutdown(sig, frame):
        logger.info("Shutting down miner...")
        axon.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if platform.system() != "Windows":
        signal.signal(signal.SIGTERM, shutdown)

    axon.start()
    logger.info("Miner %s online at %s", miner_id, axon.endpoint)

    print(f"\n  Axon server running on {axon.endpoint}")
    print(f"  Endpoints:")
    print(f"     POST {axon.endpoint}/task   -- Receive tasks from validators")
    print(f"     GET  {axon.endpoint}/health -- Health check")
    print(f"     GET  {axon.endpoint}/info   -- Miner info")
    if online:
        print(f"  On-chain: auto-submit results after processing")
        if args.withdraw_interval > 0:
            print(f"  Auto-withdraw earnings every {args.withdraw_interval}s")
    print(f"\n  Press Ctrl+C to stop\n")

    # ── Main loop ──
    last_withdraw = time.time()
    try:
        while True:
            time.sleep(10)

            stats = axon.get_stats()
            if stats["tasks_processed"] > 0 and stats["tasks_processed"] % 5 == 0:
                logger.info(
                    "Stats: %d tasks processed, uptime=%.0fs",
                    stats["tasks_processed"],
                    stats["uptime"],
                )

            # Periodic withdraw
            if (
                online
                and args.withdraw_interval > 0
                and time.time() - last_withdraw > args.withdraw_interval
            ):
                withdraw_earnings_onchain()
                last_withdraw = time.time()

    except KeyboardInterrupt:
        pass
    finally:
        axon.stop()
        logger.info("Miner stopped")


if __name__ == "__main__":
    main()
