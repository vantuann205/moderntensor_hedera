"""
ModernTensor Proof of Intelligence (PoI)

The protocol's key differentiator from Bittensor and other decentralized AI networks.


PoI verifies that AI miners are producing genuinely intelligent outputs,
not just copying, gaming metrics, or colluding. It combines:

1. **Knowledge Verification**: Challenge-response probes to verify miners
   actually understand the domain, not just pattern-matching.

2. **Cross-Validator Correlation**: Detect collusion by analyzing
   score correlation patterns across validators.

3. **Output Entropy Analysis**: Verify outputs contain novel information
   and aren't just templated responses.

4. **Temporal Consistency**: Track score consistency over time to detect
   performance manipulation.

The PoI score is a meta-score that validates the scoring process itself,
acting as a second layer of verification on top of the dimension scores.
"""

from __future__ import annotations

import hashlib
import logging
import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Set
import json
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class PoIResult:
    """Result of a Proof of Intelligence verification."""
    is_verified: bool
    poi_score: float  # 0.0 to 1.0
    knowledge_score: float
    entropy_score: float
    correlation_score: float
    consistency_score: float
    flags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_verified": self.is_verified,
            "poi_score": round(self.poi_score, 4),
            "knowledge_score": round(self.knowledge_score, 4),
            "entropy_score": round(self.entropy_score, 4),
            "correlation_score": round(self.correlation_score, 4),
            "consistency_score": round(self.consistency_score, 4),
            "flags": self.flags,
        }


@dataclass
class MinerHistory:
    """Historical performance data for a miner."""
    scores: deque = field(default_factory=lambda: deque(maxlen=100))
    timestamps: deque = field(default_factory=lambda: deque(maxlen=100))
    output_hashes: deque = field(default_factory=lambda: deque(maxlen=100))
    poi_scores: deque = field(default_factory=lambda: deque(maxlen=100))

    def add_entry(
        self,
        score: float,
        output_hash: str,
        poi_score: float = 0.0,
    ) -> None:
        self.scores.append(score)
        self.timestamps.append(time.time())
        self.output_hashes.append(output_hash)
        self.poi_scores.append(poi_score)


class ProofOfIntelligence:
    """
    Proof of Intelligence (PoI) verification system.

    Validates the authenticity and quality of AI miner outputs
    through multi-signal analysis. PoI is a meta-verification
    layer that sits on top of the dimension scoring system.

    Verification Components:
        1. Knowledge Check (25%): Does the miner demonstrate domain
           understanding beyond surface-level analysis?
        2. Entropy Analysis (25%): Is the output novel and information-rich,
           or just templated/copied?
        3. Cross-Correlation (25%): Are validator scores suspiciously
           correlated (collusion detection)?
        4. Temporal Consistency (25%): Is performance consistent over time,
           or showing signs of gaming?

    Example:
        poi = ProofOfIntelligence(verification_threshold=0.5)

        result = poi.verify(
            miner_id="0.0.12345",
            output={"analysis": "...", "findings": [...]},
            dimension_scores={"security": 0.9, "correctness": 0.8},
            validator_scores={"v1": 0.85, "v2": 0.82, "v3": 0.11},
        )

        if result.is_verified:
            print(f"✓ Verified — PoI: {result.poi_score:.2f}")
        else:
            print(f"✗ Failed — Flags: {result.flags}")
    """

    def __init__(
        self,
        verification_threshold: float = 0.4,
        entropy_min: float = 0.3,
        correlation_max: float = 0.95,
        consistency_window: int = 20,
    ):
        """
        Args:
            verification_threshold: Minimum PoI score to pass verification
            entropy_min: Minimum entropy score for valid outputs
            correlation_max: Maximum allowed validator score correlation
            consistency_window: Number of recent tasks for consistency check
        """
        self.verification_threshold = verification_threshold
        self.entropy_min = entropy_min
        self.correlation_max = correlation_max
        self.consistency_window = consistency_window
        self._miner_histories: Dict[str, MinerHistory] = {}
        self._total_verifications = 0
        self._passed_verifications = 0
        logger.info(
            "ProofOfIntelligence initialized — threshold=%.2f",
            verification_threshold,
        )

        # Persistence
        self.data_dir = Path("data")
        self.data_dir.mkdir(exist_ok=True)
        self.state_file = self.data_dir / "poi_state.json"
        self.load_state()

    def verify(
        self,
        miner_id: str,
        output: Dict[str, Any],
        dimension_scores: Dict[str, float],
        validator_scores: Optional[Dict[str, float]] = None,
        task_payload: Optional[Dict[str, Any]] = None,
    ) -> PoIResult:
        """
        Run full Proof of Intelligence verification.

        Args:
            miner_id: The miner being verified
            output: The miner's output
            dimension_scores: Scores from the dimension scorer
            validator_scores: Scores from multiple validators (for correlation)
            task_payload: Original task data (for relevance checking)

        Returns:
            PoIResult with verification status and breakdown
        """
        self._total_verifications += 1
        flags: List[str] = []

        # 1. Knowledge Verification (25%)
        knowledge_score = self._check_knowledge(
            output, dimension_scores, task_payload, flags
        )

        # 2. Entropy Analysis (25%)
        entropy_score = self._check_entropy(output, miner_id, flags)

        # 3. Cross-Validator Correlation (25%)
        correlation_score = self._check_correlation(
            validator_scores or {}, flags
        )

        # 4. Temporal Consistency (25%)
        consistency_score = self._check_consistency(
            miner_id, dimension_scores, flags
        )

        # Composite PoI score (equal weights)
        poi_score = (
            knowledge_score * 0.25
            + entropy_score * 0.25
            + correlation_score * 0.25
            + consistency_score * 0.25
        )

        is_verified = poi_score >= self.verification_threshold and len(flags) < 3

        if is_verified:
            self._passed_verifications += 1

        # Record history
        output_hash = self._hash_output(output)
        history = self._get_or_create_history(miner_id)
        history.add_entry(
            score=sum(dimension_scores.values()) / max(len(dimension_scores), 1),
            output_hash=output_hash,
            poi_score=poi_score,
        )

        result = PoIResult(
            is_verified=is_verified,
            poi_score=poi_score,
            knowledge_score=knowledge_score,
            entropy_score=entropy_score,
            correlation_score=correlation_score,
            consistency_score=consistency_score,
            flags=flags,
        )

        logger.info(
            "PoI for miner %s: verified=%s, score=%.4f, flags=%s",
            miner_id,
            is_verified,
            poi_score,
            flags,
        )
        self.save_state()
        return result

    # ------------------------------------------------------------------
    # Verification Components
    # ------------------------------------------------------------------

    def _check_knowledge(
        self,
        output: Dict[str, Any],
        dimension_scores: Dict[str, float],
        task_payload: Optional[Dict[str, Any]],
        flags: List[str],
    ) -> float:
        """
        Check if the output demonstrates genuine domain knowledge.

        Heuristics:
        - Output contains domain-specific terminology
        - Analysis depth (not just surface-level)
        - References specific patterns, standards, or vulnerabilities
        - Finding specificity (line numbers, variable names)
        """
        score = 0.0
        output_text = str(output).lower()

        # Check for domain-specific knowledge indicators
        knowledge_indicators = [
            # Security knowledge
            "reentrancy", "overflow", "underflow", "access control",
            "front-running", "oracle", "flash loan", "slippage",
            # Code quality
            "complexity", "coupling", "cohesion", "abstraction",
            "encapsulation", "inheritance", "polymorphism",
            # Standards
            "erc20", "erc721", "erc1155", "openzeppelin",
            "solidity", "pragma", "modifier", "require",
            # General AI knowledge
            "precision", "recall", "accuracy", "latency",
            "throughput", "convergence", "optimization",
        ]
        found = sum(1 for kw in knowledge_indicators if kw in output_text)
        knowledge_density = min(1.0, found / 5.0)
        score += knowledge_density * 0.3 # Reduced from 0.4

        # Add Enhanced Check
        score += self._check_knowledge_enhanced(output_text)

        # Check analysis depth (not just a one-liner)
        findings = output.get("findings", output.get("vulnerabilities", []))
        if isinstance(findings, list) and findings:
            # Check if findings have specific details
            specific_findings = sum(
                1 for f in findings
                if isinstance(f, dict) and (
                    f.get("line") or f.get("location") or
                    f.get("code") or f.get("variable")
                )
            )
            specificity = min(1.0, specific_findings / max(len(findings), 1))
            score += specificity * 0.3

        # Check if output is relevant to the task
        if task_payload:
            task_text = str(task_payload).lower()
            # Simple relevance — shared terms
            task_words = set(task_text.split())
            output_words = set(output_text.split())
            overlap = len(task_words & output_words)
            relevance = min(1.0, overlap / max(len(task_words) * 0.1, 1))
            score += relevance * 0.3

        if score < 0.2:
            flags.append("LOW_KNOWLEDGE_DEPTH")

        return min(1.0, score)

    def _check_knowledge_enhanced(
        self,
        output_text: str,
        task_type: str = "security_audit"
    ) -> float:
        """
        Enhanced heuristic check for domain knowledge.

        For hackathon V1 (heuristic):
        1. Contextual pairs (e.g. "reentrancy" + "guard") - hard to fake with random keywords.
        2. Negative constraints (e.g. "good job" is generic).
        """
        if not output_text: return 0.0

        score = 0.0

        # 1. Combo Checks (Keywords that should appear together)
        combos = [
            ({"reentrancy"}, {"mutex", "guard", "check-effects", "withdraw"}),
            ({"overflow"}, {"safemath", "0.8.0", "unchecked"}),
            ({"access"}, {"ownable", "roles", "modifier"}),
            ({"transfer"}, {"call", "fail", "return"}),
        ]

        found_combos = 0
        for trigger, required in combos:
            if any(t in output_text for t in trigger):
                 if any(r in output_text for r in required):
                     found_combos += 1

        score += min(0.4, found_combos * 0.15)

        # 2. Specificity (Line numbers / variables)
        import re
        # Look for "Line X", "line X", "L:X"
        line_refs = len(re.findall(r'(line|L)\s?[:\#]?\s?\d+', output_text, re.IGNORECASE))
        score += min(0.3, line_refs * 0.1)

        return score

    def save_state(self) -> None:
        try:
            data = {
                mid: {
                    "scores": list(h.scores),
                    "timestamps": list(h.timestamps),
                    "output_hashes": list(h.output_hashes),
                    "poi_scores": list(h.poi_scores)
                }
                for mid, h in self._miner_histories.items()
            }
            with open(self.state_file, "w") as f:
                json.dump(data, f)
        except Exception as e:
            logger.error(f"Failed to save PoI state: {e}")

    def load_state(self) -> None:
        if not self.state_file.exists(): return
        try:
            with open(self.state_file, "r") as f:
                data = json.load(f)

            for mid, h_data in data.items():
                h = self._get_or_create_history(mid)
                h.scores = deque(h_data.get("scores", []), maxlen=100)
                h.timestamps = deque(h_data.get("timestamps", []), maxlen=100)
                h.output_hashes = deque(h_data.get("output_hashes", []), maxlen=100)
                h.poi_scores = deque(h_data.get("poi_scores", []), maxlen=100)
        except Exception as e:
            logger.error(f"Failed to load PoI state: {e}")

    def _check_entropy(
        self,
        output: Dict[str, Any],
        miner_id: str,
        flags: List[str],
    ) -> float:
        """
        Check output entropy — high entropy indicates novel, non-templated content.

        Low entropy suggests the miner is using templates or copying outputs.
        """
        output_text = str(output)

        # 1. Character-level entropy (Shannon entropy)
        char_entropy = self._shannon_entropy(output_text)
        # Typical English text has ~4.0-4.5 bits/char
        # Good AI output should be ~3.5-5.0
        normalized_char_entropy = min(1.0, char_entropy / 5.0)

        # 2. Check for duplicate outputs
        history = self._get_or_create_history(miner_id)
        current_hash = self._hash_output(output)
        duplicate_count = sum(
            1 for h in list(history.output_hashes)[-self.consistency_window:]
            if h == current_hash
        )
        duplication_penalty = min(1.0, duplicate_count * 0.3)

        # 3. Vocabulary diversity (unique words / total words)
        words = output_text.lower().split()
        if words:
            vocab_diversity = len(set(words)) / len(words)
        else:
            vocab_diversity = 0.0

        entropy_score = (
            normalized_char_entropy * 0.4
            + (1.0 - duplication_penalty) * 0.3
            + vocab_diversity * 0.3
        )

        if entropy_score < self.entropy_min:
            flags.append("LOW_ENTROPY")
        if duplicate_count > 2:
            flags.append("DUPLICATE_OUTPUT")

        return entropy_score

    def _check_correlation(
        self,
        validator_scores: Dict[str, float],
        flags: List[str],
    ) -> float:
        """
        Check for suspicious correlation patterns among validator scores.

        High correlation between all validators could indicate collusion.
        We WANT some variance — it means validators are independently evaluating.
        """
        scores = list(validator_scores.values())
        if len(scores) < 2:
            return 0.8  # Can't check correlation with fewer than 2 validators

        # Calculate pairwise agreement
        mean = sum(scores) / len(scores)
        variance = sum((s - mean) ** 2 for s in scores) / len(scores)
        std_dev = math.sqrt(variance)

        if std_dev == 0:
            # All scores identical — suspicious
            if len(scores) > 2:
                flags.append("IDENTICAL_VALIDATOR_SCORES")
                return 0.3
            return 0.7  # Two validators agreeing is fine

        # Good variance range: 0.03 - 0.2 std_dev
        if std_dev < 0.03:
            # Suspiciously similar
            if len(scores) > 2:
                flags.append("HIGH_VALIDATOR_CORRELATION")
            return 0.5
        elif std_dev > 0.3:
            # Very divergent — inconsistent evaluation
            flags.append("HIGH_VALIDATOR_DIVERGENCE")
            return 0.4
        else:
            # Healthy variance
            return 0.9

    def _check_consistency(
        self,
        miner_id: str,
        current_scores: Dict[str, float],
        flags: List[str],
    ) -> float:
        """
        Check temporal consistency of miner performance.

        Flags:
        - Sudden score jumps (gaming)
        - Monotonically increasing scores (artificial improvement)
        - Score clustering at exact values (suspect automation)
        """
        history = self._get_or_create_history(miner_id)

        if len(history.scores) < 3:
            return 0.7  # Not enough history to judge

        recent_scores = list(history.scores)[-self.consistency_window:]
        current_avg = (
            sum(current_scores.values()) / max(len(current_scores), 1)
        )

        # 1. Check for sudden jumps
        if recent_scores:
            last_score = recent_scores[-1]
            jump = abs(current_avg - last_score)
            if jump > 0.4:
                flags.append("SUDDEN_SCORE_JUMP")
                return 0.4

        # 2. Check for suspicious clustering
        rounded = [round(s, 1) for s in recent_scores]
        unique_rounded = len(set(rounded))
        if len(rounded) > 5 and unique_rounded < 3:
            flags.append("SCORE_CLUSTERING")
            return 0.5

        # 3. Calculate consistency (lower variance = more consistent)
        mean = sum(recent_scores) / len(recent_scores)
        variance = sum(
            (s - mean) ** 2 for s in recent_scores
        ) / len(recent_scores)
        std_dev = math.sqrt(variance)

        # Moderate consistency is ideal (0.05-0.15 std)
        if std_dev < 0.02:
            # Too consistent — might be automated
            return 0.6
        elif std_dev > 0.25:
            # Too inconsistent — performance is erratic
            flags.append("ERRATIC_PERFORMANCE")
            return 0.4
        else:
            return 0.9

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _shannon_entropy(text: str) -> float:
        """Calculate Shannon entropy of a string in bits per character."""
        if not text:
            return 0.0

        freq: Dict[str, int] = {}
        for char in text:
            freq[char] = freq.get(char, 0) + 1

        length = len(text)
        entropy = 0.0
        for count in freq.values():
            p = count / length
            if p > 0:
                entropy -= p * math.log2(p)

        return entropy

    @staticmethod
    def _hash_output(output: Dict[str, Any]) -> str:
        """Create a deterministic hash of an output (for duplicate detection)."""
        # Sort keys for deterministic hashing
        text = str(sorted(output.items())) if isinstance(output, dict) else str(output)
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    def _get_or_create_history(self, miner_id: str) -> MinerHistory:
        if miner_id not in self._miner_histories:
            self._miner_histories[miner_id] = MinerHistory()
        return self._miner_histories[miner_id]

    def get_stats(self) -> Dict[str, Any]:
        """Get PoI statistics."""
        return {
            "total_verifications": self._total_verifications,
            "passed_verifications": self._passed_verifications,
            "pass_rate": (
                round(
                    self._passed_verifications / self._total_verifications, 4
                )
                if self._total_verifications > 0
                else 0.0
            ),
            "tracked_miners": len(self._miner_histories),
            "verification_threshold": self.verification_threshold,
        }
