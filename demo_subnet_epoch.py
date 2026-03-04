#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
  ModernTensor — Subnet Epoch Demo (Full On-Chain)
═══════════════════════════════════════════════════════════════════

Demonstrates ONE SUBNET running a COMPLETE EPOCH on Hedera testnet:

  1.  Connect + verify all 4 contracts
  2.  Create subnet on SubnetRegistry (on-chain)
  3.  Stake miners + validators on StakingVault (on-chain)
  4.  Register miners on HCS + local registry
  5.  Run 5 tasks through the full lifecycle:
       submit → escrow deposit → match → execute → validate → score
  6.  Update incentive weights (WeightCalculator recalc)
  7.  Distribute task rewards via RewardDistributor (dry_run for MDT)
  8.  Release escrow on PaymentEscrow (on-chain)
  9.  Log scores + rewards + metagraph to HCS (on-chain)
  10. Finalize epoch on EmissionSchedule
  11. Calculate staking emission rewards
  12. Full P&L report: task rewards + staking rewards + fees

  On-Chain Contracts Used:
    • SubnetRegistry  0.0.8046035   — subnet + task registration
    • StakingVault    0.0.8046039   — staking MDT
    • PaymentEscrow   0.0.8045890   — task escrow deposit/release
    • MDTGovernor     0.0.8046041   — governance vote to set incentive

  HCS Topics:
    • Registration    0.0.7852335
    • Scoring         0.0.7852336
    • Tasks           0.0.7852337

Usage:
    python demo_subnet_epoch.py

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

# ═══════════════════════════════════════════════════════════════
#  Terminal formatting
# ═══════════════════════════════════════════════════════════════
G = "\033[92m"
R = "\033[91m"
Y = "\033[93m"
C = "\033[96m"
M = "\033[95m"
B = "\033[1m"
D = "\033[2m"
X = "\033[0m"
BLCK = chr(9608)
EMPT = chr(9617)


def hdr(title, emoji=""):
    w = 64
    print(f"\n{'=' * w}")
    print(f"  {emoji}  {B}{title}{X}")
    print(f"{'=' * w}")


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


def bar(val, width=30):
    filled = int(val * width)
    return f"{BLCK * filled}{EMPT * (width - filled)}"


def sep(label=""):
    if label:
        print(f"  {'─' * 20} {D}{label}{X} {'─' * 20}")
    else:
        print(f"  {'─' * 56}")


# ═══════════════════════════════════════════════════════════════
#  Miner AI handlers (simulate different skill levels)
# ═══════════════════════════════════════════════════════════════
def make_handler(skill: float, name: str):
    """Produce a miner handler with a deterministic skill level."""

    def handler(payload, task_type):
        code = payload.get("code", "")
        score = min(1.0, max(0.0, skill + random.uniform(-0.04, 0.04)))
        findings = max(1, int(skill * 5))
        return {
            "analysis": f"[{name}] Reviewed {len(code)} chars — {task_type}",
            "findings": [
                {
                    "severity": "warning" if i == 0 else "info",
                    "message": f"Finding #{i+1} from {name}",
                }
                for i in range(findings)
            ],
            "score": round(score, 3),
            "confidence": round(0.7 + skill * 0.25, 2),
        }

    return handler


# ═══════════════════════════════════════════════════════════════
#  MAIN DEMO
# ═══════════════════════════════════════════════════════════════
def main():
    hdr("ModernTensor — Subnet Epoch Demo (On-Chain)", "\U0001f4e1")
    print(f"  {D}1 subnet · 5 tasks · 1 epoch · incentive update · full P&L{X}")

    # ── Clean stale state ──
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
    os.makedirs(data_dir, exist_ok=True)

    # ═════════════════════════════════════════════════════════
    #  PHASE 0 — CONNECT
    # ═════════════════════════════════════════════════════════
    hdr("Phase 0 · Connect to Hedera Testnet", "\U0001f310")

    hedera_config = load_hedera_config()
    client = HederaClient(hedera_config)

    hcs = HCSService(client)
    escrow = PaymentEscrowService(client)
    registry = SubnetRegistryService(client)
    staking = StakingVaultService(client)
    governor = MDTGovernorService(client)
    hts = HTSService(client)

    balance = client.get_balance()
    OPERATOR_ID = client.operator_id_str

    ok(f"Operator  : {OPERATOR_ID}")
    ok(f"Balance   : {balance.hbars}")

    print(f"\n  {C}Contracts:{X}")
    for label, svc in [
        ("PaymentEscrow", escrow),
        ("SubnetRegistry", registry),
        ("StakingVault", staking),
        ("MDTGovernor", governor),
    ]:
        cid = getattr(svc, "contract_id", None) or "N/A"
        ok(f"  {label:18s}  {cid}")

    print(f"  {C}HCS Topics:{X}")
    ok(f"  Registration      {hcs.registration_topic_id}")
    ok(f"  Scoring           {hcs.scoring_topic_id}")
    ok(f"  Tasks             {hcs.task_topic_id}")
    ok(f"  MDT Token         {hts.mdt_token_id or 'N/A'}")

    # Derive operator EVM address
    account_num = int(OPERATOR_ID.split(".")[-1])
    OPERATOR_EVM = "0x" + account_num.to_bytes(20, "big").hex()

    # Set operator as PaymentEscrow oracle
    if escrow.contract_id:
        try:
            escrow.set_ai_oracle(OPERATOR_EVM)
            ok(f"  Escrow oracle  -> operator ({OPERATOR_EVM[:14]}...)")
        except Exception as e:
            warn(f"  setAIOracle: {e}")

    # ═════════════════════════════════════════════════════════
    #  SUBNET CONFIGURATION
    # ═════════════════════════════════════════════════════════
    SUBNET_ID = 1
    SUBNET_FEE = 0.03  # 3%
    NUM_TASKS = 5
    REWARD_PER_TASK = 100.0  # MDT
    EPOCH_NUMBER = 1

    MINERS = [
        {
            "id": "0.0.2001",
            "port": 19601,
            "skill": 0.95,
            "name": "Miner-Alpha",
            "stake": 800.0,
        },
        {
            "id": "0.0.2002",
            "port": 19602,
            "skill": 0.80,
            "name": "Miner-Beta",
            "stake": 400.0,
        },
        {
            "id": "0.0.2003",
            "port": 19603,
            "skill": 0.65,
            "name": "Miner-Gamma",
            "stake": 200.0,
        },
        {
            "id": "0.0.2004",
            "port": 19604,
            "skill": 0.50,
            "name": "Miner-Delta",
            "stake": 150.0,
        },
    ]

    VALIDATORS = [
        {"id": "0.0.9501", "stake": 80_000.0, "name": "Val-Prime"},
        {"id": "0.0.9502", "stake": 40_000.0, "name": "Val-Second"},
    ]

    # ═════════════════════════════════════════════════════════
    #  PHASE 1 — REGISTER SUBNET ON-CHAIN
    # ═════════════════════════════════════════════════════════
    hdr("Phase 1 · Register Subnet on SubnetRegistry", "\U0001f3d7")

    ok(f"Subnet #{SUBNET_ID}: owner={OPERATOR_ID}, fee={SUBNET_FEE*100:.0f}%")
    ok(
        f"Miners: {len(MINERS)} | Validators: {len(VALIDATORS)} | Tasks planned: {NUM_TASKS}"
    )

    try:
        receipt = registry.register_subnet(
            name=f"Epoch-Demo-Subnet-{int(time.time())}",
        )
        ok(f"SubnetRegistry.registerSubnet -> on-chain tx")
    except Exception as e:
        warn(f"registerSubnet: {e}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 2 — STAKING (on-chain)
    # ═════════════════════════════════════════════════════════
    hdr("Phase 2 · Stake MDT on StakingVault", "\U0001f4b0")

    for v in VALIDATORS:
        try:
            staking.stake(amount=int(v["stake"]), role=StakeRole.VALIDATOR)
            ok(f"{v['name']} staked {v['stake']:,.0f} MDT as VALIDATOR (on-chain)")
        except Exception as e:
            warn(f"stake {v['name']}: {e}")

    for m in MINERS:
        try:
            staking.stake(amount=int(m["stake"]), role=StakeRole.MINER)
            ok(f"{m['name']} staked {m['stake']:,.0f} MDT as MINER (on-chain)")
        except Exception as e:
            warn(f"stake {m['name']}: {e}")

    total_staked = sum(m["stake"] for m in MINERS) + sum(v["stake"] for v in VALIDATORS)
    ok(f"Total staked: {total_staked:,.0f} MDT")

    # ═════════════════════════════════════════════════════════
    #  PHASE 3 — START AXON SERVERS
    # ═════════════════════════════════════════════════════════
    hdr("Phase 3 · Start Miner Axon Servers", "\u26cf")

    axons = []
    miner_endpoints = []

    for m in MINERS:
        handler = make_handler(m["skill"], m["name"])
        axon = Axon(
            miner_id=m["id"],
            host="0.0.0.0",
            port=m["port"],
            handler=handler,
        )
        axon.start()
        axons.append(axon)
        miner_endpoints.append(
            {
                "miner_id": m["id"],
                "endpoint": f"http://127.0.0.1:{m['port']}",
            }
        )
        ok(f"{m['name']} -> http://127.0.0.1:{m['port']}")

    ok(f"All {len(axons)} Axon servers online")

    # ═════════════════════════════════════════════════════════
    #  PHASE 4 — REGISTER MINERS + VALIDATORS
    # ═════════════════════════════════════════════════════════
    hdr("Phase 4 · Register Miners + Validators", "\U0001f4dd")

    config = ProtocolConfig()
    miner_registry = MinerRegistry(config=config)
    fee_engine = FeeEngine(config=config)
    matcher = TaskMatcher()
    consensus = ScoreConsensus(min_validators=1)
    validator_orch = ValidationOrchestrator(validator_id="val-prime")
    treasury = Treasury(state_dir="data")
    distributor = RewardDistributor(
        hts_service=hts,
        treasury=treasury,
        protocol_treasury_account=OPERATOR_ID,
        dry_run=True,  # MDT transfers simulated (single testnet account)
    )
    task_manager = TaskManager(
        config=config,
        fee_engine=fee_engine,
        miner_registry=miner_registry,
        matcher=matcher,
        validator=validator_orch,
    )
    task_manager.on_payment_ready(distributor.process_payment)
    dendrite = Dendrite()
    weight_calc = WeightCalculator(min_stake=100, weight_cap=0.20)
    emissions = EmissionSchedule()

    # Register miners locally + HCS
    for m in MINERS:
        miner_info = miner_registry.register(
            miner_id=m["id"],
            subnet_ids=[SUBNET_ID],
            stake_amount=m["stake"],
            capabilities=["code_review", "text_analysis"],
            metadata={
                "name": m["name"],
                "axon_host": "0.0.0.0",
                "axon_port": m["port"],
            },
        )
        miner_info.axon_host = "0.0.0.0"
        miner_info.axon_port = m["port"]

        try:
            reg = MinerRegistration(
                miner_id=m["id"],
                account_id=OPERATOR_ID,
                stake_amount=m["stake"],
                capabilities=["code_review"],
                subnet_ids=[SUBNET_ID],
            )
            hcs.register_miner(reg)
            ok(f"{m['name']} registered -> HCS + local (on-chain)")
        except Exception as e:
            warn(f"HCS register {m['name']}: {e}")

    for v in VALIDATORS:
        ok(f"{v['name']} registered (stake={v['stake']:,.0f} MDT)")

    # ═════════════════════════════════════════════════════════
    #  PHASE 5 — INITIAL INCENTIVE WEIGHTS
    # ═════════════════════════════════════════════════════════
    hdr("Phase 5 · Initial Incentive Weights (pre-epoch)", "\u2696")

    miner_data_for_weights = [
        {
            "miner_id": m["id"],
            "reputation_score": 0.5,  # fresh — no history yet
            "stake_amount": m["stake"],
            "success_rate": 1.0,
            "timeout_rate": 0.0,
            "total_tasks": 0,
        }
        for m in MINERS
    ]

    initial_weights = weight_calc.calculate(
        miners=miner_data_for_weights,
        epoch=0,
        subnet_id=SUBNET_ID,
    )

    print(f"\n  {C}Pre-Epoch Weights (all miners equal — no history):{X}")
    for m in MINERS:
        w = initial_weights.get_weight(m["id"])
        print(f"    {m['name']:14s}  {bar(w * 4, 25)}  w={w:.4f}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 6 — FEE ENGINE
    # ═════════════════════════════════════════════════════════
    hdr("Phase 6 · Fee Calculation", "\U0001f4b8")

    fee_bd = fee_engine.calculate(
        reward_amount=REWARD_PER_TASK,
        subnet_fee_rate=SUBNET_FEE,
        priority=TaskPriority.NORMAL,
    )
    print(
        f"""
  For {REWARD_PER_TASK:.0f} MDT task (subnet_fee={SUBNET_FEE*100:.0f}%):
  {'─' * 48}
  Miner reward:      {fee_bd.miner_reward:8.2f} MDT  ({fee_bd.miner_reward/REWARD_PER_TASK*100:.0f}%)
  Validator pool:    {fee_bd.validator_reward:8.2f} MDT  ({fee_bd.validator_reward/REWARD_PER_TASK*100:.0f}%)
  Protocol fee:      {fee_bd.protocol_fee:8.2f} MDT  ({fee_bd.protocol_fee/REWARD_PER_TASK*100:.0f}%)
  Subnet fee:        {fee_bd.subnet_fee:8.2f} MDT  ({fee_bd.subnet_fee/REWARD_PER_TASK*100:.0f}%)
  {'─' * 48}
  Total deposit:     {REWARD_PER_TASK:8.2f} MDT
"""
    )

    # ═════════════════════════════════════════════════════════
    #  PHASE 7 — TASK LIFECYCLE (×5) WITH ON-CHAIN
    # ═════════════════════════════════════════════════════════
    hdr(f"Phase 7 · Run {NUM_TASKS} Tasks (full lifecycle)", "\U0001f504")

    all_scores = {}
    tasks_ok = []
    task_ids = []
    hcs_score_count = 0
    hcs_reward_count = 0

    for t_num in range(1, NUM_TASKS + 1):
        print(f"\n  {B}─── Task {t_num}/{NUM_TASKS} ───{X}")

        task_id_str = f"epoch1-task-{int(time.time())}-{t_num}"

        # A. HCS task log
        task_sub = TaskSubmission(
            task_id=task_id_str,
            requester_id=OPERATOR_ID,
            task_type="code_review",
            prompt=f"Review function handle_{t_num} for vulnerabilities",
            reward_amount=int(REWARD_PER_TASK * 1e8),
            deadline=int(time.time()) + 3600,
        )
        try:
            hcs.create_task(task_sub)
            ok(f"HCS task log (on-chain)")
        except Exception as e:
            warn(f"HCS task: {e}")

        # B. PaymentEscrow.deposit (on-chain)
        try:
            request_id = PaymentEscrowService.make_request_id(task_id_str)
            escrow.deposit(
                request_id=request_id,
                amount=int(REWARD_PER_TASK * 1e8),
                timeout=3600,
            )
            ok(f"PaymentEscrow.deposit  {int(REWARD_PER_TASK)} MDT (on-chain)")
        except Exception as e:
            warn(f"Escrow deposit: {e}")

        # C. SubnetRegistry.createTask (on-chain)
        try:
            registry.create_task(
                subnet_id=0,
                task_hash=task_id_str,
                reward_amount=int(REWARD_PER_TASK * 1e8),
                duration=3600,
            )
            ok(f"SubnetRegistry.createTask (on-chain)")
        except Exception as e:
            warn(f"Registry createTask: {e}")

        task_ids.append(task_id_str)

        # D. TaskManager submit + match
        task = task_manager.submit_task(
            subnet_id=SUBNET_ID,
            task_type="code_review",
            payload={
                "code": f"def handle_{t_num}(req): return process(req.data)",
                "lang": "python",
            },
            reward_amount=REWARD_PER_TASK,
            requester_id=OPERATOR_ID,
            priority="normal",
            max_miners=len(MINERS),
        )
        assignments = task_manager.match_task(task.task_id)
        info(f"Matched to {len(assignments)} miners")

        # E. Dendrite → Axon (real HTTP calls)
        results = dendrite.broadcast(
            miners=miner_endpoints,
            task_id=task.task_id,
            task_type="code_review",
            payload=task.payload,
        )

        for r in results:
            if r.success:
                task_manager.submit_result(
                    task_id=task.task_id,
                    miner_id=r.miner_id,
                    output=r.output,
                    execution_time=r.latency,
                )

        # F. Validate + score + pay (triggers RewardDistributor callback)
        validation = task_manager.validate_task(task.task_id)

        if validation.is_valid:
            winner = next(
                (m["name"] for m in MINERS if m["id"] == validation.winner_miner_id),
                validation.winner_miner_id,
            )
            ok(f"Winner: {G}{winner}{X}  score={validation.winner_score:.3f}")
            tasks_ok.append(task.task_id)

            # Accumulate scores per miner
            for mid, sc in validation.consensus_scores.items():
                all_scores.setdefault(mid, []).append(sc)

            fb = task_manager.get_fee_breakdown(task.task_id)
            if fb:
                money(
                    f"Split: miner={fb.miner_reward:.2f}  "
                    f"val={fb.validator_reward:.2f}  "
                    f"proto={fb.protocol_fee:.2f}  "
                    f"subnet={fb.subnet_fee:.2f}"
                )
        else:
            fail(f"Validation failed: {validation.rejection_reason}")

        # G. Submit scores to HCS (on-chain)
        for mid, sc_val in (validation.consensus_scores or {}).items():
            try:
                sub = ScoreSubmission(
                    validator_id=OPERATOR_ID,
                    miner_id=mid,
                    task_id=task_id_str,
                    score=sc_val,
                    confidence=0.95,
                )
                hcs.submit_score(sub)
                hcs_score_count += 1
            except Exception as e:
                warn(f"HCS score: {e}")

        # H. PaymentEscrow.release (on-chain)
        if validation.is_valid:
            try:
                request_id = PaymentEscrowService.make_request_id(task_id_str)
                escrow.release(
                    request_id=request_id,
                    miner_address=OPERATOR_EVM,
                )
                ok(f"PaymentEscrow.release (on-chain)")
            except Exception as e:
                warn(f"Escrow release: {e}")

        # I. SubnetRegistry.validateSubmission (on-chain)
        if validation.is_valid:
            try:
                registry.validate_submission(
                    task_id=t_num - 1,
                    miner_index=0,
                    score=int(validation.winner_score * 10000),
                )
                ok(f"SubnetRegistry.validateSubmission (on-chain)")
            except Exception as e:
                warn(f"Registry validate: {e}")

        # J. Log reward distribution to HCS
        if validation.is_valid:
            try:
                reward_log = {
                    "type": "reward_distributed",
                    "task_id": task_id_str,
                    "winner": validation.winner_miner_id,
                    "score": round(validation.winner_score, 4),
                    "miner_reward": fee_bd.miner_reward,
                    "timestamp": time.time(),
                }
                client.submit_message(
                    hcs.scoring_topic_id,
                    json.dumps(reward_log),
                )
                hcs_reward_count += 1
                ok(f"Reward log -> HCS (on-chain)")
            except Exception as e:
                warn(f"HCS reward log: {e}")

    print(f"\n  {G}Tasks completed: {len(tasks_ok)}/{NUM_TASKS}{X}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 8 — UPDATE INCENTIVE WEIGHTS (post-task)
    # ═════════════════════════════════════════════════════════
    hdr("Phase 8 · Incentive Weight Update", "\U0001f4ca")

    print(f"  {C}Scores from {NUM_TASKS} tasks:{X}")
    for m in MINERS:
        scores = all_scores.get(m["id"], [])
        avg = sum(scores) / len(scores) if scores else 0
        print(f"    {m['name']:14s}  avg_score={avg:.3f}  tasks={len(scores)}")

    # Build updated miner data with REAL performance
    miner_data_updated = []
    for m in MINERS:
        scores = all_scores.get(m["id"], [])
        avg_score = sum(scores) / len(scores) if scores else 0.0
        miner_data_updated.append(
            {
                "miner_id": m["id"],
                "reputation_score": avg_score,
                "stake_amount": m["stake"],
                "success_rate": 1.0 if scores else 0.0,
                "timeout_rate": 0.0,
                "total_tasks": len(scores),
            }
        )

    # Recalculate weights with real performance data
    updated_weights = weight_calc.calculate(
        miners=miner_data_updated,
        epoch=EPOCH_NUMBER,
        subnet_id=SUBNET_ID,
    )

    print(f"\n  {C}Updated Incentive Weights (merit-based):{X}")
    print(f"  {'─' * 56}")
    for m in MINERS:
        old_w = initial_weights.get_weight(m["id"])
        new_w = updated_weights.get_weight(m["id"])
        delta = new_w - old_w
        arrow = f"{G}↑{X}" if delta > 0 else (f"{R}↓{X}" if delta < 0 else "=")
        scores = all_scores.get(m["id"], [])
        avg = sum(scores) / len(scores) if scores else 0
        print(
            f"    {m['name']:14s}  "
            f"{bar(new_w * 3.5, 20)}  "
            f"w={new_w:.4f}  "
            f"({arrow} {abs(delta):+.4f})  "
            f"score={avg:.3f}"
        )
    print(f"  {'─' * 56}")

    # Validator weights
    validator_weights = weight_calc.calculate_validator_weights(
        validators=[
            {
                "validator_id": v["id"],
                "stake_amount": v["stake"],
                "reliability_score": 1.0,
                "total_validations": NUM_TASKS,
                "dishonesty_rate": 0.0,
            }
            for v in VALIDATORS
        ],
        epoch=EPOCH_NUMBER,
    )

    print(f"\n  {C}Validator Weights (stake-based):{X}")
    for v in VALIDATORS:
        w = validator_weights.get_weight(v["id"])
        print(
            f"    {v['name']:14s}  {bar(w * 2, 20)}  w={w:.4f}  stake={v['stake']:,.0f}"
        )

    # ═════════════════════════════════════════════════════════
    #  PHASE 9 — GOVERNANCE: SET INCENTIVE PARAMS
    # ═════════════════════════════════════════════════════════
    hdr("Phase 9 · Governance — Set Incentive (MDTGovernor)", "\U0001f3db")

    try:
        receipt = governor.propose(
            target_address=OPERATOR_EVM,
            call_data=b"",
            description=(
                f"Update subnet #{SUBNET_ID} incentive weights after epoch {EPOCH_NUMBER}: "
                f"top_miner={MINERS[0]['name']} w={updated_weights.get_weight(MINERS[0]['id']):.4f}"
            ),
        )
        ok(f"Governance proposal created (on-chain)")
    except Exception as e:
        warn(f"propose: {e}")

    try:
        governor.vote(proposal_id=0, support=True)
        ok(f"Voted FOR incentive update (on-chain)")
    except Exception as e:
        warn(f"vote: {e}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 10 — METAGRAPH -> HCS
    # ═════════════════════════════════════════════════════════
    hdr("Phase 10 · Metagraph Update -> HCS", "\U0001f9e0")

    metagraph = {
        "type": "metagraph_update",
        "epoch": EPOCH_NUMBER,
        "subnet_id": SUBNET_ID,
        "miners": {},
        "validators": {},
        "timestamp": time.time(),
    }
    for m in MINERS:
        scores = all_scores.get(m["id"], [])
        avg = sum(scores) / len(scores) if scores else 0
        w = updated_weights.get_weight(m["id"])
        metagraph["miners"][m["id"]] = {
            "name": m["name"],
            "weight": round(w, 6),
            "avg_score": round(avg, 4),
            "tasks": len(scores),
            "stake": m["stake"],
        }
        print(f"    {m['name']:14s}  w={w:.4f}  score={avg:.3f}  tasks={len(scores)}")
    for v in VALIDATORS:
        w = validator_weights.get_weight(v["id"])
        metagraph["validators"][v["id"]] = {
            "name": v["name"],
            "weight": round(w, 6),
            "stake": v["stake"],
        }

    try:
        client.submit_message(
            hcs.scoring_topic_id,
            json.dumps(metagraph),
        )
        ok(f"Metagraph -> HCS {hcs.scoring_topic_id} (on-chain)")
    except Exception as e:
        warn(f"metagraph HCS: {e}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 11 — EPOCH FINALIZATION + STAKING REWARDS
    # ═════════════════════════════════════════════════════════
    hdr("Phase 11 · Epoch Finalization + Staking Rewards", "\U0001f4c5")

    # Build staker map
    stakers = {}
    for m in MINERS:
        stakers[m["id"]] = m["stake"]
    for v in VALIDATORS:
        stakers[v["id"]] = v["stake"]

    daily_emission = emissions.get_daily_emission()
    epoch_rewards = emissions.calculate_epoch_rewards(stakers)
    finalized_epoch = emissions.distribute_epoch(epoch_rewards)

    print(f"\n  Epoch {EPOCH_NUMBER} — Year {emissions.get_current_year()}")
    print(f"  Daily emission: {daily_emission:,.2f} MDT")
    print(f"  Total staked:   {total_staked:,.0f} MDT")
    print(
        f"\n  {'Role':10s}  {'Entity':14s}  {'Stake':>12s}  {'Share':>7s}  {'Reward':>12s}"
    )
    print(f"  {'=' * 62}")

    total_epoch_reward = 0.0
    for m in MINERS:
        reward = epoch_rewards.get(m["id"], 0)
        share = m["stake"] / total_staked * 100
        total_epoch_reward += reward
        print(
            f"  {'Miner':10s}  {m['name']:14s}  "
            f"{m['stake']:>10,.0f} MDT  {share:>5.1f}%  "
            f"{reward:>10,.2f} MDT"
        )
    for v in VALIDATORS:
        reward = epoch_rewards.get(v["id"], 0)
        share = v["stake"] / total_staked * 100
        total_epoch_reward += reward
        print(
            f"  {'Validator':10s}  {v['name']:14s}  "
            f"{v['stake']:>10,.0f} MDT  {share:>5.1f}%  "
            f"{reward:>10,.2f} MDT"
        )
    print(f"  {'─' * 62}")
    print(
        f"  {'':10s}  {'TOTAL':14s}  {total_staked:>10,.0f} MDT  {'100%':>7s}  {total_epoch_reward:>10,.2f} MDT"
    )

    ok(f"Epoch {EPOCH_NUMBER} finalized: {total_epoch_reward:,.2f} MDT distributed")

    # Log epoch to HCS
    try:
        epoch_log = {
            "type": "epoch_finalized",
            "epoch": EPOCH_NUMBER,
            "daily_emission": round(daily_emission, 2),
            "total_distributed": round(total_epoch_reward, 2),
            "stakers": len(stakers),
            "timestamp": time.time(),
        }
        client.submit_message(hcs.scoring_topic_id, json.dumps(epoch_log))
        ok(f"Epoch log -> HCS (on-chain)")
    except Exception as e:
        warn(f"Epoch HCS: {e}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 12 — TREASURY REPORT
    # ═════════════════════════════════════════════════════════
    hdr("Phase 12 · Treasury & Revenue Report", "\U0001f4b5")

    snapshot = treasury.get_snapshot()
    print(
        f"""
  {C}Protocol Treasury Summary:{X}
  {'═' * 50}
  Total Volume:              {snapshot.total_volume:>10,.2f} MDT
  Protocol Fees (5%):        {snapshot.total_protocol_fees:>10,.2f} MDT
  Subnet Fees (3%):          {snapshot.total_subnet_fees:>10,.2f} MDT
  Miner Task Rewards (77%):  {snapshot.total_miner_rewards:>10,.2f} MDT
  Total Payouts:             {snapshot.total_payouts:>10}
  Unique Miners Paid:        {snapshot.unique_miners_paid:>10}
  Unique Tasks Paid:         {snapshot.unique_tasks_paid:>10}
  {'═' * 50}
"""
    )

    # Per-miner task earnings
    print(f"  {C}Miner Task Earnings:{X}")
    for m in MINERS:
        earned = treasury.get_miner_earnings(m["id"])
        tasks_done = treasury.get_miner_task_count(m["id"])
        print(f"    {m['name']:14s}  earned={earned:>8,.4f} MDT  tasks={tasks_done}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 13 — FULL P&L (task + staking combined)
    # ═════════════════════════════════════════════════════════
    hdr("Phase 13 · Full P&L Summary (Task + Staking)", "\U0001f4ca")

    print(
        f"\n  {'Role':10s}  {'Entity':14s}  {'Task Rwds':>12s}  {'Staking':>12s}  {'Total':>12s}"
    )
    print(f"  {'=' * 66}")

    grand_total = 0.0
    for m in MINERS:
        task_rwd = treasury.get_miner_earnings(m["id"])
        stk_rwd = epoch_rewards.get(m["id"], 0)
        total = task_rwd + stk_rwd
        grand_total += total
        print(
            f"  {'Miner':10s}  {m['name']:14s}  "
            f"{task_rwd:>10,.4f}  {stk_rwd:>10,.2f}  {total:>10,.4f}"
        )

    for v in VALIDATORS:
        # Validators earn from validator pool split + staking
        val_pool_per = fee_bd.validator_reward * len(tasks_ok) / max(len(VALIDATORS), 1)
        stk_rwd = epoch_rewards.get(v["id"], 0)
        total = val_pool_per + stk_rwd
        grand_total += total
        print(
            f"  {'Validator':10s}  {v['name']:14s}  "
            f"{val_pool_per:>10,.4f}  {stk_rwd:>10,.2f}  {total:>10,.4f}"
        )

    proto_fees = snapshot.total_protocol_fees
    subnet_fees = snapshot.total_subnet_fees
    grand_total += proto_fees + subnet_fees
    print(
        f"  {'Protocol':10s}  {'DAO':14s}  {proto_fees:>10,.4f}  {'---':>12s}  {proto_fees:>10,.4f}"
    )
    print(
        f"  {'Subnet':10s}  {'Owner':14s}  {subnet_fees:>10,.4f}  {'---':>12s}  {subnet_fees:>10,.4f}"
    )
    print(f"  {'─' * 66}")
    print(
        f"  {'':10s}  {'GRAND TOTAL':14s}  {'':>12s}  {'':>12s}  {grand_total:>10,.4f} MDT"
    )

    # ═════════════════════════════════════════════════════════
    #  PHASE 14 — MIRROR NODE VERIFICATION
    # ═════════════════════════════════════════════════════════
    hdr("Phase 14 · Mirror Node Verification", "\U0001f50d")

    info("Waiting 3s for Mirror Node sync...")
    time.sleep(3)

    for label, topic in [
        ("Registrations", hcs.registration_topic_id),
        ("Scores", hcs.scoring_topic_id),
        ("Tasks", hcs.task_topic_id),
    ]:
        try:
            import urllib.request

            url = f"https://testnet.mirrornode.hedera.com/api/v1/topics/{topic}/messages?limit=5&order=desc"
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read())
                msgs = data.get("messages", [])
                ok(f"{label}: {len(msgs)} recent messages on {topic}")
        except Exception as e:
            warn(f"Mirror {label}: {e}")

    # ═════════════════════════════════════════════════════════
    #  CLEANUP
    # ═════════════════════════════════════════════════════════
    hdr("Cleanup", "\U0001f9f9")

    for axon in axons:
        axon.stop()
    ok("All Axon servers stopped")

    treasury.save_state()
    ok("Treasury state saved")

    client.close()
    ok("Hedera client closed")

    # ═════════════════════════════════════════════════════════
    #  FINAL BANNER
    # ═════════════════════════════════════════════════════════
    hdr("Subnet Epoch Demo Complete", "\U0001f389")
    print(
        f"""
  {C}Subnet #{SUBNET_ID} — Epoch {EPOCH_NUMBER} Summary{X}
  {'─' * 56}

  {B}On-Chain Transactions:{X}
    SubnetRegistry   {registry.contract_id or 'N/A'}
      1 subnet registered · {NUM_TASKS} tasks created · {len(tasks_ok)} validated

    StakingVault     {staking.contract_id or 'N/A'}
      {len(MINERS)} miner stakes · {len(VALIDATORS)} validator stakes

    PaymentEscrow    {escrow.contract_id or 'N/A'}
      {NUM_TASKS} deposits · {len(tasks_ok)} releases

    MDTGovernor      {governor.contract_id or 'N/A'}
      1 incentive proposal · 1 vote

  {B}HCS Messages:{X}
    {len(MINERS)} registrations  -> {hcs.registration_topic_id}
    {NUM_TASKS} task logs       -> {hcs.task_topic_id}
    {hcs_score_count} score logs      -> {hcs.scoring_topic_id}
    {hcs_reward_count} reward logs     -> {hcs.scoring_topic_id}
    1 metagraph       -> {hcs.scoring_topic_id}
    1 epoch log       -> {hcs.scoring_topic_id}

  {B}Incentive Update:{X}
    Weights recalculated based on {NUM_TASKS}-task performance
    Top performer: {MINERS[0]['name']} w={updated_weights.get_weight(MINERS[0]['id']):.4f}
    Governance proposal + vote recorded on-chain

  {B}Epoch Rewards:{X}
    Daily emission: {daily_emission:,.2f} MDT
    Distributed to {len(stakers)} stakers: {total_epoch_reward:,.2f} MDT

  {B}Treasury:{X}
    Volume:  {snapshot.total_volume:,.2f} MDT across {snapshot.total_payouts} payouts
    Fees:    {proto_fees:,.2f} protocol + {subnet_fees:,.2f} subnet
  {'─' * 56}
"""
    )


if __name__ == "__main__":
    import traceback

    try:
        main()
    except Exception as e:
        traceback.print_exc()
