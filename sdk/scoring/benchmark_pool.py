"""
ModernTensor Benchmark Pool — Ground Truth Validation (Layer 3)

Maintains a pool of code samples with KNOWN vulnerabilities (from SWC/CWE).
Benchmark challenges are injected as regular tasks — miners don't know
which tasks are benchmarks vs. real requests.

Miner responses are scored against the ground truth, providing an
objective, unforgeable quality metric.
"""

from __future__ import annotations

import hashlib
import logging
import random
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------
# Ground Truth Data Structures
# -----------------------------------------------------------------------

@dataclass
class KnownVulnerability:
    """A known vulnerability in a benchmark code sample."""
    swc_id: str           # e.g. "SWC-107"
    name: str             # e.g. "Reentrancy"
    severity: str         # "critical", "high", "medium", "low", "info"
    location: str         # e.g. "withdraw function, line 5"
    description: str      # What's wrong
    remediation: str      # How to fix


@dataclass
class BenchmarkChallenge:
    """A code sample with known vulnerabilities for ground-truth scoring."""
    challenge_id: str
    code: str
    language: str
    vulnerabilities: List[KnownVulnerability]
    difficulty: str  # "easy", "medium", "hard"
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def expected_bug_names(self) -> Set[str]:
        return {v.name.lower() for v in self.vulnerabilities}

    @property
    def expected_severity_map(self) -> Dict[str, str]:
        return {v.name.lower(): v.severity for v in self.vulnerabilities}


@dataclass
class BenchmarkResult:
    """Result of scoring a miner's response against ground truth."""
    challenge_id: str
    miner_id: str
    detection_rate: float     # % of known bugs found (0-1)
    false_positive_rate: float  # % of claimed bugs that are wrong
    severity_accuracy: float  # % of correct severity classifications
    overall_score: float      # Weighted composite
    found_bugs: List[str]     # Bug names that were correctly identified
    missed_bugs: List[str]    # Bug names that were missed
    false_positives: List[str]  # Bugs claimed but not in ground truth
    response_time: float      # seconds

    def to_dict(self) -> Dict[str, Any]:
        return {
            "challenge_id": self.challenge_id,
            "miner_id": self.miner_id,
            "detection_rate": round(self.detection_rate, 4),
            "false_positive_rate": round(self.false_positive_rate, 4),
            "severity_accuracy": round(self.severity_accuracy, 4),
            "overall_score": round(self.overall_score, 4),
            "found_bugs": self.found_bugs,
            "missed_bugs": self.missed_bugs,
            "false_positives": self.false_positives,
            "response_time": round(self.response_time, 2),
        }


# -----------------------------------------------------------------------
# Built-in Benchmark Challenges (from SWC Registry)
# -----------------------------------------------------------------------

SOLIDITY_BENCHMARKS: List[BenchmarkChallenge] = [
    BenchmarkChallenge(
        challenge_id="SWC-107-reentrancy",
        language="solidity",
        difficulty="easy",
        code="""
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableBank {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // BUG: External call before state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] -= amount;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
""",
        vulnerabilities=[
            KnownVulnerability(
                swc_id="SWC-107",
                name="Reentrancy",
                severity="critical",
                location="withdraw(), line 14-15",
                description="External call before state update allows reentrancy attack",
                remediation="Apply checks-effects-interactions pattern: update balance before external call",
            ),
        ],
        metadata={"source": "SWC Registry", "category": "security"},
    ),

    BenchmarkChallenge(
        challenge_id="SWC-105-115-multi",
        language="solidity",
        difficulty="medium",
        code="""
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TokenSale {
    address public owner;
    mapping(address => uint256) public balances;
    uint256 public totalSupply;
    bool public saleActive = true;

    constructor() {
        owner = msg.sender;
        totalSupply = 1000000;
        balances[owner] = totalSupply;
    }

    function buy() public payable {
        require(saleActive, "Sale not active");
        uint256 tokens = msg.value * 100;
        balances[msg.sender] += tokens;
    }

    function transfer(address to, uint256 amount) public {
        require(balances[msg.sender] >= amount);
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }

    function setOwner(address newOwner) public {
        // BUG: No access control
        owner = newOwner;
    }

    function withdraw() public {
        // BUG: No access control
        payable(msg.sender).transfer(address(this).balance);
    }

    function endSale() public {
        require(msg.sender == owner);
        saleActive = false;
    }
}
""",
        vulnerabilities=[
            KnownVulnerability(
                swc_id="SWC-105",
                name="Unprotected Ether Withdrawal",
                severity="critical",
                location="withdraw(), line 34-36",
                description="Anyone can drain contract funds — no access control",
                remediation="Add require(msg.sender == owner) or use Ownable modifier",
            ),
            KnownVulnerability(
                swc_id="SWC-115",
                name="Missing Access Control",
                severity="high",
                location="setOwner(), line 30-32",
                description="Anyone can take ownership of the contract",
                remediation="Add access control: require(msg.sender == owner)",
            ),
        ],
        metadata={"source": "SWC Registry", "category": "access_control"},
    ),

    BenchmarkChallenge(
        challenge_id="SWC-101-integer",
        language="solidity",
        difficulty="medium",
        code="""
// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;  // Pre-0.8 — no built-in overflow protection

contract UnsafeMath {
    mapping(address => uint256) public balances;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) public {
        // BUG: Integer overflow — totalSupply can wrap around
        totalSupply += amount;
        balances[to] += amount;
    }

    function batchTransfer(address[] memory receivers, uint256 value) public {
        // BUG: Integer overflow on multiplication
        uint256 total = receivers.length * value;
        require(balances[msg.sender] >= total);
        balances[msg.sender] -= total;

        for (uint256 i = 0; i < receivers.length; i++) {
            balances[receivers[i]] += value;
        }
    }

    function timeLock(uint256 lockDuration) public view returns (uint256) {
        // BUG: block.timestamp overflow possible with large lockDuration
        return block.timestamp + lockDuration;
    }
}
""",
        vulnerabilities=[
            KnownVulnerability(
                swc_id="SWC-101",
                name="Integer Overflow",
                severity="high",
                location="mint(), batchTransfer(), timeLock()",
                description="Pre-0.8 Solidity has no overflow protection. Multiple arithmetic operations can overflow.",
                remediation="Use SafeMath library or upgrade to Solidity 0.8+",
            ),
        ],
        metadata={"source": "SWC Registry", "category": "arithmetic"},
    ),

    BenchmarkChallenge(
        challenge_id="SWC-106-selfdestruct",
        language="solidity",
        difficulty="hard",
        code="""
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Vault {
    address public owner;
    mapping(address => uint256) public deposits;

    constructor() {
        owner = msg.sender;
    }

    function deposit() public payable {
        deposits[msg.sender] += msg.value;
    }

    function withdraw() public {
        uint256 amount = deposits[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        deposits[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    function destroy() public {
        require(msg.sender == owner, "Not owner");
        // BUG: selfdestruct sends ALL funds to owner, including other users' deposits
        selfdestruct(payable(owner));
    }

    function getContractBalance() public view returns (uint256) {
        // BUG: Can be manipulated via forceSend
        return address(this).balance;
    }

    // BUG: No way for users to check if contract is going to be destroyed
    // No event for transparency
}
""",
        vulnerabilities=[
            KnownVulnerability(
                swc_id="SWC-106",
                name="Unprotected Selfdestruct",
                severity="critical",
                location="destroy(), line 24-27",
                description="Owner can destroy contract and steal all users' deposits. "
                            "selfdestruct bypasses withdraw logic.",
                remediation="Remove selfdestruct or implement multi-sig approval with timelock",
            ),
            KnownVulnerability(
                swc_id="SWC-132",
                name="Unexpected Balance Manipulation",
                severity="medium",
                location="getContractBalance(), line 30-32",
                description="address(this).balance can be manipulated via selfdestruct from another contract "
                            "(force-sending ether). Logic depending on exact balance is unreliable.",
                remediation="Track deposits internally instead of relying on address(this).balance",
            ),
        ],
        metadata={"source": "SWC Registry", "category": "lifecycle"},
    ),
]


# -----------------------------------------------------------------------
# Benchmark Pool
# -----------------------------------------------------------------------

class BenchmarkPool:
    """
    Ground Truth validation via benchmark challenges.

    Maintains a pool of code samples with KNOWN vulnerabilities.
    Challenges are injected as regular tasks — miners cannot distinguish
    them from real requests. Quality is scored objectively against
    the ground truth.

    Example:
        pool = BenchmarkPool()

        # Get a random challenge for a miner
        challenge = pool.get_challenge(difficulty="medium")

        # Score miner's response against ground truth
        result = pool.score_response(
            challenge_id=challenge.challenge_id,
            miner_id="0.0.1001",
            miner_output={"vulnerabilities": [...]},
            response_time=3.5,
        )

        print(f"Detection rate: {result.detection_rate:.0%}")
        print(f"Overall score: {result.overall_score:.4f}")
    """

    def __init__(
        self,
        challenges: Optional[List[BenchmarkChallenge]] = None,
    ):
        self._challenges: Dict[str, BenchmarkChallenge] = {}
        self._results: Dict[str, List[BenchmarkResult]] = {}  # miner_id → results
        self._injection_count = 0

        pool = challenges or SOLIDITY_BENCHMARKS
        for c in pool:
            self._challenges[c.challenge_id] = c

        logger.info(
            "BenchmarkPool initialized with %d challenges", len(self._challenges)
        )

    def get_challenge(
        self,
        difficulty: Optional[str] = None,
        exclude_ids: Optional[Set[str]] = None,
    ) -> Optional[BenchmarkChallenge]:
        """
        Get a random challenge, optionally filtered by difficulty.

        Args:
            difficulty: "easy", "medium", or "hard"
            exclude_ids: Challenge IDs to exclude (already seen by miner)

        Returns:
            A BenchmarkChallenge, or None if pool is exhausted.
        """
        candidates = list(self._challenges.values())

        if difficulty:
            candidates = [c for c in candidates if c.difficulty == difficulty]

        if exclude_ids:
            candidates = [c for c in candidates if c.challenge_id not in exclude_ids]

        if not candidates:
            return None

        self._injection_count += 1
        return random.choice(candidates)

    def get_challenge_as_task_payload(
        self,
        difficulty: Optional[str] = None,
        exclude_ids: Optional[Set[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Get a challenge formatted as a normal task payload.
        The miner cannot distinguish this from a real task.
        """
        challenge = self.get_challenge(difficulty, exclude_ids)
        if challenge is None:
            return None

        return {
            "code": challenge.code,
            "language": challenge.language,
            "_benchmark_id": challenge.challenge_id,  # stripped before sending to miner
        }

    def score_response(
        self,
        challenge_id: str,
        miner_id: str,
        miner_output: Dict[str, Any],
        response_time: float = 0.0,
    ) -> BenchmarkResult:
        """
        Score a miner's output against ground truth.

        The miner_output is expected to contain vulnerability info.
        We use fuzzy matching on vulnerability names to be fair.

        Returns:
            BenchmarkResult with detection rate, false positives, etc.
        """
        challenge = self._challenges.get(challenge_id)
        if challenge is None:
            raise ValueError(f"Unknown challenge: {challenge_id}")

        expected_bugs = challenge.expected_bug_names
        severity_map = challenge.expected_severity_map

        # Extract bugs from miner output (flexible format)
        claimed_bugs = self._extract_bugs_from_output(miner_output)

        # Match claimed bugs against ground truth
        found = set()
        false_positives = []

        for claimed in claimed_bugs:
            matched = self._fuzzy_match(claimed, expected_bugs)
            if matched:
                found.add(matched)
            else:
                false_positives.append(claimed)

        missed = list(expected_bugs - found)

        # Calculate rates
        detection_rate = len(found) / len(expected_bugs) if expected_bugs else 0.0
        fp_rate = (
            len(false_positives) / (len(found) + len(false_positives))
            if (found or false_positives) else 0.0
        )

        # Severity accuracy
        severity_correct = 0
        severity_total = 0
        claimed_severities = self._extract_severities(miner_output)
        for bug_name, expected_sev in severity_map.items():
            if bug_name in found:
                severity_total += 1
                claimed_sev = claimed_severities.get(bug_name, "")
                if claimed_sev.lower() == expected_sev.lower():
                    severity_correct += 1
        severity_accuracy = (
            severity_correct / severity_total if severity_total > 0 else 0.0
        )

        # Composite score — weighted
        overall = (
            0.60 * detection_rate
            + 0.20 * (1.0 - fp_rate)
            + 0.10 * severity_accuracy
            + 0.10 * min(1.0, 10.0 / max(response_time, 0.1))  # speed bonus
        )

        result = BenchmarkResult(
            challenge_id=challenge_id,
            miner_id=miner_id,
            detection_rate=detection_rate,
            false_positive_rate=fp_rate,
            severity_accuracy=severity_accuracy,
            overall_score=overall,
            found_bugs=list(found),
            missed_bugs=missed,
            false_positives=false_positives,
            response_time=response_time,
        )

        # Store result
        if miner_id not in self._results:
            self._results[miner_id] = []
        self._results[miner_id].append(result)

        logger.info(
            "Benchmark scored: miner=%s, challenge=%s, detect=%.0f%%, score=%.4f",
            miner_id, challenge_id, detection_rate * 100, overall,
        )

        return result

    def get_miner_benchmark_history(
        self,
        miner_id: str,
    ) -> List[BenchmarkResult]:
        """Get all benchmark results for a miner."""
        return self._results.get(miner_id, [])

    def get_miner_benchmark_score(
        self,
        miner_id: str,
    ) -> float:
        """Get average benchmark score for a miner."""
        results = self._results.get(miner_id, [])
        if not results:
            return 0.0
        return sum(r.overall_score for r in results) / len(results)

    def get_stats(self) -> Dict[str, Any]:
        """Get benchmark pool statistics."""
        total_results = sum(len(v) for v in self._results.values())
        avg_detection = 0.0
        if total_results > 0:
            all_rates = [
                r.detection_rate
                for results in self._results.values()
                for r in results
            ]
            avg_detection = sum(all_rates) / len(all_rates)

        return {
            "total_challenges": len(self._challenges),
            "total_injections": self._injection_count,
            "miners_tested": len(self._results),
            "total_results": total_results,
            "avg_detection_rate": round(avg_detection, 4),
            "challenges": [
                {
                    "id": c.challenge_id,
                    "difficulty": c.difficulty,
                    "num_bugs": len(c.vulnerabilities),
                }
                for c in self._challenges.values()
            ],
        }

    # -------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------

    @staticmethod
    def _extract_bugs_from_output(output: Dict[str, Any]) -> List[str]:
        """
        Extract vulnerability names from miner output.
        Supports multiple output formats.
        """
        bugs: List[str] = []

        # Format 1: {"vulnerabilities": [{"name": "...", ...}, ...]}
        vulns = output.get("vulnerabilities", [])
        if isinstance(vulns, list):
            for v in vulns:
                if isinstance(v, dict):
                    name = v.get("name", v.get("type", v.get("title", "")))
                    if name:
                        bugs.append(str(name).lower().strip())
                elif isinstance(v, str):
                    bugs.append(v.lower().strip())

        # Format 2: {"issues": [...]}
        issues = output.get("issues", [])
        if isinstance(issues, list):
            for i in issues:
                if isinstance(i, dict):
                    name = i.get("name", i.get("type", ""))
                    if name:
                        bugs.append(str(name).lower().strip())

        # Format 3: {"findings": [...]}
        findings = output.get("findings", [])
        if isinstance(findings, list):
            for f in findings:
                if isinstance(f, dict):
                    name = f.get("name", f.get("type", ""))
                    if name:
                        bugs.append(str(name).lower().strip())

        # Format 4: flat string analysis
        analysis = output.get("analysis", "")
        if isinstance(analysis, str) and not bugs:
            text = analysis.lower()
            keywords = [
                "reentrancy", "overflow", "underflow", "access control",
                "selfdestruct", "self-destruct", "withdrawal",
                "integer overflow", "missing access",
                "unprotected", "balance manipulation",
            ]
            for kw in keywords:
                if kw in text:
                    bugs.append(kw)

        return bugs

    @staticmethod
    def _extract_severities(output: Dict[str, Any]) -> Dict[str, str]:
        """Extract severity classifications from output."""
        severities: Dict[str, str] = {}
        for key in ("vulnerabilities", "issues", "findings"):
            items = output.get(key, [])
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        name = item.get("name", item.get("type", "")).lower().strip()
                        sev = item.get("severity", "").lower().strip()
                        if name and sev:
                            severities[name] = sev
        return severities

    @staticmethod
    def _fuzzy_match(claimed: str, expected: Set[str]) -> Optional[str]:
        """
        Fuzzy match a claimed bug name against expected bugs.
        Returns the matched expected bug name, or None.
        """
        claimed_lower = claimed.lower().strip()

        # Exact match
        if claimed_lower in expected:
            return claimed_lower

        # Partial match (1 is substring of the other)
        for exp in expected:
            if exp in claimed_lower or claimed_lower in exp:
                return exp

        # Keyword overlap
        claimed_words = set(claimed_lower.split())
        for exp in expected:
            exp_words = set(exp.split())
            if claimed_words & exp_words:
                return exp

        return None
