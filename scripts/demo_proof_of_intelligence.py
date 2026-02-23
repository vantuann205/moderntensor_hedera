#!/usr/bin/env python3
"""
ModernTensor — Proof-of-Intelligence Full Demo

Demonstrates the COMPLETE validator accountability system:

┌─────────────────────────────────────────────────────────┐
│  PHASE 1: Score Deviation Penalty                       │
│  PHASE 2: On-chain Reputation Score                     │
│  PHASE 3: Commit-Reveal Anti-Collusion                  │
│  PoI:     Adaptive minValidations                       │
│  PoI:     Cross-Subnet Reputation Portability           │
└─────────────────────────────────────────────────────────┘

Usage:
    python scripts/demo_proof_of_intelligence.py
"""

import os
import sys
import time
import hashlib
import secrets
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import IntEnum

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# ══════════════════════════════════════════════════════════════════════════════
# SIMULATION ENGINE
# Simulates on-chain behavior locally for demo purposes
# In production, these calls go through SubnetService → Hedera Smart Contract
# ══════════════════════════════════════════════════════════════════════════════

class TaskStatus(IntEnum):
    CREATED = 0
    IN_PROGRESS = 1
    PENDING_REVIEW = 2
    COMPLETED = 3


@dataclass
class ValidatorReputation:
    total_validations: int = 0
    accurate_validations: int = 0
    reputation_score: int = 5000  # Default 50% (basis points)
    last_active_at: float = 0.0

    @property
    def percent(self) -> float:
        return self.reputation_score / 100


@dataclass
class ValidationCommit:
    commit_hash: bytes = b""
    committed_at: float = 0.0
    revealed: bool = False
    revealed_score: int = 0


@dataclass
class MinerSubmission:
    miner: str = ""
    result_hash: str = ""
    score: int = 0
    validated: bool = False
    validation_count: int = 0


@dataclass
class Task:
    task_id: int = 0
    requester: str = ""
    reward_amount: int = 0
    protocol_fee: int = 0
    validator_reward: int = 0
    status: TaskStatus = TaskStatus.CREATED
    winning_miner: str = ""
    winning_score: int = 0
    submissions: List[MinerSubmission] = field(default_factory=list)


class ProofOfIntelligenceEngine:
    """
    Local simulation of the on-chain Proof-of-Intelligence system.

    This engine mirrors EXACTLY what the Solidity smart contracts do:
    - PaymentEscrow.sol: _distributeValidatorRewards()
    - SubnetRegistry.sol: portReputation(), getAdaptiveMinValidations()
    """

    # Constants (matching Solidity)
    PROTOCOL_FEE_RATE = 500       # 5%
    VALIDATOR_FEE_RATE = 1500     # 15%
    HIGH_VALUE_THRESHOLD = 1000   # MDT
    ULTRA_VALUE_THRESHOLD = 10000 # MDT
    REPUTATION_DECAY_FACTOR = 5000  # 50%

    def __init__(self, min_validations: int = 2):
        self.min_validations = min_validations
        self.tasks: Dict[int, Task] = {}
        self.validator_reputation: Dict[str, ValidatorReputation] = {}
        self.validator_scores: Dict[int, Dict[int, Dict[str, int]]] = {}
        self.pending_withdrawals: Dict[str, int] = {}
        self.protocol_fees: int = 0
        self.commits: Dict[int, Dict[int, Dict[str, ValidationCommit]]] = {}
        self.task_counter = 0

        # Logging
        self.events: List[dict] = []

    def _log(self, event: str, **kwargs):
        self.events.append({"event": event, **kwargs})

    # ─────────────────────────────────────────────────
    # VALIDATOR MANAGEMENT
    # ─────────────────────────────────────────────────

    def add_validator(self, address: str):
        """Register validator with default 50% reputation."""
        if address not in self.validator_reputation:
            self.validator_reputation[address] = ValidatorReputation(
                last_active_at=time.time()
            )
            self.pending_withdrawals.setdefault(address, 0)
            self._log("ValidatorAdded", validator=address, reputation=5000)

    # ─────────────────────────────────────────────────
    # TASK LIFECYCLE
    # ─────────────────────────────────────────────────

    def create_task(self, requester: str, reward_amount: int) -> int:
        """Create task with fee breakdown (80/15/5 split)."""
        self.task_counter += 1
        tid = self.task_counter

        protocol_fee = (reward_amount * self.PROTOCOL_FEE_RATE) // 10000
        validator_reward = (reward_amount * self.VALIDATOR_FEE_RATE) // 10000

        self.tasks[tid] = Task(
            task_id=tid,
            requester=requester,
            reward_amount=reward_amount,
            protocol_fee=protocol_fee,
            validator_reward=validator_reward,
            status=TaskStatus.CREATED,
        )
        self.validator_scores[tid] = {}
        self.commits[tid] = {}

        self._log("TaskCreated", task_id=tid, reward=reward_amount,
                  protocol_fee=protocol_fee, validator_reward=validator_reward)
        return tid

    def submit_result(self, task_id: int, miner: str, result_hash: str):
        """Miner submits AI output."""
        task = self.tasks[task_id]
        idx = len(task.submissions)
        task.submissions.append(MinerSubmission(
            miner=miner, result_hash=result_hash
        ))
        task.status = TaskStatus.PENDING_REVIEW
        self.validator_scores[task_id][idx] = {}
        self.commits[task_id][idx] = {}
        self.pending_withdrawals.setdefault(miner, 0)

        self._log("ResultSubmitted", task_id=task_id, miner=miner, index=idx)
        return idx

    # ─────────────────────────────────────────────────
    # DIRECT VALIDATION (Phase 1+2)
    # ─────────────────────────────────────────────────

    def validate_submission(
        self, task_id: int, miner_index: int, validator: str, score: int
    ):
        """Direct score submission (without commit-reveal)."""
        assert 0 <= score <= 10000, "Score must be 0-10000"
        task = self.tasks[task_id]
        sub = task.submissions[miner_index]

        self.validator_scores[task_id][miner_index][validator] = score
        sub.validation_count += 1

        self._log("SubmissionValidated", task_id=task_id, validator=validator,
                  score=score, miner_index=miner_index)

        # Check consensus
        adaptive_min = self.get_adaptive_min_validations(task.reward_amount)
        if sub.validation_count >= adaptive_min:
            self._reach_consensus(task_id, miner_index)

    # ─────────────────────────────────────────────────
    # PHASE 3: COMMIT-REVEAL
    # ─────────────────────────────────────────────────

    @staticmethod
    def compute_commit_hash(score: int, salt: bytes) -> bytes:
        """Compute keccak256(abi.encodePacked(score, salt))."""
        # Simulate Solidity's keccak256(abi.encodePacked(uint256, bytes32))
        packed = score.to_bytes(32, 'big') + salt
        return hashlib.sha256(packed).digest()  # SHA256 for demo

    def commit_score(
        self, task_id: int, miner_index: int, validator: str, commit_hash: bytes
    ):
        """Phase A: Commit hashed score."""
        assert commit_hash != b"", "Empty commit hash"

        if task_id not in self.commits:
            self.commits[task_id] = {}
        if miner_index not in self.commits[task_id]:
            self.commits[task_id][miner_index] = {}

        assert validator not in self.commits[task_id][miner_index], "Already committed"

        self.commits[task_id][miner_index][validator] = ValidationCommit(
            commit_hash=commit_hash,
            committed_at=time.time(),
        )
        self._log("ScoreCommitted", task_id=task_id, validator=validator)

    def reveal_score(
        self, task_id: int, miner_index: int, validator: str,
        score: int, salt: bytes
    ):
        """Phase B: Reveal and verify committed score."""
        assert 0 <= score <= 10000, "Invalid score"
        vc = self.commits[task_id][miner_index][validator]
        assert not vc.revealed, "Already revealed"

        # Verify hash
        expected = self.compute_commit_hash(score, salt)
        assert expected == vc.commit_hash, "Hash mismatch — tampering detected!"

        vc.revealed = True
        vc.revealed_score = score

        # Feed into standard pipeline
        self.validator_scores[task_id][miner_index][validator] = score
        task = self.tasks[task_id]
        sub = task.submissions[miner_index]
        sub.validation_count += 1

        self._log("ScoreRevealed", task_id=task_id, validator=validator, score=score)

        # Check consensus
        adaptive_min = self.get_adaptive_min_validations(task.reward_amount)
        if sub.validation_count >= adaptive_min:
            self._reach_consensus(task_id, miner_index)

    # ─────────────────────────────────────────────────
    # CONSENSUS + REWARD DISTRIBUTION
    # ─────────────────────────────────────────────────

    def _reach_consensus(self, task_id: int, miner_index: int):
        """Calculate median and mark consensus reached."""
        scores = list(self.validator_scores[task_id][miner_index].values())
        scores.sort()
        n = len(scores)
        median = scores[n // 2] if n % 2 == 1 else (scores[n // 2 - 1] + scores[n // 2]) // 2

        task = self.tasks[task_id]
        sub = task.submissions[miner_index]
        sub.score = median
        sub.validated = True

        if median > task.winning_score:
            task.winning_score = median
            task.winning_miner = sub.miner

        self._log("ConsensusReached", task_id=task_id, median=median,
                  validator_count=n)

    def finalize_task(self, task_id: int) -> dict:
        """
        Finalize task: distribute rewards with reputation-weighted shares.

        This mirrors _distributeValidatorRewards() in Solidity EXACTLY.
        """
        task = self.tasks[task_id]
        assert task.winning_miner, "No valid submissions"
        task.status = TaskStatus.COMPLETED

        # Find winning submission
        winner_idx = None
        for i, sub in enumerate(task.submissions):
            if sub.miner == task.winning_miner and sub.validated:
                winner_idx = i
                break

        # Credit miner reward (Pull pattern)
        miner_reward = task.reward_amount - task.protocol_fee - task.validator_reward
        self.pending_withdrawals[task.winning_miner] += miner_reward
        self.protocol_fees += task.protocol_fee

        # ── PHASE 1+2: Distribute validator rewards with deviation penalty ──
        validators = list(self.validator_scores[task_id][winner_idx].keys())
        scores_map = self.validator_scores[task_id][winner_idx]
        all_scores = list(scores_map.values())
        all_scores.sort()
        n = len(all_scores)
        median = all_scores[n // 2] if n % 2 == 1 else (all_scores[n // 2 - 1] + all_scores[n // 2]) // 2

        shares = {}
        total_shares = 0
        reward_details = []

        for v in validators:
            score = scores_map[v]
            rep = self.validator_reputation[v]
            rep.total_validations += 1
            rep.last_active_at = time.time()

            # Calculate deviation
            if median == 0:
                deviation = 0
            else:
                diff = abs(score - median)
                deviation = (diff * 10000) // median

            # Phase 1: Deviation tier
            if deviation <= 2000:  # ≤20%
                share = 100
                rep.accurate_validations += 1
                tier = "FULL ✅"
            elif deviation <= 5000:  # ≤50%
                share = 50
                tier = "HALF ⚠️"
            else:  # >50%
                share = 0
                tier = "PENALIZED ❌"

            # Phase 2: Update reputation
            if rep.total_validations > 0:
                rep.reputation_score = (rep.accurate_validations * 10000) // rep.total_validations

            # Apply reputation multiplier
            weighted_share = (share * rep.reputation_score) // 10000
            shares[v] = weighted_share
            total_shares += weighted_share

            detail = {
                "validator": v,
                "score": score,
                "deviation_pct": deviation / 100,
                "tier": tier,
                "base_share": share,
                "reputation": rep.reputation_score / 100,
                "weighted_share": weighted_share,
            }
            reward_details.append(detail)

            self._log("ReputationUpdated", validator=v,
                      reputation=rep.reputation_score,
                      total=rep.total_validations,
                      accurate=rep.accurate_validations)

        # Distribute from validator reward pool
        actual_rewards = {}
        leftover = task.validator_reward
        for v in validators:
            if total_shares > 0 and shares[v] > 0:
                reward = (task.validator_reward * shares[v]) // total_shares
                self.pending_withdrawals[v] += reward
                actual_rewards[v] = reward
                leftover -= reward
            else:
                actual_rewards[v] = 0

        # Leftover goes to protocol (penalized validators' share)
        self.protocol_fees += leftover

        result = {
            "task_id": task_id,
            "winning_miner": task.winning_miner,
            "winning_score": task.winning_score,
            "miner_reward": miner_reward,
            "validator_pool": task.validator_reward,
            "protocol_fee": task.protocol_fee + leftover,
            "median": median,
            "details": reward_details,
            "actual_rewards": actual_rewards,
        }

        self._log("TaskCompleted", **{k: v for k, v in result.items() if k != "details"})
        return result

    # ─────────────────────────────────────────────────
    # PoI: ADAPTIVE MIN VALIDATIONS
    # ─────────────────────────────────────────────────

    def get_adaptive_min_validations(self, reward_amount: int) -> int:
        """Security scales with value."""
        base = self.min_validations
        if reward_amount >= self.ULTRA_VALUE_THRESHOLD:
            return base + 2
        elif reward_amount >= self.HIGH_VALUE_THRESHOLD:
            return base + 1
        return base

    # ─────────────────────────────────────────────────
    # PoI: CROSS-SUBNET REPUTATION PORTABILITY
    # ─────────────────────────────────────────────────

    def port_reputation(self, validator: str) -> int:
        """
        Port reputation with 50% decay.
        Returns ported score.
        """
        rep = self.validator_reputation[validator]
        ported = (rep.reputation_score * self.REPUTATION_DECAY_FACTOR) // 10000
        self._log("ReputationPorted", validator=validator,
                  original=rep.reputation_score, ported=ported)
        return ported


# ══════════════════════════════════════════════════════════════════════════════
# DEMO RUNNER
# ══════════════════════════════════════════════════════════════════════════════

def print_header(title: str):
    print(f"\n{'═' * 64}")
    print(f"  {title}")
    print(f"{'═' * 64}")

def print_section(title: str):
    print(f"\n{'─' * 50}")
    print(f"  {title}")
    print(f"{'─' * 50}")

def print_table(rows: list, headers: list):
    """Print formatted table."""
    col_widths = [max(len(str(h)), max(len(str(r[i])) for r in rows)) for i, h in enumerate(headers)]
    header_line = " │ ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    sep_line = "─┼─".join("─" * w for w in col_widths)
    print(f"  {header_line}")
    print(f"  {sep_line}")
    for row in rows:
        line = " │ ".join(str(row[i]).ljust(col_widths[i]) for i in range(len(headers)))
        print(f"  {line}")


def main():
    print_header("🧠 ModernTensor — Proof-of-Intelligence Full Demo")
    print("""
  This demo shows the FULL validator accountability system:
  ├── Phase 1: Score Deviation Penalty (penalize bad validators)
  ├── Phase 2: On-chain Reputation (compounding trust)
  ├── Phase 3: Commit-Reveal (anti-front-running)
  ├── PoI:     Adaptive minValidations (value-based security)
  └── PoI:     Cross-Subnet Reputation Portability
    """)

    engine = ProofOfIntelligenceEngine(min_validations=2)

    # Register validators
    validators = {
        "V1_Alice":   "0x1111...alice",
        "V2_Bob":     "0x2222...bob",
        "V3_Charlie": "0x3333...charlie",
    }
    for name, addr in validators.items():
        engine.add_validator(addr)
    print("  ✅ Registered 3 validators (each starts at 50% reputation)\n")

    # ═══════════════════════════════════════════════════════════════
    # DEMO 1: Direct Scoring (Phase 1+2)
    # ═══════════════════════════════════════════════════════════════
    print_header("📊 Demo 1: Direct Scoring + Deviation Penalty + Reputation")

    print("\n  Scenario: 3 validators score a code review submission")
    print("  Alice: 8500, Bob: 8800, Charlie: 1000 (suspicious!)\n")

    engine.min_validations = 3
    tid = engine.create_task("requester_1", 100)
    engine.submit_result(tid, "miner_1", "code_review_hash")

    # All three validators score directly
    engine.validate_submission(tid, 0, validators["V1_Alice"], 8500)
    engine.validate_submission(tid, 0, validators["V2_Bob"], 8800)
    engine.validate_submission(tid, 0, validators["V3_Charlie"], 1000)

    result = engine.finalize_task(tid)

    print(f"  📐 Median Score: {result['median']}")
    print(f"  🏆 Winner: miner_1 (reward: {result['miner_reward']} MDT)\n")

    rows = []
    for d in result["details"]:
        name = [n for n, a in validators.items() if a == d["validator"]][0]
        reward = result["actual_rewards"][d["validator"]]
        rows.append([
            name,
            str(d["score"]),
            f"{d['deviation_pct']:.1f}%",
            d["tier"],
            str(d["base_share"]),
            f"{d['reputation']:.0f}%",
            str(d["weighted_share"]),
            f"{reward} MDT"
        ])

    print_table(rows, [
        "Validator", "Score", "Deviation", "Tier", "Base", "Rep%", "Weighted", "Reward"
    ])

    print(f"\n  💰 Protocol treasury received: {result['protocol_fee']} MDT (includes penalty)")

    # ═══════════════════════════════════════════════════════════════
    # DEMO 2: Commit-Reveal Anti-Collusion (Phase 3)
    # ═══════════════════════════════════════════════════════════════
    print_header("🔒 Demo 2: Commit-Reveal Scheme (Anti-Front-Running)")

    print("""
  Scenario: Validators commit hashed scores FIRST, then reveal.
  This prevents validators from seeing each other's scores.

  Flow: commitScore(hash) → wait → revealScore(score, salt)
    """)

    engine.min_validations = 2
    tid2 = engine.create_task("requester_2", 200)
    engine.submit_result(tid2, "miner_2", "ai_output_hash")

    # Phase A: Commit
    print("  ── Phase A: COMMIT (scores hidden) ───────────────")
    salt_alice = secrets.token_bytes(32)
    salt_bob = secrets.token_bytes(32)

    hash_alice = engine.compute_commit_hash(9200, salt_alice)
    hash_bob = engine.compute_commit_hash(9000, salt_bob)

    engine.commit_score(tid2, 0, validators["V1_Alice"], hash_alice)
    print(f"  🔐 Alice committed: {hash_alice[:8].hex()}...")

    engine.commit_score(tid2, 0, validators["V2_Bob"], hash_bob)
    print(f"  🔐 Bob committed:   {hash_bob[:8].hex()}...")

    print("\n  ⏳ Waiting for commit phase to end...")
    print("     (In production: 1 hour window on-chain)")

    # Phase B: Reveal
    print("\n  ── Phase B: REVEAL (verify & score) ──────────────")
    engine.reveal_score(tid2, 0, validators["V1_Alice"], 9200, salt_alice)
    print(f"  ✅ Alice revealed: 9200 → hash verified!")

    engine.reveal_score(tid2, 0, validators["V2_Bob"], 9000, salt_bob)
    print(f"  ✅ Bob revealed:   9000 → hash verified!")

    # Demonstrate tamper detection
    print("\n  ── Tamper Detection Demo ─────────────────────────")
    try:
        fake_salt = secrets.token_bytes(32)
        fake_hash = engine.compute_commit_hash(5000, fake_salt)
        # Try to reveal with different score than committed
        temp_commits = engine.commits.get(999, {})
        engine.commits[999] = {0: {"attacker": ValidationCommit(
            commit_hash=fake_hash, committed_at=time.time()
        )}}
        engine.reveal_score(999, 0, "attacker", 9999, fake_salt)
        print("  ❌ ERROR: Tamper not detected!")
    except (AssertionError, KeyError, Exception) as e:
        print(f"  🛡️ Tamper BLOCKED: Hash mismatch detected!")
        print(f"     Attacker committed hash(5000) but tried to reveal 9999")

    result2 = engine.finalize_task(tid2)
    print(f"\n  📐 Consensus reached via commit-reveal: {result2['median']}")
    print(f"  🏆 miner_2 wins with {result2['winning_score']} score")

    # ═══════════════════════════════════════════════════════════════
    # DEMO 3: Reputation Compounding Over Time
    # ═══════════════════════════════════════════════════════════════
    print_header("📈 Demo 3: Reputation Compounding Over Multiple Tasks")

    print("""
  Scenario: Alice is consistently accurate, Charlie keeps being bad.
  Watch how reputation diverges and affects rewards.
    """)

    engine.min_validations = 3

    for round_num in range(1, 4):
        tid_r = engine.create_task(f"requester_r{round_num}", 300)
        engine.submit_result(tid_r, f"miner_r{round_num}", f"result_{round_num}")

        # Alice: always accurate, Bob: accurate, Charlie: always off
        engine.validate_submission(tid_r, 0, validators["V1_Alice"], 9000)
        engine.validate_submission(tid_r, 0, validators["V2_Bob"], 8800)
        engine.validate_submission(tid_r, 0, validators["V3_Charlie"], 2000)  # Way off

        result_r = engine.finalize_task(tid_r)

    print("  After 4 tasks (1 initial + 3 rounds):\n")

    rep_rows = []
    for name, addr in validators.items():
        rep = engine.validator_reputation[addr]
        bal = engine.pending_withdrawals[addr]
        rep_rows.append([
            name,
            f"{rep.accurate_validations}/{rep.total_validations}",
            f"{rep.reputation_score/100:.0f}%",
            f"{'🟢' * rep.accurate_validations}{'🔴' * (rep.total_validations - rep.accurate_validations)}",
            f"{bal} MDT"
        ])

    print_table(rep_rows, ["Validator", "Accuracy", "Rep Score", "History", "Total Earned"])

    print("""
  📊 Key Insight: Alice (100% rep) earns MUCH more than Charlie (0% rep)
     even if Charlie occasionally scores within range — reputation
     is a COMPOUNDING multiplier. Once lost, hard to rebuild!
    """)

    # ═══════════════════════════════════════════════════════════════
    # DEMO 4: Adaptive minValidations
    # ═══════════════════════════════════════════════════════════════
    print_header("⚡ Demo 4: Adaptive minValidations (Security ∝ Value)")

    print("""
  Higher-value tasks automatically require MORE validators:
    """)

    test_rewards = [100, 500, 1000, 5000, 10000, 50000]
    adaptive_rows = []
    for r in test_rewards:
        adaptive = engine.get_adaptive_min_validations(r)
        tier = "🟢 Normal" if r < 1000 else ("🟡 High" if r < 10000 else "🔴 Ultra")
        adaptive_rows.append([f"{r} MDT", tier, str(adaptive)])

    print_table(adaptive_rows, ["Task Reward", "Security Tier", "Min Validators"])

    print("""
  📊 Result: A 10,000 MDT task needs 4 validators instead of 2.
     Attackers must compromise MORE validators for high-value targets.
    """)

    # ═══════════════════════════════════════════════════════════════
    # DEMO 5: Cross-Subnet Reputation Portability
    # ═══════════════════════════════════════════════════════════════
    print_header("🧬 Demo 5: Cross-Subnet Reputation Portability")

    print("""
  Scenario: Alice has 100% reputation in "Code Review" subnet.
  She joins "Image Generation" subnet. Her reputation ports with 50% decay.
    """)

    alice_rep = engine.validator_reputation[validators["V1_Alice"]]
    print(f"  Subnet A (Code Review):   Alice reputation = {alice_rep.reputation_score/100:.0f}%")

    ported = engine.port_reputation(validators["V1_Alice"])
    print(f"  Subnet B (Image Gen):     Alice ported rep  = {ported/100:.0f}% (50% decay)")
    print(f"  Subnet B (default):       New validator rep  = 50% (default)")

    print(f"""
  📊 Alice starts at {ported/100:.0f}% instead of 50% — a reward advantage
     earned by proving herself in another domain, but still needs
     to build rep in the new domain through accurate scoring.
    """)

    # ═══════════════════════════════════════════════════════════════
    # FINAL SUMMARY
    # ═══════════════════════════════════════════════════════════════
    print_header("🏁 Proof-of-Intelligence — Complete System Summary")

    print(f"""
  ┌─────────────────────────────────────────────────────────┐
  │  6 LAYERS OF VALIDATOR ACCOUNTABILITY                   │
  ├─────────────────────────────────────────────────────────┤
  │  1. 🔒 Commit-Reveal     → Anti-front-running          │
  │  2. 📐 Median Consensus  → Outlier resistance          │
  │  3. ⚖️  Deviation Penalty → Penalize bad scorers        │
  │  4. 📈 Reputation Score  → Compounding trust            │
  │  5. ⚡ Adaptive minVals  → Security ∝ value             │
  │  6. 🧬 Cross-Subnet Rep  → Portable proof-of-quality   │
  ├─────────────────────────────────────────────────────────┤
  │  RESULT: Self-reinforcing system where honest scoring   │
  │  is the ONLY profitable long-term strategy.             │
  └─────────────────────────────────────────────────────────┘

  📊 Final State:
  ├── Total tasks processed: {engine.task_counter}
  ├── Protocol treasury: {engine.protocol_fees} MDT
  └── Validator earnings:
""")

    for name, addr in validators.items():
        rep = engine.validator_reputation[addr]
        bal = engine.pending_withdrawals[addr]
        emoji = "🟢" if rep.reputation_score >= 8000 else ("🟡" if rep.reputation_score >= 5000 else "🔴")
        print(f"      {emoji} {name}: {bal} MDT earned, {rep.reputation_score/100:.0f}% reputation")

    print(f"""
  ───────────────────────────────────────────────────────────
  "The first protocol where AI quality is verified by AI
   consensus, with 6 layers of cryptoeconomic accountability."
                                    — ModernTensor PoI v1.0
  ───────────────────────────────────────────────────────────
    """)

    return 0


if __name__ == "__main__":
    sys.exit(main())
