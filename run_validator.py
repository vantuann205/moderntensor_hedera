#!/usr/bin/env python3
"""
ModernTensor Validator Runner

Starts a validator node that:
1. Registers with minimum 50,000 MDT stake
2. Uses Dendrite to send tasks to miners' Axon endpoints
3. Scores miner outputs using AI validation
4. Reports scores to HCS for consensus

Usage:
    python run_validator.py --validator-id 0.0.9001 --subnets 1

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

import sys
import os
import argparse
import logging
import time
import json
import signal
import platform

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sdk.protocol.dendrite import Dendrite, DendriteResult
from sdk.scoring.weights import WeightCalculator
from sdk.scoring.consensus import ScoreConsensus

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("validator")


class ValidatorNode:
    """
    Validator node that sends tasks to miners and scores results.

    Flow:
        1. Load miner registry (with axon endpoints)
        2. Create task
        3. Send task to miners via Dendrite
        4. Score results
        5. Run consensus
        6. Submit scores to HCS
    """

    # Matching StakingVault.sol: minValidatorStake = 50,000 MDT
    MIN_STAKE = 50_000.0

    def __init__(
        self,
        validator_id: str,
        stake: float,
        subnet_ids: list,
        timeout: float = 30.0,
    ):
        if stake < self.MIN_STAKE:
            raise ValueError(
                f"Validator stake {stake:,.0f} MDT is below minimum "
                f"{self.MIN_STAKE:,.0f} MDT"
            )

        self.validator_id = validator_id
        self.stake = stake
        self.subnet_ids = subnet_ids

        # Dendrite for sending tasks to miners
        self.dendrite = Dendrite(
            validator_id=validator_id,
            timeout=timeout,
        )

        # Weight calculator for miner selection
        self.weight_calculator = WeightCalculator(min_stake=100.0)

        # Consensus engine for score aggregation
        self.consensus = ScoreConsensus()

        # Task tracking
        self._tasks_sent = 0
        self._tasks_validated = 0
        self._running = False

        logger.info(
            "ValidatorNode initialized — id=%s, stake=%.0f MDT, subnets=%s",
            validator_id,
            stake,
            subnet_ids,
        )

    def send_task_to_miners(
        self,
        task_id: str,
        task_type: str,
        payload: dict,
        miners: list,
    ) -> list:
        """
        Send a task to multiple miners via Dendrite.

        Args:
            task_id: Unique task identifier
            task_type: Type of task (e.g., "code_review")
            payload: Task data
            miners: List of dicts with "miner_id" and "endpoint"

        Returns:
            List of DendriteResult
        """
        logger.info(
            "Sending task %s (type=%s) to %d miners",
            task_id[:8],
            task_type,
            len(miners),
        )

        results = self.dendrite.broadcast(
            miners=miners,
            task_id=task_id,
            task_type=task_type,
            payload=payload,
        )

        self._tasks_sent += 1

        successful = [r for r in results if r.success]
        logger.info(
            "Task %s: %d/%d miners responded",
            task_id[:8],
            len(successful),
            len(results),
        )

        return results

    def score_results(
        self,
        task_id: str,
        results: list,
    ) -> dict:
        """
        Score miner results and determine winner.

        Args:
            task_id: Task identifier
            results: List of DendriteResult from miners

        Returns:
            Dict with scores, consensus, winner
        """
        successful = [r for r in results if r.success]
        if not successful:
            return {"task_id": task_id, "error": "No successful results"}

        # Score each result
        scores = {}
        for r in successful:
            output = r.output or {}
            # Simple scoring: check for quality indicators
            score = 0.5  # Base score
            if "analysis" in output or "text" in output:
                score += 0.2
            if "score" in output:
                score = min(1.0, output["score"])
            if "findings" in output and len(output.get("findings", [])) > 0:
                score += 0.1
            if "confidence" in output:
                score = score * float(output.get("confidence", 1.0))

            scores[r.miner_id] = min(1.0, score)

        # Run consensus
        consensus_result = self.consensus.aggregate(scores)

        # Find winner
        winner_id = max(scores, key=scores.get) if scores else None

        self._tasks_validated += 1

        result = {
            "task_id": task_id,
            "scores": scores,
            "consensus": consensus_result.to_dict(),
            "winner": winner_id,
            "winner_score": scores.get(winner_id, 0) if winner_id else 0,
        }

        logger.info(
            "Task %s validated: winner=%s (score=%.3f), consensus=%.3f",
            task_id[:8],
            winner_id,
            result["winner_score"],
            consensus_result.consensus_score,
        )

        return result

    def health_check_miners(self, miners: list) -> list:
        """Check which miners are online."""
        online = []
        for m in miners:
            ep = m.get("endpoint", "")
            if ep and self.dendrite.check_health(ep):
                online.append(m)
                logger.debug("Miner %s is online", m.get("miner_id"))
            else:
                logger.warning("Miner %s is offline", m.get("miner_id"))
        return online

    def get_stats(self) -> dict:
        return {
            "validator_id": self.validator_id,
            "stake": self.stake,
            "tasks_sent": self._tasks_sent,
            "tasks_validated": self._tasks_validated,
            "dendrite": self.dendrite.get_stats(),
        }


def main():
    parser = argparse.ArgumentParser(description="ModernTensor Validator Node")
    parser.add_argument(
        "--validator-id", default="0.0.9001", help="Validator Hedera account ID"
    )
    parser.add_argument(
        "--stake", type=float, default=50_000.0, help="Stake amount (MDT)"
    )
    parser.add_argument("--subnets", default="1", help="Subnet IDs (comma-separated)")
    parser.add_argument(
        "--timeout", type=float, default=30.0, help="Task timeout (seconds)"
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=10.0,
        help="Seconds between polling for tasks",
    )
    parser.add_argument(
        "--auto-register",
        action="store_true",
        help="Auto-register and stake on-chain before starting",
    )
    parser.add_argument(
        "--skip-checks", action="store_true", help="Skip on-chain pre-flight checks"
    )
    args = parser.parse_args()

    subnet_ids = [int(s.strip()) for s in args.subnets.split(",")]

    print("=" * 60)
    print("  ModernTensor Validator Node")
    print("=" * 60)
    print(f"  Validator ID:  {args.validator_id}")
    print(f"  Stake:         {args.stake:,.0f} MDT")
    print(f"  Subnets:       {subnet_ids}")
    print(f"  Timeout:       {args.timeout}s")
    print("=" * 60)

    # ── On-Chain Pre-flight Checks ──
    if not args.skip_checks:
        try:
            from dotenv import load_dotenv

            load_dotenv()
            from sdk.hedera.config import load_hedera_config
            from sdk.hedera.client import HederaClient
            from sdk.hedera.guard import OnChainGuard

            config = load_hedera_config()
            client = HederaClient(config)
            guard = OnChainGuard(client)

            if args.auto_register:
                print("\n  🔄 Auto-registering validator on-chain...")
                stake_amount = int(args.stake * 10**8)
                result = guard.auto_register_validator(
                    subnet_id=subnet_ids[0],
                    stake_amount=stake_amount,
                )
                print(f"  {result}")
                if not result.passed:
                    logger.warning(
                        "Some auto-registration steps failed, continuing anyway"
                    )
            else:
                print("\n  🔍 On-chain pre-flight checks...")
                result = guard.check_validator()
                print(f"  {result}")
                if not result.passed:
                    logger.warning(
                        "Pre-flight checks incomplete (use --auto-register to fix)"
                    )
            print()
        except Exception as e:
            logger.warning("On-chain checks skipped: %s", e)

    try:
        validator = ValidatorNode(
            validator_id=args.validator_id,
            stake=args.stake,
            subnet_ids=subnet_ids,
            timeout=args.timeout,
        )
    except ValueError as e:
        print(f"\n  ❌ {e}")
        sys.exit(1)

    print(f"\n  ✅ Validator ready")
    print(f"  🔍 Dendrite client for sending tasks to miners")
    print(f"  ⚖️  Weight calculator for miner selection")
    print(f"  🤝 Consensus engine for score aggregation")
    print(f"\n  📡 Entering validation loop (poll every {args.poll_interval}s)")
    print(f"  Press Ctrl+C to stop\n")

    # Graceful shutdown
    validator._running = True

    def shutdown(sig, frame):
        logger.info("Shutting down validator...")
        validator._running = False

    signal.signal(signal.SIGINT, shutdown)
    if platform.system() != "Windows":
        signal.signal(signal.SIGTERM, shutdown)

    # ── Validation Loop ──
    # Poll HCS task topic for pending tasks, send to miners, score, report
    hcs_service = None
    mirror_base = "https://testnet.mirrornode.hedera.com"
    task_topic = os.environ.get("HCS_TASK_TOPIC_ID", "0.0.7852337")
    scoring_topic = os.environ.get("HCS_SCORING_TOPIC_ID", "0.0.7852336")
    last_sequence = 0  # Track last processed HCS message

    try:
        from sdk.hedera.hcs import HCSService
        from dotenv import load_dotenv

        load_dotenv()
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient

        config = load_hedera_config()
        client = HederaClient(config)
        hcs_service = HCSService(client)
        logger.info("HCS service initialized — polling topic %s", task_topic)
    except Exception as e:
        logger.warning("HCS service unavailable, using Mirror Node REST: %s", e)

    try:
        while validator._running:
            try:
                # ── Poll HCS task topic via Mirror Node REST API ──
                import urllib.request

                url = (
                    f"{mirror_base}/api/v1/topics/{task_topic}/messages"
                    f"?limit=10&order=desc"
                )
                if last_sequence > 0:
                    url += f"&sequencenumber=gt:{last_sequence}"

                try:
                    req = urllib.request.Request(url)
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        import json as _json

                        data = _json.loads(resp.read().decode())
                        messages = data.get("messages", [])

                    new_tasks = []
                    for msg in messages:
                        seq = msg.get("sequence_number", 0)
                        if seq > last_sequence:
                            last_sequence = seq
                        try:
                            import base64

                            payload = _json.loads(
                                base64.b64decode(msg["message"]).decode()
                            )
                            if (
                                payload.get("type") == "task_create"
                                and payload.get("status", "pending") == "pending"
                            ):
                                new_tasks.append(payload)
                        except Exception:
                            continue

                    if new_tasks:
                        logger.info(
                            "Found %d new task(s) from HCS topic %s",
                            len(new_tasks),
                            task_topic,
                        )

                    for task in new_tasks:
                        task_id = task.get("task_id", f"task-{last_sequence}")
                        task_type = task.get("task_type", "code_review")
                        logger.info(
                            "Processing task %s (type=%s)",
                            task_id[:16],
                            task_type,
                        )

                        # Get registered miners for this subnet
                        # For now use the validator's own endpoint as a self-test
                        miners = [
                            {
                                "miner_id": f"miner-{validator.validator_id}",
                                "endpoint": f"http://localhost:8091",
                            }
                        ]

                        results = validator.send_task_to_miners(
                            task_id=task_id,
                            task_type=task_type,
                            payload=task,
                            miners=miners,
                        )

                        scoring = validator.score_results(task_id, results)

                        # Submit scores to HCS scoring topic
                        if hcs_service and scoring.get("winner"):
                            try:
                                score_msg = {
                                    "type": "score_report",
                                    "task_id": task_id,
                                    "validator_id": validator.validator_id,
                                    "scores": scoring["scores"],
                                    "winner": scoring["winner"],
                                    "winner_score": scoring["winner_score"],
                                    "consensus": scoring.get("consensus", {}),
                                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                                }
                                hcs_service.submit_message(
                                    scoring_topic,
                                    json.dumps(score_msg),
                                )
                                logger.info(
                                    "Score report submitted to HCS topic %s",
                                    scoring_topic,
                                )
                            except Exception as e:
                                logger.warning("Failed to submit score to HCS: %s", e)

                except urllib.error.URLError as e:
                    logger.debug("Mirror Node poll failed: %s", e)

                # Periodic stats
                stats = validator.get_stats()
                if stats["tasks_validated"] > 0 and stats["tasks_validated"] % 5 == 0:
                    logger.info(
                        "Validator stats: sent=%d, validated=%d",
                        stats["tasks_sent"],
                        stats["tasks_validated"],
                    )

            except Exception as e:
                logger.error("Error in validation loop: %s", e)

            # Sleep in chunks for responsive shutdown
            for _ in range(int(args.poll_interval)):
                if not validator._running:
                    break
                time.sleep(1.0)
    except KeyboardInterrupt:
        pass

    logger.info("Validator %s stopped", args.validator_id)
    print(f"\n  🛑 Validator stopped. Final stats:")
    final = validator.get_stats()
    print(f"     Tasks sent:      {final['tasks_sent']}")
    print(f"     Tasks validated: {final['tasks_validated']}")


if __name__ == "__main__":
    main()
