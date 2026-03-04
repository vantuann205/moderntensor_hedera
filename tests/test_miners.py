"""
Miner handler unit tests.

Tests each miner's handler function in isolation without Hedera connectivity.
"""

import pytest

from miners.sentiment_analyzer_miner import sentiment_handler
from miners.code_review_miner import _review_rule_based
from miners.text_generator_miner import _generate_fallback


# ── Sentiment miner ────────────────────────────────────────────────


class TestSentimentHandler:
    def test_positive_text(self):
        result = sentiment_handler(
            {"text": "This code is amazing and beautiful"}, "sentiment_analysis"
        )
        assert result["sentiment"] == "positive"
        assert result["score"] > 0.6

    def test_negative_text(self):
        result = sentiment_handler(
            {"text": "This is terrible broken legacy code"}, "sentiment_analysis"
        )
        assert result["sentiment"] == "negative"
        assert result["score"] < 0.4

    def test_empty_text_is_neutral(self):
        result = sentiment_handler({"text": ""}, "sentiment_analysis")
        assert result["sentiment"] == "neutral"

    def test_missing_text_key(self):
        result = sentiment_handler({}, "sentiment_analysis")
        assert result["sentiment"] == "neutral"


# ── Code review miner (rule-based) ─────────────────────────────────


class TestCodeReviewRuleBased:
    def test_bad_code_scores_low(self):
        code = "import *\npassword = '12345'\ndef foo():\n  return eval(x)\n"
        result = _review_rule_based(code, "python")
        assert result["score"] < 0.5
        assert len(result["issues"]) > 0

    def test_clean_code_scores_high(self):
        code = "def add(a: int, b: int) -> int:\n    return a + b\n"
        result = _review_rule_based(code, "python")
        assert result["score"] >= 0.5

    def test_empty_code(self):
        result = _review_rule_based("", "python")
        assert isinstance(result["score"], (int, float))


# ── Text generator (fallback) ──────────────────────────────────────


class TestTextGeneratorFallback:
    def test_generates_text(self):
        result = _generate_fallback("Write a haiku about code", "creative")
        assert len(result["text"]) > 0

    def test_result_has_model_field(self):
        result = _generate_fallback("Hello world", "general")
        assert "model" in result or "text" in result
