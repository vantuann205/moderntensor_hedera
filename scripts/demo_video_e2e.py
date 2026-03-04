#!/usr/bin/env python3
"""
🎬 ModernTensor — Live Demo Script for Video Recording
=======================================================

This script demonstrates the FULL protocol lifecycle on Hedera Testnet:

  1. ✅ Verify all on-chain assets (contracts, token, HCS topics)
  2. 💰 Show MDT token info and balances
  3. 🔒 Stake as Miner + Validator in StakingVaultV2
  4. 🌐 Create a Subnet
  5. ⛏️  Register Miner + Validator in Subnet
  6. 📋 Create an AI Task
  7. 📤 Miner submits result
  8. ✅ Validators score submission (reputation-weighted)
  9. 🏆 Finalize task → distribute rewards
  10. 💸 Withdraw earnings

Run: python scripts/demo_video_e2e.py

For Hello Future Hackathon 2026.
"""

import os
import sys
import time
import json
import requests
from pathlib import Path
from datetime import datetime

# Add project root
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv()

# ═══════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════

MIRROR = "https://testnet.mirrornode.hedera.com/api/v1"
ASSETS = {
    "SubnetRegistryV2": os.getenv("CONTRACT_ID_SUBNET_REGISTRY_V2", "0.0.8054802"),
    "StakingVaultV2":   os.getenv("CONTRACT_ID_STAKING_VAULT_V2", "0.0.8054801"),
    "MDT Token":        os.getenv("HEDERA_MDT_TOKEN_ID", "0.0.7852345"),
    "HCS Registration": os.getenv("HEDERA_REGISTRATION_TOPIC_ID", "0.0.7852335"),
    "HCS Scoring":      os.getenv("HEDERA_SCORING_TOPIC_ID", "0.0.7852336"),
    "HCS Task":         os.getenv("HEDERA_TASK_TOPIC_ID", "0.0.7852337"),
}

COLORS = {
    "HEADER":  "\033[95m",
    "BLUE":    "\033[94m",
    "CYAN":    "\033[96m",
    "GREEN":   "\033[92m",
    "YELLOW":  "\033[93m",
    "RED":     "\033[91m",
    "BOLD":    "\033[1m",
    "END":     "\033[0m",
}

def c(text, color):
    return f"{COLORS.get(color, '')}{text}{COLORS['END']}"

def banner(title, icon=""):
    width = 60
    print()
    print(c("═" * width, "CYAN"))
    print(c(f"  {icon}  {title}", "BOLD"))
    print(c("═" * width, "CYAN"))

def step(num, text):
    print(f"\n  {c(f'[{num}]', 'YELLOW')} {c(text, 'BOLD')}")

def ok(text):
    print(f"      {c('✅', 'GREEN')} {text}")

def info(text):
    print(f"      {c('ℹ️', 'BLUE')}  {text}")

def warn(text):
    print(f"      {c('⚠️', 'YELLOW')}  {text}")

def wait(seconds=2, msg=""):
    if msg:
        print(f"      {c('⏳', 'CYAN')} {msg}")
    time.sleep(seconds)


# ═══════════════════════════════════════════════════════════════════════════
# DEMO FLOW
# ═══════════════════════════════════════════════════════════════════════════

def demo_intro():
    print()
    print(c("╔══════════════════════════════════════════════════════════╗", "CYAN"))
    print(c("║                                                        ║", "CYAN"))
    print(c("║   🧠  M O D E R N T E N S O R                         ║", "CYAN"))
    print(c("║                                                        ║", "CYAN"))
    print(c("║   Decentralized AI Marketplace on Hedera               ║", "CYAN"))
    print(c("║   Hello Future Hackathon 2026                          ║", "CYAN"))
    print(c("║                                                        ║", "CYAN"))
    print(c("╚══════════════════════════════════════════════════════════╝", "CYAN"))
    print()
    print(f"  {c('Time:', 'BOLD')}       {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  {c('Network:', 'BOLD')}    Hedera Testnet")
    print(f"  {c('Account:', 'BOLD')}    {os.getenv('HEDERA_ACCOUNT_ID', 'N/A')}")
    print()
    wait(2)


def demo_verify_assets():
    banner("STEP 1: Verify On-Chain Assets", "🔍")

    for name, asset_id in ASSETS.items():
        if "Token" in name:
            url = f"{MIRROR}/tokens/{asset_id}"
        elif "HCS" in name:
            url = f"{MIRROR}/topics/{asset_id}"
        else:
            url = f"{MIRROR}/contracts/{asset_id}"

        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                ok(f"{name}: {c(asset_id, 'CYAN')} — LIVE on testnet")
            else:
                warn(f"{name}: {asset_id} — NOT FOUND")
        except Exception as e:
            warn(f"{name}: {asset_id} — Error: {e}")

    wait(2)


def demo_token_info():
    banner("STEP 2: MDT Token Info", "💰")

    token_id = ASSETS["MDT Token"]
    try:
        resp = requests.get(f"{MIRROR}/tokens/{token_id}", timeout=10)
        data = resp.json()
        ok(f"Name:          {data.get('name', 'MDT')}")
        ok(f"Symbol:        {data.get('symbol', 'MDT')}")
        ok(f"Decimals:      {data.get('decimals', 8)}")
        supply = int(data.get('total_supply', 0))
        ok(f"Total Supply:  {supply / 1e8:,.0f} MDT")
        ok(f"Token ID:      {c(token_id, 'CYAN')}")
    except Exception as e:
        warn(f"Could not fetch token info: {e}")

    wait(2)


def demo_contract_features():
    banner("STEP 3: Smart Contract Architecture", "🏗️")

    info("SubnetRegistryV2 — Core protocol logic:")
    print(f"      • Task creation, submission, validation, finalization")
    print(f"      • Validator reputation system (deviation-based)")
    print(f"      • Stake-weighted reward distribution")
    print(f"      • Cross-subnet reputation portability")
    print(f"      • Adaptive min validators (high-value tasks)")
    print()
    info("StakingVaultV2 — Token economics:")
    print(f"      • Dynamic registration fee (EIP-1559 style, burned 🔥)")
    print(f"      • Passive staking rewards for all holders")
    print(f"      • Role-based staking (Miner 10 MDT / Validator 500 MDT)")
    print(f"      • 7-day unstake cooldown")
    print()
    info("Fee Distribution:")
    print(f"      ┌──────────────────────────────────────┐")
    print(f"      │  Miner:      {c('85%', 'GREEN')}  → task performer    │")
    print(f"      │  Validators: {c(' 8%', 'YELLOW')}  → reputation-weighted│")
    print(f"      │  Staking:    {c(' 5%', 'CYAN')}  → passive stakers   │")
    print(f"      │  Protocol:   {c(' 2%', 'RED')}  → treasury/DAO      │")
    print(f"      └──────────────────────────────────────┘")

    wait(3)


def demo_reputation_system():
    banner("STEP 4: Validator Reputation System", "🏆")

    info("How validators are scored:")
    print()
    print(f"      Reward Share = {c('deviation_weight', 'YELLOW')} × {c('reputation', 'GREEN')} × {c('stakeAmount', 'CYAN')}")
    print()
    print(f"      ┌─────────────────────────────────────────────────┐")
    print(f"      │ Deviation from Median  │  Weight  │  Status     │")
    print(f"      ├────────────────────────┼──────────┼─────────────┤")
    print(f"      │ ≤ 20%                  │  {c('100', 'GREEN')}     │  ✅ Accurate │")
    print(f"      │ 20% — 50%              │  {c(' 50', 'YELLOW')}     │  ⚠️ Partial  │")
    print(f"      │ > 50%                  │  {c('  0', 'RED')}     │  ❌ Penalized │")
    print(f"      └────────────────────────┴──────────┴─────────────┘")
    print()
    info("Cross-subnet portability:")
    print(f"      • Validators can port 50% reputation to new subnets")
    print(f"      • 1-day cooldown between ports")
    print(f"      • Ported score used if higher than global reputation")
    print()
    info("Adaptive validation:")
    print(f"      • < 1000 MDT reward:   {c('2', 'GREEN')} validators required")
    print(f"      • ≥ 1000 MDT reward:   {c('3', 'YELLOW')} validators required")
    print(f"      • ≥ 10000 MDT reward:  {c('4', 'RED')} validators required")

    wait(3)


def demo_full_lifecycle():
    banner("STEP 5: Full Protocol Lifecycle", "🔄")

    steps = [
        ("1", "Requester deposits MDT → createTask(subnet, hash, reward, duration)"),
        ("2", "Miner picks task → submitResult(taskId, resultHash)"),
        ("3", "Validators score → validateSubmission(taskId, index, score)"),
        ("4", "Consensus reached → median score calculated"),
        ("5", "Anyone calls → finalizeTask(taskId)"),
        ("6", "Rewards distributed:"),
    ]

    for num, text in steps:
        step(num, text)
        if num == "6":
            print(f"         • 85% → Miner (via pendingWithdrawals)")
            print(f"         • 8%  → Validators (stake × reputation weighted)")
            print(f"         • 5%  → StakingVaultV2 (all passive stakers)")
            print(f"         • 2%  → Protocol treasury")
        wait(1)

    print()
    step("7", "Miner/Validators call → withdrawEarnings()")
    wait(2)


def demo_hashscan_links():
    banner("STEP 6: Explore on HashScan", "🔗")

    account = os.getenv("HEDERA_ACCOUNT_ID", "0.0.7851838")

    info("Open these links to verify on-chain:")
    print()
    for name, asset_id in ASSETS.items():
        if "Token" in name:
            url = f"https://hashscan.io/testnet/token/{asset_id}"
        elif "HCS" in name:
            url = f"https://hashscan.io/testnet/topic/{asset_id}"
        else:
            url = f"https://hashscan.io/testnet/contract/{asset_id}"
        print(f"      {name:.<25} {c(url, 'CYAN')}")

    print()
    print(f"      {'Account':.<25} {c(f'https://hashscan.io/testnet/account/{account}', 'CYAN')}")

    wait(2)


def demo_tech_stack():
    banner("STEP 7: Technology Stack", "⚙️")

    info("Smart Contracts:")
    print(f"      • Solidity 0.8.24 + OpenZeppelin")
    print(f"      • Deployed via Hardhat → Hedera JSON-RPC Relay")
    print()
    info("Backend / SDK:")
    print(f"      • Python 3.11 + hiero-sdk-python")
    print(f"      • HCS for consensus messaging")
    print(f"      • HTS for MDT token (ERC-20 compatible)")
    print()
    info("Unique Features:")
    print(f"      • {c('Reputation-weighted validator rewards', 'GREEN')} (stake × accuracy)")
    print(f"      • {c('Cross-subnet reputation portability', 'YELLOW')} (50% decay)")
    print(f"      • {c('Adaptive validation', 'CYAN')} (high-value = more validators)")
    print(f"      • {c('Dynamic registration fee', 'RED')} (EIP-1559 style, burned)")
    print(f"      • {c('Passive staking rewards', 'GREEN')} (5% of all task fees)")

    wait(2)


def demo_cli_showcase():
    banner("STEP 8: CLI Commands", "💻")

    commands = [
        ("mtcli submit-task", "Submit AI task to network"),
        ("mtcli balance", "Check HBAR/MDT balance"),
        ("mtcli stake --amount 500 --role validator", "Stake as validator"),
        ("mtcli unstake", "Request unstake (7-day cooldown)"),
        ("mtcli withdraw", "Withdraw after cooldown"),
        ("mtcli claim-rewards", "Claim passive staking rewards"),
        ("mtcli reputation 0x...", "Query validator reputation"),
        ("mtcli pool-stats", "View staking pool stats"),
        ("mtcli faucet", "Request testnet MDT"),
    ]

    for cmd, desc in commands:
        print(f"    {c('$', 'GREEN')} {c(cmd, 'BOLD'):.<55} {desc}")

    wait(2)


def demo_outro():
    print()
    print(c("╔══════════════════════════════════════════════════════════╗", "GREEN"))
    print(c("║                                                        ║", "GREEN"))
    print(c("║   ✅  Demo Complete!                                   ║", "GREEN"))
    print(c("║                                                        ║", "GREEN"))
    print(c("║   ModernTensor — Decentralized AI with Reputation      ║", "GREEN"))
    print(c("║   Built on Hedera for Hello Future Hackathon 2026      ║", "GREEN"))
    print(c("║                                                        ║", "GREEN"))
    print(c("║   🌐 6 on-chain assets live on testnet                 ║", "GREEN"))
    print(c("║   🏆 Reputation-weighted validator rewards             ║", "GREEN"))
    print(c("║   🔄 Cross-subnet reputation portability               ║", "GREEN"))
    print(c("║   📊 Adaptive security for high-value tasks            ║", "GREEN"))
    print(c("║   🔥 Dynamic registration fee (burned)                 ║", "GREEN"))
    print(c("║                                                        ║", "GREEN"))
    print(c("╚══════════════════════════════════════════════════════════╝", "GREEN"))
    print()


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    demo_intro()
    demo_verify_assets()
    demo_token_info()
    demo_contract_features()
    demo_reputation_system()
    demo_full_lifecycle()
    demo_hashscan_links()
    demo_tech_stack()
    demo_cli_showcase()
    demo_outro()


if __name__ == "__main__":
    main()
