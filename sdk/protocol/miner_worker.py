"""
ModernTensor Miner Worker

Automated worker loop for miners. After registration, a miner runs this
worker to:
    1. Poll for assigned tasks
    2. Execute the handler (AI model) on each task
    3. Submit results back to the protocol

This completes the miner participation lifecycle.

For ModernTensor on Hedera — Hello Future Hackathon 2026
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..marketplace.orchestrator import MarketplaceProtocol
    from ..protocol.types import TaskAssignment, TaskResult

logger = logging.getLogger(__name__)

# Type alias: handler receives (task_payload, task_type) and returns output dict
TaskHandler = Callable[[Dict[str, Any], str], Dict[str, Any]]


class MinerWorker:
    """
    Automated worker for a registered miner.

    Polls the protocol for assigned tasks, runs the handler function,
    and submits results. This is the "miner runs" part of the lifecycle.

    Example:
        from sdk.marketplace import MarketplaceProtocol
        from sdk.protocol.miner_worker import MinerWorker

        protocol = MarketplaceProtocol(...)
        protocol.register_miner("0.0.1001", subnet_ids=[1], stake=500)

        def my_ai_handler(payload, task_type):
            # Your AI model logic here
            return {"analysis": "...", "score": 0.85}

        worker = MinerWorker(
            protocol=protocol,
            miner_id="0.0.1001",
            handler=my_ai_handler,
        )

        # Process all pending assignments once
        processed = worker.run_once()

        # Or run continuously
        worker.start(poll_interval=5.0)
    """

    def __init__(
        self,
        protocol: "MarketplaceProtocol",
        miner_id: str,
        handler: TaskHandler,
        auto_validate: bool = True,
    ):
        """
        Args:
            protocol: MarketplaceProtocol instance
            miner_id: This miner's registered ID
            handler: Function that processes task payloads → output Dict
            auto_validate: If True, trigger validate_and_pay after submitting
                          (only in single-miner mode or when all results are in)
        """
        self.protocol = protocol
        self.miner_id = miner_id
        self.handler = handler
        self.auto_validate = auto_validate

        self._running = False
        self._processed_count = 0
        self._error_count = 0
        self._total_earnings = 0.0

        # Verify miner is registered
        miner = protocol.get_miner(miner_id)
        if miner is None:
            raise ValueError(
                f"Miner {miner_id} is not registered. "
                f"Call protocol.register_miner() first."
            )

        logger.info(
            "MinerWorker initialized — miner=%s, subnets=%s",
            miner_id, miner.subnet_ids,
        )

    def poll_assignments(self) -> List["TaskAssignment"]:
        """
        Poll for tasks assigned to this miner that still need results.

        Returns:
            List of incomplete TaskAssignment objects for this miner
        """
        return self.protocol.task_manager.get_assignments_for_miner(
            self.miner_id
        )

    def process_assignment(self, assignment: "TaskAssignment") -> Optional["TaskResult"]:
        """
        Process a single task assignment:
        1. Get task payload
        2. Run handler function
        3. Submit result to protocol
        4. Optionally trigger validation

        Args:
            assignment: TaskAssignment to process

        Returns:
            TaskResult on success, None on failure
        """
        task = self.protocol.task_manager.get_task(assignment.task_id)
        if task is None:
            logger.warning(
                "Task %s not found, skipping", assignment.task_id[:8]
            )
            return None

        # Check deadline
        if assignment.is_expired:
            logger.warning(
                "Assignment %s expired, skipping", assignment.task_id[:8]
            )
            return None

        logger.info(
            "Processing task %s (type=%s) for miner %s",
            task.task_id[:8], task.task_type, self.miner_id,
        )

        start_time = time.time()
        try:
            # Run the AI handler
            output = self.handler(task.payload, task.task_type)
        except Exception as e:
            logger.error(
                "Handler failed for task %s: %s",
                task.task_id[:8], e,
            )
            self._error_count += 1
            return None

        execution_time = time.time() - start_time

        # Submit result
        try:
            result = self.protocol.submit_result(
                task_id=assignment.task_id,
                miner_id=self.miner_id,
                output=output,
                execution_time=execution_time,
            )
        except (ValueError, TimeoutError) as e:
            logger.error(
                "Failed to submit result for task %s: %s",
                task.task_id[:8], e,
            )
            self._error_count += 1
            return None

        self._processed_count += 1
        logger.info(
            "Result submitted for task %s (%.1fs)",
            task.task_id[:8], execution_time,
        )

        # Auto-validate if enabled and all assignments are complete
        if self.auto_validate:
            self._try_auto_validate(assignment.task_id)

        return result

    def _try_auto_validate(self, task_id: str) -> None:
        """Try to trigger validation if all assignments are complete."""
        assignments = self.protocol.task_manager.get_assignments(task_id)
        all_complete = all(
            a.is_completed or a.is_timeout for a in assignments
        )
        if all_complete:
            try:
                validation = self.protocol.validate_and_pay(task_id)
                if (
                    validation.is_valid
                    and validation.winner_miner_id == self.miner_id
                ):
                    payment = self.protocol.task_manager.get_payment(task_id)
                    if payment:
                        self._total_earnings += payment.amount
                    logger.info(
                        "🏆 Won task %s! Score: %.4f",
                        task_id[:8], validation.winner_score,
                    )
            except Exception as e:
                logger.debug("Auto-validate skipped: %s", e)

    def run_once(self) -> int:
        """
        Poll and process all pending assignments once.

        Returns:
            Number of tasks processed
        """
        assignments = self.poll_assignments()
        if not assignments:
            return 0

        count = 0
        for assignment in assignments:
            result = self.process_assignment(assignment)
            if result is not None:
                count += 1

        return count

    def start(self, poll_interval: float = 5.0, max_iterations: int = 0):
        """
        Start the worker loop. Polls for tasks and processes them.

        Args:
            poll_interval: Seconds between polls
            max_iterations: Max iterations (0 = unlimited)
        """
        self._running = True
        iteration = 0

        logger.info(
            "MinerWorker started — miner=%s, poll_interval=%.1fs",
            self.miner_id, poll_interval,
        )

        try:
            while self._running:
                processed = self.run_once()
                if processed > 0:
                    logger.info(
                        "Processed %d tasks (total: %d, errors: %d)",
                        processed, self._processed_count, self._error_count,
                    )

                iteration += 1
                if max_iterations > 0 and iteration >= max_iterations:
                    logger.info("Reached max iterations (%d)", max_iterations)
                    break

                time.sleep(poll_interval)
        except KeyboardInterrupt:
            logger.info("MinerWorker stopped by user")
        finally:
            self._running = False

    def stop(self):
        """Signal the worker to stop after current iteration."""
        self._running = False
        logger.info("MinerWorker stopping — miner=%s", self.miner_id)

    def get_stats(self) -> Dict[str, Any]:
        """Get worker statistics."""
        miner = self.protocol.get_miner(self.miner_id)
        return {
            "miner_id": self.miner_id,
            "is_running": self._running,
            "tasks_processed": self._processed_count,
            "errors": self._error_count,
            "total_earnings": round(self._total_earnings, 4),
            "reputation": miner.reputation.score if miner else 0.0,
            "status": miner.status.value if miner else "unknown",
        }
