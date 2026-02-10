"""
Tests for 3-Layer Validation System.

Layer 1: PoI (already tested in test_poi.py)
Layer 2: Proof of Quality — multi-validator consensus
Layer 3: Benchmark Pool — ground truth scoring
Integration: All 3 layers combined
"""

import pytest

from sdk.scoring.benchmark_pool import (
    BenchmarkPool,
    BenchmarkChallenge,
    BenchmarkResult,
    KnownVulnerability,
    SOLIDITY_BENCHMARKS,
)
from sdk.scoring.proof_of_quality import (
    ProofOfQuality,
    PoQResult,
    ValidatorScore,
)


# ══════════════════════════════════════════════════════════════════════
# LAYER 3: BENCHMARK POOL TESTS
# ══════════════════════════════════════════════════════════════════════

class TestBenchmarkPool:
    """Tests for ground truth benchmark challenges."""

    def test_pool_initialization(self):
        """Pool loads default SWC benchmarks."""
        pool = BenchmarkPool()
        stats = pool.get_stats()
        assert stats["total_challenges"] == 4
        assert stats["total_results"] == 0

    def test_get_challenge(self):
        """Get a random challenge."""
        pool = BenchmarkPool()
        challenge = pool.get_challenge()
        assert challenge is not None
        assert challenge.code
        assert len(challenge.vulnerabilities) > 0

    def test_get_challenge_by_difficulty(self):
        """Filter challenges by difficulty."""
        pool = BenchmarkPool()
        easy = pool.get_challenge(difficulty="easy")
        assert easy is not None
        assert easy.difficulty == "easy"

    def test_get_challenge_as_task_payload(self):
        """Challenge formatted as task payload."""
        pool = BenchmarkPool()
        payload = pool.get_challenge_as_task_payload()
        assert payload is not None
        assert "code" in payload
        assert "language" in payload
        assert "_benchmark_id" in payload

    def test_score_perfect_response(self):
        """Miner finds all vulnerabilities → high score."""
        pool = BenchmarkPool()
        result = pool.score_response(
            challenge_id="SWC-107-reentrancy",
            miner_id="miner-1",
            miner_output={
                "vulnerabilities": [
                    {"name": "Reentrancy", "severity": "critical"},
                ]
            },
            response_time=2.0,
        )
        assert result.detection_rate == 1.0
        assert result.overall_score > 0.7
        assert len(result.found_bugs) == 1
        assert len(result.missed_bugs) == 0

    def test_score_partial_response(self):
        """Miner finds some bugs → partial score."""
        pool = BenchmarkPool()
        result = pool.score_response(
            challenge_id="SWC-105-115-multi",
            miner_id="miner-1",
            miner_output={
                "vulnerabilities": [
                    {"name": "Missing Access Control", "severity": "high"},
                ]
            },
            response_time=3.0,
        )
        assert result.detection_rate == 0.5
        assert len(result.found_bugs) == 1
        assert len(result.missed_bugs) == 1
        assert result.overall_score > 0.3

    def test_score_empty_response(self):
        """Miner returns nothing → zero score."""
        pool = BenchmarkPool()
        result = pool.score_response(
            challenge_id="SWC-107-reentrancy",
            miner_id="miner-lazy",
            miner_output={"vulnerabilities": []},
            response_time=1.0,
        )
        assert result.detection_rate == 0.0
        assert result.overall_score < 0.4

    def test_score_with_false_positives(self):
        """Miner claims bugs that don't exist → false positive rate."""
        pool = BenchmarkPool()
        result = pool.score_response(
            challenge_id="SWC-107-reentrancy",
            miner_id="miner-fp",
            miner_output={
                "vulnerabilities": [
                    {"name": "Reentrancy", "severity": "critical"},
                    {"name": "SQL Injection", "severity": "high"},
                    {"name": "XSS Attack", "severity": "medium"},
                ]
            },
            response_time=2.0,
        )
        assert result.detection_rate == 1.0
        assert result.false_positive_rate > 0
        assert len(result.false_positives) == 2

    def test_fuzzy_matching(self):
        """Fuzzy match on bug names (partial/keyword match)."""
        pool = BenchmarkPool()
        result = pool.score_response(
            challenge_id="SWC-107-reentrancy",
            miner_id="miner-fuzzy",
            miner_output={
                "vulnerabilities": [
                    {"name": "reentrancy vulnerability detected"},
                ]
            },
            response_time=2.0,
        )
        assert result.detection_rate == 1.0

    def test_analysis_string_format(self):
        """Extract bugs from flat string analysis."""
        pool = BenchmarkPool()
        result = pool.score_response(
            challenge_id="SWC-107-reentrancy",
            miner_id="miner-string",
            miner_output={
                "analysis": "Found a reentrancy bug in the withdraw function"
            },
            response_time=2.5,
        )
        assert result.detection_rate == 1.0

    def test_miner_benchmark_history(self):
        """Track benchmark history per miner."""
        pool = BenchmarkPool()
        pool.score_response(
            "SWC-107-reentrancy", "miner-1",
            {"vulnerabilities": [{"name": "Reentrancy"}]}, 1.0,
        )
        pool.score_response(
            "SWC-105-115-multi", "miner-1",
            {"vulnerabilities": [{"name": "Missing Access Control"}]}, 2.0,
        )

        history = pool.get_miner_benchmark_history("miner-1")
        assert len(history) == 2

        avg_score = pool.get_miner_benchmark_score("miner-1")
        assert avg_score > 0

    def test_exclude_seen_challenges(self):
        """Exclude already-seen challenges."""
        pool = BenchmarkPool()
        seen = {"SWC-107-reentrancy", "SWC-105-115-multi", "SWC-101-integer"}
        challenge = pool.get_challenge(exclude_ids=seen)
        assert challenge is not None
        assert challenge.challenge_id not in seen


# ══════════════════════════════════════════════════════════════════════
# LAYER 2: PROOF OF QUALITY TESTS
# ══════════════════════════════════════════════════════════════════════

class TestProofOfQuality:
    """Tests for multi-validator PoQ consensus."""

    def test_single_validator(self):
        """Single validator score accepted."""
        poq = ProofOfQuality(min_validators=1)
        poq.submit_score("val_1", "miner_1", quality=0.8, relevance=0.9, depth=0.7)
        result = poq.aggregate("miner_1")
        assert result.is_quality
        assert result.consensus_score > 0.5

    def test_multi_validator_consensus(self):
        """Multiple validators converge to consensus."""
        poq = ProofOfQuality(min_validators=1)
        poq.submit_score("val_1", "miner_1", quality=0.8, relevance=0.85, depth=0.7)
        poq.submit_score("val_2", "miner_1", quality=0.75, relevance=0.8, depth=0.65)
        poq.submit_score("val_3", "miner_1", quality=0.82, relevance=0.88, depth=0.72)

        result = poq.aggregate("miner_1")
        assert result.is_quality
        assert 0.6 < result.consensus_score < 1.0
        assert len(result.individual_scores) == 3

    def test_outlier_clipping(self):
        """Outlier validator score is clipped."""
        poq = ProofOfQuality(min_validators=1)
        poq.submit_score("val_1", "miner_1", quality=0.8, relevance=0.9, depth=0.7)
        poq.submit_score("val_2", "miner_1", quality=0.75, relevance=0.85, depth=0.65)
        poq.submit_score("val_3", "miner_1", quality=0.1, relevance=0.1, depth=0.1)  # outlier

        result = poq.aggregate("miner_1")
        # val_3 should be clipped
        assert "val_3" in result.clipped_validators
        # Score should still be high (outlier didn't drag it down)
        assert result.consensus_score > 0.5

    def test_quality_threshold_fail(self):
        """Low scores fail quality check."""
        poq = ProofOfQuality(quality_threshold=0.5, min_validators=1)
        poq.submit_score("val_1", "miner_bad", quality=0.1, relevance=0.1, depth=0.1)
        result = poq.aggregate("miner_bad")
        assert not result.is_quality
        assert result.consensus_score < 0.5

    def test_validator_trust_tracking(self):
        """Trust increases for aligned validators, decreases for outliers."""
        poq = ProofOfQuality(min_validators=1)

        # Round 1: val_1 and val_2 agree, val_3 is outlier
        poq.submit_score("val_1", "m1", quality=0.8, relevance=0.8, depth=0.8)
        poq.submit_score("val_2", "m1", quality=0.75, relevance=0.75, depth=0.75)
        poq.submit_score("val_3", "m1", quality=0.1, relevance=0.1, depth=0.1)
        poq.aggregate("m1")

        trust_1 = poq.get_validator_trust("val_1")
        trust_3 = poq.get_validator_trust("val_3")
        assert trust_1 > trust_3

    def test_duplicate_submission_overwrite(self):
        """Duplicate score from same validator overwrites."""
        poq = ProofOfQuality(min_validators=1)
        poq.submit_score("val_1", "miner_1", quality=0.3, relevance=0.3, depth=0.3)
        poq.submit_score("val_1", "miner_1", quality=0.9, relevance=0.9, depth=0.9)

        result = poq.aggregate("miner_1")
        # Should use the latest score (0.9)
        assert result.consensus_score > 0.7

    def test_insufficient_validators(self):
        """Return error when not enough validators."""
        poq = ProofOfQuality(min_validators=3)
        poq.submit_score("val_1", "miner_1", quality=0.8, relevance=0.8, depth=0.8)
        result = poq.aggregate("miner_1")
        assert not result.is_quality
        assert "error" in result.metadata

    def test_commit_hash_generated(self):
        """Each score has a commit hash for commit-reveal."""
        poq = ProofOfQuality()
        score = poq.submit_score("val_1", "m1", quality=0.5, relevance=0.5, depth=0.5)
        assert score.commit_hash
        assert len(score.commit_hash) == 16

    def test_stats(self):
        """Stats track rounds and clipping."""
        poq = ProofOfQuality(min_validators=1)
        poq.submit_score("v1", "m1", quality=0.8, relevance=0.8, depth=0.8)
        poq.aggregate("m1")
        stats = poq.get_stats()
        assert stats["total_rounds"] == 1
        assert stats["validators_tracked"] >= 1

    def test_result_to_dict(self):
        """PoQResult serialization."""
        poq = ProofOfQuality(min_validators=1)
        poq.submit_score("v1", "m1", quality=0.7, relevance=0.8, depth=0.6)
        result = poq.aggregate("m1")
        d = result.to_dict()
        assert "consensus_score" in d
        assert "is_quality" in d
        assert "validator_trust" in d


# ══════════════════════════════════════════════════════════════════════
# INTEGRATION: 3-LAYER COMBINED TESTS
# ══════════════════════════════════════════════════════════════════════

class TestThreeLayerIntegration:
    """Tests for all 3 layers working together."""

    def test_full_validation_pipeline(self):
        """Layer 1 (PoI) + Layer 2 (PoQ) + Layer 3 (Benchmark) combined."""
        from sdk.scoring import ProofOfIntelligence

        poi = ProofOfIntelligence()
        poq = ProofOfQuality(min_validators=1)
        pool = BenchmarkPool()

        # Get benchmark challenge
        challenge = pool.get_challenge(difficulty="easy")
        task_payload = {"code": challenge.code, "language": challenge.language}

        # Simulate miner output
        miner_output = {
            "vulnerabilities": [
                {"name": "Reentrancy", "severity": "critical",
                 "description": "External call before state update in withdraw()"},
            ],
            "recommendations": [
                "Apply checks-effects-interactions pattern",
                "Use ReentrancyGuard from OpenZeppelin",
            ],
            "analysis": "The withdraw function is vulnerable to reentrancy...",
        }

        # Layer 1: PoI
        poi_result = poi.verify(
            miner_id="miner-1",
            output=miner_output,
            dimension_scores={"security": 0.9, "correctness": 0.8},
            task_payload=task_payload,
        )
        assert poi_result.is_verified

        # Layer 2: PoQ (multi-validator consensus)
        poq.submit_score("val_1", "miner-1", quality=0.85, relevance=0.9, depth=0.8)
        poq.submit_score("val_2", "miner-1", quality=0.80, relevance=0.85, depth=0.75)
        poq_result = poq.aggregate("miner-1")
        assert poq_result.is_quality

        # Layer 3: Benchmark ground truth
        bench_result = pool.score_response(
            challenge_id=challenge.challenge_id,
            miner_id="miner-1",
            miner_output=miner_output,
            response_time=2.5,
        )
        assert bench_result.detection_rate == 1.0
        assert bench_result.overall_score > 0.7

    def test_cheater_detected_across_layers(self):
        """A lazy miner is caught by multiple layers."""
        from sdk.scoring import ProofOfIntelligence

        poi = ProofOfIntelligence()
        poq = ProofOfQuality(min_validators=1)
        pool = BenchmarkPool()

        lazy_output = {"analysis": "Code looks fine", "vulnerabilities": []}

        # Layer 1: PoI should flag low-effort output
        poi_result = poi.verify(
            miner_id="miner-lazy",
            output=lazy_output,
            dimension_scores={"security": 0.1, "correctness": 0.1},
        )
        # PoI may or may not flag this (depends on entropy)
        # But Layer 2 and 3 will definitely catch it

        # Layer 2: Low quality scores
        poq.submit_score("val_1", "miner-lazy", quality=0.1, relevance=0.2, depth=0.05)
        poq_result = poq.aggregate("miner-lazy")
        assert not poq_result.is_quality

        # Layer 3: Zero detection
        bench_result = pool.score_response(
            challenge_id="SWC-107-reentrancy",
            miner_id="miner-lazy",
            miner_output=lazy_output,
            response_time=1.0,
        )
        assert bench_result.detection_rate == 0.0
        assert bench_result.overall_score < 0.4

    def test_good_vs_bad_miner_differentiation(self):
        """System clearly differentiates good and bad miners."""
        pool = BenchmarkPool()
        poq = ProofOfQuality(min_validators=1)

        # Good miner
        good_result = pool.score_response(
            "SWC-105-115-multi", "good-miner",
            {
                "vulnerabilities": [
                    {"name": "Unprotected Ether Withdrawal", "severity": "critical"},
                    {"name": "Missing Access Control", "severity": "high"},
                ]
            },
            response_time=3.0,
        )

        # Bad miner
        bad_result = pool.score_response(
            "SWC-105-115-multi", "bad-miner",
            {"vulnerabilities": [], "analysis": "Looks ok"},
            response_time=0.5,
        )

        assert good_result.overall_score > bad_result.overall_score
        assert good_result.detection_rate == 1.0
        assert bad_result.detection_rate == 0.0

        # PoQ should reflect this
        poq.submit_score("v1", "good-miner", quality=0.9, relevance=0.9, depth=0.9)
        poq.submit_score("v1", "bad-miner", quality=0.1, relevance=0.1, depth=0.1)

        good_poq = poq.aggregate("good-miner")
        bad_poq = poq.aggregate("bad-miner")

        assert good_poq.consensus_score > bad_poq.consensus_score
