"""
ModernTensor Marketplace Orchestrator

The main entry point for the entire marketplace protocol.
Provides a unified API that ties together:
- Protocol Core (task lifecycle, miner management, fees)
- Scoring Engine (multi-dimensional scoring, PoI)
- Hedera Services (HCS logging, HTS tokens, smart contracts)

This is the class that external users interact with.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, Dict, List, Optional

from ..protocol.types import (
    FeeBreakdown,
    MinerInfo,
    PaymentInfo,
    ProtocolConfig,
    TaskAssignment,
    TaskRequest,
    TaskResult,
    ValidatorScore,
)
from ..protocol.fee_engine import FeeEngine
from ..protocol.miner_registry import MinerRegistry
from ..protocol.task_manager import TaskManager
from ..protocol.matching import TaskMatcher
from ..protocol.validator import ValidationOrchestrator, ValidationResult
from ..protocol.reward_distributor import RewardDistributor
from ..protocol.escrow_manager import EscrowManager
from ..protocol.treasury import Treasury
from ..scoring.dimensions import MultiDimensionScorer, CODE_REVIEW_DIMENSIONS
from ..scoring.consensus import ScoreConsensus
from ..scoring.weights import WeightCalculator
from ..scoring.proof_of_intelligence import ProofOfIntelligence
from ..scoring.proof_of_quality import ProofOfQuality
from ..scoring.benchmark_pool import BenchmarkPool
from .analytics import ProtocolAnalytics

logger = logging.getLogger(__name__)


class MarketplaceProtocol:
    """
    Unified marketplace protocol — single entry point for the entire system.

    Architecture layers:
        ┌──────────────────────────────┐
        │     MarketplaceProtocol      │  ← You are here
        ├──────────────────────────────┤
        │  TaskManager │ MinerRegistry │  ← Protocol Core
        ├──────────────────────────────┤
        │  Scorer │ Consensus │ PoI    │  ← Scoring Engine
        ├──────────────────────────────┤
        │  HCS │ HTS │ Smart Contracts │  ← Hedera Services
        └──────────────────────────────┘

    Example:
        # Initialize
        protocol = MarketplaceProtocol(
            config=ProtocolConfig(protocol_fee_rate=0.05),
            validator_id="0.0.99999",
        )

        # Register miners
        protocol.register_miner("0.0.1001", subnet_ids=[1], stake=500)
        protocol.register_miner("0.0.1002", subnet_ids=[1], stake=300)

        # Submit and process a task
        task = protocol.submit_task(
            subnet_id=1,
            task_type="code_review",
            payload={"code": "contract Foo { ... }"},
            reward_amount=50.0,
            requester_id="0.0.2001",
        )

        # Match task to miners
        assignments = protocol.match_task(task.task_id)

        # Miners submit results
        for a in assignments:
            protocol.submit_result(
                task_id=task.task_id,
                miner_id=a.miner_id,
                output={"analysis": "...", "findings": [...]},
                execution_time=12.5,
            )

        # Validate and pay
        result = protocol.validate_and_pay(task.task_id)
        print(f"Winner: {result.winner_miner_id}")
    """

    def __init__(
        self,
        config: Optional[ProtocolConfig] = None,
        validator_id: str = "0.0.0",
        enable_poi: bool = True,
        enable_poq: bool = True,
        enable_benchmark: bool = True,
        enable_dynamic_fees: bool = False,
        hts_service: Optional[Any] = None,
        hcs_service: Optional[Any] = None,
        contract_service: Optional[Any] = None,
        dry_run: bool = True,
    ):
        """
        Initialize the marketplace protocol.

        Args:
            config: Protocol configuration
            validator_id: This node's validator ID
            enable_poi: Enable Proof of Intelligence verification (Layer 1)
            enable_poq: Enable Proof of Quality multi-validator consensus (Layer 2)
            enable_benchmark: Enable benchmark ground-truth challenges (Layer 3)
            enable_dynamic_fees: Enable dynamic fee adjustment
            hts_service: HTSService for on-chain MDT transfers
            hcs_service: HCSService for audit logging
            contract_service: SmartContractService for escrow
            dry_run: If True, simulate transfers without on-chain execution
        """
        self.config = config or ProtocolConfig()
        self.validator_id = validator_id
        self.hcs_service = hcs_service  # Store for sync bridge

        # Initialize subsystems
        self._init_protocol_core(enable_dynamic_fees)
        self._init_scoring_engine(validator_id, enable_poi, enable_poq, enable_benchmark)
        self._init_reward_system(hts_service, hcs_service, contract_service, dry_run)

        # HCS ↔ MinerRegistry sync bridge
        self._hcs_sync = None
        if hcs_service is not None:
            from ..hedera.hcs_sync import HCSRegistrySync
            self._hcs_sync = HCSRegistrySync(hcs_service, self.miner_registry)
            logger.info("HCS sync bridge enabled")

        # Protocol state
        self._epoch = 0
        self._started_at = time.time()
        self._event_log: List[Dict[str, Any]] = []

        # Analytics aggregator
        self.analytics = ProtocolAnalytics()

        logger.info(
            "MarketplaceProtocol initialized — validator=%s, poi=%s, "
            "reward_system=active (dry_run=%s), hcs_sync=%s",
            validator_id, enable_poi, dry_run, self._hcs_sync is not None,
        )

    # ------------------------------------------------------------------
    # Initialization Helpers
    # ------------------------------------------------------------------

    def _init_protocol_core(self, enable_dynamic_fees: bool) -> None:
        """Initialize protocol core: fees, registry, matching."""
        self.fee_engine = FeeEngine(
            config=self.config,
            enable_dynamic_fees=enable_dynamic_fees,
        )
        self.miner_registry = MinerRegistry(config=self.config)
        self.matcher = TaskMatcher()

    def _init_scoring_engine(
        self,
        validator_id: str,
        enable_poi: bool,
        enable_poq: bool = True,
        enable_benchmark: bool = True,
    ) -> None:
        """Initialize scoring engine: dimensions, consensus, weights, PoI, PoQ, benchmarks."""
        self.scorer = MultiDimensionScorer(CODE_REVIEW_DIMENSIONS)
        self.consensus = ScoreConsensus()
        self.weight_calculator = WeightCalculator(
            min_stake=self.config.min_stake_amount,
        )

        # Layer 1: Proof of Intelligence (anti-cheat)
        self.poi = ProofOfIntelligence() if enable_poi else None

        # Layer 2: Proof of Quality (multi-validator consensus)
        self.poq = ProofOfQuality(min_validators=1) if enable_poq else None

        # Layer 3: Benchmark Pool (ground truth challenges)
        self.benchmark_pool = BenchmarkPool() if enable_benchmark else None

        # Create scoring function for validator
        def scoring_fn(task: TaskRequest, result: TaskResult) -> Any:
            from ..protocol.types import ScoreBreakdown
            scored = self.scorer.score(task.payload, result.output)
            return ScoreBreakdown(
                dimensions=scored["dimensions"],
                weights=scored["weights"],
                final_score=scored["final_score"],
                confidence=scored["confidence"],
            )

        # Validator orchestrator
        self.validator = ValidationOrchestrator(
            validator_id=validator_id,
            scoring_fn=scoring_fn,
        )

        # Task manager (ties everything together)
        self.task_manager = TaskManager(
            config=self.config,
            fee_engine=self.fee_engine,
            miner_registry=self.miner_registry,
            matcher=self.matcher,
            validator=self.validator,
        )

    def _init_reward_system(
        self,
        hts_service: Optional[Any],
        hcs_service: Optional[Any],
        contract_service: Optional[Any],
        dry_run: bool,
    ) -> None:
        """Initialize reward system: treasury, escrow, distributor."""
        self.treasury = Treasury()
        self.escrow_manager = EscrowManager(
            contract_service=contract_service,
            hts_service=hts_service,
            dry_run=dry_run,
        )
        self.reward_distributor = RewardDistributor(
            hts_service=hts_service,
            hcs_service=hcs_service,
            contract_service=contract_service,
            treasury=self.treasury,
            dry_run=dry_run,
        )

        # Wire TaskManager's payment callback to RewardDistributor
        self.task_manager.on_payment_ready(self._on_payment_ready)

    # ------------------------------------------------------------------
    # Miner Management
    # ------------------------------------------------------------------

    def register_miner(
        self,
        miner_id: str,
        subnet_ids: Optional[List[int]] = None,
        stake: float = 0.0,
        capabilities: Optional[List[str]] = None,
        publish_to_hcs: bool = False,
    ) -> MinerInfo:
        """
        Register a new miner in the marketplace.

        Args:
            miner_id: Unique Hedera account ID
            subnet_ids: Subnets to register in
            stake: Amount of MDT to stake
            capabilities: Task types this miner supports
            publish_to_hcs: If True and HCS is available, also publish on-chain
        """
        if publish_to_hcs and self._hcs_sync:
            result = self._hcs_sync.publish_registration(
                miner_id=miner_id,
                subnet_ids=subnet_ids,
                stake=stake,
                capabilities=capabilities,
            )
            miner = result["miner"]
            self._log_event("miner_registered", {
                "miner_id": miner_id,
                "subnets": subnet_ids,
                "stake": stake,
                "on_chain": result["on_chain"],
            })
        else:
            miner = self.miner_registry.register(
                miner_id=miner_id,
                subnet_ids=subnet_ids,
                stake_amount=stake,
                capabilities=capabilities,
            )
            self._log_event("miner_registered", {
                "miner_id": miner_id,
                "subnets": subnet_ids,
                "stake": stake,
                "on_chain": False,
            })
        return miner

    def deregister_miner(self, miner_id: str) -> MinerInfo:
        """Deregister a miner from the marketplace."""
        miner = self.miner_registry.deregister(miner_id)
        self._log_event("miner_deregistered", {"miner_id": miner_id})
        return miner

    def get_miner(self, miner_id: str) -> Optional[MinerInfo]:
        """Get miner information."""
        return self.miner_registry.get_miner(miner_id)

    def get_leaderboard(
        self,
        subnet_id: Optional[int] = None,
        top_n: int = 20,
    ) -> List[MinerInfo]:
        """Get ranked miner leaderboard."""
        return self.miner_registry.get_leaderboard(subnet_id, top_n)

    def sync_miners_from_chain(self) -> List[MinerInfo]:
        """
        Pull miner registrations from HCS and sync into local MinerRegistry.

        Returns:
            List of newly registered MinerInfo from on-chain data.
            Empty list if HCS sync is not available.
        """
        if not self._hcs_sync:
            logger.warning("HCS sync not available — no hcs_service configured")
            return []

        new_miners = self._hcs_sync.sync_from_chain()
        for miner in new_miners:
            self._log_event("miner_synced_from_chain", {
                "miner_id": miner.miner_id,
                "subnets": miner.subnet_ids,
                "stake": miner.stake_amount,
            })
        return new_miners

    # ------------------------------------------------------------------
    # Task Operations
    # ------------------------------------------------------------------

    def submit_task(
        self,
        subnet_id: int,
        task_type: str,
        payload: Dict[str, Any],
        reward_amount: float,
        requester_id: str,
        priority: str = "normal",
        max_miners: int = 3,
    ) -> TaskRequest:
        """Submit a new task to the marketplace."""
        task = self.task_manager.submit_task(
            subnet_id=subnet_id,
            task_type=task_type,
            payload=payload,
            reward_amount=reward_amount,
            requester_id=requester_id,
            priority=priority,
            max_miners=max_miners,
        )

        # Create escrow deposit for this task
        fee_breakdown = self.task_manager.get_fee_breakdown(task.task_id)
        if fee_breakdown:
            self.escrow_manager.create_escrow(
                task_id=task.task_id,
                depositor_id=requester_id,
                amount=fee_breakdown.reward_amount,
                protocol_fee=fee_breakdown.protocol_fee,
                subnet_fee=fee_breakdown.subnet_fee,
            )

        # Record in analytics
        self.analytics.record_task_submitted(subnet_id, reward_amount)

        self._log_event("task_submitted", {
            "task_id": task.task_id,
            "subnet_id": subnet_id,
            "reward": reward_amount,
            "escrow": "created",
        })
        return task

    def match_task(self, task_id: str) -> List[TaskAssignment]:
        """Match a task to available miners."""
        assignments = self.task_manager.match_task(task_id)
        self._log_event("task_matched", {
            "task_id": task_id,
            "miners": [a.miner_id for a in assignments],
        })
        return assignments

    def submit_result(
        self,
        task_id: str,
        miner_id: str,
        output: Dict[str, Any],
        execution_time: Optional[float] = None,
    ) -> TaskResult:
        """Submit a result from a miner."""
        result = self.task_manager.submit_result(
            task_id=task_id,
            miner_id=miner_id,
            output=output,
            execution_time=execution_time,
        )
        self._log_event("result_submitted", {
            "task_id": task_id,
            "miner_id": miner_id,
        })
        return result

    def validate_and_pay(self, task_id: str) -> ValidationResult:
        """
        Validate results, distribute rewards, and settle escrow.

        Runs the full 3-layer validation pipeline:
        1. Score all miner results (dimension scoring)
        2. Layer 1 — PoI verification (anti-cheat)
        3. Layer 2 — PoQ multi-validator consensus
        4. Layer 3 — Benchmark ground-truth scoring (if applicable)
        5. Determine winner
        6. Prepare payment → RewardDistributor processes on-chain transfer
        7. Release escrow → EscrowManager settles smart contract
        """
        validation = self.task_manager.validate_task(task_id)

        task = self.task_manager.get_task(task_id)
        assignments = self.task_manager.get_assignments(task_id)

        # Find winner's assignment
        winner_assignment = None
        if validation.is_valid and validation.winner_miner_id:
            for a in assignments:
                if a.miner_id == validation.winner_miner_id and a.result:
                    winner_assignment = a
                    break

        # ── Layer 1: Proof of Intelligence ──
        if self.poi and winner_assignment and winner_assignment.result:
            poi_result = self.poi.verify(
                miner_id=validation.winner_miner_id,
                output=winner_assignment.result.output,
                dimension_scores=validation.consensus_scores,
                validator_scores=validation.consensus_scores,
                task_payload=task.payload if task else None,
            )
            self._log_event("poi_verified", {
                "task_id": task_id,
                "miner_id": validation.winner_miner_id,
                "poi_score": poi_result.poi_score,
                "verified": poi_result.is_verified,
            })

        # ── Layer 2: Proof of Quality (multi-validator consensus) ──
        if self.poq and validation.is_valid and assignments:
            for a in assignments:
                if a.result and a.score is not None:
                    # Each assignment's score acts as a "validator" signal
                    scored = self.scorer.score(
                        task.payload if task else {},
                        a.result.output,
                    )
                    self.poq.submit_score(
                        validator_id=self.validator_id,
                        miner_id=a.miner_id,
                        quality=scored["final_score"],
                        relevance=scored["dimensions"].get("correctness", 0.5),
                        depth=scored["dimensions"].get("security", 0.5),
                        confidence=scored["confidence"],
                    )

            # Aggregate for winner
            if validation.winner_miner_id:
                poq_result = self.poq.aggregate(validation.winner_miner_id)
                self._log_event("poq_verified", {
                    "task_id": task_id,
                    "miner_id": validation.winner_miner_id,
                    "consensus_score": poq_result.consensus_score,
                    "is_quality": poq_result.is_quality,
                    "clipped": poq_result.clipped_validators,
                })

        # ── Layer 3: Benchmark Ground-Truth (if this is a benchmark task) ──
        if self.benchmark_pool and task and validation.is_valid:
            benchmark_id = (task.payload or {}).get("_benchmark_id")
            if benchmark_id:
                for a in assignments:
                    if a.result:
                        bench_result = self.benchmark_pool.score_response(
                            challenge_id=benchmark_id,
                            miner_id=a.miner_id,
                            miner_output=a.result.output,
                            response_time=a.result.execution_time or 0,
                        )
                        self._log_event("benchmark_scored", {
                            "task_id": task_id,
                            "miner_id": a.miner_id,
                            "detection_rate": bench_result.detection_rate,
                            "overall_score": bench_result.overall_score,
                            "found": bench_result.found_bugs,
                            "missed": bench_result.missed_bugs,
                        })

        # Release or refund escrow based on validation result
        try:
            if validation.is_valid:
                self.escrow_manager.release_escrow(task_id)
            else:
                self.escrow_manager.refund_escrow(task_id)
        except (KeyError, ValueError) as e:
            logger.debug("Escrow settlement skipped: %s", e)

        # Record analytics for completed tasks
        if validation.is_valid:
            fee = self.task_manager.get_fee_breakdown(task_id)
            task_obj = self.task_manager.get_task(task_id)
            self.analytics.record_task_completed(
                subnet_id=task_obj.subnet_id if task_obj else 0,
                reward=fee.reward_amount if fee else 0,
                score=validation.winner_score,
                completion_time=time.time() - self._started_at,
                protocol_fee=fee.protocol_fee if fee else 0,
            )
        else:
            task_obj = self.task_manager.get_task(task_id)
            self.analytics.record_task_failed(
                subnet_id=task_obj.subnet_id if task_obj else 0,
            )

        self._log_event("task_validated", {
            "task_id": task_id,
            "winner": validation.winner_miner_id,
            "score": validation.winner_score,
            "paid": validation.is_valid,
        })
        return validation

    def get_miner_tasks(self, miner_id: str) -> List:
        """Get pending assignments for a specific miner."""
        return self.task_manager.get_assignments_for_miner(miner_id)

    def get_miner_earnings(self, miner_id: str) -> Dict[str, Any]:
        """
        Get earnings summary for a specific miner.

        Returns dict with total_earned, task_count, history list.
        """
        history = self.task_manager.get_miner_history(miner_id)
        total = sum(h.get("earnings", 0) for h in history)
        wins = sum(1 for h in history if h.get("is_winner"))
        return {
            "miner_id": miner_id,
            "total_earned": round(total, 4),
            "tasks_completed": len(history),
            "tasks_won": wins,
            "win_rate": round(wins / len(history), 4) if history else 0.0,
            "history": history,
        }

    def get_task_detail(self, task_id: str) -> Dict[str, Any]:
        """
        Get comprehensive detail for a task — used by requester to check status.

        Returns dict with task info, assignments, results, validation, payment.
        """
        task = self.task_manager.get_task(task_id)
        if task is None:
            return {}

        assignments = self.task_manager.get_assignments(task_id)
        results = self.task_manager.get_results(task_id)
        validation = self.task_manager.get_validation(task_id)
        payment = self.task_manager.get_payment(task_id)
        fee = self.task_manager.get_fee_breakdown(task_id)

        detail: Dict[str, Any] = {
            "task_id": task.task_id,
            "task_type": task.task_type,
            "subnet_id": task.subnet_id,
            "status": task.status.value,
            "reward_amount": task.reward_amount,
            "requester_id": task.requester_id,
            "priority": task.priority.value if hasattr(task.priority, 'value') else str(task.priority),
            "max_miners": task.max_miners,
            "created_at": task.created_at,
            "assignments": [],
            "results": [],
            "validation": None,
            "payment": None,
            "fee_breakdown": fee.to_dict() if fee else None,
        }

        for a in assignments:
            detail["assignments"].append({
                "miner_id": a.miner_id,
                "is_completed": a.is_completed,
                "is_timeout": a.is_timeout,
                "score": a.score,
            })

        for r in results:
            detail["results"].append({
                "miner_id": r.miner_id,
                "output": r.output,
                "execution_time": r.execution_time,
                "submitted_at": r.submitted_at,
            })

        if validation:
            detail["validation"] = {
                "is_valid": validation.is_valid,
                "winner_miner_id": validation.winner_miner_id,
                "winner_score": validation.winner_score,
                "scores": [
                    {
                        "miner_id": s.miner_id,
                        "final_score": s.final_score,
                    }
                    for s in (validation.validator_scores or [])
                ],
            }

        if payment:
            detail["payment"] = {
                "miner_id": payment.miner_id,
                "amount": payment.amount,
                "is_paid": payment.is_paid,
            }

        return detail

    def _on_payment_ready(self, payment: PaymentInfo) -> None:
        """
        Callback from TaskManager when payment is ready.
        Routes to RewardDistributor for on-chain execution.
        """
        batch = self.reward_distributor.process_payment(payment)
        self._log_event("reward_distributed", {
            "task_id": payment.task_id,
            "miner_id": payment.miner_id,
            "amount": payment.amount,
            "status": batch.status,
            "total_distributed": batch.total_distributed,
        })

    # ------------------------------------------------------------------
    # Protocol Operations
    # ------------------------------------------------------------------

    def advance_epoch(self) -> Dict[str, Any]:
        """
        Advance to next epoch — recalculate weights, reset counters.

        Should be called periodically (e.g., every 100 blocks or hourly).
        """
        self._epoch += 1

        # Recalculate weights for all active miners
        active = self.miner_registry.get_active_miners()
        miner_data = [
            {
                "miner_id": m.miner_id,
                "reputation_score": m.reputation.score,
                "stake_amount": m.stake_amount,
                "success_rate": m.reputation.success_rate,
                "timeout_rate": m.reputation.timeout_rate,
                "total_tasks": m.reputation.total_tasks,
            }
            for m in active
        ]

        weights = self.weight_calculator.calculate(
            miners=miner_data, epoch=self._epoch
        )

        # Reset load counters
        self.matcher.reset_load_counters()

        self._log_event("epoch_advanced", {
            "epoch": self._epoch,
            "active_miners": len(active),
            "top_miners": weights.top_miners(5),
        })

        logger.info("Epoch %d — %d active miners", self._epoch, len(active))
        return {
            "epoch": self._epoch,
            "weights": weights.to_dict(),
            "active_miners": len(active),
        }

    def get_protocol_stats(self) -> Dict[str, Any]:
        """Get comprehensive protocol statistics."""
        return {
            "epoch": self._epoch,
            "uptime_seconds": round(time.time() - self._started_at, 0),
            "task_stats": self.task_manager.get_stats(),
            "miner_stats": self.miner_registry.get_stats(),
            "fee_stats": self.fee_engine.get_metrics(),
            "matcher_stats": self.matcher.get_stats(),
            "validator_stats": self.validator.get_stats(),
            "poi_stats": self.poi.get_stats() if self.poi else None,
            "poq_stats": self.poq.get_stats() if self.poq else None,
            "benchmark_stats": self.benchmark_pool.get_stats() if self.benchmark_pool else None,
            "reward_stats": self.reward_distributor.get_stats(),
            "escrow_stats": self.escrow_manager.get_stats(),
            "treasury": self.treasury.get_snapshot().to_dict(),
            "analytics": self.analytics.get_dashboard_metrics(),
            "event_count": len(self._event_log),
        }

    def get_treasury_report(self) -> Dict[str, Any]:
        """Get detailed treasury report: revenue, top earners, recent payouts."""
        return {
            "revenue_summary": self.treasury.get_revenue_summary(),
            "top_earners": self.treasury.get_top_earners(10),
            "recent_payouts": self.treasury.get_recent_payouts(20),
            "escrow_status": self.escrow_manager.get_stats(),
            "distribution_status": self.reward_distributor.get_stats(),
        }

    def get_event_log(
        self,
        limit: int = 50,
        event_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get recent events, optionally filtered by type."""
        events = self._event_log
        if event_type:
            events = [e for e in events if e["type"] == event_type]
        return events[-limit:]

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _log_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Log a protocol event."""
        event = {
            "type": event_type,
            "timestamp": time.time(),
            "epoch": self._epoch,
            "data": data,
        }
        self._event_log.append(event)

        # Keep event log bounded
        max_events = 10000
        if len(self._event_log) > max_events:
            self._event_log = self._event_log[-max_events:]
