#!/usr/bin/env python3
"""
ModernTensor Miner Runner

Starts a miner node with Axon HTTP server for receiving tasks.

Usage:
    python run_miner.py --miner-id 0.0.1001 --port 8091 --subnets 1

The miner:
1. Registers with the protocol (just needs MDT tokens)
2. Starts Axon HTTP server (POST /task, GET /health)
3. Waits for tasks from validators via Dendrite
4. Processes tasks with handler function
5. Returns results via HTTP response

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import sys
import os
import argparse
import logging
import time
import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sdk.protocol.axon import Axon
from sdk.protocol.types import MinerInfo

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("miner")


# ──────────────────────────────────────────────────────────────
# AI Handler — This is where the miner's AI model lives
# ──────────────────────────────────────────────────────────────

def ai_handler(payload: dict, task_type: str) -> dict:
    """
    Process a task and return results.

    This is the core function that miners implement.
    Replace this with your actual AI model logic.

    Args:
        payload: Task data from the validator
        task_type: Type of task (e.g., "code_review", "text_generation")

    Returns:
        Result dict with analysis output
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
        # Generic handler
        return {
            "status": "processed",
            "task_type": task_type,
            "payload_keys": list(payload.keys()),
        }


def main():
    parser = argparse.ArgumentParser(description="ModernTensor Miner Node")
    parser.add_argument("--miner-id", default="0.0.1001", help="Miner Hedera account ID")
    parser.add_argument("--host", default="0.0.0.0", help="Axon bind address")
    parser.add_argument("--port", type=int, default=8091, help="Axon port")
    parser.add_argument("--subnets", default="1", help="Subnet IDs (comma-separated)")
    parser.add_argument("--stake", type=float, default=0.0, help="Agent bond amount (MDT)")
    parser.add_argument("--auto-register", action="store_true",
                        help="Auto-register and stake on-chain before starting")
    parser.add_argument("--skip-checks", action="store_true",
                        help="Skip on-chain pre-flight checks")
    args = parser.parse_args()

    subnet_ids = [int(s.strip()) for s in args.subnets.split(",")]

    print("=" * 60)
    print("  ModernTensor Miner Node")
    print("=" * 60)
    print(f"  Miner ID:  {args.miner_id}")
    print(f"  Axon:      {args.host}:{args.port}")
    print(f"  Subnets:   {subnet_ids}")
    print(f"  Stake:     {args.stake} MDT (agent bond)")
    print("=" * 60)

    # ── On-Chain Pre-flight Checks ──
    if not args.skip_checks:
        try:
            from dotenv import load_dotenv; load_dotenv()
            from sdk.hedera.config import load_hedera_config
            from sdk.hedera.client import HederaClient
            from sdk.hedera.guard import OnChainGuard

            config = load_hedera_config()
            client = HederaClient(config)
            guard = OnChainGuard(client)

            if args.auto_register:
                print("\n  🔄 Auto-registering on-chain...")
                stake_amount = int(args.stake * 10**8) if args.stake > 0 else 50_00000000
                result = guard.auto_register_miner(
                    subnet_id=subnet_ids[0],
                    stake_amount=stake_amount,
                )
                print(f"  {result}")
                if not result.passed:
                    logger.warning("Some auto-registration steps failed, continuing anyway")
            else:
                print("\n  🔍 On-chain pre-flight checks...")
                result = guard.check_miner()
                print(f"  {result}")
                if not result.passed:
                    logger.warning("Pre-flight checks incomplete (use --auto-register to fix)")
            print()
        except Exception as e:
            logger.warning("On-chain checks skipped: %s", e)

    # Start Axon server
    axon = Axon(
        miner_id=args.miner_id,
        handler=ai_handler,
        host=args.host,
        port=args.port,
        subnet_ids=subnet_ids,
        capabilities=["code_review", "text_generation"],
    )

    # Graceful shutdown
    def shutdown(sig, frame):
        logger.info("Shutting down miner...")
        axon.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    axon.start()

    logger.info(
        "Miner %s is online at %s — waiting for tasks from validators",
        args.miner_id, axon.endpoint,
    )
    print(f"\n  ✅ Axon server running on {axon.endpoint}")
    print(f"  📡 Endpoints:")
    print(f"     POST {axon.endpoint}/task   — Receive tasks")
    print(f"     GET  {axon.endpoint}/health — Health check")
    print(f"     GET  {axon.endpoint}/info   — Miner info")
    print(f"\n  Press Ctrl+C to stop\n")

    # Keep running
    try:
        while True:
            time.sleep(10)
            stats = axon.get_stats()
            if stats["tasks_processed"] > 0:
                logger.info(
                    "Stats: %d tasks processed, uptime=%.0fs",
                    stats["tasks_processed"], stats["uptime"],
                )
    except KeyboardInterrupt:
        pass
    finally:
        axon.stop()


if __name__ == "__main__":
    main()
