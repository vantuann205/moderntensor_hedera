#!/usr/bin/env python3
"""
ModernTensor Validator Node

Starts a validator that:
1. (Optional) Auto-registers on-chain: approve -> stake -> add_validator
2. Creates tasks on SubnetRegistry (on behalf of requesters or self)
3. Sends tasks to miners via Dendrite HTTP client
4. Scores miner outputs using AI validation
5. Submits scores on-chain (validate_submission)
6. Finalizes tasks and withdraws earnings

Usage:
    # With auto-registration (first time):
    python run_validator.py --subnet 0 --auto-register --stake 50000

    # Without auto-registration (already staked):
    python run_validator.py --subnet 0

    # With custom task settings:
    python run_validator.py --subnet 0 --task-reward 10 --task-interval 60

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
import base64

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


def _get_evm_address():
    """Get the operator's EVM address from Hedera account info."""
    try:
        client, _, _ = _init_hedera()
        from hiero_sdk_python import AccountInfoQuery, AccountId

        query = AccountInfoQuery()
        query.set_account_id(AccountId.from_string(os.getenv("HEDERA_ACCOUNT_ID")))
        info = query.execute(client.client)
        evm = str(info.contract_account_id)
        client.close()
        return evm
    except Exception as e:
        logger.warning("Could not get EVM address: %s", e)
        return None


def auto_register_validator(subnet_id: int, stake_amount: float):
    """
    Auto-register validator on-chain:
    1. Approve MDT -> StakingVault
    2. Stake as VALIDATOR
    3. Add self as validator in subnet
    """
    client, staking, registry = _init_hedera()
    token_id = os.getenv("HEDERA_MDT_TOKEN_ID") or os.getenv("HTS_TOKEN_ID_MDT")
    staking_contract = os.getenv("HEDERA_STAKING_VAULT_CONTRACT_ID")

    if not token_id or not staking_contract:
        logger.error("Missing HEDERA_MDT_TOKEN_ID or HEDERA_STAKING_VAULT_CONTRACT_ID")
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

    # Step 2: Stake as VALIDATOR (role=2)
    if ok:
        try:
            logger.info("Staking %s MDT as VALIDATOR...", stake_amount)
            staking.stake(amount_raw, 2)
            logger.info("Staked")
        except Exception as e:
            logger.error("Stake failed: %s", e)
            ok = False

    # Step 3: Get EVM address and add as validator
    if ok:
        try:
            from hiero_sdk_python import AccountInfoQuery, AccountId

            query = AccountInfoQuery()
            query.set_account_id(client.operator_id)
            info = query.execute(client.client)
            evm_address = str(info.contract_account_id)

            logger.info("Adding validator %s to subnet %d...", evm_address, subnet_id)
            registry.add_validator(subnet_id, evm_address)
            logger.info("Validator registered in subnet %d", subnet_id)
        except Exception as e:
            logger.error("Add validator failed: %s", e)
            ok = False

    client.close()
    return ok


# ──────────────────────────────────────────────────────────────
# Validator Node
# ──────────────────────────────────────────────────────────────


class ValidatorNode:
    """
    Validator node that creates tasks, sends to miners,
    scores results, and submits everything on-chain.

    Flow per epoch:
        1. Create task on-chain (SubnetRegistry.create_task)
        2. Broadcast task to miners via Dendrite
        3. Score miner outputs (AI scoring)
        4. Submit scores on-chain (validate_submission)
        5. Finalize task (distribute rewards)
        6. Withdraw earnings periodically
    """

    MIN_STAKE = 50_000.0

    def __init__(
        self,
        validator_id: str,
        stake: float,
        subnet_id: int,
        timeout: float = 30.0,
        online: bool = True,
    ):
        self.validator_id = validator_id
        self.stake = stake
        self.subnet_id = subnet_id
        self.online = online

        # Protocol clients
        self.dendrite = Dendrite(
            validator_id=validator_id,
            timeout=timeout,
        )
        self.weight_calculator = WeightCalculator(min_stake=100.0)
        self.consensus = ScoreConsensus()

        # Stats
        self._tasks_created = 0
        self._tasks_validated = 0
        self._tasks_finalized = 0
        self._running = False

        logger.info(
            "ValidatorNode initialized — id=%s, subnet=%d, on-chain=%s",
            validator_id,
            subnet_id,
            online,
        )

    def create_task_onchain(self, task_hash: str, reward: float, duration: int) -> int:
        """Create a task on SubnetRegistry. Returns task_id or -1 on failure."""
        if not self.online:
            return -1
        try:
            client, _, registry = _init_hedera()
            token_id = os.getenv("HEDERA_MDT_TOKEN_ID") or os.getenv("HTS_TOKEN_ID_MDT")
            registry_contract = os.getenv("HEDERA_SUBNET_REGISTRY_CONTRACT_ID")

            reward_raw = int(reward * 1e8)
            total_deposit = int(
                reward_raw * 1.23
            )  # 5% protocol + 15% validator + 3% subnet

            # Approve MDT
            client.approve_token_allowance(token_id, registry_contract, total_deposit)

            # Create task
            registry.create_task(self.subnet_id, task_hash, reward_raw, duration)
            self._tasks_created += 1

            # Probe for task_id (find last created task)
            task_id = -1
            for probe in range(1, 200):
                try:
                    result = registry.get_task(probe)
                    raw = result.contract_call_result
                    if raw and len(raw) >= 32:
                        tid = int.from_bytes(raw[0:32], "big")
                        if tid == 0:
                            task_id = probe - 1
                            break
                except Exception:
                    task_id = probe - 1
                    break

            logger.info(
                "Task created on-chain: subnet=%d, reward=%s MDT, task_id=%d",
                self.subnet_id,
                reward,
                task_id,
            )
            client.close()
            return task_id
        except Exception as e:
            logger.error("Create task on-chain failed: %s", e)
            return -1

    def send_task_to_miners(
        self,
        task_id: str,
        task_type: str,
        payload: dict,
        miners: list,
        on_chain_task_id: int = -1,
    ) -> list:
        """Send a task to miners via Dendrite. Includes on_chain_task_id in payload."""
        if on_chain_task_id >= 0:
            payload["on_chain_task_id"] = on_chain_task_id

        logger.info(
            "Sending task %s (type=%s) to %d miners",
            str(task_id)[:8],
            task_type,
            len(miners),
        )

        results = self.dendrite.broadcast(
            miners=miners,
            task_id=task_id,
            task_type=task_type,
            payload=payload,
        )

        successful = [r for r in results if r.success]
        logger.info(
            "Task %s: %d/%d miners responded",
            str(task_id)[:8],
            len(successful),
            len(results),
        )
        return results

    def score_results(self, task_id: str, results: list) -> dict:
        """Score miner results using consensus."""
        successful = [r for r in results if r.success]
        if not successful:
            return {"task_id": task_id, "error": "No successful results"}

        scores = {}
        for r in successful:
            output = r.output or {}
            score = 0.5
            if "analysis" in output or "text" in output:
                score += 0.2
            if "score" in output:
                score = min(1.0, output["score"])
            if "findings" in output and len(output.get("findings", [])) > 0:
                score += 0.1
            if "confidence" in output:
                score = score * float(output.get("confidence", 1.0))
            scores[r.miner_id] = min(1.0, score)

        consensus_result = self.consensus.aggregate(scores)
        winner_id = max(scores, key=scores.get) if scores else None
        self._tasks_validated += 1

        return {
            "task_id": task_id,
            "scores": scores,
            "consensus": consensus_result.to_dict(),
            "winner": winner_id,
            "winner_score": scores.get(winner_id, 0) if winner_id else 0,
        }

    def submit_scores_onchain(self, on_chain_task_id: int, scores: dict):
        """Submit validation scores on-chain for each miner."""
        if not self.online or on_chain_task_id < 0:
            return
        try:
            client, _, registry = _init_hedera()
            for miner_index, (miner_id, score_float) in enumerate(scores.items()):
                score_bps = int(score_float * 10000)
                logger.info(
                    "Validating task %d, miner %d (%s): %d/10000",
                    on_chain_task_id,
                    miner_index,
                    miner_id,
                    score_bps,
                )
                registry.validate_submission(on_chain_task_id, miner_index, score_bps)
            client.close()
        except Exception as e:
            logger.error("On-chain score submission failed: %s", e)

    def finalize_task_onchain(self, on_chain_task_id: int):
        """Finalize task to distribute rewards on-chain."""
        if not self.online or on_chain_task_id < 0:
            return
        try:
            client, _, registry = _init_hedera()
            logger.info("Finalizing task %d on-chain...", on_chain_task_id)
            registry.finalize_task(on_chain_task_id)
            self._tasks_finalized += 1
            logger.info("Task %d finalized", on_chain_task_id)
            client.close()
        except Exception as e:
            logger.error("Finalize task %d failed: %s", on_chain_task_id, e)

    def withdraw_earnings(self):
        """Withdraw accumulated earnings."""
        if not self.online:
            return
        try:
            client, _, registry = _init_hedera()
            registry.withdraw_earnings()
            logger.info("Earnings withdrawn")
            client.close()
        except Exception as e:
            logger.warning("Withdraw earnings failed: %s", e)

    def health_check_miners(self, miners: list) -> list:
        """Check which miners are online."""
        online = []
        for m in miners:
            ep = m.get("endpoint", "")
            if ep and self.dendrite.check_health(ep):
                online.append(m)
            else:
                logger.warning("Miner %s is offline", m.get("miner_id"))
        return online

    def get_stats(self) -> dict:
        return {
            "validator_id": self.validator_id,
            "stake": self.stake,
            "tasks_created": self._tasks_created,
            "tasks_validated": self._tasks_validated,
            "tasks_finalized": self._tasks_finalized,
        }


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="ModernTensor Validator Node")
    parser.add_argument("--subnet", type=int, default=0, help="Subnet ID")
    parser.add_argument(
        "--stake",
        type=float,
        default=50_000.0,
        help="MDT to stake (with --auto-register)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="Task timeout (seconds)",
    )
    parser.add_argument(
        "--task-interval",
        type=float,
        default=60.0,
        help="Seconds between creating tasks",
    )
    parser.add_argument(
        "--task-reward",
        type=float,
        default=10.0,
        help="MDT reward per task",
    )
    parser.add_argument(
        "--task-duration",
        type=int,
        default=86400,
        help="Task duration in seconds",
    )
    parser.add_argument(
        "--auto-register",
        action="store_true",
        help="Auto stake + register as validator on-chain",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="No on-chain calls (Dendrite-only mode)",
    )
    parser.add_argument(
        "--withdraw-interval",
        type=int,
        default=3600,
        help="Seconds between auto-withdraw (0=disabled)",
    )
    parser.add_argument(
        "--miners",
        default="http://localhost:8091",
        help="Comma-separated miner endpoints",
    )
    args = parser.parse_args()

    online = not args.offline
    validator_id = os.getenv("HEDERA_ACCOUNT_ID", "0.0.0")

    print("=" * 60)
    print("  ModernTensor Validator Node")
    print("=" * 60)
    print(f"  Account:        {validator_id}")
    print(f"  Subnet:         {args.subnet}")
    print(f"  On-chain:       {'YES' if online else 'OFFLINE'}")
    print(f"  Task interval:  {args.task_interval}s")
    print(f"  Task reward:    {args.task_reward} MDT")
    print(f"  Miner endpoints: {args.miners}")
    print("=" * 60)

    # ── Auto-registration ──
    if args.auto_register and online:
        print("\n  Auto-registering validator on-chain...")
        if auto_register_validator(args.subnet, args.stake):
            print("  Registration complete\n")
        else:
            print("  Registration failed (may already be registered)\n")

    # ── Create validator node ──
    validator = ValidatorNode(
        validator_id=validator_id,
        stake=args.stake,
        subnet_id=args.subnet,
        timeout=args.timeout,
        online=online,
    )

    # Parse miner endpoints
    miners = []
    for i, ep in enumerate(args.miners.split(",")):
        ep = ep.strip()
        miners.append({"miner_id": f"miner-{i}", "endpoint": ep})

    # Graceful shutdown
    validator._running = True

    def shutdown(sig, frame):
        logger.info("Shutting down validator...")
        validator._running = False

    signal.signal(signal.SIGINT, shutdown)
    if platform.system() != "Windows":
        signal.signal(signal.SIGTERM, shutdown)

    print(f"\n  Validator ready")
    print(f"  Dendrite client -> {len(miners)} miner(s)")
    if online:
        print(
            f"  On-chain: create task -> send to miners -> score -> validate -> finalize"
        )
        if args.withdraw_interval > 0:
            print(f"  Auto-withdraw earnings every {args.withdraw_interval}s")
    print(f"\n  Press Ctrl+C to stop\n")

    # ── HCS service for logging ──
    hcs_service = None
    scoring_topic = os.environ.get("HCS_SCORING_TOPIC_ID") or os.environ.get(
        "HEDERA_SCORING_TOPIC_ID", "0.0.7852336"
    )
    try:
        from sdk.hedera.hcs import HCSService

        client, _, _ = _init_hedera()
        hcs_service = HCSService(client)
        logger.info("HCS service initialized for scoring reports")
    except Exception as e:
        logger.debug("HCS service unavailable: %s", e)

    # ── Validation Loop ──
    last_withdraw = time.time()
    task_counter = 0

    try:
        while validator._running:
            try:
                task_counter += 1
                task_type = "code_review"
                task_payload = {
                    "code": f"def example_{task_counter}():\n    return {task_counter}",
                    "language": "python",
                    "context": f"Epoch task #{task_counter}",
                }
                task_hash = hashlib.sha256(
                    json.dumps(task_payload, sort_keys=True).encode()
                ).hexdigest()

                # 1. Create task on-chain
                on_chain_task_id = -1
                if online:
                    on_chain_task_id = validator.create_task_onchain(
                        task_hash,
                        args.task_reward,
                        args.task_duration,
                    )

                # 2. Send to miners via Dendrite
                online_miners = validator.health_check_miners(miners)
                if not online_miners:
                    logger.warning("No miners online, skipping task %d", task_counter)
                else:
                    results = validator.send_task_to_miners(
                        task_id=f"task-{task_counter}",
                        task_type=task_type,
                        payload=task_payload,
                        miners=online_miners,
                        on_chain_task_id=on_chain_task_id,
                    )

                    # 3. Score results
                    scoring = validator.score_results(
                        f"task-{task_counter}",
                        results,
                    )

                    if scoring.get("winner"):
                        logger.info(
                            "Task %d scored: winner=%s (%.3f)",
                            task_counter,
                            scoring["winner"],
                            scoring["winner_score"],
                        )

                        # 4. Submit scores on-chain
                        if online and on_chain_task_id >= 0:
                            validator.submit_scores_onchain(
                                on_chain_task_id,
                                scoring["scores"],
                            )

                        # 5. Finalize task on-chain
                        if online and on_chain_task_id >= 0:
                            validator.finalize_task_onchain(on_chain_task_id)

                        # 6. Report to HCS
                        if hcs_service:
                            try:
                                score_msg = {
                                    "type": "score_report",
                                    "task_id": f"task-{task_counter}",
                                    "on_chain_task_id": on_chain_task_id,
                                    "validator_id": validator.validator_id,
                                    "scores": scoring["scores"],
                                    "winner": scoring["winner"],
                                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                                }
                                hcs_service.submit_message(
                                    scoring_topic,
                                    json.dumps(score_msg),
                                )
                            except Exception as e:
                                logger.debug("HCS report failed: %s", e)

                # Periodic withdraw
                if (
                    online
                    and args.withdraw_interval > 0
                    and time.time() - last_withdraw > args.withdraw_interval
                ):
                    validator.withdraw_earnings()
                    last_withdraw = time.time()

                # Stats
                stats = validator.get_stats()
                logger.info(
                    "Stats: created=%d, validated=%d, finalized=%d",
                    stats["tasks_created"],
                    stats["tasks_validated"],
                    stats["tasks_finalized"],
                )

            except Exception as e:
                logger.error("Error in validation loop: %s", e)

            # Sleep between tasks (responsive to shutdown)
            for _ in range(int(args.task_interval)):
                if not validator._running:
                    break
                time.sleep(1.0)

    except KeyboardInterrupt:
        pass

    logger.info("Validator stopped")
    final = validator.get_stats()
    print(f"\n  Validator stopped. Final stats:")
    print(f"     Tasks created:   {final['tasks_created']}")
    print(f"     Tasks validated: {final['tasks_validated']}")
    print(f"     Tasks finalized: {final['tasks_finalized']}")


if __name__ == "__main__":
    main()
