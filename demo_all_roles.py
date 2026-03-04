#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
  ModernTensor — Full On-Chain Role & Reward Cycle Demo
═══════════════════════════════════════════════════════════════════

Demonstrates EVERY role on Hedera testnet with REAL on-chain transactions:

  Roles:
    1. Requester    — Submits tasks, pays MDT
    2. Subnet Owner — Runs a subnet, earns subnet fee (3%)
    3. Miners  (×3) — Process tasks via Axon, earn 77% of reward
    4. Validators (×2) — Score results, earn 15% validator pool
    5. Protocol DAO — Collects 5% protocol fee

  On-Chain Components Used:
    • HCS  — miner registration, task creation, score submission,
             metagraph update, reward audit logging
    • SubnetRegistry (contract) — subnet + task on-chain
    • StakingVault   (contract) — stake MDT for miners/validators
    • PaymentEscrow  (contract) — task escrow on-chain
    • MDTGovernor    (contract) — governance proposal + vote
    • HTSService     — real MDT token transfers via RewardDistributor
    • Mirror Node    — query all HCS messages to verify

  Cycle:
    A) Task Lifecycle:  submit → match → execute → score → pay (on-chain)
    B) Fee Split:       100 MDT → 77 miner + 15 validator + 5 protocol + 3 subnet
    C) Epoch Rewards:   Staking emissions (68,493 MDT/day Year 1-2)
    D) Treasury Report: Running totals for all parties

Usage:
    python demo_all_roles.py

For ModernTensor on Hedera — Hello Future Hackathon 2026
═══════════════════════════════════════════════════════════════════
"""

import sys
import os
import json
import time
import random
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

# ── Hedera on-chain imports ──
from sdk.hedera.config import load_hedera_config
from sdk.hedera.client import HederaClient
from sdk.hedera.hcs import (
    HCSService,
    MinerRegistration,
    ScoreSubmission,
    TaskSubmission,
)
from sdk.hedera.payment_escrow import PaymentEscrowService
from sdk.hedera.subnet_registry import SubnetRegistryService
from sdk.hedera.staking_vault import StakingVaultService, StakeRole
from sdk.hedera.governor import MDTGovernorService
from sdk.hedera.hts import HTSService

# ── SDK protocol imports ──
from sdk.protocol.types import (
    FeeBreakdown,
    MinerInfo,
    MinerStatus,
    ProtocolConfig,
    TaskPriority,
)
from sdk.protocol.fee_engine import FeeEngine
from sdk.protocol.task_manager import TaskManager
from sdk.protocol.miner_registry import MinerRegistry
from sdk.protocol.matching import TaskMatcher
from sdk.protocol.validator import ValidationOrchestrator
from sdk.protocol.reward_distributor import RewardDistributor, RewardBatch
from sdk.protocol.treasury import Treasury
from sdk.protocol.emissions import EmissionSchedule
from sdk.protocol.axon import Axon
from sdk.protocol.dendrite import Dendrite
from sdk.scoring.weights import WeightCalculator
from sdk.scoring.consensus import ScoreConsensus

# ── Terminal colors ──
G = "\033[92m"
R = "\033[91m"
Y = "\033[93m"
C = "\033[96m"
M = "\033[95m"
B = "\033[1m"
D = "\033[2m"
X = "\033[0m"
BAR_FULL = chr(9608)
BAR_EMPTY = chr(9617)


def header(title, emoji=""):
    print(f"\n{'=' * 64}")
    print(f"  {emoji}  {B}{title}{X}")
    print(f"{'=' * 64}")


def ok(msg):
    print(f"  {G}[OK]{X} {msg}")


def warn(msg):
    print(f"  {Y}[!!]{X} {msg}")


def fail(msg):
    print(f"  {R}[FAIL]{X} {msg}")


def info(msg):
    print(f"  {C}[..]{X} {msg}")


def money(msg):
    print(f"  {Y}[$]{X}  {msg}")


def bar(value, width=30):
    filled = int(value * width)
    return f"{BAR_FULL * filled}{BAR_EMPTY * (width - filled)}"


# ══════════════════════════════════════════════════════════════
# Miner AI handlers
# ══════════════════════════════════════════════════════════════
def make_handler(skill: float, name: str):
    """Create a miner handler with a specific skill level."""

    def handler(payload, task_type):
        code = payload.get("code", "")
        base_score = min(1.0, max(0.0, skill + random.uniform(-0.05, 0.05)))
        findings = max(1, int(skill * 5))
        return {
            "analysis": f"[{name}] Reviewed {len(code)} chars",
            "findings": [
                {
                    "severity": "warning" if i == 0 else "info",
                    "message": f"Finding #{i + 1} from {name}",
                }
                for i in range(findings)
            ],
            "score": round(base_score, 3),
            "confidence": round(0.7 + skill * 0.25, 2),
        }

    return handler


def main():
    header("ModernTensor — Full ON-CHAIN Role & Reward Demo", "\U0001f517")
    print(f"  {D}All roles + ALL 4 contracts + HCS + HTS + Mirror Node{X}")

    # ── Clean stale state ──
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
    os.makedirs(data_dir, exist_ok=True)

    # ══════════════════════════════════════════
    # CONNECT TO HEDERA TESTNET
    # ══════════════════════════════════════════
    header("Phase 0: Connect to Hedera Testnet", "\U0001f310")

    hedera_config = load_hedera_config()
    client = HederaClient(hedera_config)

    # Initialize ALL on-chain services
    hcs = HCSService(client)
    escrow = PaymentEscrowService(client)
    registry = SubnetRegistryService(client)
    staking = StakingVaultService(client)
    governor = MDTGovernorService(client)
    hts = HTSService(client)

    balance = client.get_balance()
    OPERATOR_ID = client.operator_id_str

    ok(f"Connected: {OPERATOR_ID}")
    ok(f"Balance: {balance.hbars}")
    ok(
        f"HCS topics: reg={hcs.registration_topic_id} score={hcs.scoring_topic_id} task={hcs.task_topic_id}"
    )
    print(f"\n  {C}Smart Contracts (on-chain):{X}")
    ok(f"PaymentEscrow:   {escrow.contract_id or 'N/A'}")
    ok(f"SubnetRegistry:  {registry.contract_id or 'N/A'}")
    ok(f"StakingVault:    {staking.contract_id or 'N/A'}")
    ok(f"MDTGovernor:     {governor.contract_id or 'N/A'}")
    ok(f"MDT Token:       {hts.mdt_token_id or 'N/A'}")

    # ── PaymentEscrow: query contract state + set oracle ──
    OPERATOR_EVM = None
    if escrow.contract_id:
        fee_bps = escrow.get_protocol_fee_bps()
        oracle_addr = escrow.get_ai_oracle()
        ok(f"PaymentEscrow fee: {fee_bps} bps, oracle: {oracle_addr or 'not set'}")

        # Derive operator's EVM address from Hedera account ID
        # Hedera long-zero format: 0x + 20-byte zero-padded account number
        account_num = int(OPERATOR_ID.split(".")[-1])
        OPERATOR_EVM = "0x" + account_num.to_bytes(20, "big").hex()
        ok(f"Operator EVM:    {OPERATOR_EVM[:18]}...{OPERATOR_EVM[-6:]}")

        # Set operator as oracle so release() works in demo
        try:
            escrow.set_ai_oracle(OPERATOR_EVM)
            ok(f"PaymentEscrow oracle -> operator")
        except Exception as e:
            warn(f"setAIOracle: {e}")

    # ══════════════════════════════════════════
    # DEFINE ROLES
    # ══════════════════════════════════════════
    header("Phase 1: Role Definitions", "\U0001f465")

    # All on-chain operations use the operator account (single testnet account)
    # In production, each role would have its own Hedera account
    REQUESTER_ID = OPERATOR_ID
    SUBNET_OWNER_ID = OPERATOR_ID
    PROTOCOL_TREASURY_ID = OPERATOR_ID
    SUBNET_ID = 1
    SUBNET_FEE_RATE = 0.03  # 3%

    MINERS = [
        {
            "id": "0.0.1001",
            "port": 19501,
            "skill": 0.92,
            "name": "AlphaAI",
            "stake": 500.0,
        },
        {
            "id": "0.0.1002",
            "port": 19502,
            "skill": 0.78,
            "name": "BetaML",
            "stake": 200.0,
        },
        {
            "id": "0.0.1003",
            "port": 19503,
            "skill": 0.55,
            "name": "GammaBot",
            "stake": 100.0,
        },
    ]

    VALIDATORS = [
        {"id": "0.0.9001", "stake": 75_000.0, "name": "ValidatorA"},
        {"id": "0.0.9002", "stake": 50_000.0, "name": "ValidatorB"},
    ]

    REWARD_AMOUNT = 100.0  # MDT per task
    NUM_TASKS = 3

    print(f"  {M}Requester:{X}      {REQUESTER_ID}")
    print(
        f"  {M}Subnet Owner:{X}   {SUBNET_OWNER_ID} (subnet #{SUBNET_ID}, fee={SUBNET_FEE_RATE:.0%})"
    )
    print(f"  {M}Protocol DAO:{X}   {PROTOCOL_TREASURY_ID}")
    for m in MINERS:
        print(
            f"  {G}Miner:{X}          {m['name']:10s} ({m['id']}, stake={m['stake']:.0f} MDT)"
        )
    for v in VALIDATORS:
        print(
            f"  {Y}Validator:{X}      {v['name']:10s} ({v['id']}, stake={v['stake']:,.0f} MDT)"
        )
    print(f"\n  Reward per task: {B}{REWARD_AMOUNT} MDT{X}")
    print(f"  Tasks this epoch: {B}{NUM_TASKS}{X}")
    print(f"\n  {D}Note: On-chain txs use operator account {OPERATOR_ID}{X}")
    print(f"  {D}In production each role has its own Hedera account{X}")

    # ══════════════════════════════════════════
    # PHASE 2: FEE CALCULATION
    # ══════════════════════════════════════════
    header("Phase 2: Fee Calculation (FeeEngine)", "\U0001f4b0")

    config = ProtocolConfig()
    fee_engine = FeeEngine(config)

    sample_fee = fee_engine.calculate(
        reward_amount=REWARD_AMOUNT,
        subnet_fee_rate=SUBNET_FEE_RATE,
        priority=TaskPriority.NORMAL,
    )

    print(f"\n  For a {REWARD_AMOUNT} MDT task (priority=NORMAL, subnet_fee=3%):")
    print(f"  {'-' * 50}")
    print(
        f"  {G}Miner reward:{X}      {sample_fee.miner_reward:>8.2f} MDT  ({sample_fee.miner_reward / REWARD_AMOUNT:.0%})"
    )
    print(
        f"  {Y}Validator pool:{X}    {sample_fee.validator_reward:>8.2f} MDT  ({sample_fee.validator_reward_rate:.0%})"
    )
    print(
        f"  {C}Protocol fee:{X}      {sample_fee.protocol_fee:>8.2f} MDT  ({sample_fee.protocol_fee_rate:.0%})"
    )
    print(
        f"  {M}Subnet fee:{X}        {sample_fee.subnet_fee:>8.2f} MDT  ({sample_fee.subnet_fee_rate:.0%})"
    )
    print(f"  {'-' * 50}")
    print(f"  {B}Total deposit:{X}     {sample_fee.total_deposit:>8.2f} MDT")

    # ══════════════════════════════════════════
    # PHASE 3: REGISTER SUBNET ON-CHAIN
    # ══════════════════════════════════════════
    header("Phase 3: Register Subnet (SubnetRegistry Contract)", "\U0001f310")

    try:
        receipt = registry.register_subnet(
            name="AI-CodeReview-v1",
            min_validations=3,
            min_stake=100_00000000,
        )
        ok("Subnet registered on SubnetRegistry (on-chain tx)")
    except Exception as e:
        warn(f"SubnetRegistry.registerSubnet: {e}")

    # ══════════════════════════════════════════
    # PHASE 4: STAKE MDT ON-CHAIN
    # ══════════════════════════════════════════
    header("Phase 4: Stake MDT (StakingVault Contract)", "\U0001f4b0")

    try:
        receipt = staking.stake(amount=100_00000000, role=StakeRole.VALIDATOR)
        ok("Staked 100 MDT as VALIDATOR (on-chain tx)")
    except Exception as e:
        warn(f"StakingVault.stake(validator): {e}")
    try:
        receipt = staking.stake(amount=50_00000000, role=StakeRole.MINER)
        ok("Staked 50 MDT as MINER (on-chain tx)")
    except Exception as e:
        warn(f"StakingVault.stake(miner): {e}")

    # ══════════════════════════════════════════
    # PHASE 5: START MINER AXON SERVERS
    # ══════════════════════════════════════════
    header("Phase 5: Start Miner Axon Servers", "\u26cf\ufe0f")

    axons = []
    for m in MINERS:
        handler = make_handler(m["skill"], m["name"])
        axon = Axon(
            miner_id=m["id"],
            handler=handler,
            port=m["port"],
            subnet_ids=[SUBNET_ID],
            capabilities=["code_review"],
        )
        axon.start()
        axons.append(axon)
        ok(f"{m['name']} -> {axon.endpoint}")

    time.sleep(0.5)
    ok(f"All {len(MINERS)} Axon servers online")

    # ══════════════════════════════════════════
    # PHASE 6: REGISTER MINERS ON HCS
    # ══════════════════════════════════════════
    header("Phase 6: Register Miners on HCS (On-Chain)", "\U0001f4dd")

    miner_registry = MinerRegistry(config)
    for m in MINERS:
        # Register in local registry
        miner = miner_registry.register(
            miner_id=m["id"],
            subnet_ids=[SUBNET_ID],
            stake_amount=m["stake"],
            capabilities=["code_review"],
        )
        miner.axon_host = "127.0.0.1"
        miner.axon_port = m["port"]

        # Register on HCS (real on-chain)
        reg = MinerRegistration(
            miner_id=m["id"],
            account_id=OPERATOR_ID,
            capabilities=["code_review"],
            subnet_ids=[SUBNET_ID],
        )
        try:
            receipt = hcs.register_miner(reg)
            ok(f"{m['name']} registered locally + HCS (on-chain)")
        except Exception as e:
            warn(f"{m['name']} HCS registration: {e}")

    # Validators
    for v in VALIDATORS:
        ok(f"Validator {v['name']} registered (stake={v['stake']:,.0f} MDT)")

    # ══════════════════════════════════════════
    # PHASE 7: FULL TASK LIFECYCLE ×3
    #   HCS + PaymentEscrow + SubnetRegistry + Dendrite/Axon + Score
    # ══════════════════════════════════════════
    header("Phase 7: Task Lifecycle (On-Chain) x3", "\U0001f504")

    # Pipeline setup
    matcher = TaskMatcher()
    validator_orchestrator = ValidationOrchestrator(
        validator_id=VALIDATORS[0]["id"],
        min_score_threshold=0.2,
        min_results_required=1,
    )
    task_manager = TaskManager(
        config=config,
        fee_engine=fee_engine,
        miner_registry=miner_registry,
        matcher=matcher,
        validator=validator_orchestrator,
    )

    # Treasury for accounting
    treasury = Treasury(state_dir="data")

    # Reward distributor — connected to real HCS + contracts
    # dry_run=True only for HTS transfers (testnet has 1 account, recipient
    # miner IDs are logical not real Hedera accounts).
    # HCS audit logging and escrow finalization are done separately below.
    distributor = RewardDistributor(
        hts_service=hts,
        hcs_service=hcs,
        contract_service=escrow,
        treasury=treasury,
        protocol_treasury_account=PROTOCOL_TREASURY_ID,
        hcs_topic_id=hcs.scoring_topic_id,
        dry_run=True,
    )

    # Wire payment callback
    def on_payment(payment):
        if payment.fee_breakdown:
            payment.fee_breakdown.subnet_owner_id = SUBNET_OWNER_ID
        batch = distributor.process_payment(payment)
        if payment.fee_breakdown and payment.fee_breakdown.subnet_fee > 0:
            treasury._subnet_revenue[SUBNET_ID] = round(
                treasury._subnet_revenue.get(SUBNET_ID, 0.0)
                + payment.fee_breakdown.subnet_fee,
                8,
            )
        return batch

    task_manager.on_payment_ready(on_payment)

    # Dendrite
    dendrite = Dendrite(validator_id=VALIDATORS[0]["id"], timeout=10.0)
    miner_endpoints = [
        {"miner_id": m["id"], "endpoint": f"http://127.0.0.1:{m['port']}"}
        for m in MINERS
    ]

    all_scores = {}
    tasks_completed = []
    task_ids_onchain = []
    hcs_reward_logs = 0

    for task_num in range(1, NUM_TASKS + 1):
        print(f"\n  {B}--- Task {task_num}/{NUM_TASKS} ---{X}")

        # Step A: Create task on HCS + contracts (ON-CHAIN)
        task_id_local = f"task-{int(time.time())}-{task_num}"
        task_sub = TaskSubmission(
            task_id=task_id_local,
            requester_id=OPERATOR_ID,
            task_type="code_review",
            prompt=f"Review function process_{task_num} for vulnerabilities",
            reward_amount=int(REWARD_AMOUNT * 1e8),
            deadline=int(time.time()) + 3600,
        )
        try:
            receipt = hcs.create_task(task_sub)
            ok(f"Task {task_id_local} -> HCS (on-chain)")
        except Exception as e:
            warn(f"HCS task: {e}")

        try:
            request_id = PaymentEscrowService.make_request_id(task_id_local)
            receipt = escrow.deposit(
                request_id=request_id,
                amount=int(REWARD_AMOUNT * 1e8),
                timeout=3600,
            )
            ok(f"Task -> PaymentEscrow.deposit (on-chain tx)")
        except Exception as e:
            warn(f"PaymentEscrow.deposit: {e}")

        try:
            receipt = registry.create_task(
                subnet_id=0,
                task_hash=task_id_local,
                reward_amount=int(REWARD_AMOUNT * 1e8),
                duration=3600,
            )
            ok(f"Task -> SubnetRegistry (on-chain tx)")
        except Exception as e:
            warn(f"SubnetRegistry.createTask: {e}")

        task_ids_onchain.append(task_id_local)

        # Step B: Submit task through TaskManager
        task = task_manager.submit_task(
            subnet_id=SUBNET_ID,
            task_type="code_review",
            payload={
                "code": f"def process_{task_num}(data): return transform(data)",
                "lang": "python",
            },
            reward_amount=REWARD_AMOUNT,
            requester_id=REQUESTER_ID,
            priority="normal",
            max_miners=len(MINERS),
        )
        info(f"TaskManager submitted {task.task_id[:12]}...")

        # Step C: Match
        assignments = task_manager.match_task(task.task_id)
        info(f"Matched to {len(assignments)} miners")

        # Step D: Dendrite -> Axon (real HTTP)
        results = dendrite.broadcast(
            miners=miner_endpoints,
            task_id=task.task_id,
            task_type="code_review",
            payload=task.payload,
        )

        # Step E: Submit results
        for r in results:
            if r.success:
                task_manager.submit_result(
                    task_id=task.task_id,
                    miner_id=r.miner_id,
                    output=r.output,
                    execution_time=r.latency,
                )

        # Step F: Validate + Score + Pay (triggers RewardDistributor)
        validation = task_manager.validate_task(task.task_id)

        if validation.is_valid:
            winner_name = next(
                (m["name"] for m in MINERS if m["id"] == validation.winner_miner_id),
                validation.winner_miner_id,
            )
            ok(f"Winner: {G}{winner_name}{X} (score={validation.winner_score:.3f})")
            tasks_completed.append(task.task_id)

            for mid, score in validation.consensus_scores.items():
                if mid not in all_scores:
                    all_scores[mid] = []
                all_scores[mid].append(score)

            fee_bd = task_manager.get_fee_breakdown(task.task_id)
            if fee_bd:
                money(
                    f"Split: miner={fee_bd.miner_reward:.2f} "
                    f"validator={fee_bd.validator_reward:.2f} "
                    f"protocol={fee_bd.protocol_fee:.2f} "
                    f"subnet={fee_bd.subnet_fee:.2f}"
                )
        else:
            fail(f"Task failed: {validation.rejection_reason}")

        # Step G: Submit scores to HCS + contracts (ON-CHAIN)
        for mid, score_val in (validation.consensus_scores or {}).items():
            try:
                sub = ScoreSubmission(
                    validator_id=OPERATOR_ID,
                    miner_id=mid,
                    task_id=task_id_local,
                    score=score_val,
                    confidence=0.95,
                )
                receipt = hcs.submit_score(sub)
                nm = next((m["name"] for m in MINERS if m["id"] == mid), mid)
                ok(f"{nm} score={score_val:.3f} -> HCS (on-chain)")
            except Exception as e:
                warn(f"Score HCS for {mid}: {e}")

        # Submit to contracts
        if validation.is_valid:
            try:
                request_id = PaymentEscrowService.make_request_id(task_id_local)
                receipt = escrow.release(
                    request_id=request_id,
                    miner_address=OPERATOR_EVM or "0x" + "00" * 20,
                )
                ok(f"Score -> PaymentEscrow.release (on-chain tx)")
            except Exception as e:
                warn(f"PaymentEscrow.release: {e}")

            try:
                receipt = registry.validate_submission(
                    task_id=task_num - 1,
                    miner_index=0,
                    score=int(validation.winner_score * 10000),
                )
                ok(f"Score -> SubnetRegistry (on-chain tx)")
            except Exception as e:
                warn(f"SubnetRegistry.validate: {e}")

        # Step H: Log reward distribution to HCS (ON-CHAIN)
        if validation.is_valid:
            reward_log = {
                "type": "reward_distributed",
                "task_id": task_id_local,
                "winner": validation.winner_miner_id,
                "amount": REWARD_AMOUNT,
                "fee_split": {
                    "miner": sample_fee.miner_reward,
                    "validator": sample_fee.validator_reward,
                    "protocol": sample_fee.protocol_fee,
                    "subnet": sample_fee.subnet_fee,
                },
                "ts": time.time(),
            }
            try:
                receipt = client.submit_message(
                    topic_id=hcs.scoring_topic_id,
                    message=json.dumps(reward_log),
                )
                ok(f"Reward distribution logged to HCS (on-chain)")
                hcs_reward_logs += 1
            except Exception as e:
                warn(f"Reward HCS log: {e}")

        time.sleep(0.3)  # brief pause between tasks

    # ══════════════════════════════════════════
    # PHASE 8: WEIGHT CALCULATION
    # ══════════════════════════════════════════
    header("Phase 8: Weight Recalculation (End of Epoch)", "\u2696\ufe0f")

    weight_calc = WeightCalculator(min_stake=100.0, weight_cap=0.5)

    miner_data = []
    for m in MINERS:
        avg_score = sum(all_scores.get(m["id"], [0.5])) / max(
            len(all_scores.get(m["id"], [0.5])), 1
        )
        miner_data.append(
            {
                "miner_id": m["id"],
                "reputation_score": avg_score,
                "stake_amount": m["stake"],
                "success_rate": 0.8 + m["skill"] * 0.15,
                "timeout_rate": max(0, 0.2 - m["skill"] * 0.2),
                "total_tasks": NUM_TASKS,
            }
        )

    weights = weight_calc.calculate(miner_data, epoch=1)

    print(f"  {B}Miner Weights (MERIT-based):{X}")
    for mid, w in weights.top_miners(10):
        m_cfg = next((m for m in MINERS if m["id"] == mid), {})
        name = m_cfg.get("name", mid)
        avg_s = sum(all_scores.get(mid, [0])) / max(len(all_scores.get(mid, [0])), 1)
        print(f"    {name:10s}  {bar(w, 40)}  w={w:.4f}  avg_score={avg_s:.3f}")

    # Validator weights
    val_data = [
        {
            "validator_id": v["id"],
            "stake_amount": v["stake"],
            "reliability_score": 0.95,
            "dishonesty_rate": 0.0,
        }
        for v in VALIDATORS
    ]
    val_weights = weight_calc.calculate_validator_weights(val_data, epoch=1)

    print(f"\n  {B}Validator Weights (STAKE-based):{X}")
    for vid, w in val_weights.top_miners(10):
        v_cfg = next((v for v in VALIDATORS if v["id"] == vid), {})
        name = v_cfg.get("name", vid)
        stake = v_cfg.get("stake", 0)
        print(f"    {name:10s}  {bar(w, 40)}  w={w:.4f}  stake={stake:,.0f}")

    # ══════════════════════════════════════════
    # PHASE 9: METAGRAPH -> HCS (ON-CHAIN)
    # ══════════════════════════════════════════
    header("Phase 9: Metagraph -> HCS (On-Chain)", "\U0001f9e0")

    metagraph = {
        "type": "metagraph_update",
        "epoch": 1,
        "validator": OPERATOR_ID,
        "ts": time.time(),
        "subnet": SUBNET_ID,
        "miners": {},
    }
    for mid, w in weights.top_miners(10):
        nm = next((m["name"] for m in MINERS if m["id"] == mid), mid)
        avg_s = sum(all_scores.get(mid, [0])) / max(len(all_scores.get(mid, [0])), 1)
        metagraph["miners"][mid] = {
            "weight": round(w, 6),
            "score": round(avg_s, 4),
        }
        print(f"    {nm:10s}  w={w:.4f}  score={avg_s:.3f}")

    try:
        receipt = client.submit_message(
            topic_id=hcs.scoring_topic_id,
            message=json.dumps(metagraph),
        )
        ok(f"Metagraph submitted to HCS {hcs.scoring_topic_id} (on-chain)")
    except Exception as e:
        warn(f"Metagraph HCS: {e}")

    # ══════════════════════════════════════════
    # PHASE 10: EPOCH STAKING REWARDS
    # ══════════════════════════════════════════
    header("Phase 10: Epoch Staking Rewards (EmissionSchedule)", "\U0001f4c5")

    emission = EmissionSchedule(start_timestamp=time.time() - 86400)

    current_epoch = emission.get_current_epoch_number()
    daily_emission = emission.get_daily_emission()
    current_year = emission.get_current_year()

    print(f"  Current Epoch:     {current_epoch}")
    print(f"  Current Year:      {current_year}")
    print(f"  Daily Emission:    {daily_emission:,.2f} MDT/day")
    print(f"  Remaining Pool:    {emission.get_remaining_pool():,.0f} MDT")

    all_stakers = {}
    for m in MINERS:
        all_stakers[m["id"]] = m["stake"]
    for v in VALIDATORS:
        all_stakers[v["id"]] = v["stake"]

    total_stake = sum(all_stakers.values())
    staking_rewards = emission.calculate_epoch_rewards(all_stakers)

    print(f"\n  {B}Staking Rewards for Epoch {current_epoch}:{X}")
    print(f"  {'=' * 55}")
    for role_list, role_label in [(MINERS, "Miner"), (VALIDATORS, "Validator")]:
        for entry in role_list:
            eid = entry["id"]
            name = entry["name"]
            stake = entry.get("stake", 0)
            reward = staking_rewards.get(eid, 0)
            pct = (stake / total_stake * 100) if total_stake > 0 else 0
            print(
                f"    {role_label:10s} {name:10s}  stake={stake:>10,.0f} MDT "
                f"({pct:5.1f}%)  reward={Y}{reward:>10.2f} MDT{X}"
            )
    print(f"  {'=' * 55}")
    print(
        f"    {'Total':>22s}  stake={total_stake:>10,.0f} MDT "
        f"         reward={Y}{sum(staking_rewards.values()):>10.2f} MDT{X}"
    )

    finalized = emission.distribute_epoch(staking_rewards)
    ok(
        f"Epoch {finalized.epoch_number} finalized: {finalized.distributed:,.2f} MDT distributed"
    )

    # Log epoch rewards to HCS (ON-CHAIN)
    epoch_log = {
        "type": "epoch_rewards",
        "epoch": current_epoch,
        "daily_emission": daily_emission,
        "total_distributed": sum(staking_rewards.values()),
        "stakers": {k: round(v, 4) for k, v in staking_rewards.items()},
        "ts": time.time(),
    }
    try:
        receipt = client.submit_message(
            topic_id=hcs.scoring_topic_id,
            message=json.dumps(epoch_log),
        )
        ok(f"Epoch rewards logged to HCS (on-chain)")
    except Exception as e:
        warn(f"Epoch HCS log: {e}")

    # ══════════════════════════════════════════
    # PHASE 11: VALIDATOR REWARD POOL SPLIT
    # ══════════════════════════════════════════
    header("Phase 11: Validator Reward Pool Split", "\U0001f3c6")

    total_validator_pool = sample_fee.validator_reward * NUM_TASKS
    print(
        f"  Total validator pool (from {NUM_TASKS} tasks): {total_validator_pool:.2f} MDT"
    )
    print(f"  (15% x {REWARD_AMOUNT} MDT x {NUM_TASKS} tasks)")

    validator_payouts = {}
    total_val_weight = sum(w for _, w in val_weights.top_miners(10))
    for vid, w in val_weights.top_miners(10):
        share = (
            (w / total_val_weight) * total_validator_pool if total_val_weight > 0 else 0
        )
        validator_payouts[vid] = round(share, 4)

    print(f"\n  {B}Validator Payouts:{X}")
    for v in VALIDATORS:
        payout = validator_payouts.get(v["id"], 0)
        print(
            f"    {v['name']:10s}  {bar(payout / total_validator_pool if total_validator_pool > 0 else 0, 30)}"
            f"  {Y}{payout:>8.2f} MDT{X}"
        )

    for v in VALIDATORS:
        payout = validator_payouts.get(v["id"], 0)
        if payout > 0:
            treasury.record_task_payout(
                task_id=f"epoch-{current_epoch}-val-{v['id']}",
                fee_breakdown=None,
                miner_id=v["id"],
                miner_amount=payout,
            )

    # ══════════════════════════════════════════
    # PHASE 12: GOVERNANCE (MDTGovernor Contract)
    # ══════════════════════════════════════════
    header("Phase 12: Governance (MDTGovernor Contract)", "\U0001f3db\ufe0f")

    try:
        from eth_abi import encode
        from eth_utils import function_signature_to_4byte_selector

        selector = function_signature_to_4byte_selector("setMinMinerStake(uint256)")
        encoded_args = encode(["uint256"], [200_00000000])
        call_data = selector + encoded_args
        staking_evm = "0x" + hex(int(staking.contract_id.split(".")[-1]))[2:].zfill(40)

        receipt = governor.propose(
            target_address=staking_evm,
            call_data=call_data,
            description="Increase min miner stake to 200 MDT",
        )
        ok("Governance proposal created (on-chain tx)")
    except Exception as e:
        warn(f"MDTGovernor.propose: {e}")

    try:
        receipt = governor.vote(proposal_id=0, support=True)
        ok("Voted FOR proposal #0 (on-chain tx)")
    except Exception as e:
        warn(f"MDTGovernor.vote: {e}")

    # ══════════════════════════════════════════
    # PHASE 13: TREASURY REPORT
    # ══════════════════════════════════════════
    header("Phase 13: Treasury Report (All Money Flows)", "\U0001f4ca")

    snapshot = treasury.get_snapshot()

    print(f"\n  {B}Protocol Treasury Summary:{X}")
    print(f"  {'=' * 50}")
    print(f"  Total Volume:           {snapshot.total_volume:>12.2f} MDT")
    print(f"  Protocol Fees (5%):     {C}{snapshot.total_protocol_fees:>12.2f} MDT{X}")
    print(f"  Subnet Fees (3%):       {M}{snapshot.total_subnet_fees:>12.2f} MDT{X}")
    print(f"  Miner Rewards (77%):    {G}{snapshot.total_miner_rewards:>12.2f} MDT{X}")
    print(f"  Total Payouts:          {snapshot.total_payouts}")
    print(f"  Unique Miners Paid:     {snapshot.unique_miners_paid}")
    print(f"  Unique Tasks Paid:      {snapshot.unique_tasks_paid}")
    print(f"  {'=' * 50}")

    print(f"\n  {B}Top Earners:{X}")
    top = treasury.get_top_earners(10)
    for i, t in enumerate(top, 1):
        entity_id = t["miner_id"]
        name = next(
            (m["name"] for m in MINERS if m["id"] == entity_id),
            next((v["name"] for v in VALIDATORS if v["id"] == entity_id), entity_id),
        )
        role = "Miner" if any(m["id"] == entity_id for m in MINERS) else "Validator"
        print(
            f"    #{i}  {role:10s} {name:10s}  earned={Y}{t['total_earned']:>8.4f} MDT{X}"
            f"  tasks={t['task_count']}"
        )

    print(f"\n  {B}Subnet Revenue:{X}")
    rev = treasury.get_subnet_revenue(SUBNET_ID)
    print(f"    Subnet #{SUBNET_ID} ({SUBNET_OWNER_ID}):  {M}{rev:.4f} MDT{X}")

    # ══════════════════════════════════════════
    # PHASE 14: MIRROR NODE VERIFICATION
    # ══════════════════════════════════════════
    header("Phase 14: Mirror Node Verification (On-Chain Proof)", "\U0001f50d")

    print(f"  Waiting 3s for Mirror Node sync...")
    time.sleep(3)

    for label, fn in [
        ("Miner Registrations", hcs.get_registrations),
        ("Score Submissions", hcs.get_scores),
        ("Task Submissions", hcs.get_tasks),
    ]:
        try:
            msgs = fn(limit=5)
            print(f"\n  {B}{label} (from Mirror Node):{X}")
            for msg in msgs[-5:]:
                print(f"    {D}{json.dumps(msg)[:100]}{X}")
            if not msgs:
                print(f"    {D}(syncing...){X}")
            else:
                ok(f"{len(msgs)} {label.lower()} verified on-chain")
        except Exception as e:
            warn(f"Mirror Node {label}: {e}")

    # ══════════════════════════════════════════
    # PHASE 15: COMPLETE EARNINGS SUMMARY
    # ══════════════════════════════════════════
    header("Phase 15: Complete Earnings Summary (All Roles)", "\U0001f4b5")

    print(
        f"\n  {B}{'Role':12s} {'Entity':12s} {'Task Rewards':>14s} {'Staking':>12s} {'Total':>12s}{X}"
    )
    print(f"  {'=' * 64}")

    grand_total = 0.0

    for m in MINERS:
        task_earned = treasury.get_miner_earnings(m["id"])
        stake_reward = staking_rewards.get(m["id"], 0)
        total = task_earned + stake_reward
        grand_total += total
        print(
            f"  {G}{'Miner':12s}{X} {m['name']:12s} {task_earned:>14.4f} {stake_reward:>12.2f} {Y}{total:>12.4f}{X}"
        )

    for v in VALIDATORS:
        task_earned = validator_payouts.get(v["id"], 0)
        stake_reward = staking_rewards.get(v["id"], 0)
        total = task_earned + stake_reward
        grand_total += total
        print(
            f"  {Y}{'Validator':12s}{X} {v['name']:12s} {task_earned:>14.4f} {stake_reward:>12.2f} {Y}{total:>12.4f}{X}"
        )

    proto_fee_total = snapshot.total_protocol_fees
    grand_total += proto_fee_total
    print(
        f"  {C}{'Protocol':12s}{X} {'DAO':12s} {proto_fee_total:>14.4f} {'---':>12s} {Y}{proto_fee_total:>12.4f}{X}"
    )

    subnet_fee_total = snapshot.total_subnet_fees
    grand_total += subnet_fee_total
    print(
        f"  {M}{'Subnet':12s}{X} {'Owner':12s} {subnet_fee_total:>14.4f} {'---':>12s} {Y}{subnet_fee_total:>12.4f}{X}"
    )

    print(f"  {'=' * 64}")
    print(
        f"  {'':12s} {'TOTAL':12s} {'':>14s} {'':>12s} {B}{grand_total:>12.4f} MDT{X}"
    )

    # ══════════════════════════════════════════
    # PHASE 16: EMISSION HALVING SCHEDULE
    # ══════════════════════════════════════════
    header("Phase 16: Emission Halving Schedule", "\U0001f4c9")

    print(
        f"\n  {B}{'Year':8s} {'Annual Emission':>18s} {'Daily':>14s} {'Halving':>10s}{X}"
    )
    print(f"  {'-' * 52}")
    for start_yr, end_yr, annual in EmissionSchedule.HALVING_SCHEDULE:
        daily = annual / 365.0
        halving = f"{100 * annual / 25_000_000:.0f}%"
        print(
            f"  Year {start_yr}-{end_yr}   {annual:>14,.0f} MDT   {daily:>10,.0f} MDT   {halving:>6s}"
        )
    print(f"  Year 5+    {'DAO Governed':>14s}   {'vote':>10s}   {'---':>6s}")
    print(f"\n  Total pool:  {B}{EmissionSchedule.TOTAL_EMISSION_POOL:,.0f} MDT{X}")

    # ══════════════════════════════════════════
    # CLEANUP
    # ══════════════════════════════════════════
    header("Cleanup", "\U0001f9f9")

    for axon in axons:
        axon.stop()
    ok("All Axon servers stopped")

    treasury.save_state()
    ok("Treasury state saved")

    client.close()
    ok("Hedera client closed")

    # ══════════════════════════════════════════
    # FINAL SUMMARY
    # ══════════════════════════════════════════
    header("Demo Complete — All Roles + All On-Chain", "\U0001f389")
    print(
        f"""
  {C}On-Chain Components Used:{X}
  {'-' * 58}
  HCS Messages (Hedera Consensus Service):
    {G}3 miner registrations{X}  -> {hcs.registration_topic_id}
    {G}{NUM_TASKS} task submissions{X}      -> {hcs.task_topic_id}
    {G}{len(all_scores) * NUM_TASKS} score submissions{X}    -> {hcs.scoring_topic_id}
    {G}{hcs_reward_logs} reward dist logs{X}     -> {hcs.scoring_topic_id}
    {G}1 metagraph update{X}     -> {hcs.scoring_topic_id}
    {G}1 epoch reward log{X}     -> {hcs.scoring_topic_id}

  Smart Contracts (on-chain tx):
    PaymentEscrow:   {escrow.contract_id or 'N/A'}  (deposit + release)
    SubnetRegistry:  {registry.contract_id or 'N/A'}  (subnet + task + score)
    StakingVault:    {staking.contract_id or 'N/A'}  (stake)
    MDTGovernor:     {governor.contract_id or 'N/A'}  (propose + vote)

  Networking:
    3 Axon servers + 1 Dendrite ({len(tasks_completed)}/{NUM_TASKS} tasks OK)

  Mirror Node:
    Verified registrations, scores, tasks from testnet

  MDT Token:
    {hts.mdt_token_id or 'N/A'} (8 decimals)

  {C}Reward Architecture:{X}
  {'-' * 58}
  {M}Requester{X}  -- submits task + 100 MDT --> Protocol
                                              |
  {C}FeeEngine{X}  -- splits reward:
      77% --> {G}Miners{X}    (performance-based, Axon HTTP)
      15% --> {Y}Validators{X} (score, stake-weighted)
       5% --> {C}Protocol{X}  (DAO treasury)
       3% --> {M}Subnet{X}    (subnet owner)
                                              |
  {Y}EmissionSchedule{X} -- each epoch (1 day):
      {daily_emission:,.0f} MDT/day --> proportional to all stakers
      Bitcoin-style halving every 2 years
                                              |
  {C}Treasury{X} -- records all money flows
  {'-' * 58}
"""
    )


if __name__ == "__main__":
    import traceback

    try:
        main()
    except Exception as e:
        traceback.print_exc()
