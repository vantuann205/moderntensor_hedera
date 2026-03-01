"""
ModernTensor Score Consensus

Aggregates scores from multiple validators into a single consensus score.
Uses weighted median algorithm — resistant to outlier and collusion attacks.

Algorithm:
1. Collect scores from multiple validators
2. Weight each validator by their reliability/stake
3. Compute weighted median (not mean — more robust)
4. Calculate agreement level and detect outliers
5. Produce final consensus score with confidence
"""

from __future__ import annotations

import hashlib
import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class ConsensusResult:
    """Result of score consensus aggregation."""
    consensus_score: float
    confidence: float
    agreement_level: float
    validator_scores: Dict[str, float]
    outliers: List[str]
    method: str = "weighted_median"
    num_validators: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "consensus_score": round(self.consensus_score, 4),
            "confidence": round(self.confidence, 4),
            "agreement_level": round(self.agreement_level, 4),
            "num_validators": self.num_validators,
            "outliers": self.outliers,
            "method": self.method,
            "validator_scores": {
                k: round(v, 4) for k, v in self.validator_scores.items()
            },
        }


class ScoreConsensus:
    """
    Score consensus algorithm using weighted median.

    Why weighted median instead of mean?
    - Mean is vulnerable to a single malicious validator submitting
      extreme scores (0.0 or 1.0) to manipulate the result
    - Median requires >50% of validators to collude to manipulate
    - Weighted median combines this robustness with stake weighting

    Outlier detection uses the Interquartile Range (IQR) method:
    - Q1, Q3 = 25th and 75th percentiles
    - IQR = Q3 - Q1
    - Outlier = score < Q1 - 1.5*IQR or score > Q3 + 1.5*IQR

    Example:
        consensus = ScoreConsensus(min_validators=2)
        result = consensus.aggregate(
            scores={"v1": 0.85, "v2": 0.82, "v3": 0.10},
            weights={"v1": 1.0, "v2": 1.0, "v3": 0.5},
        )
        # consensus_score ≈ 0.83, outliers = ["v3"]
    """

    def __init__(
        self,
        min_validators: int = 1,
        outlier_sensitivity: float = 1.5,
        min_agreement: float = 0.3,
    ):
        """
        Args:
            min_validators: Minimum validators for valid consensus
            outlier_sensitivity: IQR multiplier for outlier detection
            min_agreement: Minimum agreement level to accept consensus
        """
        self.min_validators = min_validators
        self.outlier_sensitivity = outlier_sensitivity
        self.min_agreement = min_agreement
        logger.info(
            "ScoreConsensus initialized — min_validators=%d, outlier_k=%.1f",
            min_validators,
            outlier_sensitivity,
        )

    def aggregate(
        self,
        scores: Dict[str, float],
        weights: Optional[Dict[str, float]] = None,
    ) -> ConsensusResult:
        """
        Aggregate multiple validator scores into consensus.

        Args:
            scores: Mapping of validator_id → score
            weights: Optional mapping of validator_id → weight
                     (defaults to equal weights)

        Returns:
            ConsensusResult with consensus score and metadata
        """
        if len(scores) < self.min_validators:
            return ConsensusResult(
                consensus_score=0.0,
                confidence=0.0,
                agreement_level=0.0,
                validator_scores=scores,
                outliers=[],
                num_validators=len(scores),
            )

        # Default: equal weights
        if weights is None:
            weights = {vid: 1.0 for vid in scores}

        # Detect outliers using (validator_id, score) pairs for correct matching
        validator_items = list(scores.items())
        score_values = [s for _, s in validator_items]
        outlier_indices = self._detect_outlier_indices(score_values)
        outlier_ids = [validator_items[i][0] for i in outlier_indices]

        # Remove outlier scores for consensus
        clean_scores = {
            vid: s for vid, s in scores.items()
            if vid not in outlier_ids
        }
        clean_weights = {
            vid: weights.get(vid, 1.0) for vid in clean_scores
        }

        # Handle case where all scores are outliers
        if not clean_scores:
            clean_scores = scores
            clean_weights = weights
            outlier_ids = []

        # Compute weighted median
        consensus_score = self._weighted_median(clean_scores, clean_weights)

        # Calculate agreement level
        agreement = self._calculate_agreement(list(clean_scores.values()))

        # Confidence based on: num validators + agreement + no outliers
        confidence = self._calculate_confidence(
            num_validators=len(scores),
            agreement=agreement,
            num_outliers=len(outlier_ids),
        )

        result = ConsensusResult(
            consensus_score=consensus_score,
            confidence=confidence,
            agreement_level=agreement,
            validator_scores=scores,
            outliers=outlier_ids,
            num_validators=len(scores),
        )

        logger.info(
            "Consensus: score=%.4f, confidence=%.2f, agreement=%.2f, "
            "validators=%d, outliers=%d",
            consensus_score,
            confidence,
            agreement,
            len(scores),
            len(outlier_ids),
        )
        return result

    def _weighted_median(
        self,
        scores: Dict[str, float],
        weights: Dict[str, float],
    ) -> float:
        """
        Compute weighted median.

        Algorithm:
        1. Sort scores
        2. Accumulate weights
        3. Median is where cumulative weight reaches 50%
        """
        items = sorted(
            [(scores[vid], weights.get(vid, 1.0)) for vid in scores],
            key=lambda x: x[0],
        )

        total_weight = sum(w for _, w in items)
        if total_weight == 0:
            return 0.0

        cumulative = 0.0
        half = total_weight / 2.0

        for score, weight in items:
            cumulative += weight
            if cumulative >= half:
                return score

        # Fallback (shouldn't reach here)
        return items[-1][0]

    def _detect_outlier_indices(self, scores: List[float]) -> List[int]:
        """
        Detect outlier scores using IQR method; returns INDICES (not values).

        IQR = Q3 - Q1
        Lower fence = Q1 - k * IQR
        Upper fence = Q3 + k * IQR

        Uses linear interpolation for quartiles (more accurate for small N).
        """
        if len(scores) < 2:
            return []  # Cannot detect outliers with fewer than 2 scores

        # For small N (2-3), use simple deviation-from-median check
        if len(scores) < 4:
            sorted_s = sorted(scores)
            median = sorted_s[len(sorted_s) // 2]
            threshold = 0.3  # 30% deviation from median → outlier
            return [
                i for i, s in enumerate(scores)
                if abs(s - median) > threshold and median > 0
            ]

        sorted_scores = sorted(scores)
        n = len(sorted_scores)

        # Linear interpolation for quartiles (more accurate for small N)
        def _percentile(data: List[float], p: float) -> float:
            k = (len(data) - 1) * p
            f = int(k)
            c = f + 1 if f + 1 < len(data) else f
            d = k - f
            return data[f] + d * (data[c] - data[f])

        q1 = _percentile(sorted_scores, 0.25)
        q3 = _percentile(sorted_scores, 0.75)
        iqr = q3 - q1

        k = self.outlier_sensitivity
        lower_fence = q1 - k * iqr
        upper_fence = q3 + k * iqr

        return [
            i for i, s in enumerate(scores)
            if s < lower_fence or s > upper_fence
        ]

    def _calculate_agreement(self, scores: List[float]) -> float:
        """
        Calculate agreement level among validators.

        Agreement = 1 - (standard deviation / max possible std dev)
        Perfect agreement (all same) → 1.0
        Maximum disagreement → 0.0
        """
        if len(scores) < 2:
            return 1.0

        mean = sum(scores) / len(scores)
        variance = sum((s - mean) ** 2 for s in scores) / len(scores)
        std_dev = math.sqrt(variance)

        # Max std_dev for [0,1] scores is 0.5
        max_std = 0.5
        agreement = max(0.0, 1.0 - (std_dev / max_std))
        return agreement

    def _calculate_confidence(
        self,
        num_validators: int,
        agreement: float,
        num_outliers: int,
    ) -> float:
        """
        Calculate confidence in the consensus result.

        Factors:
        - More validators → higher confidence
        - Higher agreement → higher confidence
        - More outliers → lower confidence
        """
        # Validator count factor (log scale, saturates around 10)
        validator_factor = min(1.0, math.log2(max(num_validators, 1) + 1) / 3.3)

        # Agreement factor
        agreement_factor = agreement

        # Outlier penalty
        outlier_penalty = max(0.0, 1.0 - (num_outliers * 0.2))

        confidence = validator_factor * agreement_factor * outlier_penalty
        return max(0.0, min(1.0, confidence))


# ===========================================================================
# Commit-Reveal Consensus  (Mirrors on-chain commit-reveal scheme)
# ===========================================================================

@dataclass
class ScoreCommit:
    """A single validator's committed score (hashed)."""
    validator_id: str
    commit_hash: str       # SHA-256 of (score || salt)
    committed_at: float = field(default_factory=time.time)
    revealed: bool = False
    revealed_score: Optional[float] = None
    revealed_salt: Optional[str] = None


class CommitRevealConsensus:
    """
    Commit-Reveal wrapper around ScoreConsensus.

    Prevents validators from seeing each other's scores before committing.
    This mirrors the on-chain commitScore() + revealScore() pattern from
    PaymentEscrow.sol / SubnetRegistry.sol.

    Flow:
        1. Each validator calls commit_score(id, score, salt) → stores hash
        2. After all commits, call start_reveal_phase()
        3. Each validator calls reveal_score(id, score, salt) → verifies hash
        4. After all reveals, call finalize() → runs ScoreConsensus.aggregate()

    Usage:
        cr = CommitRevealConsensus(min_validators=3)

        # Phase 1: Commit
        cr.commit_score("v1", 0.85, "random_salt_1")
        cr.commit_score("v2", 0.80, "random_salt_2")
        cr.commit_score("v3", 0.90, "random_salt_3")

        # Phase 2: Reveal
        cr.start_reveal_phase()
        cr.reveal_score("v1", 0.85, "random_salt_1")
        cr.reveal_score("v2", 0.80, "random_salt_2")
        cr.reveal_score("v3", 0.90, "random_salt_3")

        # Phase 3: Finalize
        result = cr.finalize()
        print(result.consensus_score)
    """

    def __init__(
        self,
        min_validators: int = 2,
        commit_timeout: float = 3600.0,   # 1 hour
        reveal_timeout: float = 1800.0,   # 30 minutes
    ):
        self.min_validators = min_validators
        self.commit_timeout = commit_timeout
        self.reveal_timeout = reveal_timeout

        # State
        self._commits: Dict[str, ScoreCommit] = {}
        self._phase: str = "commit"       # commit | reveal | finalized
        self._phase_started_at: float = time.time()
        self._inner_consensus = ScoreConsensus()

        logger.info(
            "CommitRevealConsensus created (min_validators=%d)",
            min_validators,
        )

    # -------------------------------------------------------------------
    # Phase 1: Commit
    # -------------------------------------------------------------------

    @staticmethod
    def compute_hash(score: float, salt: str) -> str:
        """Compute SHA-256 hash for commit. Matches on-chain keccak pattern."""
        payload = f"{score:.6f}:{salt}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def commit_score(self, validator_id: str, score: float, salt: str) -> str:
        """
        Commit a hashed score. The actual score is hidden until reveal.

        Args:
            validator_id: Validator's ID
            score: The actual score (0.0 - 1.0)
            salt: Random string used to prevent brute-force hash reversal

        Returns:
            The commit hash (for verification)

        Raises:
            ValueError: If not in commit phase or validator already committed
        """
        if self._phase != "commit":
            raise ValueError(f"Not in commit phase (current: {self._phase})")
        if validator_id in self._commits:
            raise ValueError(f"Validator {validator_id} already committed")

        commit_hash = self.compute_hash(score, salt)
        self._commits[validator_id] = ScoreCommit(
            validator_id=validator_id,
            commit_hash=commit_hash,
        )

        logger.info(
            "Score committed: validator=%s, hash=%s...%s",
            validator_id, commit_hash[:8], commit_hash[-4:],
        )
        return commit_hash

    @property
    def commit_count(self) -> int:
        return len(self._commits)

    @property
    def is_commit_phase_complete(self) -> bool:
        """True if enough validators have committed."""
        return len(self._commits) >= self.min_validators

    # -------------------------------------------------------------------
    # Phase 2: Reveal
    # -------------------------------------------------------------------

    def start_reveal_phase(self) -> None:
        """Transition from commit to reveal phase."""
        if self._phase != "commit":
            raise ValueError(f"Cannot start reveal: phase is {self._phase}")
        if not self.is_commit_phase_complete:
            raise ValueError(
                f"Not enough commits: {len(self._commits)}/{self.min_validators}"
            )
        self._phase = "reveal"
        self._phase_started_at = time.time()
        logger.info("Reveal phase started (%d commits)", len(self._commits))

    def reveal_score(
        self, validator_id: str, score: float, salt: str
    ) -> bool:
        """
        Reveal a previously committed score.

        Args:
            validator_id: Validator's ID
            score: The actual score (must match committed hash)
            salt: The salt used during commit

        Returns:
            True if reveal was valid

        Raises:
            ValueError: If hash mismatch, not in reveal phase, etc.
        """
        if self._phase != "reveal":
            raise ValueError(f"Not in reveal phase (current: {self._phase})")

        commit = self._commits.get(validator_id)
        if commit is None:
            raise ValueError(f"Validator {validator_id} did not commit")
        if commit.revealed:
            raise ValueError(f"Validator {validator_id} already revealed")

        # Verify hash
        expected_hash = self.compute_hash(score, salt)
        if expected_hash != commit.commit_hash:
            raise ValueError(
                f"Hash mismatch for validator {validator_id}: "
                f"expected {commit.commit_hash[:12]}..., "
                f"got {expected_hash[:12]}..."
            )

        commit.revealed = True
        commit.revealed_score = score
        commit.revealed_salt = salt

        logger.info(
            "Score revealed: validator=%s, score=%.4f",
            validator_id, score,
        )
        return True

    @property
    def reveal_count(self) -> int:
        return sum(1 for c in self._commits.values() if c.revealed)

    @property
    def is_reveal_phase_complete(self) -> bool:
        """True if all committers have revealed."""
        return all(c.revealed for c in self._commits.values())

    # -------------------------------------------------------------------
    # Phase 3: Finalize
    # -------------------------------------------------------------------

    def finalize(self) -> ConsensusResult:
        """
        Finalize: aggregate all revealed scores via ScoreConsensus.

        Returns:
            ConsensusResult from the underlying ScoreConsensus

        Raises:
            ValueError: If not all validators have revealed
        """
        if self._phase == "finalized":
            raise ValueError("Already finalized")

        revealed_scores: Dict[str, float] = {}
        for vid, commit in self._commits.items():
            if not commit.revealed or commit.revealed_score is None:
                raise ValueError(f"Validator {vid} has not revealed")
            revealed_scores[vid] = commit.revealed_score

        if len(revealed_scores) < self.min_validators:
            raise ValueError(
                f"Insufficient reveals: {len(revealed_scores)}/{self.min_validators}"
            )

        result = self._inner_consensus.aggregate(revealed_scores)
        self._phase = "finalized"

        logger.info(
            "Commit-Reveal finalized: consensus=%.4f, validators=%d, outliers=%s",
            result.consensus_score, result.num_validators, result.outliers,
        )
        return result

    @property
    def phase(self) -> str:
        return self._phase

    def get_status(self) -> Dict[str, Any]:
        """Get current commit-reveal status."""
        return {
            "phase": self._phase,
            "commits": self.commit_count,
            "reveals": self.reveal_count,
            "min_validators": self.min_validators,
            "is_commit_complete": self.is_commit_phase_complete,
            "is_reveal_complete": self.is_reveal_phase_complete,
            "validators": list(self._commits.keys()),
        }
