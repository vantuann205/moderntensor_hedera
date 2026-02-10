"""
AI Validator Agent - Production LLM Integration

Autonomous AI agent that validates miner submissions using LLMs.
Supports OpenAI, Anthropic, and Google Gemini.

For ModernTensor on Hedera - Hello Future Hackathon 2026
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List, TYPE_CHECKING
from dataclasses import dataclass
from enum import Enum

try:
    from hedera_agent_kit import HederaAgentAPI, Tool
except ImportError:
    HederaAgentAPI = None
    Tool = None

if TYPE_CHECKING:
    from .client import HederaClient
    from .hcs import HCSService

logger = logging.getLogger(__name__)


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    LOCAL = "local"


@dataclass
class ValidationConfig:
    """Configuration for AI validation."""
    provider: LLMProvider = LLMProvider.OPENAI
    model: str = "gpt-4o-mini"  # Cost-effective default
    temperature: float = 0.1     # Low for consistent scoring
    max_tokens: int = 1000
    retry_count: int = 3


# Production prompts for different task types
VALIDATION_PROMPTS = {
    "text_generation": """You are an expert AI validator for a decentralized compute network on Hedera.
Your task is to evaluate the quality of AI-generated text submissions.

EVALUATION CRITERIA:
1. **Relevance (0-100)**: How well does the submission address the task prompt?
2. **Quality (0-100)**: Grammar, coherence, and writing quality
3. **Completeness (0-100)**: Is the response complete and thorough?
4. **Creativity (0-100)**: Originality and creative merit

TASK PROMPT:
{task_prompt}

MINER SUBMISSION:
{submission}

Evaluate this submission and return a JSON response with:
{{
    "score": <0-100 overall weighted score>,
    "relevance": <0-100>,
    "quality": <0-100>,
    "completeness": <0-100>,
    "creativity": <0-100>,
    "reasoning": "<brief 2-3 sentence explanation>",
    "strengths": ["<list>"],
    "weaknesses": ["<list>"]
}}

Be fair but rigorous. A score of 70+ indicates good quality work.""",

    "code_generation": """You are an expert code reviewer for a decentralized compute network on Hedera.
Your task is to evaluate the quality of code submissions.

EVALUATION CRITERIA:
1. **Correctness (0-100)**: Does the code solve the problem correctly?
2. **Quality (0-100)**: Code style, readability, and best practices
3. **Completeness (0-100)**: All requirements addressed, edge cases handled
4. **Efficiency (0-100)**: Time/space complexity, optimization

TASK PROMPT:
{task_prompt}

CODE SUBMISSION:
```
{submission}
```

Return a JSON response with:
{{
    "score": <0-100 overall weighted score>,
    "correctness": <0-100>,
    "quality": <0-100>,
    "completeness": <0-100>,
    "efficiency": <0-100>,
    "reasoning": "<brief technical explanation>",
    "issues": ["<list of issues if any>"],
    "suggestions": ["<list of improvements>"]
}}""",

    "summarization": """You are an expert evaluator for a decentralized compute network on Hedera.
Your task is to evaluate text summarization quality.

EVALUATION CRITERIA:
1. **Accuracy (0-100)**: Does the summary correctly capture key points?
2. **Conciseness (0-100)**: Is it appropriately brief without losing meaning?
3. **Completeness (0-100)**: Are all important points included?
4. **Clarity (0-100)**: Is the summary clear and well-written?

ORIGINAL TEXT TO SUMMARIZE:
{task_prompt}

MINER'S SUMMARY:
{submission}

Return a JSON response with:
{{
    "score": <0-100 overall weighted score>,
    "accuracy": <0-100>,
    "conciseness": <0-100>,
    "completeness": <0-100>,
    "clarity": <0-100>,
    "reasoning": "<brief explanation>",
    "missing_points": ["<key points not covered>"]
}}""",

    "default": """You are an AI validator for a decentralized compute network on Hedera.
Evaluate this submission against the task prompt.

TASK PROMPT:
{task_prompt}

SUBMISSION:
{submission}

Return a JSON response with:
{{
    "score": <0-100 overall quality>,
    "relevance": <0-100>,
    "quality": <0-100>,
    "completeness": <0-100>,
    "reasoning": "<brief explanation>"
}}"""
}


class AIValidatorAgent:
    """
    Production AI Validator for ModernTensor.

    Supports multiple LLM providers with automatic fallback.

    Usage:
        from sdk.hedera import HederaClient
        from sdk.hedera.hcs import HCSService
        from sdk.hedera.agent import AIValidatorAgent

        client = HederaClient.from_env()
        hcs = HCSService(client)

        agent = AIValidatorAgent(client, hcs)

        # Validate with LLM (production)
        result = agent.validate_with_llm(
            task_prompt="Write a poem about AI",
            submission="The silicon mind...",
            task_type="text_generation"
        )
        print(f"Score: {result['score']}")

        # Or use simple heuristic (demo/testing)
        result = agent.validate_submission(task_prompt, submission)
    """

    def __init__(
        self,
        client: "HederaClient",
        hcs: "HCSService",
        config: Optional[ValidationConfig] = None,
    ):
        self.client = client
        self.hcs = hcs
        self.config = config or ValidationConfig()
        self._agent_api: Optional[Any] = None

        self._setup_hedera_agent()

    def _setup_hedera_agent(self):
        """Setup hedera-agent-kit API."""
        if HederaAgentAPI is None:
            logger.warning("hedera-agent-kit not installed")
            return
        try:
            self._agent_api = HederaAgentAPI()
            logger.info("Hedera Agent API initialized")
        except Exception as e:
            logger.warning(f"Could not initialize Hedera Agent API: {e}")

    @property
    def hedera_tools(self) -> List:
        """Get available Hedera tools from agent kit."""
        if not self._agent_api:
            return []
        return getattr(self._agent_api, 'tools', [])

    # =========================================================================
    # LLM Validation (Production)
    # =========================================================================

    def validate_with_llm(
        self,
        task_prompt: str,
        submission: str,
        task_type: str = "text_generation",
    ) -> Dict[str, Any]:
        """
        Production validation using LLM.

        Tries configured provider, falls back to others on failure.
        """
        providers = [
            (LLMProvider.OPENAI, self._validate_openai),
            (LLMProvider.ANTHROPIC, self._validate_anthropic),
            (LLMProvider.GOOGLE, self._validate_google),
        ]

        # Put configured provider first
        providers.sort(key=lambda x: x[0] != self.config.provider)

        last_error = None
        for provider, validate_fn in providers:
            try:
                result = validate_fn(task_prompt, submission, task_type)
                result["provider"] = provider.value
                result["model"] = self.config.model
                return result
            except Exception as e:
                logger.warning(f"{provider.value} validation failed: {e}")
                last_error = e
                continue

        # All LLMs failed, fall back to heuristic
        logger.warning(f"All LLM providers failed, using heuristic: {last_error}")
        result = self.validate_submission(task_prompt, submission, task_type)
        result["provider"] = "heuristic"
        result["fallback_reason"] = str(last_error)
        return result

    def _validate_openai(
        self,
        task_prompt: str,
        submission: str,
        task_type: str,
    ) -> Dict[str, Any]:
        """Validate using OpenAI API."""
        import openai

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")

        client = openai.OpenAI(api_key=api_key)

        prompt_template = VALIDATION_PROMPTS.get(task_type, VALIDATION_PROMPTS["default"])
        prompt = prompt_template.format(task_prompt=task_prompt, submission=submission)

        response = client.chat.completions.create(
            model=self.config.model if "gpt" in self.config.model else "gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert AI validator. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)
        result["confidence"] = 0.95
        result["tokens_used"] = response.usage.total_tokens
        return result

    def _validate_anthropic(
        self,
        task_prompt: str,
        submission: str,
        task_type: str,
    ) -> Dict[str, Any]:
        """Validate using Anthropic Claude API."""
        import anthropic

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")

        client = anthropic.Anthropic(api_key=api_key)

        prompt_template = VALIDATION_PROMPTS.get(task_type, VALIDATION_PROMPTS["default"])
        prompt = prompt_template.format(task_prompt=task_prompt, submission=submission)

        response = client.messages.create(
            model=self.config.model if "claude" in self.config.model else "claude-3-haiku-20240307",
            max_tokens=self.config.max_tokens,
            messages=[
                {"role": "user", "content": f"{prompt}\n\nReturn only valid JSON, no explanation."},
            ],
        )

        # Parse JSON from response
        content = response.content[0].text
        # Try to extract JSON if wrapped in markdown
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        result = json.loads(content.strip())
        result["confidence"] = 0.93
        return result

    def _validate_google(
        self,
        task_prompt: str,
        submission: str,
        task_type: str,
    ) -> Dict[str, Any]:
        """Validate using Google Gemini API."""
        import google.generativeai as genai

        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY/GEMINI_API_KEY not set")

        genai.configure(api_key=api_key)

        model_name = self.config.model if "gemini" in self.config.model else "gemini-2.0-flash"
        model = genai.GenerativeModel(model_name)

        prompt_template = VALIDATION_PROMPTS.get(task_type, VALIDATION_PROMPTS["default"])
        prompt = prompt_template.format(task_prompt=task_prompt, submission=submission)

        response = model.generate_content(
            f"{prompt}\n\nReturn only valid JSON.",
            generation_config=genai.types.GenerationConfig(
                temperature=self.config.temperature,
                max_output_tokens=self.config.max_tokens,
            ),
        )

        content = response.text
        # Try to extract JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        result = json.loads(content.strip())
        result["confidence"] = 0.90
        return result

    # =========================================================================
    # Heuristic Validation (Demo/Fallback)
    # =========================================================================

    def validate_submission(
        self,
        task_prompt: str,
        submission: str,
        task_type: str = "text_generation",
    ) -> Dict[str, Any]:
        """
        Validate using heuristics (demo/fallback).
        """
        metrics = self._evaluate_metrics(task_prompt, submission, task_type)

        weights = {
            "relevance": 0.3,
            "quality": 0.3,
            "completeness": 0.2,
            "creativity": 0.2,
        }

        weighted_score = sum(
            metrics.get(k, 50) * w for k, w in weights.items()
        )

        return {
            "score": round(weighted_score, 2),
            "confidence": metrics.get("confidence", 0.8),
            "metrics": metrics,
            "task_type": task_type,
            "provider": "heuristic",
        }

    def _evaluate_metrics(
        self,
        prompt: str,
        submission: str,
        task_type: str,
    ) -> Dict[str, float]:
        """Heuristic metric evaluation."""
        metrics = {}

        prompt_keywords = set(prompt.lower().split())
        submission_keywords = set(submission.lower().split())
        overlap = len(prompt_keywords & submission_keywords)
        metrics["relevance"] = min(100, (overlap / max(len(prompt_keywords), 1)) * 100)

        word_count = len(submission.split())
        metrics["quality"] = min(100, word_count * 2)
        metrics["completeness"] = 100 if word_count > 20 else word_count * 5

        unique_ratio = len(submission_keywords) / max(word_count, 1)
        metrics["creativity"] = min(100, unique_ratio * 200)

        metrics["confidence"] = 0.7 if word_count < 10 else 0.9

        return metrics

    # =========================================================================
    # HCS Integration
    # =========================================================================

    def submit_validation_to_hcs(
        self,
        task_id: str,
        miner_id: str,
        validation_result: Dict[str, Any],
    ) -> Any:
        """Submit validation score to HCS."""
        from .hcs import ScoreSubmission

        score = ScoreSubmission(
            validator_id=self.client.operator_id_str,
            miner_id=miner_id,
            task_id=task_id,
            score=validation_result["score"],
            confidence=validation_result.get("confidence", 0.8),
            metrics=validation_result.get("metrics", {}),
        )

        receipt = self.hcs.submit_score(score)
        logger.info(f"Submitted score for task {task_id}: {validation_result['score']}")

        return receipt

    def process_task(
        self,
        task_id: str,
        task_prompt: str,
        miner_id: str,
        submission: str,
        use_llm: bool = True,
        task_type: str = "text_generation",
    ) -> Dict[str, Any]:
        """
        Full validation flow: evaluate + submit to HCS.
        """
        if use_llm:
            result = self.validate_with_llm(task_prompt, submission, task_type)
        else:
            result = self.validate_submission(task_prompt, submission, task_type)

        receipt = self.submit_validation_to_hcs(task_id, miner_id, result)

        return {
            "validation": result,
            "hcs_receipt": receipt,
            "task_id": task_id,
            "miner_id": miner_id,
        }

    # =========================================================================
    # Batch Validation
    # =========================================================================

    def validate_batch(
        self,
        submissions: List[Dict[str, str]],
        use_llm: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Validate multiple submissions.

        Args:
            submissions: List of {task_prompt, submission, task_type, task_id, miner_id}
        """
        results = []
        for sub in submissions:
            try:
                result = self.process_task(
                    task_id=sub["task_id"],
                    task_prompt=sub["task_prompt"],
                    miner_id=sub["miner_id"],
                    submission=sub["submission"],
                    use_llm=use_llm,
                    task_type=sub.get("task_type", "text_generation"),
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to validate {sub.get('task_id')}: {e}")
                results.append({"error": str(e), "task_id": sub.get("task_id")})

        return results
