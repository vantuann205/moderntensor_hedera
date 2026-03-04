"""
Subnet Validator Node

A validator that:
  1. Connects to Hedera testnet
  2. Stakes MDT on StakingVault as VALIDATOR (on-chain)
  3. Uses Dendrite to broadcast tasks to miners
  4. Scores results with multi-dimensional scoring
  5. Runs weighted-median consensus
  6. Submits scores to HCS (on-chain)
  7. Calculates weight updates

Can run standalone:
    python -m subnet.validator_node --stake 50000 --subnets 1

Or be instantiated by the subnet orchestrator.
"""

from __future__ import annotations

import logging
import os
import sys
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

# Ensure project root on path
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from sdk.protocol.dendrite import Dendrite, DendriteResult
from sdk.scoring.consensus import ScoreConsensus, ConsensusResult
from sdk.scoring.weights import WeightCalculator, WeightMatrix

logger = logging.getLogger(__name__)


class SubnetValidator:
    """
    A subnet validator that stakes on-chain, broadcasts tasks to miners,
    scores results, runs consensus, and submits scores to HCS.

    Lifecycle:
        val = SubnetValidator(...)
        val.stake_onchain(staking)
        val.run_task(miners, task_type, payload) → TaskResult
        val.submit_scores_hcs(hcs, client, topic, result)
        val.update_weights(miners, epoch)
    """

    MIN_STAKE = 50_000.0

    def __init__(
        self,
        validator_id: str,
        stake: float = 50_000.0,
        subnet_ids: Optional[List[int]] = None,
        timeout: float = 30.0,
    ):
        if stake < self.MIN_STAKE:
            raise ValueError(
                f"Validator stake {stake:,.0f} below minimum "
                f"{self.MIN_STAKE:,.0f} MDT"
            )

        self.validator_id = validator_id
        self.stake = stake
        self.subnet_ids = subnet_ids or [1]

        # Dendrite client for sending tasks to miners
        self.dendrite = Dendrite(
            validator_id=validator_id,
            timeout=timeout,
        )

        # Scoring & consensus
        self.consensus = ScoreConsensus(min_validators=1)
        self.weight_calculator = WeightCalculator(min_stake=100.0)
        self.weight_matrix = WeightMatrix()

        # Tracking
        self._tasks_sent = 0
        self._tasks_validated = 0
        self._scores_history: Dict[str, Dict[str, float]] = {}
        self._staked = False

        logger.info(
            "SubnetValidator init — id=%s stake=%.0f subnets=%s",
            validator_id,
            stake,
            subnet_ids,
        )

    # ── On-Chain Operations ──

    def stake_onchain(self, staking_service) -> bool:
        """Stake as VALIDATOR on StakingVault (on-chain)."""
        try:
            from sdk.hedera.staking_vault import StakeRole

            staking_service.stake(
                amount=int(self.stake * 1e8),
                role=StakeRole.VALIDATOR,
            )
            self._staked = True
            logger.info(
                "Validator %s staked %,.0f MDT as VALIDATOR (on-chain)",
                self.validator_id,
                self.stake,
            )
            return True
        except Exception as e:
            logger.warning("Validator stake failed: %s", e)
            return False

    def submit_scores_hcs(
        self,
        hcs_service,
        client,
        scoring_topic: str,
        task_id: str,
        scores: Dict[str, float],
    ) -> bool:
        """Submit task scores to HCS scoring topic (on-chain)."""
        import json

        try:
            from sdk.hedera.hcs import ScoreSubmission

            for miner_id, score in scores.items():
                sub = ScoreSubmission(
                    validator_id=self.validator_id,
                    miner_id=miner_id,
                    task_id=task_id,
                    score=score,
                    confidence=0.95,
                    metrics={},
                )
                hcs_service.submit_score(sub)
            logger.info("Submitted %d scores to HCS (on-chain)", len(scores))
            return True
        except Exception as e:
            logger.warning("HCS score submission failed: %s", e)
            # Fallback: direct message
            try:
                msg = json.dumps(
                    {
                        "type": "score_batch",
                        "validator_id": self.validator_id,
                        "task_id": task_id,
                        "scores": scores,
                        "timestamp": int(time.time()),
                    }
                )
                client.submit_message(scoring_topic, msg)
                logger.info("Submitted scores via direct HCS message")
                return True
            except Exception as e2:
                logger.error("Score submission completely failed: %s", e2)
                return False

    # ── Task Execution ──

    def run_task(
        self,
        miners: List[dict],
        task_type: str,
        payload: dict,
        task_id: Optional[str] = None,
    ) -> dict:
        """
        Full task cycle: broadcast → score → consensus.

        Args:
            miners: [{miner_id, endpoint}, ...]
            task_type: e.g. "code_review"
            payload: Task data to send
            task_id: Optional task ID (auto-generated if not given)

        Returns:
            {task_id, results, scores, consensus, winner, winner_score}
        """
        task_id = task_id or f"task-{uuid.uuid4().hex[:12]}"

        # 1. Broadcast to miners via Dendrite
        logger.info(
            "Task %s → broadcasting to %d miners (type=%s)",
            task_id[:16],
            len(miners),
            task_type,
        )

        results: List[DendriteResult] = self.dendrite.broadcast(
            miners=miners,
            task_id=task_id,
            task_type=task_type,
            payload=payload,
        )
        self._tasks_sent += 1

        successful = [r for r in results if r.success]
        logger.info(
            "Task %s: %d/%d miners responded",
            task_id[:16],
            len(successful),
            len(results),
        )

        if not successful:
            return {
                "task_id": task_id,
                "error": "No successful results",
                "results": [],
                "scores": {},
            }

        # 2. Score each result
        scores = {}
        for r in successful:
            output = r.output or {}
            score = 0.5
            if "analysis" in output or "text" in output:
                score += 0.2
            if "score" in output:
                score = min(1.0, float(output["score"]))
            if "findings" in output and len(output.get("findings", [])) > 0:
                score += 0.1
            if "confidence" in output:
                score = score * float(output.get("confidence", 1.0))
            scores[r.miner_id] = round(min(1.0, score), 4)

        # 3. Run consensus
        consensus_result = self.consensus.aggregate(scores)

        # 4. Find winner
        winner_id = max(scores, key=scores.get) if scores else None
        winner_score = scores.get(winner_id, 0) if winner_id else 0

        self._tasks_validated += 1
        self._scores_history[task_id] = scores

        logger.info(
            "Task %s validated: winner=%s (%.3f), consensus=%.3f",
            task_id[:16],
            winner_id,
            winner_score,
            consensus_result.consensus_score,
        )

        return {
            "task_id": task_id,
            "results": results,
            "scores": scores,
            "consensus": consensus_result.to_dict(),
            "winner": winner_id,
            "winner_score": winner_score,
        }

    # ── Weight Management ──

    def update_weights(
        self,
        miners_info: list,
        epoch: int,
        subnet_id: int = 1,
    ) -> WeightMatrix:
        """
        Recalculate miner weights based on accumulated scores, stake, and
        performance history.

        Returns the updated WeightMatrix.
        """
        matrix = self.weight_calculator.calculate(
            miners=miners_info,
            epoch=epoch,
            subnet_id=subnet_id,
        )
        self.weight_matrix = matrix
        logger.info(
            "Weight matrix updated — epoch=%d, %d miners",
            epoch,
            len(miners_info),
        )
        return matrix

    # ── Health Check ──

    def health_check(self, miners: List[dict]) -> List[dict]:
        """Return list of online miners."""
        online = []
        for m in miners:
            ep = m.get("endpoint", "")
            if ep and self.dendrite.check_health(ep):
                online.append(m)
            else:
                logger.warning("Miner %s offline", m.get("miner_id"))
        return online

    # ── Stats ──

    def get_stats(self) -> dict:
        return {
            "validator_id": self.validator_id,
            "stake": self.stake,
            "tasks_sent": self._tasks_sent,
            "tasks_validated": self._tasks_validated,
            "total_miners_scored": sum(len(s) for s in self._scores_history.values()),
        }

    def __repr__(self) -> str:
        return (
            f"<SubnetValidator id={self.validator_id} "
            f"stake={self.stake:,.0f} MDT "
            f"tasks={self._tasks_validated}>"
        )


# ══════════════════════════════════════════════════════════════
#  Standalone entry point
# ══════════════════════════════════════════════════════════════


def main():
    import argparse
    import signal
    import platform

    parser = argparse.ArgumentParser(description="ModernTensor Subnet Validator Node")
    parser.add_argument("--validator-id", default="0.0.9001")
    parser.add_argument("--stake", type=float, default=50_000.0)
    parser.add_argument("--subnets", default="1")
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument(
        "--register",
        action="store_true",
        help="Stake on-chain before starting",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    subnet_ids = [int(s) for s in args.subnets.split(",")]

    print(f"\n{'=' * 56}")
    print(f"  ModernTensor Subnet Validator")
    print(f"{'=' * 56}")
    print(f"  ID:    {args.validator_id}")
    print(f"  Stake: {args.stake:,.0f} MDT")
    print(f"  Subs:  {subnet_ids}")
    print(f"{'=' * 56}")

    if args.register:
        from dotenv import load_dotenv

        load_dotenv()
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient
        from sdk.hedera.staking_vault import StakingVaultService

        config = load_hedera_config()
        client = HederaClient(config)
        staking = StakingVaultService(client)

        val = SubnetValidator(
            validator_id=args.validator_id,
            stake=args.stake,
            subnet_ids=subnet_ids,
            timeout=args.timeout,
        )
        if val.stake_onchain(staking):
            print(f"  [OK] Staked {args.stake:,.0f} MDT on-chain")
        client.close()
    else:
        val = SubnetValidator(
            validator_id=args.validator_id,
            stake=args.stake,
            subnet_ids=subnet_ids,
            timeout=args.timeout,
        )

    print(f"\n  Validator ready. Use in orchestrator or with run_subnet_demo.py")
    print(f"  Press Ctrl+C to exit\n")

    def shutdown(sig, frame):
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if platform.system() != "Windows":
        signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
