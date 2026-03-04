#!/usr/bin/env python3
"""
ModernTensor — Code Review Miner

A ready-to-run miner template that performs AI-powered code review
using OpenAI GPT. Receives code via Axon, returns structured review.

Setup:
    1. pip install -e .
    2. cp .env.example .env  (set your keys)
    3. python miners/code_review_miner.py

Environment Variables Required:
    HEDERA_ACCOUNT_ID     — Your Hedera testnet account
    HEDERA_PRIVATE_KEY    — Your Hedera private key
    OPENAI_API_KEY        — OpenAI API key for code review
    MDT_STAKE_AMOUNT      — Amount of MDT to stake (default: 100)
"""

import json
import logging
import os
import sys
import time
from pathlib import Path

# Project root
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("code_review_miner")

# ---------------------------------------------------------------------------
# AI Code Review Handler
# ---------------------------------------------------------------------------


def code_review_handler(payload: dict, task_type: str) -> dict:
    """
    Receives code and returns a structured code review.

    This is the function that gets called when a validator sends a task.

    Args:
        payload: {"code": "...", "language": "python", "context": "..."}
        task_type: "code_review"

    Returns:
        {"review": "...", "score": 0.85, "issues": [...], "suggestions": [...]}
    """
    code = payload.get("code", "")
    language = payload.get("language", "python")
    context = payload.get("context", "General code review")

    if not code.strip():
        return {
            "review": "No code provided",
            "score": 0.0,
            "issues": ["Empty code submission"],
            "suggestions": [],
        }

    # Try OpenAI first, fallback to rule-based
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key and not api_key.startswith("sk-xxx"):
        return _review_with_openai(code, language, context, api_key)
    else:
        logger.warning("No valid OPENAI_API_KEY — using rule-based review")
        return _review_rule_based(code, language)


def _review_with_openai(code: str, language: str, context: str, api_key: str) -> dict:
    """AI-powered code review using OpenAI GPT."""
    try:
        import openai

        client = openai.OpenAI(api_key=api_key)

        prompt = f"""You are an expert {language} code reviewer. Review this code:

```{language}
{code}
```

Context: {context}

Respond in JSON format:
{{
    "review": "Brief overall assessment (2-3 sentences)",
    "score": 0.85,  // 0.0 to 1.0
    "issues": ["issue1", "issue2"],
    "suggestions": ["suggestion1", "suggestion2"],
    "security_concerns": ["concern1"],
    "best_practices": ["practice followed or missing"]
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)
        logger.info("OpenAI review complete — score: %.2f", result.get("score", 0))
        return result

    except Exception as e:
        logger.error("OpenAI review failed: %s", e)
        return _review_rule_based(code, language)


def _review_rule_based(code: str, language: str) -> dict:
    """Fallback rule-based review (no LLM required)."""
    issues = []
    suggestions = []
    score = 0.7

    lines = code.split("\n")
    total_lines = len(lines)

    # Check for common issues
    if total_lines > 500:
        issues.append("File is very long — consider splitting into modules")
        score -= 0.05

    for i, line in enumerate(lines, 1):
        if len(line) > 120:
            issues.append(f"Line {i}: exceeds 120 characters")
            score -= 0.01
        if "TODO" in line or "FIXME" in line:
            issues.append(f"Line {i}: has TODO/FIXME marker")
        if "import *" in line:
            issues.append(f"Line {i}: wildcard import — be explicit")
            score -= 0.03
        if "eval(" in line or "exec(" in line:
            issues.append(f"Line {i}: dangerous eval/exec usage")
            score -= 0.1
        if "password" in line.lower() and "=" in line:
            issues.append(f"Line {i}: potential hardcoded password")
            score -= 0.15

    # Check for docstrings
    has_docstring = '"""' in code or "'''" in code
    if not has_docstring:
        suggestions.append("Add docstrings to functions and classes")
        score -= 0.05

    # Check for type hints (Python)
    if language == "python":
        if "def " in code and "->" not in code:
            suggestions.append("Add return type hints to functions")
            score -= 0.03

    # Clamp score
    score = max(0.1, min(1.0, score))

    return {
        "review": f"Rule-based review of {total_lines} lines of {language} code. "
        f"Found {len(issues)} issues.",
        "score": round(score, 2),
        "issues": issues[:10],
        "suggestions": suggestions[:5],
    }


# ---------------------------------------------------------------------------
# Main — Start Miner
# ---------------------------------------------------------------------------


def main():
    from sdk.protocol.axon import Axon

    miner_id = os.getenv("HEDERA_ACCOUNT_ID", "0.0.demo-miner")
    port = int(os.getenv("MINER_PORT", "8091"))

    print("=" * 60)
    print("  ModernTensor — Code Review Miner")
    print("=" * 60)
    print(f"  Miner ID:     {miner_id}")
    print(f"  Port:         {port}")
    print(f"  Capabilities: [code_review]")
    print(
        f"  OpenAI:       {'✅ configured' if os.getenv('OPENAI_API_KEY') else '⚠️ rule-based fallback'}"
    )
    print("=" * 60)

    # Create and start Axon server
    axon = Axon(
        miner_id=miner_id,
        handler=code_review_handler,
        port=port,
        capabilities=["code_review"],
        subnet_ids=[1],
    )

    axon.start()
    print(f"\n🟢 Miner running at {axon.endpoint}")
    print("   Waiting for tasks from validators...")
    print("   Press Ctrl+C to stop\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🔴 Shutting down...")
        axon.stop()
        stats = axon.get_stats()
        print(f"   Tasks processed: {stats.get('tasks_completed', 0)}")
        print("   Goodbye!")


if __name__ == "__main__":
    main()
