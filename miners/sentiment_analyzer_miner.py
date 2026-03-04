#!/usr/bin/env python3
"""
ModernTensor — Sentiment Analyzer Miner

A lightweight miner that performs sentiment analysis WITHOUT requiring
any LLM API key. Uses rule-based NLP for zero-cost operation.

Great for testing the network without API costs.

Setup:
    1. pip install -e .
    2. python miners/sentiment_analyzer_miner.py
"""

import logging
import math
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("sentiment_miner")

# ---------------------------------------------------------------------------
# Sentiment Lexicon (no external dependencies)
# ---------------------------------------------------------------------------

POSITIVE_WORDS = {
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "love",
    "like",
    "best",
    "happy",
    "beautiful",
    "perfect",
    "awesome",
    "brilliant",
    "outstanding",
    "superb",
    "incredible",
    "positive",
    "success",
    "win",
    "improve",
    "efficient",
    "elegant",
    "clean",
    "fast",
    "secure",
    "reliable",
    "innovative",
    "powerful",
    "easy",
}

NEGATIVE_WORDS = {
    "bad",
    "terrible",
    "awful",
    "horrible",
    "worst",
    "hate",
    "ugly",
    "broken",
    "fail",
    "error",
    "bug",
    "crash",
    "slow",
    "insecure",
    "vulnerable",
    "complex",
    "messy",
    "deprecated",
    "legacy",
    "hacky",
    "spaghetti",
    "debt",
    "leak",
    "bottleneck",
    "bloat",
    "fragile",
    "unstable",
    "unreliable",
    "confusing",
    "difficult",
    "painful",
}

INTENSIFIERS = {"very", "really", "extremely", "incredibly", "absolutely", "totally"}
NEGATORS = {
    "not",
    "no",
    "never",
    "neither",
    "nor",
    "hardly",
    "barely",
    "don't",
    "doesn't",
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
}


# ---------------------------------------------------------------------------
# Sentiment Handler
# ---------------------------------------------------------------------------


def sentiment_handler(payload: dict, task_type: str) -> dict:
    """
    Analyze sentiment of input text.

    Args:
        payload: {"text": "This code is amazing and well-structured"}
        task_type: "sentiment_analysis"

    Returns:
        {
            "sentiment": "positive",
            "score": 0.78,
            "confidence": 0.85,
            "details": {"positive_count": 3, "negative_count": 0, ...}
        }
    """
    text = payload.get("text", "")
    if not text.strip():
        return {
            "sentiment": "neutral",
            "score": 0.5,
            "confidence": 0.0,
            "details": {"error": "Empty text"},
        }

    return _analyze_sentiment(text)


def _analyze_sentiment(text: str) -> dict:
    """Rule-based sentiment analysis."""
    # Tokenize
    words = re.findall(r"\b\w+\b", text.lower())
    total_words = len(words)

    if total_words == 0:
        return {"sentiment": "neutral", "score": 0.5, "confidence": 0.0, "details": {}}

    positive_count = 0
    negative_count = 0
    intensified = 0
    negated = 0

    for i, word in enumerate(words):
        # Check for negation in previous 2 words
        is_negated = any(words[j] in NEGATORS for j in range(max(0, i - 2), i))
        # Check for intensifier
        is_intensified = any(words[j] in INTENSIFIERS for j in range(max(0, i - 1), i))

        multiplier = 1.5 if is_intensified else 1.0

        if word in POSITIVE_WORDS:
            if is_negated:
                negative_count += multiplier
                negated += 1
            else:
                positive_count += multiplier
                if is_intensified:
                    intensified += 1

        elif word in NEGATIVE_WORDS:
            if is_negated:
                positive_count += multiplier * 0.5  # Double negation weaker
                negated += 1
            else:
                negative_count += multiplier
                if is_intensified:
                    intensified += 1

    # Calculate score (0 = very negative, 0.5 = neutral, 1 = very positive)
    total_sentiment = positive_count + negative_count
    if total_sentiment == 0:
        score = 0.5
        confidence = 0.3
    else:
        # Sigmoid-like normalization
        raw = (positive_count - negative_count) / total_sentiment
        score = 0.5 + raw * 0.5  # Map [-1, 1] to [0, 1]
        # Confidence based on how many sentiment words found
        coverage = total_sentiment / total_words
        confidence = min(0.95, 0.3 + coverage * 2.0)

    score = max(0.0, min(1.0, score))

    if score > 0.6:
        sentiment = "positive"
    elif score < 0.4:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    return {
        "sentiment": sentiment,
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "details": {
            "total_words": total_words,
            "positive_signals": round(positive_count, 1),
            "negative_signals": round(negative_count, 1),
            "intensified": intensified,
            "negated": negated,
        },
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    from sdk.protocol.axon import Axon

    miner_id = os.getenv("HEDERA_ACCOUNT_ID", "0.0.demo-miner")
    port = int(os.getenv("MINER_PORT", "8093"))

    print("=" * 60)
    print("  ModernTensor — Sentiment Analyzer Miner")
    print("=" * 60)
    print(f"  Miner ID:     {miner_id}")
    print(f"  Port:         {port}")
    print(f"  Capabilities: [sentiment_analysis]")
    print(f"  LLM:          Not required (rule-based)")
    print("=" * 60)

    axon = Axon(
        miner_id=miner_id,
        handler=sentiment_handler,
        port=port,
        capabilities=["sentiment_analysis"],
        subnet_ids=[1],
    )

    axon.start()
    print(f"\n🟢 Miner running at {axon.endpoint}")
    print("   No API key needed — zero cost operation!")
    print("   Press Ctrl+C to stop\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🔴 Shutting down...")
        axon.stop()
        print("   Goodbye!")


if __name__ == "__main__":
    main()
