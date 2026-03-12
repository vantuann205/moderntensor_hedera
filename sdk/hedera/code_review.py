"""
ModernTensor - AI Code Review Agent

Specialized AI agent for code review tasks in the Code Review Subnet.
Supports multi-LLM validation with 5-dimension scoring:
- Security, Correctness, Readability, Best Practices, Gas Efficiency

For ModernTensor Subnet Protocol on Hedera - Hello Future Hackathon 2026
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List, TYPE_CHECKING
from dataclasses import dataclass, field
from enum import Enum

if TYPE_CHECKING:
    from .client import HederaClient
    from .hcs import HCSService

logger = logging.getLogger(__name__)


class CodeLanguage(str, Enum):
    """Supported code languages for review."""
    SOLIDITY = "solidity"
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    RUST = "rust"
    MOVE = "move"
    GENERIC = "generic"


@dataclass
class CodeReviewConfig:
    """Configuration for code review AI agent."""
    provider: str = "openai"  # openai, anthropic, google
    model: str = "gpt-4o-mini"
    temperature: float = 0.1
    max_tokens: int = 2000
    retry_count: int = 3
    # Scoring weights (must sum to 1.0)
    weights: Dict[str, float] = field(default_factory=lambda: {
        "security": 0.30,
        "correctness": 0.25,
        "readability": 0.15,
        "best_practices": 0.15,
        "gas_efficiency": 0.15,
    })


@dataclass
class CodeReviewResult:
    """Structured result from a code review."""
    overall_score: float  # 0-100
    security: float  # 0-100
    correctness: float  # 0-100
    readability: float  # 0-100
    best_practices: float  # 0-100
    gas_efficiency: float  # 0-100
    confidence: float  # 0-1
    vulnerabilities: List[Dict[str, str]] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    summary: str = ""
    provider: str = "heuristic"
    language: str = "generic"


# Code review prompts per language
CODE_REVIEW_PROMPTS = {
    "solidity": """You are an expert Solidity smart contract auditor for the ModernTensor Protocol on Hedera.
Your task is to perform a thorough security audit and code review of the submitted Solidity code.

EVALUATION CRITERIA (score each 0-100):
1. **Security (0-100)**: Reentrancy, overflow, access control, front-running, DoS, unchecked calls
2. **Correctness (0-100)**: Logic correctness, edge cases, state transitions, event emissions
3. **Readability (0-100)**: Code clarity, naming conventions, comments, structure
4. **Best Practices (0-100)**: OpenZeppelin usage, proper modifiers, error handling, NatSpec
5. **Gas Efficiency (0-100)**: Storage optimization, loop efficiency, calldata vs memory, packing

CODE TO REVIEW:
```solidity
{code}
```

{context}

Return a JSON response with:
{{
    "overall_score": <0-100 weighted score>,
    "security": <0-100>,
    "correctness": <0-100>,
    "readability": <0-100>,
    "best_practices": <0-100>,
    "gas_efficiency": <0-100>,
    "vulnerabilities": [
        {{"severity": "critical|high|medium|low|info", "description": "<issue>", "location": "<line or function>"}}
    ],
    "suggestions": ["<improvement suggestion>"],
    "summary": "<2-3 sentence overall assessment>"
}}

Be thorough but fair. A score of 70+ indicates production-ready code.""",

    "python": """You are an expert Python code reviewer for the ModernTensor Protocol on Hedera.
Perform a thorough code review of the submitted Python code.

EVALUATION CRITERIA (score each 0-100):
1. **Security (0-100)**: Input validation, injection risks, secrets handling, dependency safety
2. **Correctness (0-100)**: Logic correctness, edge cases, error handling, type safety
3. **Readability (0-100)**: PEP 8 compliance, naming, docstrings, code structure
4. **Best Practices (0-100)**: Design patterns, DRY, SOLID principles, testing considerations
5. **Gas Efficiency (0-100)**: Performance optimization, memory usage, algorithm efficiency

CODE TO REVIEW:
```python
{code}
```

{context}

Return a JSON response with:
{{
    "overall_score": <0-100 weighted score>,
    "security": <0-100>,
    "correctness": <0-100>,
    "readability": <0-100>,
    "best_practices": <0-100>,
    "gas_efficiency": <0-100>,
    "vulnerabilities": [
        {{"severity": "critical|high|medium|low|info", "description": "<issue>", "location": "<line or function>"}}
    ],
    "suggestions": ["<improvement suggestion>"],
    "summary": "<2-3 sentence overall assessment>"
}}""",

    "generic": """You are an expert code reviewer for the ModernTensor Protocol on Hedera.
Perform a thorough code review of the submitted code.

EVALUATION CRITERIA (score each 0-100):
1. **Security (0-100)**: Security vulnerabilities and risks
2. **Correctness (0-100)**: Logic correctness and edge case handling
3. **Readability (0-100)**: Code clarity and documentation
4. **Best Practices (0-100)**: Design patterns and conventions
5. **Gas Efficiency (0-100)**: Performance and optimization

CODE TO REVIEW:
```
{code}
```

{context}

Return a JSON response with:
{{
    "overall_score": <0-100 weighted score>,
    "security": <0-100>,
    "correctness": <0-100>,
    "readability": <0-100>,
    "best_practices": <0-100>,
    "gas_efficiency": <0-100>,
    "vulnerabilities": [
        {{"severity": "critical|high|medium|low|info", "description": "<issue>", "location": "<line or function>"}}
    ],
    "suggestions": ["<improvement suggestion>"],
    "summary": "<2-3 sentence overall assessment>"
}}"""
}


class CodeReviewAgent:
    """
    AI Code Review Agent for the ModernTensor Code Review Subnet.

    Performs automated code review with multi-LLM support and
    5-dimension scoring. Results are submitted to HCS for
    on-chain audit trail.

    Usage:
        agent = CodeReviewAgent(client, hcs)

        # Review Solidity code
        result = agent.review_code(
            code="contract Foo { ... }",
            language="solidity",
        )
        print(f"Score: {result.overall_score}")
        print(f"Vulnerabilities: {result.vulnerabilities}")

        # Review and submit to HCS
        agent.review_and_submit(
            task_id="task-001",
            miner_id="miner-001",
            code="def foo(): ...",
            language="python",
        )
    """

    def __init__(
        self,
        client: "HederaClient",
        hcs: "HCSService",
        config: Optional[CodeReviewConfig] = None,
    ):
        self.client = client
        self.hcs = hcs
        self.config = config or CodeReviewConfig()

    # =========================================================================
    # Main Review Methods
    # =========================================================================

    def review_code(
        self,
        code: str,
        language: str = "generic",
        context: str = "",
        use_llm: bool = True,
    ) -> CodeReviewResult:
        """
        Review code and return structured result.

        Args:
            code: Source code to review
            language: Programming language (solidity, python, etc.)
            context: Additional context about the code
            use_llm: Whether to use LLM (True) or heuristic (False)

        Returns:
            CodeReviewResult with scores and findings
        """
        if use_llm:
            return self._review_with_llm(code, language, context)
        return self._review_heuristic(code, language)

    def review_and_submit(
        self,
        task_id: str,
        miner_id: str,
        code: str,
        language: str = "generic",
        context: str = "",
        use_llm: bool = True,
    ) -> Dict[str, Any]:
        """
        Review code and submit score to HCS.

        Returns:
            Dict with review result and HCS receipt
        """
        result = self.review_code(code, language, context, use_llm)

        # Submit to HCS
        receipt = self._submit_to_hcs(task_id, miner_id, result)

        return {
            "review": result,
            "hcs_receipt": receipt,
            "task_id": task_id,
            "miner_id": miner_id,
        }

    # =========================================================================
    # LLM Review (Production)
    # =========================================================================

    def _review_with_llm(
        self,
        code: str,
        language: str,
        context: str,
    ) -> CodeReviewResult:
        """Review code using LLM with automatic fallback."""
        providers = [
            ("openai", self._review_openai),
            ("anthropic", self._review_anthropic),
            ("google", self._review_google),
        ]

        # Put configured provider first
        providers.sort(key=lambda x: x[0] != self.config.provider)

        last_error = None
        for provider_name, review_fn in providers:
            try:
                result = review_fn(code, language, context)
                result.provider = provider_name
                result.language = language
                return result
            except Exception as e:
                logger.warning(f"{provider_name} code review failed: {e}")
                last_error = e
                continue

        # All LLMs failed — fall back to heuristic
        logger.warning(f"All LLM providers failed, using heuristic: {last_error}")
        result = self._review_heuristic(code, language)
        result.provider = "heuristic_fallback"
        return result

    def _build_prompt(self, code: str, language: str, context: str) -> str:
        """Build the review prompt for the given language."""
        lang_key = language if language in CODE_REVIEW_PROMPTS else "generic"
        template = CODE_REVIEW_PROMPTS[lang_key]
        context_text = f"CONTEXT: {context}" if context else ""
        return template.format(code=code, context=context_text)

    def _parse_llm_response(self, content: str) -> CodeReviewResult:
        """Parse LLM response JSON into CodeReviewResult."""
        # Extract JSON from markdown code blocks if needed
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        data = json.loads(content.strip())

        return CodeReviewResult(
            overall_score=float(data.get("overall_score", 0)),
            security=float(data.get("security", 0)),
            correctness=float(data.get("correctness", 0)),
            readability=float(data.get("readability", 0)),
            best_practices=float(data.get("best_practices", 0)),
            gas_efficiency=float(data.get("gas_efficiency", 0)),
            confidence=0.95,
            vulnerabilities=data.get("vulnerabilities", []),
            suggestions=data.get("suggestions", []),
            summary=data.get("summary", ""),
        )

    def _review_openai(
        self, code: str, language: str, context: str
    ) -> CodeReviewResult:
        """Review code using OpenAI."""
        import openai

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")

        client = openai.OpenAI(api_key=api_key)
        prompt = self._build_prompt(code, language, context)

        response = client.chat.completions.create(
            model=self.config.model if "gpt" in self.config.model else "gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert code auditor. Return only valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            response_format={"type": "json_object"},
        )

        result = self._parse_llm_response(response.choices[0].message.content)
        result.confidence = 0.95
        return result

    def _review_anthropic(
        self, code: str, language: str, context: str
    ) -> CodeReviewResult:
        """Review code using Anthropic Claude."""
        import anthropic

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")

        client = anthropic.Anthropic(api_key=api_key)
        prompt = self._build_prompt(code, language, context)

        response = client.messages.create(
            model=(
                self.config.model
                if "claude" in self.config.model
                else "claude-3-haiku-20240307"
            ),
            max_tokens=self.config.max_tokens,
            messages=[
                {
                    "role": "user",
                    "content": f"{prompt}\n\nReturn only valid JSON, no explanation.",
                },
            ],
        )

        result = self._parse_llm_response(response.content[0].text)
        result.confidence = 0.93
        return result

    def _review_google(
        self, code: str, language: str, context: str
    ) -> CodeReviewResult:
        """Review code using Google Gemini (google-genai SDK)."""
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY/GEMINI_API_KEY not set")

        try:
            from google import genai
            from google.genai import types as genai_types
            client = genai.Client(api_key=api_key)
            model_name = "gemini-2.0-flash" 

            prompt = self._build_prompt(code, language, context)
            response = client.models.generate_content(
                model=model_name,
                contents=f"{prompt}\n\nReturn only valid JSON.",
                config=genai_types.GenerateContentConfig(
                    temperature=self.config.temperature,
                    max_output_tokens=self.config.max_tokens,
                    response_mime_type="application/json",
                )
            )
            result = self._parse_llm_response(response.text)
            result.confidence = 0.92
            result.provider = "google"
            return result
        except ImportError:
            # Fallback to old API
            import google.generativeai as genai_old
            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            genai_old.configure(api_key=api_key)
            model = genai_old.GenerativeModel("gemini-2.0-flash")
            prompt = self._build_prompt(code, language, context)
            response = model.generate_content(f"{prompt}\n\nReturn only valid JSON.")
            result = self._parse_llm_response(response.text)
            result.confidence = 0.90
            return result

    # =========================================================================
    # Heuristic Review (Demo / Fallback)
    # =========================================================================

    def _review_heuristic(
        self, code: str, language: str
    ) -> CodeReviewResult:
        """
        Heuristic code review for demo/fallback when no LLM is available.
        Analyzes code structure, common patterns, and basic security checks.
        """
        lines = code.strip().split("\n")
        line_count = len(lines)
        code_lower = code.lower()

        # Security checks
        security_score = 85.0
        vulnerabilities: List[Dict[str, str]] = []

        # Solidity-specific checks
        if language == "solidity":
            if "selfdestruct" in code_lower:
                security_score -= 20
                vulnerabilities.append({
                    "severity": "critical",
                    "description": "selfdestruct usage detected — can destroy contract",
                    "location": "global",
                })
            if "tx.origin" in code_lower:
                security_score -= 15
                vulnerabilities.append({
                    "severity": "high",
                    "description": "tx.origin used for authorization — vulnerable to phishing",
                    "location": "global",
                })
            if "delegatecall" in code_lower:
                security_score -= 10
                vulnerabilities.append({
                    "severity": "medium",
                    "description": "delegatecall detected — potential storage collision risk",
                    "location": "global",
                })
            if "reentrancyguard" in code_lower or "nonreentrant" in code_lower:
                security_score += 5  # Good practice
            if "safemath" in code_lower or "safeerc20" in code_lower:
                security_score += 3

        # Python-specific checks
        elif language == "python":
            if "eval(" in code_lower or "exec(" in code_lower:
                security_score -= 20
                vulnerabilities.append({
                    "severity": "critical",
                    "description": "eval/exec usage — code injection risk",
                    "location": "global",
                })
            if "pickle.load" in code_lower:
                security_score -= 15
                vulnerabilities.append({
                    "severity": "high",
                    "description": "pickle.load — deserialization vulnerability",
                    "location": "global",
                })

        security_score = max(0, min(100, security_score))

        # Correctness (based on structure)
        correctness_score = 70.0
        if line_count > 5:
            correctness_score += 10
        if "return" in code_lower or "emit" in code_lower:
            correctness_score += 5
        if "require" in code_lower or "assert" in code_lower or "raise" in code_lower:
            correctness_score += 10  # Input validation present
        correctness_score = min(100, correctness_score)

        # Readability
        readability_score = 60.0
        comment_lines = sum(
            1
            for line in lines
            if line.strip().startswith("//")
            or line.strip().startswith("#")
            or line.strip().startswith("*")
            or line.strip().startswith("/**")
        )
        comment_ratio = comment_lines / max(line_count, 1)
        readability_score += comment_ratio * 80  # More comments = better
        if line_count > 0:
            avg_line_length = sum(len(l) for l in lines) / line_count
            if avg_line_length < 100:
                readability_score += 10  # Reasonable line length
        readability_score = min(100, readability_score)

        # Best practices
        bp_score = 65.0
        if language == "solidity":
            if "openzeppelin" in code_lower:
                bp_score += 15
            if "event " in code_lower:
                bp_score += 5
            if "modifier " in code_lower:
                bp_score += 5
            if "@dev" in code or "@param" in code or "@notice" in code:
                bp_score += 10  # NatSpec
        elif language == "python":
            if '"""' in code or "'''" in code:
                bp_score += 10  # Docstrings
            if "def " in code and "self" in code:
                bp_score += 5  # OOP
            if "typing" in code_lower or ": " in code:
                bp_score += 5  # Type hints
        bp_score = min(100, bp_score)

        # Gas efficiency (Solidity) / Performance (Python)
        gas_score = 70.0
        if language == "solidity":
            if "memory" in code_lower and "storage" in code_lower:
                gas_score += 10  # Understands storage vs memory
            if "calldata" in code_lower:
                gas_score += 5
            if "uint256" in code_lower:
                gas_score += 3  # Proper uint usage
            if "uint8" in code_lower and "uint256" not in code_lower:
                gas_score -= 5  # Small types waste gas
        gas_score = min(100, gas_score)

        # Calculate weighted overall score
        weights = self.config.weights
        overall = (
            security_score * weights["security"]
            + correctness_score * weights["correctness"]
            + readability_score * weights["readability"]
            + bp_score * weights["best_practices"]
            + gas_score * weights["gas_efficiency"]
        )

        suggestions = []
        if comment_ratio < 0.1:
            suggestions.append("Add more inline comments and documentation")
        if security_score < 70:
            suggestions.append("Address security vulnerabilities before deployment")
        if line_count > 200:
            suggestions.append("Consider splitting into smaller modules for maintainability")

        return CodeReviewResult(
            overall_score=round(overall, 2),
            security=round(security_score, 2),
            correctness=round(correctness_score, 2),
            readability=round(readability_score, 2),
            best_practices=round(bp_score, 2),
            gas_efficiency=round(gas_score, 2),
            confidence=0.75,
            vulnerabilities=vulnerabilities,
            suggestions=suggestions,
            summary=f"Code review of {line_count}-line {language} code. "
                    f"Overall score: {overall:.1f}/100. "
                    f"Found {len(vulnerabilities)} potential issue(s).",
            provider="heuristic",
            language=language,
        )

    # =========================================================================
    # HCS Integration
    # =========================================================================

    def _submit_to_hcs(
        self,
        task_id: str,
        miner_id: str,
        result: CodeReviewResult,
    ) -> Any:
        """Submit code review score to HCS."""
        from .hcs import ScoreSubmission

        score = ScoreSubmission(
            validator_id=self.client.operator_id_str,
            miner_id=miner_id,
            task_id=task_id,
            score=result.overall_score,
            confidence=result.confidence,
            metrics={
                "security": result.security,
                "correctness": result.correctness,
                "readability": result.readability,
                "best_practices": result.best_practices,
                "gas_efficiency": result.gas_efficiency,
                "vulnerabilities_count": len(result.vulnerabilities),
                "language": result.language,
            },
        )

        receipt = self.hcs.submit_score(score)
        logger.info(
            f"Submitted code review score for task {task_id}: "
            f"{result.overall_score}/100"
        )

        return receipt
