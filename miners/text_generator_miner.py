#!/usr/bin/env python3
"""
ModernTensor — Text Generator Miner

A ready-to-run miner template that generates text using OpenAI GPT.
Supports: creative writing, summarization, translation, Q&A.

Setup:
    1. pip install -e .
    2. cp .env.example .env  (set your keys)
    3. python miners/text_generator_miner.py

Environment Variables Required:
    HEDERA_ACCOUNT_ID     — Your Hedera testnet account
    OPENAI_API_KEY        — OpenAI API key
"""

import json
import logging
import os
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
logger = logging.getLogger("text_generator_miner")


# ---------------------------------------------------------------------------
# Text Generation Handler
# ---------------------------------------------------------------------------


def text_generator_handler(payload: dict, task_type: str) -> dict:
    """
    Receives a prompt and returns generated text.

    Args:
        payload: {
            "prompt": "Write a poem about...",
            "max_tokens": 500,
            "style": "creative" | "formal" | "technical",
            "temperature": 0.7
        }
        task_type: "text_generation"

    Returns:
        {"text": "...", "tokens_used": 123, "model": "gpt-4o-mini"}
    """
    prompt = payload.get("prompt", "")
    max_tokens = min(payload.get("max_tokens", 500), 2000)
    style = payload.get("style", "creative")
    temperature = payload.get("temperature", 0.7)

    if not prompt.strip():
        return {"text": "", "error": "Empty prompt", "tokens_used": 0}

    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key and not api_key.startswith("sk-xxx"):
        return _generate_with_openai(prompt, max_tokens, style, temperature, api_key)
    else:
        logger.warning("No valid OPENAI_API_KEY — using template fallback")
        return _generate_fallback(prompt, style)


def _generate_with_openai(
    prompt: str, max_tokens: int, style: str, temperature: float, api_key: str
) -> dict:
    """Generate text using OpenAI GPT."""
    try:
        import openai

        client = openai.OpenAI(api_key=api_key)

        system_prompts = {
            "creative": "You are a creative writer. Write vivid, engaging prose.",
            "formal": "You are a professional writer. Write clear, formal content.",
            "technical": "You are a technical writer. Write precise, accurate content.",
        }

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": system_prompts.get(style, system_prompts["creative"]),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )

        text = response.choices[0].message.content
        tokens = response.usage.total_tokens if response.usage else 0

        logger.info("Generated %d tokens for prompt: %s...", tokens, prompt[:50])
        return {
            "text": text,
            "tokens_used": tokens,
            "model": "gpt-4o-mini",
            "style": style,
        }

    except Exception as e:
        logger.error("OpenAI generation failed: %s", e)
        return _generate_fallback(prompt, style)


def _generate_fallback(prompt: str, style: str) -> dict:
    """Template-based fallback when no LLM is available."""
    prompt_lower = prompt.lower()

    if "haiku" in prompt_lower:
        text = "Silicon dreams flow\nThrough circuits of golden light\nFuture speaks in code"
    elif "poem" in prompt_lower:
        text = (
            "In the digital age we stand,\n"
            "Where data flows like grains of sand.\n"
            "Through networks vast and servers tall,\n"
            "Technology connects us all."
        )
    elif "summarize" in prompt_lower or "summary" in prompt_lower:
        text = f"Summary: The provided content discusses key themes and ideas. [Fallback mode - install OpenAI for real summarization]"
    else:
        text = f"[Fallback response for: {prompt[:100]}...]\nInstall OpenAI and set OPENAI_API_KEY for real text generation."

    return {
        "text": text,
        "tokens_used": 0,
        "model": "fallback-template",
        "style": style,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    from sdk.protocol.axon import Axon

    miner_id = os.getenv("HEDERA_ACCOUNT_ID", "0.0.demo-miner")
    port = int(os.getenv("MINER_PORT", "8092"))

    print("=" * 60)
    print("  ModernTensor — Text Generator Miner")
    print("=" * 60)
    print(f"  Miner ID:     {miner_id}")
    print(f"  Port:         {port}")
    print(f"  Capabilities: [text_generation, summarization]")
    print(
        f"  OpenAI:       {'✅ configured' if os.getenv('OPENAI_API_KEY') else '⚠️ fallback mode'}"
    )
    print("=" * 60)

    axon = Axon(
        miner_id=miner_id,
        handler=text_generator_handler,
        port=port,
        capabilities=["text_generation", "summarization"],
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
        print("   Goodbye!")


if __name__ == "__main__":
    main()
