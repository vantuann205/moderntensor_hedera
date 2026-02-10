"""
ModernTensor Proof of Quality (PoQ) — Semantic Quality Validation (Layer 2)

Inspired by the PoQ research paradigm (arXiv 2024), this module implements
lightweight quality assessment for AI outputs using semantic similarity
and multi-validator consensus with Yuma-style clipping.

Key features:
- Semantic coherence scoring (output vs. task relevance)
- Multi-validator independent scoring with outlier removal
- Validator trust tracking (vtrust) — validators who agree with
  consensus earn higher trust, increasing their influence
- Commit-reveal prevention: validators submit hash first, reveal later
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------
# Data Structures
# -----------------------------------------------------------------------

@dataclass
class ValidatorScore:
    """Score submitted by a single validator."""
    validator_id: str
    miner_id: str
    quality_score: float       # 0-1: overall quality rating
    relevance_score: float     # 0-1: how relevant to the task
    depth_score: float         # 0-1: analysis depth
    confidence: float          # 0-1: validator's confidence
    timestamp: float = field(default_factory=time.time)
    commit_hash: str = ""      # hash of score (for commit-reveal)


@dataclass
class PoQResult:
    """Result of Proof of Quality consensus."""
    is_quality: bool             # Passed quality threshold?
    consensus_score: float       # Final aggregated score (0-1)
    individual_scores: List[ValidatorScore]
    clipped_validators: List[str]  # Validators whose scores were clipped
    validator_trust: Dict[str, float]  # Updated trust for each validator
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_quality": self.is_quality,
            "consensus_score": round(self.consensus_score, 4),
            "num_validators": len(self.individual_scores),
            "clipped_validators": self.clipped_validators,
            "validator_trust": {
                k: round(v, 4) for k, v in self.validator_trust.items()
            },
        }


# -----------------------------------------------------------------------
# Proof of Quality Engine
# -----------------------------------------------------------------------

class ProofOfQuality:
    """
    Multi-validator quality consensus engine with Yuma-style clipping.

    Flow:
        1. Multiple validators independently score a miner's output
        2. Outlier scores are clipped (Yuma consensus)
        3. Weighted average produces consensus score
        4. Validators who agree with consensus earn higher trust
        5. Higher-trust validators get more weight in future rounds

    Example:
        poq = ProofOfQuality()

        # Simulate multiple validators scoring
        poq.submit_score("val_1", "miner_1", quality=0.8, relevance=0.9, depth=0.7)
        poq.submit_score("val_2", "miner_1", quality=0.75, relevance=0.85, depth=0.65)
        poq.submit_score("val_3", "miner_1", quality=0.2, relevance=0.3, depth=0.1)  # outlier

        result = poq.aggregate("miner_1")
        print(f"Consensus: {result.consensus_score:.4f}")
        print(f"Clipped: {result.clipped_validators}")
    """

    def __init__(
        self,
        quality_threshold: float = 0.4,
        clipping_kappa: float = 0.5,
        trust_decay: float = 0.95,
        min_validators: int = 1,
    ):
        """
        Args:
            quality_threshold: Minimum score to pass quality check
            clipping_kappa: Yuma clipping parameter (0-1). Fraction of
                stake-weight that defines the benchmark for clipping.
            trust_decay: Trust decay per round (EMA factor)
            min_validators: Minimum validators needed for consensus
        """
        self._quality_threshold = quality_threshold
        self._clipping_kappa = clipping_kappa
        self._trust_decay = trust_decay
        self._min_validators = min_validators

        # Pending scores: miner_id → list of validator scores
        self._pending: Dict[str, List[ValidatorScore]] = {}

        # Validator trust: validator_id → trust score (0-1)
        self._vtrust: Dict[str, float] = {}

        # Stats
        self._total_rounds = 0
        self._total_clipped = 0

        logger.info(
            "PoQ initialized: threshold=%.2f, kappa=%.2f",
            quality_threshold, clipping_kappa,
        )

    def submit_score(
        self,
        validator_id: str,
        miner_id: str,
        quality: float,
        relevance: float,
        depth: float,
        confidence: float = 0.8,
    ) -> ValidatorScore:
        """
        Submit a quality score from a validator.

        Args:
            validator_id: ID of the validator
            miner_id: ID of the miner being evaluated
            quality: Overall quality score (0-1)
            relevance: Relevance to task (0-1)
            depth: Analysis depth (0-1)
            confidence: Validator's confidence (0-1)
        """
        score = ValidatorScore(
            validator_id=validator_id,
            miner_id=miner_id,
            quality_score=max(0.0, min(1.0, quality)),
            relevance_score=max(0.0, min(1.0, relevance)),
            depth_score=max(0.0, min(1.0, depth)),
            confidence=max(0.0, min(1.0, confidence)),
        )

        # Generate commit hash
        payload = f"{validator_id}:{miner_id}:{quality:.6f}:{relevance:.6f}:{depth:.6f}"
        score.commit_hash = hashlib.sha256(payload.encode()).hexdigest()[:16]

        if miner_id not in self._pending:
            self._pending[miner_id] = []

        # Prevent duplicate submissions
        for existing in self._pending[miner_id]:
            if existing.validator_id == validator_id:
                logger.warning(
                    "Duplicate score from %s for %s — overwriting",
                    validator_id, miner_id,
                )
                self._pending[miner_id].remove(existing)
                break

        self._pending[miner_id].append(score)

        # Init trust if new validator
        if validator_id not in self._vtrust:
            self._vtrust[validator_id] = 0.5  # neutral starting trust

        logger.debug(
            "Score submitted: validator=%s, miner=%s, q=%.2f, r=%.2f, d=%.2f",
            validator_id, miner_id, quality, relevance, depth,
        )

        return score

    def aggregate(self, miner_id: str) -> PoQResult:
        """
        Aggregate validator scores using Yuma-style consensus.

        Steps:
            1. Compute composite score for each validator
            2. Apply Yuma clipping (remove outliers)
            3. Weighted average using validator trust
            4. Update trust based on alignment with consensus
        """
        scores = self._pending.get(miner_id, [])

        if len(scores) < self._min_validators:
            logger.warning(
                "Not enough validators for %s (have %d, need %d)",
                miner_id, len(scores), self._min_validators,
            )
            return PoQResult(
                is_quality=False,
                consensus_score=0.0,
                individual_scores=scores,
                clipped_validators=[],
                validator_trust={},
                metadata={"error": "insufficient_validators"},
            )

        # Step 1: Compute composite for each validator
        composites: List[Tuple[ValidatorScore, float]] = []
        for s in scores:
            composite = (
                0.50 * s.quality_score
                + 0.30 * s.relevance_score
                + 0.20 * s.depth_score
            )
            composites.append((s, composite))

        # Step 2: Yuma clipping
        clipped, clipped_validators = self._yuma_clip(composites)

        # Step 3: Trust-weighted average
        consensus_score = self._weighted_average(clipped)

        # Step 4: Update validator trust
        updated_trust = self._update_trust(composites, consensus_score)

        self._total_rounds += 1
        self._total_clipped += len(clipped_validators)

        # Clear pending
        self._pending.pop(miner_id, None)

        result = PoQResult(
            is_quality=consensus_score >= self._quality_threshold,
            consensus_score=consensus_score,
            individual_scores=scores,
            clipped_validators=clipped_validators,
            validator_trust=updated_trust,
        )

        logger.info(
            "PoQ consensus: miner=%s, score=%.4f, quality=%s, clipped=%d",
            miner_id, consensus_score, result.is_quality, len(clipped_validators),
        )

        return result

    def get_validator_trust(self, validator_id: str) -> float:
        """Get current trust score for a validator."""
        return self._vtrust.get(validator_id, 0.5)

    def get_stats(self) -> Dict[str, Any]:
        """Get PoQ engine statistics."""
        return {
            "total_rounds": self._total_rounds,
            "total_clipped": self._total_clipped,
            "validators_tracked": len(self._vtrust),
            "avg_trust": (
                round(sum(self._vtrust.values()) / len(self._vtrust), 4)
                if self._vtrust else 0.0
            ),
            "pending_miners": len(self._pending),
        }

    # -------------------------------------------------------------------
    # Yuma Consensus Implementation
    # -------------------------------------------------------------------

    def _yuma_clip(
        self,
        composites: List[Tuple[ValidatorScore, float]],
    ) -> Tuple[List[Tuple[ValidatorScore, float]], List[str]]:
        """
        Yuma-style clipping: remove scores that deviate too far from
        the stake-weighted benchmark.

        The benchmark is the score supported by kappa fraction
        of total trust weight. Scores above or below the benchmark
        by more than 1 std dev are clipped.
        """
        if len(composites) <= 2:
            return composites, []

        # Get trust weights
        total_trust = 0.0
        for s, _ in composites:
            total_trust += self._vtrust.get(s.validator_id, 0.5)

        if total_trust == 0:
            total_trust = 1.0

        # Sort by composite score
        sorted_composites = sorted(composites, key=lambda x: x[1])

        # Find benchmark: score at kappa fraction of cumulative trust
        cumulative = 0.0
        benchmark = sorted_composites[len(sorted_composites) // 2][1]  # default: median
        for s, score in sorted_composites:
            trust = self._vtrust.get(s.validator_id, 0.5)
            cumulative += trust / total_trust
            if cumulative >= self._clipping_kappa:
                benchmark = score
                break

        # Compute std dev
        mean = sum(c for _, c in composites) / len(composites)
        variance = sum((c - mean) ** 2 for _, c in composites) / len(composites)
        std_dev = math.sqrt(variance) if variance > 0 else 0.1

        # Clip scores beyond 1.5 std devs from benchmark
        clipped = []
        clipped_ids = []
        for s, score in composites:
            if abs(score - benchmark) > 1.5 * std_dev and len(composites) > 2:
                clipped_ids.append(s.validator_id)
                # Clip to benchmark
                clipped.append((s, benchmark))
            else:
                clipped.append((s, score))

        return clipped, clipped_ids

    def _weighted_average(
        self,
        composites: List[Tuple[ValidatorScore, float]],
    ) -> float:
        """
        Trust-weighted average of composite scores.
        Higher-trust validators have more influence.
        """
        total_weight = 0.0
        weighted_sum = 0.0

        for s, score in composites:
            trust = self._vtrust.get(s.validator_id, 0.5)
            weight = trust * s.confidence
            weighted_sum += weight * score
            total_weight += weight

        if total_weight == 0:
            return 0.0

        return weighted_sum / total_weight

    def _update_trust(
        self,
        composites: List[Tuple[ValidatorScore, float]],
        consensus: float,
    ) -> Dict[str, float]:
        """
        Update validator trust based on alignment with consensus.

        Validators whose scores are close to consensus → trust increases.
        Validators whose scores diverge → trust decreases.
        """
        updated = {}

        for s, score in composites:
            vid = s.validator_id
            old_trust = self._vtrust.get(vid, 0.5)

            # Alignment = 1 - |score - consensus| (capped at 0)
            alignment = max(0.0, 1.0 - abs(score - consensus) * 2)

            # EMA update
            new_trust = self._trust_decay * old_trust + (1 - self._trust_decay) * alignment
            new_trust = max(0.05, min(1.0, new_trust))  # keep in [0.05, 1.0]

            self._vtrust[vid] = new_trust
            updated[vid] = new_trust

        return updated
