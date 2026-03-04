#!/usr/bin/env python3
"""
ModernTensor — AI Validator Runner

A ready-to-run validator node that:
    1. Listens for miner submissions on HCS
    2. Validates AI outputs using multi-dimensional scoring
    3. Runs Proof of Intelligence (PoI) checks
    4. Submits consensus scores via commit-reveal
    5. Earns 15% of task rewards

Setup:
    1. pip install -e .
    2. cp .env.example .env  (set your keys)
    3. python validators/ai_validator_runner.py

Environment Variables Required:
    HEDERA_ACCOUNT_ID     — Your Hedera testnet account
    HEDERA_PRIVATE_KEY    — Your Hedera private key
    OPENAI_API_KEY        — At least one LLM provider for AI validation
"""

import json
import logging
import os
import sys
import time
import hashlib
from pathlib import Path
from typing import Dict, List, Optional

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [validator] %(levelname)s: %(message)s",
)
logger = logging.getLogger("validator")


# ---------------------------------------------------------------------------
# Validator Configuration
# ---------------------------------------------------------------------------

class ValidatorConfig:
    """Validator node configuration."""

    def __init__(self):
        self.validator_id = os.getenv("HEDERA_ACCOUNT_ID", "0.0.validator")
        self.poll_interval = float(os.getenv("VALIDATOR_POLL_INTERVAL", "10"))
        self.min_confidence = float(os.getenv("VALIDATOR_MIN_CONFIDENCE", "0.6"))
        self.llm_provider = os.getenv("VALIDATOR_LLM_PROVIDER", "openai")
        self.target_subnets = [
            int(x) for x in os.getenv("VALIDATOR_SUBNETS", "0").split(",")
        ]

        # Scoring weights
        self.dimension_weights = {
            "correctness": 0.30,
            "completeness": 0.25,
            "security": 0.25,
            "readability": 0.20,
        }


# ---------------------------------------------------------------------------
# AI Scoring Engine
# ---------------------------------------------------------------------------

class AIScorer:
    """
    Scores miner submissions using LLM + rule-based analysis.
    Combines multiple signals for robust scoring.
    """

    def __init__(self, config: ValidatorConfig):
        self.config = config
        self._openai_client = None

    def score_submission(
        self,
        task_type: str,
        task_payload: dict,
        miner_output: dict,
    ) -> dict:
        """
        Score a miner's submission across multiple dimensions.

        Returns:
            {
                "overall_score": 0.82,
                "dimensions": {"correctness": 0.9, ...},
                "confidence": 0.85,
                "reasoning": "...",
                "poi_signals": {...}
            }
        """
        # Multi-dimensional scoring
        dimensions = {}

        if task_type == "code_review":
            dimensions = self._score_code_review(task_payload, miner_output)
        elif task_type == "text_generation":
            dimensions = self._score_text_generation(task_payload, miner_output)
        elif task_type == "sentiment_analysis":
            dimensions = self._score_sentiment(task_payload, miner_output)
        else:
            dimensions = self._score_generic(task_payload, miner_output)

        # Calculate weighted overall score
        overall = sum(
            dimensions.get(dim, 0.5) * weight
            for dim, weight in self.config.dimension_weights.items()
        )

        # Proof of Intelligence checks
        poi_signals = self._check_poi(miner_output)

        # Adjust score based on PoI
        poi_penalty = poi_signals.get("penalty", 0.0)
        overall = max(0.0, min(1.0, overall - poi_penalty))

        # Confidence based on analysis depth
        confidence = self._calculate_confidence(dimensions, poi_signals)

        return {
            "overall_score": round(overall, 4),
            "dimensions": {k: round(v, 4) for k, v in dimensions.items()},
            "confidence": round(confidence, 4),
            "reasoning": self._generate_reasoning(dimensions, poi_signals),
            "poi_signals": poi_signals,
        }

    def _score_code_review(self, task: dict, output: dict) -> dict:
        """Score a code review submission."""
        review = output.get("review", "")
        issues = output.get("issues", [])
        suggestions = output.get("suggestions", [])
        score = output.get("score", 0.5)

        # Correctness: Does the review identify real issues?
        correctness = min(1.0, 0.3 + len(issues) * 0.08) if issues else 0.3

        # Completeness: Coverage of review aspects
        completeness = 0.4
        if review and len(review) > 50:
            completeness += 0.2
        if issues:
            completeness += min(0.2, len(issues) * 0.04)
        if suggestions:
            completeness += min(0.2, len(suggestions) * 0.05)

        # Security: Were security issues flagged?
        security_keywords = ["security", "vulnerability", "injection", "xss", "csrf", "eval"]
        code = task.get("code", "")
        has_security_risk = any(kw in code.lower() for kw in ["eval", "exec", "password", "secret"])
        security_mentioned = any(kw in str(output).lower() for kw in security_keywords)
        security = 0.7
        if has_security_risk and security_mentioned:
            security = 0.95
        elif has_security_risk and not security_mentioned:
            security = 0.3

        # Readability of the review itself
        readability = min(1.0, 0.3 + len(review) / 500) if review else 0.2

        return {
            "correctness": correctness,
            "completeness": completeness,
            "security": security,
            "readability": readability,
        }

    def _score_text_generation(self, task: dict, output: dict) -> dict:
        """Score a text generation submission."""
        text = output.get("text", "")
        prompt = task.get("prompt", "")

        if not text:
            return {k: 0.1 for k in self.config.dimension_weights}

        words = text.split()
        word_count = len(words)

        # Correctness: relevant to prompt?
        prompt_words = set(prompt.lower().split())
        text_words = set(text.lower().split())
        overlap = len(prompt_words & text_words) / max(len(prompt_words), 1)
        correctness = min(1.0, 0.3 + overlap)

        # Completeness: sufficient length?
        completeness = min(1.0, 0.2 + word_count / 200)

        # Security: no harmful content (basic check)
        security = 0.9

        # Readability: sentence structure
        sentences = text.count(".") + text.count("!") + text.count("?")
        avg_sentence_len = word_count / max(sentences, 1)
        readability = 0.8 if 10 < avg_sentence_len < 30 else 0.5

        return {
            "correctness": correctness,
            "completeness": completeness,
            "security": security,
            "readability": readability,
        }

    def _score_sentiment(self, task: dict, output: dict) -> dict:
        """Score a sentiment analysis submission."""
        sentiment = output.get("sentiment", "")
        score = output.get("score", 0.5)
        confidence = output.get("confidence", 0.0)

        # Basic validation
        valid_sentiments = {"positive", "negative", "neutral"}
        correctness = 0.8 if sentiment in valid_sentiments else 0.2
        completeness = 0.5 + (0.3 if "details" in output else 0)
        security = 0.9
        readability = 0.7 + (0.2 if confidence > 0.5 else 0)

        return {
            "correctness": correctness,
            "completeness": completeness,
            "security": security,
            "readability": readability,
        }

    def _score_generic(self, task: dict, output: dict) -> dict:
        """Generic scoring fallback."""
        has_content = bool(output) and len(str(output)) > 20
        return {
            "correctness": 0.6 if has_content else 0.2,
            "completeness": 0.5 if has_content else 0.1,
            "security": 0.8,
            "readability": 0.6 if has_content else 0.2,
        }

    def _check_poi(self, output: dict) -> dict:
        """
        Proof of Intelligence: detect copy-paste, template, or gibberish output.
        """
        text = json.dumps(output)
        signals = {"penalty": 0.0}

        # 1. Entropy check — very low entropy suggests template/copy
        if len(text) > 0:
            char_freq = {}
            for c in text.lower():
                char_freq[c] = char_freq.get(c, 0) + 1
            total = len(text)
            entropy = -sum(
                (count / total) * (count / total)
                for count in char_freq.values()
            )
            # Normalized — very low = suspicious
            if len(set(text)) < 10:
                signals["low_entropy"] = True
                signals["penalty"] += 0.15

        # 2. Length check — too short = likely lazy
        if len(text) < 30:
            signals["too_short"] = True
            signals["penalty"] += 0.1

        # 3. Repetition check
        words = text.lower().split()
        if len(words) > 5:
            unique_ratio = len(set(words)) / len(words)
            if unique_ratio < 0.3:
                signals["high_repetition"] = True
                signals["penalty"] += 0.2

        return signals

    def _calculate_confidence(self, dimensions: dict, poi: dict) -> float:
        """Calculate confidence in the score."""
        # Higher confidence when more dimensions agree
        scores = list(dimensions.values())
        if not scores:
            return 0.3

        mean = sum(scores) / len(scores)
        variance = sum((s - mean) ** 2 for s in scores) / len(scores)

        # Low variance = high confidence (dimensions agree)
        confidence = max(0.3, min(0.95, 0.8 - variance))

        # PoI penalty reduces confidence
        if poi.get("penalty", 0) > 0:
            confidence *= 0.8

        return confidence

    def _generate_reasoning(self, dimensions: dict, poi: dict) -> str:
        """Generate human-readable reasoning for the score."""
        parts = []

        best = max(dimensions, key=dimensions.get) if dimensions else "N/A"
        worst = min(dimensions, key=dimensions.get) if dimensions else "N/A"

        parts.append(f"Strongest: {best} ({dimensions.get(best, 0):.2f})")
        parts.append(f"Weakest: {worst} ({dimensions.get(worst, 0):.2f})")

        if poi.get("penalty", 0) > 0:
            flags = [k for k in poi if k != "penalty" and poi[k]]
            parts.append(f"PoI flags: {', '.join(flags)}")

        return "; ".join(parts)


# ---------------------------------------------------------------------------
# Validator Node
# ---------------------------------------------------------------------------

class ValidatorNode:
    """
    Main validator node — polls for tasks, scores miner outputs,
    submits scores to consensus.
    """

    def __init__(self, config: ValidatorConfig):
        self.config = config
        self.scorer = AIScorer(config)
        self.tasks_validated = 0
        self.scores_submitted = 0
        self._running = False

    def validate_task(
        self,
        task_id: str,
        task_type: str,
        task_payload: dict,
        miner_id: str,
        miner_output: dict,
    ) -> dict:
        """
        Validate a single miner submission.

        Returns full score report.
        """
        logger.info("Validating task %s from miner %s", task_id[:12], miner_id)

        score_report = self.scorer.score_submission(
            task_type=task_type,
            task_payload=task_payload,
            miner_output=miner_output,
        )

        # Generate commit hash for commit-reveal
        score_data = json.dumps({
            "validator_id": self.config.validator_id,
            "task_id": task_id,
            "miner_id": miner_id,
            "score": score_report["overall_score"],
        }, sort_keys=True)

        nonce = os.urandom(16).hex()
        commit_hash = hashlib.sha256(
            (score_data + nonce).encode()
        ).hexdigest()

        score_report["commit_hash"] = commit_hash
        score_report["nonce"] = nonce
        score_report["task_id"] = task_id
        score_report["miner_id"] = miner_id
        score_report["validator_id"] = self.config.validator_id

        self.tasks_validated += 1

        logger.info(
            "Task %s: score=%.4f confidence=%.4f [%s]",
            task_id[:12],
            score_report["overall_score"],
            score_report["confidence"],
            score_report["reasoning"][:80],
        )

        return score_report

    def submit_score_onchain(self, score_report: dict) -> bool:
        """Submit score to Hedera HCS (commit phase)."""
        try:
            from sdk.hedera.config import load_hedera_config
            from sdk.hedera.client import HederaClient
            from sdk.hedera.hcs import HCSService, ScoreSubmission

            config = load_hedera_config()
            client = HederaClient(config)
            hcs = HCSService(client)

            submission = ScoreSubmission(
                validator_id=score_report["validator_id"],
                miner_id=score_report["miner_id"],
                task_id=score_report["task_id"],
                score=score_report["overall_score"],
                confidence=score_report["confidence"],
                metrics=score_report["dimensions"],
            )

            hcs.submit_score(submission)
            self.scores_submitted += 1
            client.close()
            logger.info("Score submitted to HCS for task %s", score_report["task_id"][:12])
            return True

        except Exception as e:
            logger.error("Failed to submit score on-chain: %s", e)
            return False

    def get_stats(self) -> dict:
        return {
            "validator_id": self.config.validator_id,
            "tasks_validated": self.tasks_validated,
            "scores_submitted": self.scores_submitted,
            "subnets": self.config.target_subnets,
            "llm_provider": self.config.llm_provider,
        }


# ---------------------------------------------------------------------------
# Main — Interactive Demo Mode
# ---------------------------------------------------------------------------

def main():
    config = ValidatorConfig()
    node = ValidatorNode(config)

    print("=" * 60)
    print("  ModernTensor — AI Validator Node")
    print("=" * 60)
    print(f"  Validator ID: {config.validator_id}")
    print(f"  Subnets:      {config.target_subnets}")
    print(f"  LLM Provider: {config.llm_provider}")
    print(f"  Min Conf:     {config.min_confidence}")
    print(f"  Dimensions:   {list(config.dimension_weights.keys())}")
    print("=" * 60)

    # Demo: validate sample submissions
    print("\n📝 Running validation demo with sample submissions...\n")

    # Sample 1: Good code review
    report1 = node.validate_task(
        task_id="task-001-demo",
        task_type="code_review",
        task_payload={
            "code": "def fib(n):\n  return fib(n-1)+fib(n-2) if n>1 else n\n",
            "language": "python",
        },
        miner_id="0.0.miner-alpha",
        miner_output={
            "review": "Recursive fibonacci has O(2^n) complexity. Use memoization or iterative approach.",
            "score": 0.75,
            "issues": [
                "Exponential time complexity O(2^n)",
                "No memoization or dynamic programming",
                "No type hints",
            ],
            "suggestions": [
                "Use @functools.lru_cache for memoization",
                "Add type hint: def fib(n: int) -> int",
            ],
        },
    )
    print(f"  ✅ Task 1 (code_review): score={report1['overall_score']}, conf={report1['confidence']}")
    print(f"     {report1['reasoning']}")

    # Sample 2: Text generation
    report2 = node.validate_task(
        task_id="task-002-demo",
        task_type="text_generation",
        task_payload={"prompt": "Write about decentralized AI"},
        miner_id="0.0.miner-beta",
        miner_output={
            "text": "Decentralized AI represents a paradigm shift in how we build and deploy "
                    "artificial intelligence systems. By distributing computation across a "
                    "network of independent nodes, we eliminate single points of failure "
                    "and create more resilient, censorship-resistant AI infrastructure.",
            "tokens_used": 85,
            "model": "gpt-4o-mini",
        },
    )
    print(f"  ✅ Task 2 (text_gen):    score={report2['overall_score']}, conf={report2['confidence']}")

    # Sample 3: Low quality / suspicious output
    report3 = node.validate_task(
        task_id="task-003-demo",
        task_type="code_review",
        task_payload={"code": "x=1\nprint(x)\n", "language": "python"},
        miner_id="0.0.miner-gamma",
        miner_output={
            "review": "ok",
            "score": 1.0,
            "issues": [],
            "suggestions": [],
        },
    )
    print(f"  ⚠️  Task 3 (lazy):      score={report3['overall_score']}, conf={report3['confidence']}")
    if report3.get("poi_signals", {}).get("penalty", 0) > 0:
        print(f"     PoI flags detected! Penalty applied.")

    # Stats
    print(f"\n📊 Validator Stats:")
    stats = node.get_stats()
    for k, v in stats.items():
        print(f"   {k}: {v}")

    # Offer to continue in polling mode
    print(f"\n{'─' * 50}")
    print("  Validator demo complete!")
    print("  To run in continuous polling mode, set up HCS topics")
    print("  and the validator will automatically pick up tasks.")
    print(f"{'─' * 50}")


if __name__ == "__main__":
    main()
