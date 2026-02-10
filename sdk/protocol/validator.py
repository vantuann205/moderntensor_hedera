"""
ModernTensor Validation Orchestrator

Coordinates the validation flow for task results:
1. Collect results from assigned miners
2. Invoke scoring engine for each result
3. Aggregate scores via consensus
4. Record validated scores on HCS
5. Determine winner and trigger payment

The orchestrator bridges the protocol layer with the scoring engine.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from .types import (
    ScoreBreakdown,
    TaskAssignment,
    TaskRequest,
    TaskResult,
    ValidatorScore,
)

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of the full validation pipeline for a task."""
    task_id: str
    assignments: List[TaskAssignment]
    validator_scores: List[ValidatorScore]
    consensus_scores: Dict[str, float]  # miner_id → consensus score
    winner_miner_id: Optional[str] = None
    winner_score: float = 0.0
    validation_time: float = 0.0
    is_valid: bool = False
    rejection_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "num_results": len(self.assignments),
            "consensus_scores": {
                k: round(v, 4) for k, v in self.consensus_scores.items()
            },
            "winner_miner_id": self.winner_miner_id,
            "winner_score": round(self.winner_score, 4),
            "validation_time": round(self.validation_time, 2),
            "is_valid": self.is_valid,
            "rejection_reason": self.rejection_reason,
        }


# Type alias for a scoring function
ScoringFunction = Callable[[TaskRequest, TaskResult], ScoreBreakdown]


class ValidationOrchestrator:
    """
    Orchestrates the validation pipeline for task results.

    The validation flow:
    1. Collect all results from assigned miners
    2. Score each result using the scoring function
    3. Apply consensus algorithm to aggregate scores
    4. Determine task winner
    5. Emit validation events (for HCS logging)

    Example:
        orchestrator = ValidationOrchestrator(
            validator_id="0.0.99999",
            scoring_fn=code_review_scorer,
            min_score_threshold=0.3,
        )

        result = orchestrator.validate(
            task=task_request,
            assignments=task_assignments,
        )
        print(f"Winner: {result.winner_miner_id} ({result.winner_score:.2f})")
    """

    def __init__(
        self,
        validator_id: str,
        scoring_fn: Optional[ScoringFunction] = None,
        min_score_threshold: float = 0.2,
        min_results_required: int = 1,
        max_score_variance: float = 0.5,
    ):
        """
        Args:
            validator_id: This validator's Hedera account ID
            scoring_fn: Function to score a task result (pluggable)
            min_score_threshold: Minimum score to be considered valid
            min_results_required: Minimum results needed for validation
            max_score_variance: Maximum allowed variance for consensus
        """
        self.validator_id = validator_id
        self.scoring_fn = scoring_fn or self._default_scoring_fn
        self.min_score_threshold = min_score_threshold
        self.min_results_required = min_results_required
        self.max_score_variance = max_score_variance
        self._validations_count = 0
        self._on_score_recorded: Optional[Callable] = None
        logger.info(
            "ValidationOrchestrator initialized — validator=%s, threshold=%.2f",
            validator_id,
            min_score_threshold,
        )

    def validate(
        self,
        task: TaskRequest,
        assignments: List[TaskAssignment],
    ) -> ValidationResult:
        """
        Run the full validation pipeline.

        Args:
            task: The original task request
            assignments: All assignments (with results) for this task

        Returns:
            ValidationResult with consensus scores and winner
        """
        start_time = time.time()
        self._validations_count += 1

        # Filter assignments that have results
        completed = [a for a in assignments if a.result is not None]

        if len(completed) < self.min_results_required:
            return ValidationResult(
                task_id=task.task_id,
                assignments=assignments,
                validator_scores=[],
                consensus_scores={},
                is_valid=False,
                rejection_reason=(
                    f"Only {len(completed)} results, "
                    f"need at least {self.min_results_required}"
                ),
                validation_time=time.time() - start_time,
            )

        # Score each result
        validator_scores: List[ValidatorScore] = []
        for assignment in completed:
            breakdown = self.scoring_fn(task, assignment.result)
            breakdown.compute_final()

            score = ValidatorScore(
                validator_id=self.validator_id,
                task_id=task.task_id,
                miner_id=assignment.miner_id,
                breakdown=breakdown,
            )
            validator_scores.append(score)

            # Record score on assignment
            assignment.score = breakdown.final_score

            # Emit event
            if self._on_score_recorded:
                self._on_score_recorded(score)

            logger.debug(
                "Scored miner %s: %.4f",
                assignment.miner_id,
                breakdown.final_score,
            )

        # Build consensus scores
        consensus_scores = {
            score.miner_id: score.final_score
            for score in validator_scores
        }

        # Determine winner (highest consensus score above threshold)
        valid_scores = {
            mid: s for mid, s in consensus_scores.items()
            if s >= self.min_score_threshold
        }

        winner_id = None
        winner_score = 0.0
        is_valid = False

        if valid_scores:
            winner_id = max(valid_scores, key=valid_scores.get)
            winner_score = valid_scores[winner_id]
            is_valid = True

        validation_time = time.time() - start_time

        result = ValidationResult(
            task_id=task.task_id,
            assignments=assignments,
            validator_scores=validator_scores,
            consensus_scores=consensus_scores,
            winner_miner_id=winner_id,
            winner_score=winner_score,
            validation_time=validation_time,
            is_valid=is_valid,
            rejection_reason=(
                None if is_valid
                else f"No results above threshold {self.min_score_threshold}"
            ),
        )

        logger.info(
            "Validation complete for task %s: winner=%s (%.4f), time=%.2fs",
            task.task_id[:8],
            winner_id,
            winner_score,
            validation_time,
        )
        return result

    def validate_single(
        self,
        task: TaskRequest,
        result: TaskResult,
    ) -> ValidatorScore:
        """
        Score a single task result (without consensus).

        Useful for independent validation by multiple validators.
        """
        breakdown = self.scoring_fn(task, result)
        breakdown.compute_final()

        return ValidatorScore(
            validator_id=self.validator_id,
            task_id=task.task_id,
            miner_id=result.miner_id,
            breakdown=breakdown,
        )

    def on_score_recorded(self, callback: Callable) -> None:
        """Register a callback for when a score is recorded (for HCS logging)."""
        self._on_score_recorded = callback

    def _default_scoring_fn(
        self,
        task: TaskRequest,
        result: TaskResult,
    ) -> ScoreBreakdown:
        """
        Default scoring function — evaluates based on completeness and timeliness.

        Override with a domain-specific scorer (e.g., code_review_scorer).
        """
        scores: Dict[str, float] = {}
        weights: Dict[str, float] = {}

        # Completeness — does the output have expected fields?
        expected_fields = task.payload.get("expected_fields", [])
        if expected_fields:
            present = sum(
                1 for f in expected_fields if f in result.output
            )
            scores["completeness"] = present / len(expected_fields)
        else:
            # Check output is non-empty
            scores["completeness"] = 1.0 if result.output else 0.0
        weights["completeness"] = 0.4

        # Timeliness — faster is better (relative to timeout)
        if result.execution_time and task.timeout_seconds:
            time_ratio = result.execution_time / task.timeout_seconds
            scores["timeliness"] = max(0.0, 1.0 - time_ratio)
        else:
            scores["timeliness"] = 0.5
        weights["timeliness"] = 0.2

        # Output quality — basic heuristic (output size relative to input)
        input_size = len(str(task.payload))
        output_size = len(str(result.output))
        if input_size > 0:
            ratio = min(output_size / max(input_size, 1), 5.0) / 5.0
            scores["quality"] = ratio
        else:
            scores["quality"] = 0.5
        weights["quality"] = 0.4

        return ScoreBreakdown(
            dimensions=scores,
            weights=weights,
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get validation statistics."""
        return {
            "validator_id": self.validator_id,
            "total_validations": self._validations_count,
            "min_score_threshold": self.min_score_threshold,
        }
