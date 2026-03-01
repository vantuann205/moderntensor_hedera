"""
ModernTensor Scoring Engine

Multi-dimensional scoring, consensus algorithms,
Proof of Intelligence, Proof of Quality, and
Benchmark Ground-Truth Validation for the AI Marketplace Protocol.
"""

from .dimensions import (
    ScoringDimension, DimensionConfig, MultiDimensionScorer,
    CODE_REVIEW_DIMENSIONS, GENERAL_DIMENSIONS,
)
from .consensus import ScoreConsensus, ConsensusResult, CommitRevealConsensus, ScoreCommit
from .weights import WeightCalculator, WeightMatrix
from .proof_of_intelligence import ProofOfIntelligence, PoIResult
from .proof_of_quality import ProofOfQuality, PoQResult
from .benchmark_pool import BenchmarkPool, BenchmarkResult, BenchmarkChallenge

__all__ = [
    "ScoringDimension",
    "DimensionConfig",
    "MultiDimensionScorer",
    "CODE_REVIEW_DIMENSIONS",
    "GENERAL_DIMENSIONS",
    "ScoreConsensus",
    "ConsensusResult",
    "CommitRevealConsensus",
    "ScoreCommit",
    "WeightCalculator",
    "WeightMatrix",
    "ProofOfIntelligence",
    "PoIResult",
    "ProofOfQuality",
    "PoQResult",
    "BenchmarkPool",
    "BenchmarkResult",
    "BenchmarkChallenge",
]

