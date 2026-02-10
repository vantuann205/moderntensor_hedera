#!/usr/bin/env python3
"""
Tests for the Proof of Intelligence (PoI) module.

Verifies:
- Knowledge verification scoring
- Shannon entropy analysis
- Cross-validator correlation detection
- Temporal consistency checks
- MinerHistory deque bounded growth
- Overall PoI pass/fail threshold
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sdk.scoring.proof_of_intelligence import (
    ProofOfIntelligence,
    PoIResult,
    MinerHistory,
)


def test_poi_basic_verification():
    """Basic PoI verification returns a result with all signals."""
    poi = ProofOfIntelligence(verification_threshold=0.4)

    result = poi.verify(
        miner_id="miner_001",
        output={
            "analysis": "This code has a reentrancy vulnerability in the "
                        "withdraw function. The state is updated after the "
                        "external call which allows recursive calls to drain "
                        "funds. Use ReentrancyGuard or checks-effects-interactions.",
            "findings": [
                {"severity": "critical", "description": "Reentrancy"},
                {"severity": "medium", "description": "No events"},
            ],
        },
        dimension_scores={
            "security": 0.3,
            "correctness": 0.7,
            "readability": 0.8,
        },
    )

    assert isinstance(result, PoIResult)
    assert 0.0 <= result.poi_score <= 1.0
    assert hasattr(result, "knowledge_score")
    assert hasattr(result, "entropy_score")
    assert hasattr(result, "correlation_score")
    assert hasattr(result, "consistency_score")


def test_poi_detects_empty_output():
    """Empty or minimal output should get low PoI score."""
    poi = ProofOfIntelligence(verification_threshold=0.4)

    result = poi.verify(
        miner_id="lazy_miner",
        output={"analysis": "", "findings": []},
        dimension_scores={"security": 0.5},
    )

    # Empty output → low knowledge score
    assert result.knowledge_score < 0.2


def test_poi_detects_validator_collusion():
    """Highly correlated validator scores should flag correlation."""
    poi = ProofOfIntelligence(correlation_max=0.95)

    result = poi.verify(
        miner_id="miner_001",
        output={"analysis": "Some reasonable analysis here.", "findings": []},
        dimension_scores={"security": 0.8},
        validator_scores={
            "v1": 0.8000,
            "v2": 0.8001,
            "v3": 0.8002,
        },
    )

    # Suspiciously similar scores should lower correlation signal
    assert result.correlation_score < 0.8


def test_poi_passes_good_output():
    """Quality output with diverse validators should pass."""
    poi = ProofOfIntelligence(verification_threshold=0.4)

    result = poi.verify(
        miner_id="good_miner",
        output={
            "analysis": "Comprehensive security analysis reveals multiple "
                        "critical issues. The withdraw function is vulnerable "
                        "to reentrancy attacks because state changes occur after "
                        "external calls. The emergencyWithdraw uses tx.origin "
                        "which is susceptible to phishing. No event emissions "
                        "for critical state changes. Recommend implementing "
                        "ReentrancyGuard, replacing tx.origin with msg.sender, "
                        "and adding events for all state mutations.",
            "findings": [
                {"severity": "critical", "description": "Reentrancy in withdraw"},
                {"severity": "high", "description": "tx.origin phishing"},
                {"severity": "medium", "description": "Missing events"},
            ],
        },
        dimension_scores={
            "security": 0.3,
            "correctness": 0.7,
            "readability": 0.8,
            "best_practices": 0.5,
            "gas_efficiency": 0.6,
        },
        validator_scores={
            "v1": 0.75,
            "v2": 0.80,
            "v3": 0.70,
        },
    )

    assert result.is_verified, f"Expected pass, got score={result.poi_score}"


def test_miner_history_bounded_growth():
    """MinerHistory uses deque — stays bounded at 100 entries."""
    history = MinerHistory()

    for i in range(200):
        history.add_entry(
            score=float(i),
            output_hash=f"hash_{i}",
            poi_score=0.5,
        )

    assert len(history.scores) == 100
    assert len(history.timestamps) == 100
    assert len(history.output_hashes) == 100
    assert len(history.poi_scores) == 100

    # Most recent entry should be the last one added
    assert history.scores[-1] == 199.0


def test_miner_history_deque_slicing():
    """Deque fields can be converted to list for slicing (regression test)."""
    history = MinerHistory()
    for i in range(10):
        history.add_entry(score=float(i), output_hash=f"h{i}", poi_score=0.5)

    # This should not raise TypeError (deque doesn't support slicing directly)
    recent = list(history.scores)[-5:]
    assert len(recent) == 5
    assert recent == [5.0, 6.0, 7.0, 8.0, 9.0]


def test_poi_stats():
    """PoI tracks total and passed verifications."""
    poi = ProofOfIntelligence(verification_threshold=0.3)

    # Run multiple verifications
    for i in range(5):
        poi.verify(
            miner_id=f"miner_{i}",
            output={
                "analysis": f"Analysis {i} with enough detail to pass "
                            "the knowledge and entropy checks.",
                "findings": [{"severity": "info", "description": "OK"}],
            },
            dimension_scores={"security": 0.8},
        )

    assert poi._total_verifications == 5
