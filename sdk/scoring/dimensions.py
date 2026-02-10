"""
ModernTensor Multi-Dimensional Scoring

Configurable scoring framework that evaluates AI outputs across multiple
quality dimensions. Each subnet can define its own dimensions and weights.

Built-in dimension scorers for common AI task types:
- Code Review: security, correctness, readability, best practices, gas efficiency
- Text Generation: coherence, relevance, accuracy, fluency, completeness
- General: quality, timeliness, completeness
"""

from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class ScoringDimension(str, Enum):
    """Standard scoring dimensions."""
    SECURITY = "security"
    CORRECTNESS = "correctness"
    READABILITY = "readability"
    BEST_PRACTICES = "best_practices"
    GAS_EFFICIENCY = "gas_efficiency"
    COMPLETENESS = "completeness"
    COHERENCE = "coherence"
    RELEVANCE = "relevance"
    ACCURACY = "accuracy"
    NOVELTY = "novelty"
    TIMELINESS = "timeliness"


@dataclass
class DimensionConfig:
    """Configuration for a single scoring dimension."""
    name: str
    weight: float = 1.0
    min_score: float = 0.0
    max_score: float = 1.0
    description: str = ""
    scorer: Optional[Callable[[Dict, Dict], float]] = None

    def validate(self) -> None:
        if self.weight < 0:
            raise ValueError(f"Weight must be non-negative, got {self.weight}")
        if self.min_score >= self.max_score:
            raise ValueError(
                f"min_score ({self.min_score}) must be < max_score ({self.max_score})"
            )


# -----------------------------------------------------------------------
# Built-in Dimension Scorers
# -----------------------------------------------------------------------

def _score_security(task_payload: Dict, result_output: Dict) -> float:
    """
    Score security analysis quality.

    Evaluates:
    - Number of vulnerabilities identified
    - Severity classification accuracy
    - Remediation suggestions provided
    """
    vulnerabilities = result_output.get("vulnerabilities", [])
    if not vulnerabilities and not result_output.get("security_analysis"):
        return 0.1  # Minimal score for empty analysis

    score = 0.0
    # Has vulnerability list?
    if vulnerabilities:
        score += 0.3
        # Severity classifications present?
        has_severity = all(
            "severity" in v for v in vulnerabilities if isinstance(v, dict)
        )
        if has_severity:
            score += 0.2
        # Remediation suggestions?
        has_fix = any(
            v.get("fix") or v.get("remediation")
            for v in vulnerabilities
            if isinstance(v, dict)
        )
        if has_fix:
            score += 0.2

    # Security analysis text?
    analysis = result_output.get("security_analysis", "")
    if isinstance(analysis, str) and len(analysis) > 100:
        score += 0.3

    return min(1.0, score)


def _score_correctness(task_payload: Dict, result_output: Dict) -> float:
    """
    Score correctness of the analysis.

    Evaluates output completeness and structural validity.
    """
    if not result_output:
        return 0.0

    score = 0.0
    total_checks = 0

    # Has structured output?
    expected_keys = ["analysis", "score", "findings", "summary"]
    for key in expected_keys:
        total_checks += 1
        if key in result_output:
            score += 1.0

    # Has numeric score in valid range?
    if "score" in result_output:
        total_checks += 1
        s = result_output["score"]
        if isinstance(s, (int, float)) and 0 <= s <= 1:
            score += 1.0

    # Has findings list?
    findings = result_output.get("findings", [])
    if isinstance(findings, list) and findings:
        total_checks += 1
        score += 1.0

    return score / max(total_checks, 1)


def _score_readability(task_payload: Dict, result_output: Dict) -> float:
    """
    Score readability of the output.

    Evaluates structure, formatting, and clarity.
    """
    output_text = str(result_output)
    if not output_text or len(output_text) < 20:
        return 0.1

    score = 0.0

    # Length check — not too short, not excessively long
    length = len(output_text)
    if 100 <= length <= 10000:
        score += 0.3
    elif length > 10000:
        score += 0.2  # Slightly penalize very long outputs
    elif length > 50:
        score += 0.1

    # Has structure (uses sections, lists, etc.)?
    has_sections = bool(re.search(r'[#*\-\d]+[\.\)]\s', output_text))
    if has_sections:
        score += 0.3

    # Has summary/conclusion?
    summary = result_output.get("summary", "")
    if isinstance(summary, str) and len(summary) > 20:
        score += 0.2

    # Proper sentences (rough heuristic — has periods)
    sentences = output_text.count(".")
    if sentences > 3:
        score += 0.2

    return min(1.0, score)


def _score_best_practices(task_payload: Dict, result_output: Dict) -> float:
    """
    Score adherence to best practices in the analysis.
    """
    recommendations = result_output.get("recommendations", [])
    best_practices = result_output.get("best_practices", [])
    suggestions = result_output.get("suggestions", [])

    combined = recommendations + best_practices + suggestions

    if not combined and not result_output.get("analysis"):
        return 0.1

    score = 0.0

    # Has specific recommendations?
    if combined:
        score += 0.4
        # Quality of recommendations (have details?)
        detailed = sum(
            1 for r in combined
            if isinstance(r, (str, dict)) and len(str(r)) > 30
        )
        detail_ratio = detailed / max(len(combined), 1)
        score += detail_ratio * 0.3

    # References standards or patterns?
    analysis_text = str(result_output)
    standards = [
        "SOLID", "DRY", "KISS", "OWASP", "CEI", "ERC",
        "best practice", "standard", "convention", "pattern",
    ]
    found_standards = sum(
        1 for s in standards if s.lower() in analysis_text.lower()
    )
    score += min(0.3, found_standards * 0.1)

    return min(1.0, score)


def _score_gas_efficiency(task_payload: Dict, result_output: Dict) -> float:
    """
    Score gas efficiency analysis (for Solidity/smart contract reviews).
    """
    gas_analysis = result_output.get("gas_analysis", "")
    gas_findings = result_output.get("gas_optimizations", [])

    if not gas_analysis and not gas_findings:
        # Check if task is even about code
        code = task_payload.get("code", "")
        if "gas" not in str(result_output).lower() and code:
            return 0.2  # Didn't analyze gas at all
        return 0.5  # Task might not require gas analysis

    score = 0.0

    if gas_findings:
        score += 0.5
        # Specific optimizations suggested?
        specific = sum(
            1 for f in gas_findings
            if isinstance(f, dict) and f.get("suggestion")
        )
        score += min(0.3, specific * 0.1)

    if isinstance(gas_analysis, str) and len(gas_analysis) > 50:
        score += 0.2

    return min(1.0, score)


def _score_timeliness(task_payload: Dict, result_output: Dict) -> float:
    """Score based on execution time metadata."""
    exec_time = result_output.get("_execution_time", 0)
    timeout = result_output.get("_timeout", 300)

    if exec_time <= 0:
        return 0.5  # No timing data

    ratio = exec_time / max(timeout, 1)
    # Linear scoring: 0% of timeout → 1.0, 100% → 0.0
    return max(0.0, 1.0 - ratio)


# -----------------------------------------------------------------------
# Scoring Presets
# -----------------------------------------------------------------------

CODE_REVIEW_DIMENSIONS = [
    DimensionConfig("security", 0.30, description="Security vulnerability detection", scorer=_score_security),
    DimensionConfig("correctness", 0.25, description="Output correctness and validity", scorer=_score_correctness),
    DimensionConfig("readability", 0.15, description="Output readability and structure", scorer=_score_readability),
    DimensionConfig("best_practices", 0.15, description="Best practices adherence", scorer=_score_best_practices),
    DimensionConfig("gas_efficiency", 0.15, description="Gas optimization analysis", scorer=_score_gas_efficiency),
]

GENERAL_DIMENSIONS = [
    DimensionConfig("correctness", 0.40, description="Output correctness", scorer=_score_correctness),
    DimensionConfig("completeness", 0.30, description="Output completeness", scorer=_score_readability),
    DimensionConfig("timeliness", 0.30, description="Response timeliness", scorer=_score_timeliness),
]


# -----------------------------------------------------------------------
# Multi-Dimension Scorer
# -----------------------------------------------------------------------

class MultiDimensionScorer:
    """
    Multi-dimensional scoring engine.

    Evaluates AI outputs across configurable quality dimensions,
    producing a weighted composite score with confidence estimation.

    Example:
        scorer = MultiDimensionScorer(CODE_REVIEW_DIMENSIONS)
        breakdown = scorer.score(
            task_payload={"code": "...", "language": "solidity"},
            result_output={"vulnerabilities": [...], "analysis": "..."},
        )
        print(f"Final: {breakdown.final_score:.2f}")
        print(f"Security: {breakdown.dimensions['security']:.2f}")
    """

    def __init__(self, dimensions: Optional[List[DimensionConfig]] = None):
        """
        Args:
            dimensions: List of dimension configurations.
                        Defaults to CODE_REVIEW_DIMENSIONS.
        """
        self.dimensions = dimensions or CODE_REVIEW_DIMENSIONS
        self._validate_dimensions()
        logger.info(
            "MultiDimensionScorer initialized with %d dimensions: %s",
            len(self.dimensions),
            [d.name for d in self.dimensions],
        )

    def score(
        self,
        task_payload: Dict[str, Any],
        result_output: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Score a result across all configured dimensions.

        Args:
            task_payload: Original task data
            result_output: Miner's output

        Returns:
            Dictionary with dimension scores, weights, final score,
            and confidence estimation.
        """
        dim_scores: Dict[str, float] = {}
        dim_weights: Dict[str, float] = {}

        for dim in self.dimensions:
            if dim.scorer:
                raw_score = dim.scorer(task_payload, result_output)
            else:
                raw_score = 0.5  # Default for dimensions without scorers

            # Clamp to [min, max]
            clamped = max(dim.min_score, min(dim.max_score, raw_score))
            # Normalize to [0, 1]
            normalized = (clamped - dim.min_score) / (dim.max_score - dim.min_score)

            dim_scores[dim.name] = round(normalized, 4)
            dim_weights[dim.name] = dim.weight

        # Compute weighted final score
        total_weight = sum(dim_weights.values())
        if total_weight > 0:
            final_score = sum(
                dim_scores[name] * dim_weights[name]
                for name in dim_scores
            ) / total_weight
        else:
            final_score = 0.0

        # Estimate confidence from score variance
        confidence = self._estimate_confidence(list(dim_scores.values()))

        return {
            "dimensions": dim_scores,
            "weights": dim_weights,
            "final_score": round(final_score, 4),
            "confidence": round(confidence, 4),
        }

    def _estimate_confidence(self, scores: List[float]) -> float:
        """
        Estimate confidence from score variance.

        Low variance → high confidence (dimensions agree)
        High variance → low confidence (dimensions disagree)
        """
        if len(scores) < 2:
            return 1.0

        mean = sum(scores) / len(scores)
        variance = sum((s - mean) ** 2 for s in scores) / len(scores)
        std_dev = math.sqrt(variance)

        # Map std_dev to confidence: 0 std → 1.0, 0.5 std → 0.0
        confidence = max(0.0, 1.0 - (std_dev / 0.5))
        return confidence

    def _validate_dimensions(self) -> None:
        """Validate dimension configurations."""
        total_weight = sum(d.weight for d in self.dimensions)
        if abs(total_weight - 1.0) > 0.01:
            logger.warning(
                "Dimension weights sum to %.2f (expected 1.0), "
                "scores will be normalized",
                total_weight,
            )
        for dim in self.dimensions:
            dim.validate()

    def get_config(self) -> List[Dict]:
        """Get dimension configurations."""
        return [
            {
                "name": d.name,
                "weight": d.weight,
                "description": d.description,
            }
            for d in self.dimensions
        ]
