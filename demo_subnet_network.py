#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
  ModernTensor Subnet Demo — Full Networking Flow
═══════════════════════════════════════════════════════════════════

Demonstrates the complete subnet lifecycle WITH real HTTP networking:

  1. Start 3 miner Axon servers (different ports)
  2. Register validator (50K MDT stake)
  3. Validator sends code_review task to all miners via Dendrite
  4. Miners process task and return results via Axon
  5. Validator scores results + runs consensus
  6. Weight calculation (merit-based for miners)
  7. Epoch advancement with validator weights

Usage:
    python demo_subnet_network.py

For ModernTensor on Hedera — Hello Future Hackathon 2026
═══════════════════════════════════════════════════════════════════
"""

import sys
import os
import time
import random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sdk.protocol.axon import Axon
from sdk.protocol.dendrite import Dendrite
from sdk.scoring.weights import WeightCalculator
from sdk.scoring.consensus import ScoreConsensus

# ── Terminal colors ──
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

CHECK = f"{GREEN}✓{RESET}"
CROSS = f"{RED}✗{RESET}"
ARROW = f"{CYAN}→{RESET}"


def header(title, emoji=""):
    print(f"\n{'═' * 60}")
    print(f"  {emoji}  {BOLD}{title}{RESET}")
    print(f"{'═' * 60}")


def subheader(title):
    print(f"\n  {CYAN}── {title} ──{RESET}")


# ──────────────────────────────────────────────────────────────
# Miner AI Handlers (each miner has different skill level)
# ──────────────────────────────────────────────────────────────

def make_handler(skill: float, name: str):
    """Create a handler with a specific skill level."""
    def handler(payload, task_type):
        code = payload.get("code", "")
        # Simulate varying quality based on skill
        base_score = skill + random.uniform(-0.05, 0.05)
        findings_count = max(1, int(skill * 5))
        return {
            "analysis": f"[{name}] Reviewed {len(code)} chars of code. "
                        f"Found {findings_count} issues.",
            "findings": [
                {"severity": "warning" if i == 0 else "info",
                 "message": f"Finding #{i+1} from {name}"}
                for i in range(findings_count)
            ],
            "score": round(min(1.0, max(0.0, base_score)), 3),
            "confidence": round(0.7 + skill * 0.25, 2),
        }
    return handler


def main():
    header("ModernTensor Subnet Demo — Full Networking", "🌐")

    # ══════════════════════════════════════════════════════════
    # PHASE 1: Start Miner Axon Servers
    # ══════════════════════════════════════════════════════════
    header("Phase 1: Start Miner Axon Servers", "⛏️")

    miners_config = [
        {"id": "0.0.1001", "port": 19001, "skill": 0.90, "name": "AlphaAI"},
        {"id": "0.0.1002", "port": 19002, "skill": 0.75, "name": "BetaML"},
        {"id": "0.0.1003", "port": 19003, "skill": 0.55, "name": "GammaBot"},
    ]

    axons = []
    for cfg in miners_config:
        handler = make_handler(cfg["skill"], cfg["name"])
        axon = Axon(
            miner_id=cfg["id"],
            handler=handler,
            port=cfg["port"],
            subnet_ids=[1],
            capabilities=["code_review"],
        )
        axon.start()
        axons.append(axon)
        print(f"  {CHECK} Miner {cfg['name']} ({cfg['id']}) → {axon.endpoint}")

    # Wait for servers to be ready
    time.sleep(0.5)
    print(f"\n  {CHECK} All 3 miners online with Axon HTTP servers")

    # ══════════════════════════════════════════════════════════
    # PHASE 2: Validator Setup (Dendrite + 50K Stake)
    # ══════════════════════════════════════════════════════════
    header("Phase 2: Validator Setup", "⚖️")

    VALIDATOR_ID = "0.0.9001"
    VALIDATOR_STAKE = 75_000.0  # Above 50K minimum

    dendrite = Dendrite(validator_id=VALIDATOR_ID, timeout=10.0)
    weight_calc = WeightCalculator(min_stake=100.0, weight_cap=0.5)
    consensus = ScoreConsensus()

    print(f"  {CHECK} Validator {VALIDATOR_ID} initialized")
    print(f"  {CHECK} Stake: {VALIDATOR_STAKE:,.0f} MDT (min: 50,000)")
    print(f"  {CHECK} Dendrite client ready")

    # ══════════════════════════════════════════════════════════
    # PHASE 3: Health Check — Ping All Miners
    # ══════════════════════════════════════════════════════════
    header("Phase 3: Health Check Miners", "💓")

    miner_endpoints = []
    for cfg in miners_config:
        ep = f"http://127.0.0.1:{cfg['port']}"
        is_alive = dendrite.check_health(ep)
        status = f"{CHECK} ONLINE" if is_alive else f"{CROSS} OFFLINE"
        print(f"  {cfg['name']:10s} ({ep}) {ARROW} {status}")
        if is_alive:
            miner_endpoints.append({
                "miner_id": cfg["id"],
                "endpoint": ep,
                "name": cfg["name"],
            })

    print(f"\n  {len(miner_endpoints)}/{len(miners_config)} miners reachable")

    # ══════════════════════════════════════════════════════════
    # PHASE 4: Send Code Review Task via Dendrite
    # ══════════════════════════════════════════════════════════
    header("Phase 4: Send Task via Dendrite → Axon", "📤")

    task_payload = {
        "code": """
def transfer_tokens(sender, receiver, amount):
    if amount <= 0:
        raise ValueError("Amount must be positive")
    balance = get_balance(sender)
    if balance < amount:
        raise InsufficientFunds(f"Balance {balance} < {amount}")
    debit(sender, amount)
    credit(receiver, amount)
    log_transfer(sender, receiver, amount)
    return True
        """.strip(),
        "language": "python",
        "context": "Smart contract token transfer function",
    }

    print(f"  Task: Code review of transfer_tokens()")
    print(f"  Type: code_review")
    print(f"  Code: {len(task_payload['code'])} chars")
    print(f"\n  Sending to {len(miner_endpoints)} miners...")

    results = dendrite.broadcast(
        miners=miner_endpoints,
        task_id="task-demo-001",
        task_type="code_review",
        payload=task_payload,
    )

    subheader("Results from miners")
    for r in results:
        name = next(
            (m["name"] for m in miner_endpoints if m["miner_id"] == r.miner_id),
            r.miner_id,
        )
        if r.success:
            output = r.output or {}
            print(f"  {CHECK} {name:10s} — score={output.get('score', '?')}, "
                  f"findings={len(output.get('findings', []))}, "
                  f"latency={r.latency:.3f}s")
        else:
            print(f"  {CROSS} {name:10s} — {r.error}")

    # ══════════════════════════════════════════════════════════
    # PHASE 5: Score Results + Consensus
    # ══════════════════════════════════════════════════════════
    header("Phase 5: Validator Scoring + Consensus", "🎯")

    successful = [r for r in results if r.success]
    scores = {}
    for r in successful:
        output = r.output or {}
        scores[r.miner_id] = output.get("score", 0.5)

    # Consensus
    consensus_result = consensus.aggregate(scores)

    print(f"  Individual scores:")
    for mid, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
        name = next(
            (m["name"] for m in miner_endpoints if m["miner_id"] == mid),
            mid,
        )
        bar_len = int(score * 30)
        bar = f"{'█' * bar_len}{'░' * (30 - bar_len)}"
        print(f"    {name:10s}  {bar}  {score:.3f}")

    print(f"\n  {BOLD}Consensus score: {consensus_result.consensus_score:.3f}{RESET}")
    print(f"  Agreement level: {consensus_result.agreement_level:.3f}")
    if consensus_result.outliers:
        print(f"  {YELLOW}Outliers: {consensus_result.outliers}{RESET}")

    # Winner
    winner_id = max(scores, key=scores.get) if scores else None
    winner_name = next(
        (m["name"] for m in miner_endpoints if m["miner_id"] == winner_id),
        winner_id,
    )
    print(f"\n  🏆 Winner: {GREEN}{winner_name}{RESET} (score={scores.get(winner_id, 0):.3f})")

    # ══════════════════════════════════════════════════════════
    # PHASE 6: Weight Calculation (Merit-Based)
    # ══════════════════════════════════════════════════════════
    header("Phase 6: Weight Recalculation (Merit-Based)", "⚖️")

    miner_data = []
    for cfg in miners_config:
        miner_data.append({
            "miner_id": cfg["id"],
            "reputation_score": scores.get(cfg["id"], 0.5),
            "stake_amount": random.choice([0, 100, 5000]),  # Stake varies
            "success_rate": 0.8 + cfg["skill"] * 0.15,
            "timeout_rate": max(0, 0.2 - cfg["skill"] * 0.2),
            "total_tasks": random.randint(10, 100),
        })

    weights = weight_calc.calculate(miner_data, epoch=1)

    print(f"  {BOLD}Miner Weights (stake does NOT affect!):{RESET}")
    for mid, w in weights.top_miners(10):
        cfg = next((c for c in miners_config if c["id"] == mid), {})
        name = cfg.get("name", mid)
        stake = next((m["stake_amount"] for m in miner_data if m["miner_id"] == mid), 0)
        bar_len = int(w * 60)
        bar = f"{'█' * bar_len}{'░' * (60 - bar_len)}"
        print(f"    {name:10s}  {bar}  w={w:.4f}  stake={stake}")

    print(f"\n  {DIM}Note: stake amount does NOT influence miner weight.{RESET}")
    print(f"  {DIM}Weight = performance² × reliability (merit-based){RESET}")

    # ══════════════════════════════════════════════════════════
    # PHASE 7: Validator Weights (Stake-Based)
    # ══════════════════════════════════════════════════════════
    header("Phase 7: Validator Weights (Stake-Based)", "🏛️")

    validators = [
        {"validator_id": "0.0.9001", "stake_amount": 75_000, "reliability_score": 0.95, "dishonesty_rate": 0.0},
        {"validator_id": "0.0.9002", "stake_amount": 50_000, "reliability_score": 0.90, "dishonesty_rate": 0.02},
        {"validator_id": "0.0.9003", "stake_amount": 200_000, "reliability_score": 0.98, "dishonesty_rate": 0.0},
    ]

    val_weights = weight_calc.calculate_validator_weights(validators, epoch=1)

    print(f"  {BOLD}Validator Weights (stake MATTERS!):{RESET}")
    for vid, w in val_weights.top_miners(10):
        stake = next((v["stake_amount"] for v in validators if v["validator_id"] == vid), 0)
        bar_len = int(w * 60)
        bar = f"{'█' * bar_len}{'░' * (60 - bar_len)}"
        print(f"    {vid}  {bar}  w={w:.4f}  stake={stake:,}")

    print(f"\n  {DIM}Validator weight = sqrt(stake/min) × reliability{RESET}")

    # ══════════════════════════════════════════════════════════
    # CLEANUP
    # ══════════════════════════════════════════════════════════
    header("Cleanup", "🧹")
    for axon in axons:
        axon.stop()
    print(f"  {CHECK} All Axon servers stopped")

    # ══════════════════════════════════════════════════════════
    # SUMMARY
    # ══════════════════════════════════════════════════════════
    header("Demo Complete!", "🎉")
    print(f"""
  Architecture demonstrated:
  ┌─────────────┐    Dendrite (HTTP)    ┌─────────────┐
  │  Validator   │ ──────────────────→ │  Miner Axon │
  │  (Dendrite)  │ ←────────────────── │  (HTTP srv) │
  └─────────────┘    JSON response     └─────────────┘

  Key principles:
    • Miner registration: {GREEN}just needs MDT tokens{RESET}
    • Miner weight:       {GREEN}performance × reliability (MERIT){RESET}
    • Validator register: {YELLOW}requires ≥ 50,000 MDT stake{RESET}
    • Validator weight:   {YELLOW}sqrt(stake) × reliability{RESET}
    • Task delivery:      {CYAN}Dendrite → Axon (real HTTP){RESET}
    • Scoring:            {CYAN}AI validation → consensus{RESET}
""")


if __name__ == "__main__":
    main()
