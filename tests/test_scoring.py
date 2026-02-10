#!/usr/bin/env python3
"""
Tests for the Scoring Engine (dimensions + consensus + weights).

Verifies:
- 5-dimension scoring with configurable weights
- Weighted median consensus aggregation
- Outlier detection via IQR method (index-based)
- Bonding curve weight calculation (sqrt diminishing returns)
- Weight normalization and capping
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sdk.scoring.dimensions import (
    MultiDimensionScorer,
    DimensionConfig,
    CODE_REVIEW_DIMENSIONS,
    GENERAL_DIMENSIONS,
)
from sdk.scoring.consensus import ScoreConsensus, ConsensusResult
from sdk.scoring.weights import WeightCalculator


# =========================================================================
# MultiDimensionScorer Tests
# =========================================================================

def test_multi_dimension_scorer_basic():
    """Scoring produces scores for all 5 code review dimensions."""
    scorer = MultiDimensionScorer(CODE_REVIEW_DIMENSIONS)

    task_payload = {"code": "def foo(): return 42", "language": "python"}
    miner_output = {
        "analysis": "Simple function that returns a constant. "
                    "No security issues. Good readability.",
        "findings": [],
    }

    result = scorer.score(task_payload, miner_output)

    assert "final_score" in result
    assert "dimensions" in result
    assert "confidence" in result
    assert 0.0 <= result["final_score"] <= 1.0
    assert len(result["dimensions"]) > 0


def test_code_review_dimensions_count():
    """CODE_REVIEW_DIMENSIONS has exactly 5 dimensions."""
    assert len(CODE_REVIEW_DIMENSIONS) == 5
    names = [d.name for d in CODE_REVIEW_DIMENSIONS]
    assert "security" in names
    assert "correctness" in names
    assert "readability" in names
    assert "best_practices" in names
    assert "gas_efficiency" in names


def test_general_dimensions_exist():
    """GENERAL_DIMENSIONS is defined and non-empty."""
    assert len(GENERAL_DIMENSIONS) > 0


def test_dimension_weights_sum():
    """CODE_REVIEW_DIMENSIONS weights should sum close to 1.0."""
    total = sum(d.weight for d in CODE_REVIEW_DIMENSIONS)
    assert abs(total - 1.0) < 0.01, f"Weights sum to {total}"


# =========================================================================
# ScoreConsensus Tests
# =========================================================================

def test_consensus_single_validator():
    """Single validator → consensus equals that score."""
    consensus = ScoreConsensus()
    result = consensus.aggregate({"v1": 0.85})

    assert isinstance(result, ConsensusResult)
    assert abs(result.consensus_score - 0.85) < 1e-6
    assert result.num_validators == 1
    assert result.outliers == []


def test_consensus_multiple_validators():
    """Multiple validators → weighted median consensus."""
    consensus = ScoreConsensus()
    scores = {"v1": 0.80, "v2": 0.85, "v3": 0.82}
    result = consensus.aggregate(scores)

    assert 0.80 <= result.consensus_score <= 0.85
    assert result.num_validators == 3
    assert result.agreement_level > 0.5  # Should agree well


def test_consensus_outlier_detection():
    """One extreme score should be detected as outlier."""
    consensus = ScoreConsensus()
    scores = {
        "honest_1": 0.80,
        "honest_2": 0.82,
        "honest_3": 0.78,
        "honest_4": 0.81,
        "malicious": 0.05,  # Outlier
    }
    result = consensus.aggregate(scores)

    # Malicious validator should be flagged
    assert "malicious" in result.outliers
    # Consensus should be near honest validators (0.78-0.82)
    assert 0.75 <= result.consensus_score <= 0.85


def test_consensus_all_agree():
    """All validators agree → high confidence."""
    consensus = ScoreConsensus()
    scores = {"v1": 0.80, "v2": 0.80, "v3": 0.80}
    result = consensus.aggregate(scores)

    assert result.agreement_level > 0.9
    assert abs(result.consensus_score - 0.80) < 0.05


def test_consensus_to_dict():
    """ConsensusResult serializes all fields."""
    consensus = ScoreConsensus()
    result = consensus.aggregate({"v1": 0.9, "v2": 0.85})
    d = result.to_dict()

    assert "consensus_score" in d
    assert "confidence" in d
    assert "agreement_level" in d
    assert "num_validators" in d
    assert "outliers" in d
    assert "method" in d


# =========================================================================
# WeightCalculator Tests
# =========================================================================

def test_weight_sqrt_bonding_curve():
    """Weights use sqrt bonding curve — diminishing returns."""
    calc = WeightCalculator(min_stake=100.0, weight_cap=0.99)

    miners = [
        {"miner_id": "miner_a", "reputation_score": 0.8, "stake_amount": 100.0,
         "success_rate": 0.9, "timeout_rate": 0.0, "total_tasks": 50},
        {"miner_id": "miner_b", "reputation_score": 0.8, "stake_amount": 400.0,
         "success_rate": 0.9, "timeout_rate": 0.0, "total_tasks": 50},
        {"miner_id": "miner_c", "reputation_score": 0.8, "stake_amount": 1600.0,
         "success_rate": 0.9, "timeout_rate": 0.0, "total_tasks": 50},
    ]
    matrix = calc.calculate(miners)
    raw = matrix.raw_weights

    # miner_c has 16x stake but should NOT have 16x raw weight (sqrt curve)
    ratio = raw["miner_c"] / raw["miner_a"]
    assert ratio < 10, f"Bonding curve not working: ratio = {ratio}"

    # Higher stake should give higher raw weight
    assert raw["miner_c"] > raw["miner_b"] > raw["miner_a"]


def test_weight_normalization():
    """Weights should be normalized (sum close to 1.0)."""
    calc = WeightCalculator(min_stake=100.0)
    miners = [
        {"miner_id": "m1", "reputation_score": 0.7, "stake_amount": 200.0,
         "success_rate": 0.8, "timeout_rate": 0.0, "total_tasks": 5},
        {"miner_id": "m2", "reputation_score": 0.8, "stake_amount": 300.0,
         "success_rate": 0.9, "timeout_rate": 0.0, "total_tasks": 5},
        {"miner_id": "m3", "reputation_score": 0.9, "stake_amount": 500.0,
         "success_rate": 0.95, "timeout_rate": 0.0, "total_tasks": 5},
    ]
    matrix = calc.calculate(miners)
    weights = matrix.weights

    total = sum(weights.values())
    assert abs(total - 1.0) < 0.01, f"Weights sum to {total}"


def test_weight_below_min_stake():
    """Miner below min stake gets lower weight."""
    calc = WeightCalculator(min_stake=100.0)
    miners = [
        {"miner_id": "good", "reputation_score": 0.8, "stake_amount": 500.0,
         "success_rate": 0.9, "timeout_rate": 0.0, "total_tasks": 50},
        {"miner_id": "poor", "reputation_score": 0.8, "stake_amount": 10.0,
         "success_rate": 0.9, "timeout_rate": 0.0, "total_tasks": 50},
    ]
    matrix = calc.calculate(miners)
    raw = matrix.raw_weights

    # Raw weight should clearly favor the well-staked miner
    assert raw["good"] > raw["poor"]
