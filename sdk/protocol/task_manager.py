"""
ModernTensor Task Manager

The heart of the marketplace protocol — manages the complete task lifecycle:
    submit → validate → match → assign → execute → score → pay

State machine for task processing with timeout handling, retry logic,
and integration with the fee engine, miner registry, and validator.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, Dict, List, Optional

from .types import (
    FeeBreakdown,
    MinerInfo,
    PaymentInfo,
    ProtocolConfig,
    TaskAssignment,
    TaskRequest,
    TaskResult,
    TaskStatus,
)
from .fee_engine import FeeEngine
from .matching import TaskMatcher
from .miner_registry import MinerRegistry
from .validator import ValidationOrchestrator, ValidationResult
import json
from pathlib import Path

logger = logging.getLogger(__name__)


class TaskManager:
    """
    Manages the complete lifecycle of tasks in the marketplace protocol.

    Lifecycle:
        1. PENDING   — Task submitted, awaiting validation
        2. MATCHING  — Finding miners via TaskMatcher
        3. ASSIGNED  — Miners assigned, awaiting results
        4. EXECUTING — Miners working on the task
        5. VALIDATING — Results being scored and validated
        6. COMPLETED — Task finished, payment released
        7. FAILED    — Task failed (timeout, insufficient miners, etc.)

    Example:
        manager = TaskManager(
            config=ProtocolConfig(),
            fee_engine=fee_engine,
            miner_registry=registry,
            matcher=matcher,
            validator=validator,
        )

        # Submit a task
        task = manager.submit_task(
            subnet_id=1,
            task_type="code_review",
            payload={"code": "...", "language": "solidity"},
            reward_amount=50.0,
            requester_id="0.0.11111",
        )

        # Process the task (match → assign → wait → validate → pay)
        result = manager.process_task(task.task_id)
    """

    def __init__(
        self,
        config: Optional[ProtocolConfig] = None,
        fee_engine: Optional[FeeEngine] = None,
        miner_registry: Optional[MinerRegistry] = None,
        matcher: Optional[TaskMatcher] = None,
        validator: Optional[ValidationOrchestrator] = None,
    ):
        self.config = config or ProtocolConfig()
        self.fee_engine = fee_engine or FeeEngine(self.config)
        self.miner_registry = miner_registry or MinerRegistry(self.config)
        self.matcher = matcher or TaskMatcher()
        self.validator = validator

        # Storage
        self._tasks: Dict[str, TaskRequest] = {}
        self._assignments: Dict[str, List[TaskAssignment]] = {}
        self._results: Dict[str, List[TaskResult]] = {}
        self._validations: Dict[str, ValidationResult] = {}
        self._payments: Dict[str, PaymentInfo] = {}
        self._fee_breakdowns: Dict[str, FeeBreakdown] = {}

        # Callbacks
        self._on_task_submitted: Optional[Callable] = None
        self._on_task_completed: Optional[Callable] = None
        self._on_payment_ready: Optional[Callable] = None

        # Metrics
        self._total_tasks = 0
        self._completed_tasks = 0
        self._failed_tasks = 0
        self._total_volume = 0.0

        # Persistence
        self.data_dir = Path("data")
        self.data_dir.mkdir(exist_ok=True)
        self.state_file = self.data_dir / "task_manager.json"
        self.load_state()

        logger.info("TaskManager initialized")

    # ------------------------------------------------------------------
    # Task Submission
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
        timeout_seconds: Optional[float] = None,
        metadata: Optional[Dict] = None,
    ) -> TaskRequest:
        """
        Submit a new task to the marketplace.

        Args:
            subnet_id: Target subnet
            task_type: Type of task
            payload: Task data
            reward_amount: MDT reward offered
            requester_id: Submitter's account ID
            priority: "low", "normal", "high", "urgent"
            max_miners: Max miners to assign
            timeout_seconds: Task timeout
            metadata: Additional metadata

        Returns:
            Created TaskRequest
        """
        from .types import TaskPriority

        task = TaskRequest(
            subnet_id=subnet_id,
            task_type=task_type,
            payload=payload,
            reward_amount=reward_amount,
            requester_id=requester_id,
            priority=TaskPriority(priority),
            max_miners=max_miners,
            timeout_seconds=timeout_seconds or self.config.default_task_timeout,
            metadata=metadata or {},
        )

        self._tasks[task.task_id] = task
        self._total_tasks += 1
        self._total_volume += reward_amount

        # Calculate fees upfront
        subnet_fee_rate = self._get_subnet_fee_rate(subnet_id)
        fee_breakdown = self.fee_engine.calculate_for_task(task, subnet_fee_rate)
        self._fee_breakdowns[task.task_id] = fee_breakdown

        if self._on_task_submitted:
            self._on_task_submitted(task, fee_breakdown)

        logger.info(
            "Task submitted: id=%s, subnet=%d, type=%s, reward=%.2f MDT",
            task.task_id[:8],
            subnet_id,
            task_type,
            reward_amount,
        )
        self.save_state()
        return task

    # ------------------------------------------------------------------
    # Task Processing Pipeline
    # ------------------------------------------------------------------

    def match_task(self, task_id: str) -> List[TaskAssignment]:
        """
        Match a task to miners and create assignments.

        Transitions: PENDING → MATCHING → ASSIGNED
        """
        task = self._get_task_or_raise(task_id)
        task.status = TaskStatus.MATCHING

        # Get available miners
        available = self.miner_registry.get_active_miners(task.subnet_id)

        try:
            selected_miners = self.matcher.match(task, available)
        except ValueError as e:
            task.status = TaskStatus.FAILED
            self._failed_tasks += 1
            logger.error("Matching failed for task %s: %s", task_id[:8], e)
            raise

        # Create assignments
        assignments = []
        for miner in selected_miners:
            assignment = TaskAssignment(
                task_id=task_id,
                miner_id=miner.miner_id,
                subnet_id=task.subnet_id,
                deadline=time.time() + task.timeout_seconds,
            )
            assignments.append(assignment)

        self._assignments[task_id] = assignments
        task.status = TaskStatus.ASSIGNED

        logger.info(
            "Task %s matched to %d miners",
            task_id[:8],
            len(assignments),
        )
        self.save_state()
        return assignments

    def submit_result(
        self,
        task_id: str,
        miner_id: str,
        output: Dict[str, Any],
        execution_time: Optional[float] = None,
        proof: Optional[str] = None,
    ) -> TaskResult:
        """
        Submit a result from a miner for a task.

        Transitions: ASSIGNED → EXECUTING
        """
        task = self._get_task_or_raise(task_id)
        assignments = self._assignments.get(task_id, [])

        # Verify this miner is assigned
        assignment = None
        for a in assignments:
            if a.miner_id == miner_id:
                assignment = a
                break

        if assignment is None:
            raise ValueError(
                f"Miner {miner_id} is not assigned to task {task_id[:8]}"
            )

        # Check for timeout
        if assignment.is_expired:
            assignment.is_timeout = True
            self.miner_registry.record_timeout(miner_id)
            raise TimeoutError(
                f"Assignment for miner {miner_id} has expired"
            )

        # Create result
        result = TaskResult(
            task_id=task_id,
            miner_id=miner_id,
            output=output,
            execution_time=execution_time,
            proof=proof,
        )

        # Attach result to assignment
        assignment.result = result
        assignment.is_completed = True

        # Store result
        if task_id not in self._results:
            self._results[task_id] = []
        self._results[task_id].append(result)

        task.status = TaskStatus.EXECUTING

        logger.info(
            "Result received for task %s from miner %s",
            task_id[:8],
            miner_id,
        )
        self.save_state()
        return result

    def validate_task(self, task_id: str) -> ValidationResult:
        """
        Validate all results for a task.

        Transitions: EXECUTING → VALIDATING → COMPLETED/FAILED
        """
        task = self._get_task_or_raise(task_id)

        if self.validator is None:
            raise RuntimeError("No validator configured in TaskManager")

        task.status = TaskStatus.VALIDATING
        assignments = self._assignments.get(task_id, [])

        validation = self.validator.validate(task, assignments)
        self._validations[task_id] = validation

        # Penalize timed-out miners REGARDLESS of overall task outcome
        for a in assignments:
            if a.is_timeout:
                self.miner_registry.record_timeout(a.miner_id)

        if validation.is_valid:
            task.status = TaskStatus.COMPLETED
            self._completed_tasks += 1

            # Update miner reputations
            for score_entry in validation.validator_scores:
                miner_result = None
                for a in assignments:
                    if a.miner_id == score_entry.miner_id and a.result:
                        miner_result = a.result
                        break

                exec_time = (
                    miner_result.execution_time if miner_result else 0.0
                ) or 0.0

                self.miner_registry.update_reputation(
                    miner_id=score_entry.miner_id,
                    task_score=score_entry.final_score,
                    response_time=exec_time,
                    success=True,
                )

            # Prepare payment
            if validation.winner_miner_id:
                self._prepare_payment(task, validation)

            if self._on_task_completed:
                self._on_task_completed(task, validation)
        else:
            task.status = TaskStatus.FAILED
            self._failed_tasks += 1

        logger.info(
            "Task %s validation: valid=%s, winner=%s",
            task_id[:8],
            validation.is_valid,
            validation.winner_miner_id,
        )
        self.save_state()
        return validation

    def process_task(self, task_id: str) -> ValidationResult:
        """
        Run the complete task pipeline: match → (results collected) → validate.

        Note: This expects results to already be submitted in between
        match_task() and validate_task(). For real usage, the flow is:
            1. match_task()
            2. (miners submit results asynchronously)
            3. validate_task()

        This method runs immediately for demo/testing purposes.
        """
        self.match_task(task_id)
        # In production, we wait for results here
        return self.validate_task(task_id)

    # ------------------------------------------------------------------
    # Payment
    # ------------------------------------------------------------------

    def _prepare_payment(
        self,
        task: TaskRequest,
        validation: ValidationResult,
    ) -> PaymentInfo:
        """Prepare payment info for the winner."""
        fee_breakdown = self._fee_breakdowns.get(task.task_id)

        # Distribute rewards proportional to scores
        if fee_breakdown:
            miner_rewards = self.fee_engine.distribute_miner_rewards(
                total_miner_reward=fee_breakdown.miner_reward,
                miner_scores=validation.consensus_scores,
            )
            winner_amount = miner_rewards.get(
                validation.winner_miner_id, fee_breakdown.miner_reward,
            )
        else:
            winner_amount = task.reward_amount

        payment = PaymentInfo(
            task_id=task.task_id,
            miner_id=validation.winner_miner_id,
            amount=winner_amount,
            fee_breakdown=fee_breakdown,
        )
        self._payments[task.task_id] = payment

        if self._on_payment_ready:
            self._on_payment_ready(payment)

        logger.info(
            "Payment prepared: task=%s, miner=%s, amount=%.4f MDT",
            task.task_id[:8],
            validation.winner_miner_id,
            winner_amount,
        )
        self.save_state()
        return payment

    def get_payment(self, task_id: str) -> Optional[PaymentInfo]:
        """Get payment info for a task."""
        return self._payments.get(task_id)

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_task(self, task_id: str) -> Optional[TaskRequest]:
        """Get a task by ID."""
        return self._tasks.get(task_id)

    def get_assignments(self, task_id: str) -> List[TaskAssignment]:
        """Get all assignments for a task."""
        return self._assignments.get(task_id, [])

    def get_all_tasks(self) -> List[TaskRequest]:
        """Get all tasks (active and historical)."""
        return list(self._tasks.values())

    def get_fee_breakdown(self, task_id: str) -> Optional[FeeBreakdown]:
        """Get fee breakdown for a task."""
        return self._fee_breakdowns.get(task_id)

    def get_results(self, task_id: str) -> List[TaskResult]:
        """Get all results for a task."""
        return self._results.get(task_id, [])

    def get_validation(self, task_id: str) -> Optional[ValidationResult]:
        """Get validation result for a task."""
        return self._validations.get(task_id)

    def get_pending_tasks(self) -> List[TaskRequest]:
        """Get all tasks still pending or in progress."""
        return [
            t for t in self._tasks.values()
            if t.status not in (TaskStatus.COMPLETED, TaskStatus.FAILED)
        ]

    def get_assignments_for_miner(
        self,
        miner_id: str,
    ) -> List[TaskAssignment]:
        """
        Get all incomplete assignments for a specific miner.

        Returns tasks that are assigned to this miner and haven't been
        completed or timed out yet — i.e. tasks the miner should work on.
        """
        pending = []
        for task_id, assignments in self._assignments.items():
            task = self._tasks.get(task_id)
            if task is None:
                continue
            # Only look at tasks that are assigned or executing
            if task.status not in (
                TaskStatus.ASSIGNED, TaskStatus.EXECUTING, TaskStatus.MATCHING,
            ):
                continue
            for a in assignments:
                if (
                    a.miner_id == miner_id
                    and not a.is_completed
                    and not a.is_timeout
                ):
                    pending.append(a)
        return pending

    def get_miner_history(
        self,
        miner_id: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Get completed task history for a specific miner.

        Returns dicts with task_id, score, result, execution_time, etc.
        """
        history = []
        for task_id, assignments in self._assignments.items():
            for a in assignments:
                if a.miner_id == miner_id and a.is_completed:
                    task = self._tasks.get(task_id)
                    validation = self._validations.get(task_id)
                    payment = self._payments.get(task_id)

                    entry = {
                        "task_id": task_id,
                        "task_type": task.task_type if task else "unknown",
                        "subnet_id": a.subnet_id,
                        "score": a.score,
                        "execution_time": (
                            a.result.execution_time if a.result else None
                        ),
                        "is_winner": (
                            validation.winner_miner_id == miner_id
                            if validation else False
                        ),
                        "earnings": (
                            payment.amount
                            if payment and payment.miner_id == miner_id
                            else 0.0
                        ),
                        "submitted_at": (
                            a.result.submitted_at if a.result else None
                        ),
                    }
                    history.append(entry)

        history.sort(
            key=lambda x: x.get("submitted_at") or 0,
            reverse=True,
        )
        return history[:limit]

    def get_task_history(
        self,
        subnet_id: Optional[int] = None,
        limit: int = 50,
    ) -> List[Dict]:
        """Get task history with optional subnet filter."""
        tasks = list(self._tasks.values())
        if subnet_id is not None:
            tasks = [t for t in tasks if t.subnet_id == subnet_id]

        tasks.sort(key=lambda t: t.created_at, reverse=True)
        return [t.to_dict() for t in tasks[:limit]]

    # ------------------------------------------------------------------
    # Event Handlers
    # ------------------------------------------------------------------

    def on_task_submitted(self, callback: Callable) -> None:
        """Register callback for task submission events."""
        self._on_task_submitted = callback

    def on_task_completed(self, callback: Callable) -> None:
        """Register callback for task completion events."""
        self._on_task_completed = callback

    def on_payment_ready(self, callback: Callable) -> None:
        """Register callback for payment ready events."""
        self._on_payment_ready = callback

    # ------------------------------------------------------------------
    # Metrics
    # ------------------------------------------------------------------

    def get_stats(self) -> Dict[str, Any]:
        """Get task manager statistics."""
        status_counts: Dict[str, int] = {}
        for task in self._tasks.values():
            s = task.status.value
            status_counts[s] = status_counts.get(s, 0) + 1

        return {
            "total_tasks": self._total_tasks,
            "completed_tasks": self._completed_tasks,
            "failed_tasks": self._failed_tasks,
            "completion_rate": (
                round(self._completed_tasks / self._total_tasks, 4)
                if self._total_tasks > 0
                else 0.0
            ),
            "total_volume": round(self._total_volume, 4),
            "status_distribution": status_counts,
            "pending_tasks": len(self.get_pending_tasks()),
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_task_or_raise(self, task_id: str) -> TaskRequest:
        """Get a task or raise KeyError."""
        if task_id not in self._tasks:
            raise KeyError(f"Task {task_id} not found")
        return self._tasks[task_id]

    def _get_subnet_fee_rate(self, subnet_id: int) -> float:
        """Get the fee rate for a subnet. Default 5% for unknown subnets."""
        # In production, this queries the SubnetRegistry smart contract
        default_rates = {
            0: 0.05,  # General AI subnet: 5%
            1: 0.03,  # AI Code Review subnet: 3%
        }
        return default_rates.get(subnet_id, 0.05)

    def save_state(self) -> None:
        """Save task manager state to JSON."""
        try:
            data = {
                "tasks": {k: v.to_dict() for k, v in self._tasks.items()},
                "assignments": {k: [a.to_dict() for a in v] for k, v in self._assignments.items()},
                "results": {k: [r.to_dict() for r in v] for k, v in self._results.items()},
                # validation to_dict is incomplete in some implementations, but let's assume standard behavior or skip complex objects if needed
                # For hackathon, persisting tasks and assignments is key.
                "metrics": {
                    "total_tasks": self._total_tasks,
                    "completed_tasks": self._completed_tasks,
                    "failed_tasks": self._failed_tasks,
                    "total_volume": self._total_volume,
                }
            }
            with open(self.state_file, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save task manager state: {e}")

    def load_state(self) -> None:
        """Load task manager state from JSON."""
        if not self.state_file.exists():
            return

        try:
            with open(self.state_file, "r") as f:
                data = json.load(f)

            from .types import TaskRequest, TaskStatus, TaskPriority, TaskAssignment, TaskResult

            # Restore Metrics
            metrics = data.get("metrics", {})
            self._total_tasks = metrics.get("total_tasks", 0)
            self._completed_tasks = metrics.get("completed_tasks", 0)
            self._failed_tasks = metrics.get("failed_tasks", 0)
            self._total_volume = metrics.get("total_volume", 0.0)

            # Restore Tasks
            for tid, t_data in data.get("tasks", {}).items():
                t_data["status"] = TaskStatus(t_data["status"])
                t_data["priority"] = TaskPriority(t_data["priority"])
                self._tasks[tid] = TaskRequest(**t_data)

            # Restore Assignments
            for tid, a_list in data.get("assignments", {}).items():
                self._assignments[tid] = []
                for a_data in a_list:
                    # deeply nested objects like result need care
                    res_data = a_data.pop("result", None)
                    result = None
                    if res_data:
                        result = TaskResult(**res_data)

                    assignment = TaskAssignment(result=result, **a_data)
                    self._assignments[tid].append(assignment)

            # Restore Results
            for tid, r_list in data.get("results", {}).items():
                self._results[tid] = [TaskResult(**r) for r in r_list]

            logger.info(f"Loaded {len(self._tasks)} tasks from state")
        except Exception as e:
            logger.error(f"Failed to load task manager state: {e}")
