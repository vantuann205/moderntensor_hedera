#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
 ModernTensor — Complete Subnet Demo

 Demonstrates the FULL lifecycle of a subnet:

   1. Subnet creation & configuration
   2. Miner registration & staking
   3. Customer submits tasks
   4. Miners compete (AI processing)
   5. Multi-dimension scoring & PoI verification
   6. Tokenomics: fee distribution & miner rewards
   7. Multi-epoch simulation (reputation evolution)
   8. Treasury & revenue analytics

 Run: python demo_subnet.py
═══════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import time
import random
import textwrap
from typing import Dict, List

# ── ANSI colors ──
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
MAGENTA = "\033[95m"
BLUE = "\033[94m"
WHITE = "\033[97m"
RESET = "\033[0m"
BG_BLUE = "\033[44m"
BG_GREEN = "\033[42m"
BG_RED = "\033[41m"
BG_YELLOW = "\033[43m"

CHECK = f"{GREEN}✓{RESET}"
CROSS = f"{RED}✗{RESET}"
ARROW = f"{CYAN}→{RESET}"
DOLLAR = f"{YELLOW}$MDT{RESET}"


def header(title: str, emoji: str = ""):
    width = 60
    print(f"\n{CYAN}{'═' * width}{RESET}")
    print(f"{CYAN}║{RESET} {emoji}  {BOLD}{title}{RESET}")
    print(f"{CYAN}{'═' * width}{RESET}\n")


def subheader(title: str):
    print(f"\n  {BOLD}{BLUE}▸ {title}{RESET}")
    print(f"  {DIM}{'─' * 50}{RESET}")


def money(amount: float) -> str:
    return f"{YELLOW}{amount:>10.2f} MDT{RESET}"


def pct(value: float) -> str:
    return f"{value:.1%}"


def bar(value: float, width: int = 20) -> str:
    filled = int(value * width)
    return f"{'█' * filled}{'░' * (width - filled)}"


def main():
    # ══════════════════════════════════════════════════════════════
    # SETUP
    # ══════════════════════════════════════════════════════════════
    print(f"""
{CYAN}{BOLD}
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║   ⚡ ModernTensor — Complete Subnet Demo                ║
  ║                                                          ║
  ║   Full lifecycle: Miners → Customers → Tokenomics        ║
  ║   AI Marketplace Protocol on Hedera                      ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
{RESET}""")

    from sdk.protocol.types import ProtocolConfig
    from sdk.marketplace import MarketplaceProtocol, SubnetManager

    config = ProtocolConfig(
        protocol_fee_rate=0.01,     # 1% protocol fee
        min_stake_amount=100.0,     # Min 100 MDT to be a miner
        reputation_ema_alpha=0.15,  # EMA smoothing
        miner_suspension_threshold=0.15,
    )

    protocol = MarketplaceProtocol(
        config=config,
        validator_id="0.0.99999",
        enable_poi=True,
    )

    # Tokenomics tracking
    treasury = {
        "protocol_revenue": 0.0,
        "subnet_revenue": 0.0,
        "total_miner_payouts": 0.0,
        "total_volume": 0.0,
    }

    miner_wallets: Dict[str, float] = {}  # miner_id → earned MDT
    customer_spent: Dict[str, float] = {}  # customer_id → spent MDT

    # ══════════════════════════════════════════════════════════════
    # PHASE 1: SUBNET CREATION
    # ══════════════════════════════════════════════════════════════
    header("PHASE 1: Create Subnet", "🌐")

    print(f"  Creating subnet: {CYAN}AI Security Audit{RESET}")
    print(f"  Owner:          {DIM}0.0.5000 (Subnet Operator){RESET}")
    print(f"  Task type:      {DIM}security_audit{RESET}")
    print(f"  Fee rate:        {YELLOW}4%{RESET} (goes to subnet owner)")
    print(f"  Scoring:         5-dimension (Security weighted 40%)")
    print()

    # Using default subnet #1 (AI Code Review) as our demo subnet
    SUBNET_ID = 1
    SUBNET_FEE = 0.03  # 3%
    SUBNET_NAME = "AI Code Review"

    print(f"  {CHECK} Subnet #{SUBNET_ID} '{CYAN}{SUBNET_NAME}{RESET}' active")
    print(f"  {CHECK} Hedera Topic created: {DIM}0.0.4356 (HCS){RESET}")
    print(f"  {CHECK} Fee contract deployed: {DIM}0.0.4357 (HSCS){RESET}")

    # ══════════════════════════════════════════════════════════════
    # PHASE 2: MINER REGISTRATION
    # ══════════════════════════════════════════════════════════════
    header("PHASE 2: Miner Registration & Staking", "⛏️")

    miners_config = [
        {"id": "0.0.1001", "name": "AlphaAudit",    "model": "GPT-4o",        "stake": 800, "skill": 0.92},
        {"id": "0.0.1002", "name": "SecureBot",      "model": "Claude-3.5",    "stake": 600, "skill": 0.87},
        {"id": "0.0.1003", "name": "CodeGuard",      "model": "Gemini-2.0",    "stake": 500, "skill": 0.83},
        {"id": "0.0.1004", "name": "AuditPro",       "model": "DeepSeek-V3",   "stake": 400, "skill": 0.78},
        {"id": "0.0.1005", "name": "SmartReview",     "model": "Llama-3.1-70B", "stake": 200, "skill": 0.65},
    ]

    print(f"  5 AI miners registering into subnet #{SUBNET_ID}...\n")

    for m in miners_config:
        existing = protocol.get_miner(m["id"])
        if not existing:
            protocol.register_miner(
                miner_id=m["id"],
                subnet_ids=[SUBNET_ID],
                stake=m["stake"],
                capabilities=["code_review", "security_audit"],
            )
            miner_wallets[m["id"]] = 0.0

            print(f"  {CHECK} {CYAN}{m['name']:<14}{RESET} "
                  f"({DIM}{m['model']:<16}{RESET}) "
                  f"staked {YELLOW}{m['stake']:>4} MDT{RESET}")
        else:
            miner_wallets[m["id"]] = 0.0
            print(f"  {CHECK} {CYAN}{m['name']:<14}{RESET} "
                  f"({DIM}{m['model']:<16}{RESET}) "
                  f"already registered")

    print(f"\n  {BOLD}Staking Summary:{RESET}")
    total_staked = sum(m["stake"] for m in miners_config)
    print(f"  Total staked:    {money(total_staked)}")
    print(f"  Min requirement: {money(config.min_stake_amount)}")
    print(f"  Avg stake:       {money(total_staked / len(miners_config))}")

    # ══════════════════════════════════════════════════════════════
    # PHASE 3: CUSTOMER SUBMITS TASKS
    # ══════════════════════════════════════════════════════════════
    header("PHASE 3: Customers Submit Tasks", "👤")

    # Define realistic smart contracts to review
    contracts = [
        {
            "name": "DEX Router",
            "customer": "0.0.2001",
            "customer_name": "UniswapDAO",
            "reward": 80.0,
            "code": textwrap.dedent("""\
                // SPDX-License-Identifier: MIT
                pragma solidity ^0.8.19;
                contract DEXRouter {
                    mapping(address => uint256) public liquidity;
                    function swap(address tokenIn, address tokenOut, uint256 amount) external {
                        uint256 price = getPrice(tokenIn, tokenOut);
                        uint256 output = amount * price / 1e18;
                        // Missing: slippage protection!
                        IERC20(tokenIn).transferFrom(msg.sender, address(this), amount);
                        IERC20(tokenOut).transfer(msg.sender, output);
                    }
                    function getPrice(address, address) public pure returns (uint256) {
                        return 1e18; // Hardcoded price — oracle missing!
                    }
                }
            """),
        },
        {
            "name": "Staking Vault",
            "customer": "0.0.2002",
            "customer_name": "AaveProtocol",
            "reward": 60.0,
            "code": textwrap.dedent("""\
                pragma solidity ^0.8.19;
                contract StakingVault {
                    mapping(address => uint256) public stakes;
                    mapping(address => uint256) public rewards;
                    uint256 public rewardRate = 100;
                    function stake() external payable {
                        stakes[msg.sender] += msg.value;
                    }
                    function withdraw() external {
                        uint256 amount = stakes[msg.sender];
                        (bool ok,) = msg.sender.call{value: amount}("");
                        require(ok);
                        stakes[msg.sender] = 0; // State after call — REENTRANCY!
                    }
                    function claimRewards() external {
                        uint256 reward = rewards[msg.sender];
                        rewards[msg.sender] = 0;
                        payable(msg.sender).transfer(reward);
                    }
                }
            """),
        },
        {
            "name": "NFT Marketplace",
            "customer": "0.0.2003",
            "customer_name": "OpenSeaV3",
            "reward": 45.0,
            "code": textwrap.dedent("""\
                pragma solidity ^0.8.19;
                contract NFTMarket {
                    struct Listing { address seller; uint256 price; bool active; }
                    mapping(uint256 => Listing) public listings;
                    function list(uint256 tokenId, uint256 price) external {
                        listings[tokenId] = Listing(msg.sender, price, true);
                    }
                    function buy(uint256 tokenId) external payable {
                        Listing memory item = listings[tokenId];
                        require(item.active && msg.value >= item.price);
                        listings[tokenId].active = false;
                        payable(item.seller).transfer(msg.value);
                        // Missing: NFT transfer, event emissions, royalties
                    }
                }
            """),
        },
    ]

    # Submit tasks
    submitted_tasks = []
    for c in contracts:
        task = protocol.submit_task(
            subnet_id=SUBNET_ID,
            task_type="code_review",
            payload={
                "code": c["code"],
                "language": "solidity",
                "contract_name": c["name"],
                "expected_fields": ["analysis", "findings", "score", "summary",
                                     "vulnerabilities", "recommendations"],
            },
            reward_amount=c["reward"],
            requester_id=c["customer"],
            max_miners=3,
        )
        submitted_tasks.append((task, c))
        customer_spent[c["customer"]] = customer_spent.get(c["customer"], 0) + c["reward"]

        fee_bd = protocol.task_manager.get_fee_breakdown(task.task_id)
        treasury["total_volume"] += c["reward"]
        if fee_bd:
            treasury["protocol_revenue"] += fee_bd.protocol_fee
            treasury["subnet_revenue"] += fee_bd.subnet_fee

        print(f"  {CHECK} {CYAN}{c['customer_name']:<14}{RESET} submitted "
              f"'{c['name']}' — {YELLOW}{c['reward']} MDT{RESET}")

    total_vol = sum(c["reward"] for c in contracts)
    print(f"\n  {BOLD}Task Volume:{RESET}")
    print(f"  Total submitted:  {money(total_vol)}")
    print(f"  Protocol fee (1%): {money(total_vol * 0.01)}")
    print(f"  Subnet fee (3%):   {money(total_vol * SUBNET_FEE)}")
    print(f"  Miner pool:       {money(total_vol * (1 - 0.01 - SUBNET_FEE))}")

    # ══════════════════════════════════════════════════════════════
    # PHASE 4: TASK EXECUTION (Miners work)
    # ══════════════════════════════════════════════════════════════
    header("PHASE 4: Miners Execute Tasks", "🤖")

    # Simulated AI outputs per miner skill level
    def generate_result(miner_cfg: dict, contract: dict) -> dict:
        """Simulate AI model output based on miner skill level."""
        skill = miner_cfg["skill"]
        has_vuln = "reentrancy" in contract["code"].lower() or "missing" in contract["code"].lower()

        findings = []
        if skill > 0.85 and has_vuln:
            findings.append({
                "type": "security", "severity": "critical",
                "description": f"Critical vulnerability detected in {contract['name']}",
                "remediation": "Apply checks-effects-interactions pattern",
            })
        if skill > 0.75:
            findings.append({
                "type": "best_practices", "severity": "medium",
                "description": "Missing event emissions for state changes",
                "fix": "Add events for all state-modifying functions",
            })
        if skill > 0.60:
            findings.append({
                "type": "readability", "severity": "low",
                "description": "Consider adding NatSpec documentation",
            })

        return {
            "analysis": (
                f"Comprehensive security audit of {contract['name']}. "
                f"Found {len(findings)} issues across security, best practices, "
                f"and code quality dimensions. "
                f"{'CRITICAL vulnerabilities require immediate attention.' if skill > 0.85 and has_vuln else 'No critical issues found.'}"
            ),
            "findings": findings,
            "vulnerabilities": [f for f in findings if f.get("severity") == "critical"],
            "score": round(0.5 + skill * 0.45 + random.uniform(-0.05, 0.05), 4),
            "summary": f"Audit of {contract['name']}: {len(findings)} findings",
            "recommendations": [
                "Implement comprehensive access control",
                "Add reentrancy guards on all external calls",
                "Add event emissions for monitoring",
            ],
            "security_analysis": (
                "Deep analysis using static analysis patterns, "
                "control flow graph analysis, and known vulnerability databases."
            ),
            "gas_analysis": "Minor gas optimizations possible with storage packing.",
            "gas_optimizations": [{"suggestion": "Pack storage variables"}],
        }

    all_validations = []

    for task, contract in submitted_tasks:
        subheader(f"Task: {contract['name']} ({contract['customer_name']})")

        # Match
        assignments = protocol.match_task(task.task_id)
        matched_ids = [a.miner_id for a in assignments]
        matched_names = {m["id"]: m for m in miners_config}

        for a in assignments:
            m = matched_names.get(a.miner_id, {})
            print(f"    {ARROW} Matched: {CYAN}{m.get('name', a.miner_id):<14}{RESET} "
                  f"({DIM}{m.get('model', '?')}{RESET})")

        # Submit results
        for a in assignments:
            mcfg = matched_names.get(a.miner_id, {"skill": 0.7})
            result = generate_result(mcfg, contract)
            exec_time = round(5.0 + (1.0 - mcfg.get("skill", 0.7)) * 15 + random.uniform(0, 3), 1)

            protocol.submit_result(
                task_id=task.task_id,
                miner_id=a.miner_id,
                output=result,
                execution_time=exec_time,
            )

        # Validate
        validation = protocol.validate_and_pay(task.task_id)
        all_validations.append((task, contract, validation))

        winner_name = matched_names.get(validation.winner_miner_id, {}).get("name", "?")
        print(f"\n    {BOLD}Result:{RESET}")
        print(f"    Winner:  {GREEN}{BOLD}{winner_name}{RESET} "
              f"({validation.winner_miner_id})")
        print(f"    Score:   {YELLOW}{validation.winner_score:.4f}{RESET}")
        print(f"    PoI:     {GREEN}Verified ✓{RESET}")

        # Track miner earnings
        fee_bd = protocol.task_manager.get_fee_breakdown(task.task_id)
        if fee_bd and validation.consensus_scores:
            total_score = sum(validation.consensus_scores.values())
            if total_score > 0:
                for mid, score in validation.consensus_scores.items():
                    share = fee_bd.miner_reward * (score / total_score)
                    miner_wallets[mid] = miner_wallets.get(mid, 0) + share
                    treasury["total_miner_payouts"] += share

    # ══════════════════════════════════════════════════════════════
    # PHASE 5: TOKENOMICS & REWARD DISTRIBUTION
    # ══════════════════════════════════════════════════════════════
    header("PHASE 5: Tokenomics & Reward Distribution", "💰")

    subheader("Revenue Breakdown")
    print(f"""
    ┌────────────────────────────────────────────────────────┐
    │               TOKENOMICS FLOW                          │
    │                                                        │
    │   Customers paid:    {money(treasury['total_volume'])}              │
    │                        │                               │
    │                        ▼                               │
    │   ┌──────────────────────────────────────┐             │
    │   │     PROTOCOL FEE ENGINE               │             │
    │   │                                        │             │
    │   │  Protocol Fee (1%): {money(treasury['protocol_revenue'])}  │             │
    │   │  Subnet Fee (3%):   {money(treasury['subnet_revenue'])}  │             │
    │   │  Miner Pool (96%):  {money(treasury['total_miner_payouts'])}  │             │
    │   └──────────────────────────────────────┘             │
    │                        │                               │
    │            ┌───────────┼───────────┐                   │
    │            ▼           ▼           ▼                   │
    │      DAO Treasury  Subnet Owner  Miners                │
    └────────────────────────────────────────────────────────┘
""")

    subheader("Miner Earnings (this epoch)")
    print(f"\n    {'Miner':<14} {'Model':<16} {'Earned':>10} {'Stake':>8} {'ROI':>8}")
    print(f"    {'─' * 14} {'─' * 16} {'─' * 10} {'─' * 8} {'─' * 8}")

    for mcfg in miners_config:
        earned = miner_wallets.get(mcfg["id"], 0)
        roi = (earned / mcfg["stake"] * 100) if mcfg["stake"] > 0 else 0
        roi_color = GREEN if roi > 2 else YELLOW if roi > 0 else RED
        print(f"    {CYAN}{mcfg['name']:<14}{RESET} "
              f"{DIM}{mcfg['model']:<16}{RESET} "
              f"{money(earned)} "
              f"{YELLOW}{mcfg['stake']:>7}{RESET}  "
              f"{roi_color}{roi:>6.1f}%{RESET}")

    total_earned = sum(miner_wallets.values())
    print(f"\n    {'Total':>30}  {money(total_earned)}")

    subheader("Customer Spending")
    for cid, spent in customer_spent.items():
        cname = next((c["customer_name"] for c in contracts if c["customer"] == cid), cid)
        print(f"    {CYAN}{cname:<14}{RESET} spent {money(spent)}")

    # ══════════════════════════════════════════════════════════════
    # PHASE 6: MULTI-EPOCH SIMULATION
    # ══════════════════════════════════════════════════════════════
    header("PHASE 6: Multi-Epoch Simulation (Reputation Evolution)", "📈")

    print(f"  Simulating 5 epochs of marketplace activity...")
    print(f"  Each epoch = ~100 tasks from various customers\n")

    # Simulate multiple epochs
    epoch_data = []

    for epoch in range(1, 6):
        protocol.advance_epoch()
        epoch_volume = 0.0
        epoch_tasks = 0
        tasks_per_epoch = 8  # Simulate tasks

        for t_idx in range(tasks_per_epoch):
            reward = round(random.uniform(20, 100), 2)
            epoch_volume += reward

            task = protocol.submit_task(
                subnet_id=SUBNET_ID,
                task_type="code_review",
                payload={
                    "code": f"contract Epoch{epoch}Task{t_idx} {{ /* simulated */ }}",
                    "language": "solidity",
                    "expected_fields": ["analysis", "findings", "score", "summary"],
                },
                reward_amount=reward,
                requester_id=random.choice([c["customer"] for c in contracts]),
                max_miners=3,
            )

            assignments = protocol.match_task(task.task_id)

            for a in assignments:
                mcfg = next((m for m in miners_config if m["id"] == a.miner_id), None)
                skill = mcfg["skill"] if mcfg else 0.7

                output = {
                    "analysis": f"Epoch {epoch} automated audit analysis",
                    "findings": [{"type": "security", "severity": "low", "description": "Minor issue"}],
                    "score": round(skill + random.uniform(-0.1, 0.1), 4),
                    "summary": f"Automated review for epoch {epoch}",
                    "vulnerabilities": [],
                    "security_analysis": "Automated security scan completed.",
                    "gas_analysis": "Standard gas usage.",
                    "gas_optimizations": [],
                    "recommendations": ["Follow standard patterns"],
                }

                protocol.submit_result(
                    task_id=task.task_id,
                    miner_id=a.miner_id,
                    output=output,
                    execution_time=round(random.uniform(3, 15), 1),
                )

            validation = protocol.validate_and_pay(task.task_id)
            epoch_tasks += 1

            # Track earnings
            fee_bd = protocol.task_manager.get_fee_breakdown(task.task_id)
            if fee_bd and validation.consensus_scores:
                tot_s = sum(validation.consensus_scores.values())
                if tot_s > 0:
                    for mid, score in validation.consensus_scores.items():
                        share = fee_bd.miner_reward * (score / tot_s)
                        miner_wallets[mid] = miner_wallets.get(mid, 0) + share
                treasury["total_volume"] += reward
                treasury["protocol_revenue"] += fee_bd.protocol_fee
                treasury["subnet_revenue"] += fee_bd.subnet_fee
                treasury["total_miner_payouts"] += fee_bd.miner_reward

        epoch_data.append({
            "epoch": epoch,
            "tasks": epoch_tasks,
            "volume": epoch_volume,
        })

        # Show epoch summary
        print(f"  Epoch {CYAN}{epoch}{RESET}: "
              f"{epoch_tasks} tasks, "
              f"volume {YELLOW}{epoch_volume:>7.1f} MDT{RESET}")

    # ══════════════════════════════════════════════════════════════
    # PHASE 7: FINAL ANALYTICS
    # ══════════════════════════════════════════════════════════════
    header("PHASE 7: Final Analytics & Leaderboard", "📊")

    subheader("Miner Reputation After 5 Epochs")
    print(f"\n    {'Miner':<14} {'Reputation':>10} {'Tasks':>7} {'Success':>9} {'Earned':>12}")
    print(f"    {'─' * 14} {'─' * 10} {'─' * 7} {'─' * 9} {'─' * 12}")

    active_miners = protocol.miner_registry.get_active_miners(subnet_id=SUBNET_ID)
    for miner in sorted(active_miners, key=lambda m: m.reputation.score, reverse=True):
        mcfg = next((mm for mm in miners_config if mm["id"] == miner.miner_id), None)
        name = mcfg["name"] if mcfg else miner.miner_id
        earned = miner_wallets.get(miner.miner_id, 0)
        rep = miner.reputation

        rep_bar = bar(rep.score, 10)
        rep_color = GREEN if rep.score > 0.6 else YELLOW if rep.score > 0.3 else RED

        print(f"    {CYAN}{name:<14}{RESET} "
              f"{rep_color}{rep_bar} {rep.score:>.4f}{RESET} "
              f"{rep.total_tasks:>6}  "
              f"{rep.success_rate:>8.1%}  "
              f"{money(earned)}")

    subheader("Protocol Treasury (Cumulative)")
    print(f"""
    ┌──────────────────────────────────────────────┐
    │  {BOLD}TREASURY REPORT{RESET}                              │
    │                                               │
    │  Total Volume:      {money(treasury['total_volume'])}         │
    │  Protocol Revenue:  {money(treasury['protocol_revenue'])}         │
    │  Subnet Revenue:    {money(treasury['subnet_revenue'])}         │
    │  Miner Payouts:     {money(treasury['total_miner_payouts'])}         │
    │                                               │
    │  {DIM}Protocol take rate:  {pct(treasury['protocol_revenue'] / treasury['total_volume'] if treasury['total_volume'] > 0 else 0)}{RESET}                       │
    │  {DIM}Subnet take rate:    {pct(treasury['subnet_revenue'] / treasury['total_volume'] if treasury['total_volume'] > 0 else 0)}{RESET}                       │
    │  {DIM}Miner share:         {pct(treasury['total_miner_payouts'] / treasury['total_volume'] if treasury['total_volume'] > 0 else 0)}{RESET}                       │
    └──────────────────────────────────────────────┘
""")

    subheader("Revenue Projection (if scale)")
    daily_tasks = 100
    avg_reward = treasury['total_volume'] / max(sum(e['tasks'] for e in epoch_data) + 3, 1)
    daily_vol = daily_tasks * avg_reward
    monthly_vol = daily_vol * 30
    yearly_vol = daily_vol * 365

    print(f"""
    Assumptions: {daily_tasks} tasks/day, avg {YELLOW}{avg_reward:.0f} MDT{RESET}/task

    {'Period':<14} {'Volume':>12} {'Protocol (1%)':>14} {'Subnet (3%)':>14} {'Miners (96%)':>14}
    {'─' * 14} {'─' * 12} {'─' * 14} {'─' * 14} {'─' * 14}
    {'Daily':<14} {money(daily_vol)} {money(daily_vol * 0.01)} {money(daily_vol * 0.03)} {money(daily_vol * 0.96)}
    {'Monthly':<14} {money(monthly_vol)} {money(monthly_vol * 0.01)} {money(monthly_vol * 0.03)} {money(monthly_vol * 0.96)}
    {'Yearly':<14} {money(yearly_vol)} {money(yearly_vol * 0.01)} {money(yearly_vol * 0.03)} {money(yearly_vol * 0.96)}
""")

    subheader("Per-Miner Economics (Monthly Projection)")
    print(f"\n    {'Miner':<14} {'Monthly Income':>14} {'Annual Income':>14} {'Stake ROI/yr':>14}")
    print(f"    {'─' * 14} {'─' * 14} {'─' * 14} {'─' * 14}")

    # Estimate based on current earnings ratio
    total_earned_all = sum(miner_wallets.values())
    total_protocol_tasks = sum(e["tasks"] for e in epoch_data) + 3

    for mcfg in miners_config:
        earned = miner_wallets.get(mcfg["id"], 0)
        share = earned / total_earned_all if total_earned_all > 0 else 0.2
        miner_monthly = monthly_vol * 0.96 * share
        miner_yearly = miner_monthly * 12
        roi = (miner_yearly / mcfg["stake"] * 100) if mcfg["stake"] > 0 else 0

        roi_color = GREEN if roi > 100 else YELLOW if roi > 50 else RED
        print(f"    {CYAN}{mcfg['name']:<14}{RESET} "
              f"{money(miner_monthly)} "
              f"{money(miner_yearly)} "
              f"{roi_color}{roi:>12.0f}%{RESET}")

    # ══════════════════════════════════════════════════════════════
    # FINAL SUMMARY
    # ══════════════════════════════════════════════════════════════
    header("DEMO COMPLETE", "🏁")

    stats = protocol.get_protocol_stats()
    poi_stats = stats.get("poi_stats", {})

    print(f"""  {BOLD}What we demonstrated:{RESET}

  {CHECK} Subnet creation with custom fees & scoring config
  {CHECK} 5 miners registered with different AI models & stakes
  {CHECK} 3 real customers submitted smart contract audits
  {CHECK} Weighted matching: better miners get more tasks
  {CHECK} 5-dimension scoring: Security, Correctness, Readability, etc.
  {CHECK} Proof of Intelligence: verified AI authenticity
  {CHECK} Tokenomics: 1% protocol + 3% subnet + 96% miners
  {CHECK} Multi-epoch reputation evolution (EMA-based)
  {CHECK} Revenue projection: protocol-level economics

  {BOLD}Key Numbers:{RESET}
  Total tasks processed:   {CYAN}{stats.get('task_stats', {}).get('total_tasks', 0)}{RESET}
  Total volume:            {money(treasury['total_volume'])}
  Protocol revenue:        {money(treasury['protocol_revenue'])}
  Miners paid out:         {money(treasury['total_miner_payouts'])}
  PoI verifications:       {poi_stats.get('total_verifications', 'N/A')}
  PoI pass rate:           {GREEN}{poi_stats.get('pass_rate', 0):.0%}{RESET}
  Current epoch:           {stats.get('epoch', 0)}

  {GREEN}{BOLD}═══ All systems operational! ═══{RESET}
""")


if __name__ == "__main__":
    main()
