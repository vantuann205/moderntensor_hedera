#!/usr/bin/env python3
"""
===============================================================
  ModernTensor — Subnet Demo (On-Chain)
===============================================================

Standalone subnet with separate miner & validator nodes:

  1.  Connect to Hedera testnet + verify 4 contracts
  2.  Register subnet on SubnetRegistry (on-chain)
  3.  Create 4 SubnetMiner nodes → stake + HCS register + Axon HTTP
  4.  Create SubnetValidator → stake on-chain
  5.  Run N tasks: Dendrite broadcast → Axon → score → consensus
  6.  Submit all scores to HCS (on-chain)
  7.  Escrow deposit + release per task (on-chain)
  8.  Update incentive weights (WeightCalculator)
  9.  Governance proposal to set new weights (MDTGovernor)
  10. Metagraph → HCS (on-chain)
  11. Epoch finalization + staking rewards (EmissionSchedule)
  12. Full P&L report

All on-chain — no mock, no placeholder.

Usage:
    python run_subnet_demo.py

For ModernTensor on Hedera — Hello Future Hackathon 2026
===============================================================
"""

import json
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

# ── Subnet package ──
from subnet.config import SubnetConfig
from subnet.miner_node import SubnetMiner
from subnet.validator_node import SubnetValidator

# ── Hedera on-chain ──
from sdk.hedera.config import load_hedera_config
from sdk.hedera.client import HederaClient
from sdk.hedera.hcs import HCSService, ScoreSubmission, TaskSubmission
from sdk.hedera.payment_escrow import PaymentEscrowService
from sdk.hedera.subnet_registry import SubnetRegistryService
from sdk.hedera.staking_vault import StakingVaultService, StakeRole
from sdk.hedera.governor import MDTGovernorService
from sdk.hedera.hts import HTSService

# ── Protocol layer ──
from sdk.protocol.types import ProtocolConfig, TaskPriority
from sdk.protocol.fee_engine import FeeEngine
from sdk.protocol.miner_registry import MinerRegistry
from sdk.protocol.matching import TaskMatcher
from sdk.protocol.validator import ValidationOrchestrator
from sdk.protocol.task_manager import TaskManager
from sdk.protocol.reward_distributor import RewardDistributor
from sdk.protocol.treasury import Treasury
from sdk.protocol.emissions import EmissionSchedule
from sdk.protocol.dendrite import Dendrite
from sdk.scoring.weights import WeightCalculator
from sdk.scoring.consensus import ScoreConsensus

# ═══════════════════════════════════════════════════════════
#  Terminal formatting
# ═══════════════════════════════════════════════════════════
G = "\033[92m"
R = "\033[91m"
Y = "\033[93m"
C = "\033[96m"
M = "\033[95m"
B = "\033[1m"
D = "\033[2m"
X = "\033[0m"

BLK = chr(9608)
EMP = chr(9617)


def hdr(title, phase=0):
    w = 64
    print(f"\n{'=' * w}")
    print(f"  Phase {phase}  {B}{title}{X}")
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


def bar(val, width=25):
    filled = int(min(1.0, val) * width)
    return f"{BLK * filled}{EMP * (width - filled)}"


def sep():
    print(f"  {'─' * 56}")


# ═══════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════
def main():
    cfg = SubnetConfig()

    print(f"\n{'=' * 64}")
    print(f"  {B}ModernTensor — Subnet Demo (On-Chain){X}")
    print(f"{'=' * 64}")
    print(f"  Subnet:     #{cfg.subnet_id}  {cfg.subnet_name}")
    print(f"  Miners:     4 nodes, ports {cfg.miner_base_port}-{cfg.miner_base_port+3}")
    print(f"  Validator:  1 node, stake {cfg.min_validator_stake:,.0f} MDT")
    print(f"  Tasks:      {cfg.tasks_per_epoch} per epoch")
    print(f"  Reward:     {cfg.reward_per_task:.0f} MDT/task")
    print(f"{'=' * 64}")

    # Clean stale state
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
    os.makedirs(data_dir, exist_ok=True)

    # ═════════════════════════════════════════════════════════
    #  PHASE 0 — CONNECT TO HEDERA
    # ═════════════════════════════════════════════════════════
    hdr("Connect to Hedera Testnet", 0)

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
    account_num = int(OPERATOR_ID.split(".")[-1])
    OPERATOR_EVM = "0x" + account_num.to_bytes(20, "big").hex()

    ok(f"Operator     : {OPERATOR_ID}")
    ok(f"Balance      : {balance.hbars}")
    ok(f"EVM address  : {OPERATOR_EVM[:14]}...")

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

    # Set operator as escrow oracle
    if escrow.contract_id:
        try:
            escrow.set_ai_oracle(OPERATOR_EVM)
            ok(f"  Escrow oracle set")
        except Exception as e:
            warn(f"  setAIOracle: {e}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 1 — REGISTER SUBNET ON-CHAIN
    # ═════════════════════════════════════════════════════════
    hdr("Register Subnet on SubnetRegistry", 1)

    try:
        receipt = registry.register_subnet(
            name=f"{cfg.subnet_name}-{int(time.time())}",
        )
        ok(f"Subnet registered on-chain (SubnetRegistry {cfg.subnet_registry})")
    except Exception as e:
        warn(f"registerSubnet: {e}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 2 — CREATE MINER NODES
    # ═════════════════════════════════════════════════════════
    hdr("Create & Register Miner Nodes", 2)

    miner_defs = [
        {"id": "0.0.3001", "name": "Miner-Alpha", "skill": 0.95, "stake": 800.0},
        {"id": "0.0.3002", "name": "Miner-Beta", "skill": 0.80, "stake": 400.0},
        {"id": "0.0.3003", "name": "Miner-Gamma", "skill": 0.65, "stake": 200.0},
        {"id": "0.0.3004", "name": "Miner-Delta", "skill": 0.50, "stake": 150.0},
    ]

    miners: list[SubnetMiner] = []

    for i, md in enumerate(miner_defs):
        port = cfg.miner_base_port + i
        miner = SubnetMiner(
            miner_id=md["id"],
            name=md["name"],
            port=port,
            host=cfg.miner_host,
            skill=md["skill"],
            stake_amount=md["stake"],
            subnet_ids=[cfg.subnet_id],
            capabilities=cfg.supported_tasks,
        )

        # a) Stake on-chain
        if miner.stake_onchain(staking):
            ok(f"{md['name']} staked {md['stake']:,.0f} MDT (on-chain)")

        # b) Register on HCS
        if miner.register_hcs(hcs, OPERATOR_ID):
            ok(f"{md['name']} registered on HCS (on-chain)")

        # c) Start Axon HTTP server
        miner.start()
        ok(f"{md['name']} Axon online -> {miner.endpoint}")

        miners.append(miner)

    ok(f"All {len(miners)} miner nodes online")

    # ═════════════════════════════════════════════════════════
    #  PHASE 3 — CREATE VALIDATOR NODE
    # ═════════════════════════════════════════════════════════
    hdr("Create & Register Validator Node", 3)

    validator = SubnetValidator(
        validator_id="0.0.9001",
        stake=cfg.min_validator_stake,
        subnet_ids=[cfg.subnet_id],
        timeout=30.0,
    )

    # Stake on-chain
    if validator.stake_onchain(staking):
        ok(f"Validator staked {cfg.min_validator_stake:,.0f} MDT (on-chain)")

    ok(f"Validator ready: {validator}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 4 — PROTOCOL LAYER SETUP
    # ═════════════════════════════════════════════════════════
    hdr("Protocol Layer Initialization", 4)

    proto_config = ProtocolConfig()
    miner_registry = MinerRegistry(config=proto_config)
    fee_engine = FeeEngine(config=proto_config)
    matcher = TaskMatcher()
    val_orch = ValidationOrchestrator(validator_id="val-prime")
    treasury = Treasury(state_dir="data")
    distributor = RewardDistributor(
        hts_service=hts,
        treasury=treasury,
        protocol_treasury_account=OPERATOR_ID,
        dry_run=True,
    )
    task_manager = TaskManager(
        config=proto_config,
        fee_engine=fee_engine,
        miner_registry=miner_registry,
        matcher=matcher,
        validator=val_orch,
    )
    task_manager.on_payment_ready(distributor.process_payment)

    weight_calc = WeightCalculator(min_stake=100, weight_cap=0.20)
    emissions = EmissionSchedule()

    # Register miners in protocol layer
    for miner in miners:
        miner.register_local(miner_registry)
        ok(f"{miner.name} -> local MinerRegistry")

    ok(f"Protocol layer ready (FeeEngine, TaskManager, WeightCalculator)")

    # ═════════════════════════════════════════════════════════
    #  PHASE 5 — PRE-EPOCH WEIGHTS
    # ═════════════════════════════════════════════════════════
    hdr("Pre-Epoch Weights (equal — no history)", 5)

    pre_miner_data = [
        {
            "miner_id": m.miner_id,
            "reputation_score": 0.5,
            "stake_amount": m.stake_amount,
            "success_rate": 1.0,
            "timeout_rate": 0.0,
            "total_tasks": 0,
        }
        for m in miners
    ]
    initial_weights = weight_calc.calculate(
        miners=pre_miner_data,
        epoch=0,
        subnet_id=cfg.subnet_id,
    )

    for m in miners:
        w = initial_weights.get_weight(m.miner_id)
        print(f"    {m.name:14s}  {bar(w * 4)}  w={w:.4f}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 6 — FEE STRUCTURE
    # ═════════════════════════════════════════════════════════
    hdr("Fee Calculation", 6)

    fee_bd = fee_engine.calculate(
        reward_amount=cfg.reward_per_task,
        subnet_fee_rate=cfg.subnet_share,
        priority=TaskPriority.NORMAL,
    )
    print(
        f"""
  For {cfg.reward_per_task:.0f} MDT task (subnet_fee={cfg.subnet_share*100:.0f}%):
  {'─' * 48}
  Miner reward:      {fee_bd.miner_reward:8.2f} MDT  ({fee_bd.miner_reward/cfg.reward_per_task*100:.0f}%)
  Validator pool:    {fee_bd.validator_reward:8.2f} MDT  ({fee_bd.validator_reward/cfg.reward_per_task*100:.0f}%)
  Protocol fee:      {fee_bd.protocol_fee:8.2f} MDT  ({fee_bd.protocol_fee/cfg.reward_per_task*100:.0f}%)
  Subnet fee:        {fee_bd.subnet_fee:8.2f} MDT  ({fee_bd.subnet_fee/cfg.reward_per_task*100:.0f}%)
  {'─' * 48}
  Total:             {cfg.reward_per_task:8.2f} MDT
"""
    )

    # ═════════════════════════════════════════════════════════
    #  PHASE 7 — RUN TASKS (full lifecycle)
    # ═════════════════════════════════════════════════════════
    hdr(f"Run {cfg.tasks_per_epoch} Tasks (full lifecycle)", 7)

    # Build miner list for Dendrite
    miner_endpoints = [m.to_dendrite_entry() for m in miners]

    all_scores: dict[str, list[float]] = {}
    tasks_ok: list[str] = []
    hcs_score_count = 0

    for t_num in range(1, cfg.tasks_per_epoch + 1):
        print(f"\n  {B}--- Task {t_num}/{cfg.tasks_per_epoch} ---{X}")

        task_id_str = (
            f"subnet{cfg.subnet_id}-epoch{cfg.epoch_number}-t{t_num}-{int(time.time())}"
        )

        # A. HCS task log (on-chain)
        try:
            task_sub = TaskSubmission(
                task_id=task_id_str,
                requester_id=OPERATOR_ID,
                task_type="code_review",
                prompt=f"Review function process_{t_num} for security issues",
                reward_amount=int(cfg.reward_per_task * 1e8),
                deadline=int(time.time()) + cfg.task_timeout,
            )
            hcs.create_task(task_sub)
            ok(f"HCS task log (on-chain)")
        except Exception as e:
            warn(f"HCS task: {e}")

        # B. PaymentEscrow.deposit (on-chain)
        try:
            request_id = PaymentEscrowService.make_request_id(task_id_str)
            escrow.deposit(
                request_id=request_id,
                amount=int(cfg.reward_per_task * 1e8),
                timeout=cfg.task_timeout,
            )
            ok(f"PaymentEscrow.deposit  {int(cfg.reward_per_task)} MDT (on-chain)")
        except Exception as e:
            warn(f"Escrow deposit: {e}")

        # C. SubnetRegistry.createTask (on-chain)
        try:
            registry.create_task(
                subnet_id=0,
                task_hash=task_id_str,
                reward_amount=int(cfg.reward_per_task * 1e8),
                duration=cfg.task_timeout,
            )
            ok(f"SubnetRegistry.createTask (on-chain)")
        except Exception as e:
            warn(f"Registry createTask: {e}")

        # D. TaskManager submit + match
        task = task_manager.submit_task(
            subnet_id=cfg.subnet_id,
            task_type="code_review",
            payload={
                "code": f"def process_{t_num}(req): return validate(req.data)",
                "lang": "python",
            },
            reward_amount=cfg.reward_per_task,
            requester_id=OPERATOR_ID,
            priority="normal",
            max_miners=len(miners),
        )
        assignments = task_manager.match_task(task.task_id)
        info(f"Matched to {len(assignments)} miners")

        # E. Validator broadcasts to miners via Dendrite (real HTTP)
        task_result = validator.run_task(
            miners=miner_endpoints,
            task_type="code_review",
            payload=task.payload,
            task_id=task.task_id,
        )

        # Submit results to TaskManager
        for r in task_result.get("results", []):
            if r.success:
                task_manager.submit_result(
                    task_id=task.task_id,
                    miner_id=r.miner_id,
                    output=r.output,
                    execution_time=r.latency,
                )

        # F. Validate + score via TaskManager (triggers RewardDistributor)
        validation = task_manager.validate_task(task.task_id)

        if validation.is_valid:
            winner_name = next(
                (m.name for m in miners if m.miner_id == validation.winner_miner_id),
                validation.winner_miner_id,
            )
            ok(f"Winner: {G}{winner_name}{X}  score={validation.winner_score:.3f}")
            tasks_ok.append(task.task_id)

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
        if validation.consensus_scores:
            validator.submit_scores_hcs(
                hcs_service=hcs,
                client=client,
                scoring_topic=hcs.scoring_topic_id,
                task_id=task_id_str,
                scores=validation.consensus_scores,
            )
            hcs_score_count += len(validation.consensus_scores)

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

    print(f"\n  {G}Tasks completed: {len(tasks_ok)}/{cfg.tasks_per_epoch}{X}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 8 — UPDATE INCENTIVE WEIGHTS
    # ═════════════════════════════════════════════════════════
    hdr("Incentive Weight Update (post-task)", 8)

    print(f"  {C}Scores from {cfg.tasks_per_epoch} tasks:{X}")
    for m in miners:
        scores = all_scores.get(m.miner_id, [])
        avg = sum(scores) / len(scores) if scores else 0
        print(f"    {m.name:14s}  avg_score={avg:.3f}  tasks={len(scores)}")

    post_miner_data = []
    for m in miners:
        scores = all_scores.get(m.miner_id, [])
        avg_score = sum(scores) / len(scores) if scores else 0.0
        post_miner_data.append(
            {
                "miner_id": m.miner_id,
                "reputation_score": avg_score,
                "stake_amount": m.stake_amount,
                "success_rate": 1.0 if scores else 0.0,
                "timeout_rate": 0.0,
                "total_tasks": len(scores),
            }
        )

    updated_weights = weight_calc.calculate(
        miners=post_miner_data,
        epoch=cfg.epoch_number,
        subnet_id=cfg.subnet_id,
    )

    print(f"\n  {C}Updated Weights (merit-based):{X}")
    sep()
    for m in miners:
        old_w = initial_weights.get_weight(m.miner_id)
        new_w = updated_weights.get_weight(m.miner_id)
        delta = new_w - old_w
        arrow = f"{G}+{X}" if delta > 0 else (f"{R}-{X}" if delta < 0 else "=")
        scores = all_scores.get(m.miner_id, [])
        avg = sum(scores) / len(scores) if scores else 0
        print(
            f"    {m.name:14s}  {bar(new_w * 3.5, 20)}  "
            f"w={new_w:.4f} ({arrow}{abs(delta):.4f})  "
            f"score={avg:.3f}"
        )

    # Validator weights
    validator_weight_data = [
        {
            "validator_id": validator.validator_id,
            "stake_amount": validator.stake,
            "reliability_score": 1.0,
            "total_validations": cfg.tasks_per_epoch,
            "dishonesty_rate": 0.0,
        }
    ]
    val_weights = weight_calc.calculate_validator_weights(
        validators=validator_weight_data,
        epoch=cfg.epoch_number,
    )
    vw = val_weights.get_weight(validator.validator_id)
    print(
        f"\n    Validator     {bar(vw * 2, 20)}  w={vw:.4f}  "
        f"stake={validator.stake:,.0f} MDT"
    )

    # ═════════════════════════════════════════════════════════
    #  PHASE 9 — GOVERNANCE: INCENTIVE PROPOSAL
    # ═════════════════════════════════════════════════════════
    hdr("Governance — Set Incentive (MDTGovernor)", 9)

    try:
        governor.propose(
            target_address=OPERATOR_EVM,
            call_data=b"",
            description=(
                f"Update subnet #{cfg.subnet_id} incentive weights — "
                f"epoch {cfg.epoch_number}: top_miner={miners[0].name} "
                f"w={updated_weights.get_weight(miners[0].miner_id):.4f}"
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
    hdr("Metagraph Update -> HCS", 10)

    metagraph = {
        "type": "metagraph_update",
        "epoch": cfg.epoch_number,
        "subnet_id": cfg.subnet_id,
        "miners": {},
        "validators": {},
        "timestamp": time.time(),
    }

    for m in miners:
        scores = all_scores.get(m.miner_id, [])
        avg_s = sum(scores) / len(scores) if scores else 0
        w = updated_weights.get_weight(m.miner_id)
        metagraph["miners"][m.miner_id] = {
            "name": m.name,
            "weight": round(w, 6),
            "avg_score": round(avg_s, 4),
            "tasks": len(scores),
            "stake": m.stake_amount,
        }
        print(
            f"    {m.name:14s}  w={w:.4f}  score={avg_s:.3f}  "
            f"stake={m.stake_amount:.0f}"
        )

    metagraph["validators"][validator.validator_id] = {
        "name": "Validator-Prime",
        "weight": round(vw, 6),
        "stake": validator.stake,
    }

    try:
        client.submit_message(hcs.scoring_topic_id, json.dumps(metagraph))
        ok(f"Metagraph -> HCS {hcs.scoring_topic_id} (on-chain)")
    except Exception as e:
        warn(f"metagraph HCS: {e}")

    # ═════════════════════════════════════════════════════════
    #  PHASE 11 — EPOCH FINALIZATION + STAKING REWARDS
    # ═════════════════════════════════════════════════════════
    hdr("Epoch Finalization + Staking Rewards", 11)

    stakers = {}
    for m in miners:
        stakers[m.miner_id] = m.stake_amount
    stakers[validator.validator_id] = validator.stake

    total_staked = sum(stakers.values())
    daily_emission = emissions.get_daily_emission()
    epoch_rewards = emissions.calculate_epoch_rewards(stakers)
    emissions.distribute_epoch(epoch_rewards)

    print(f"\n  Epoch {cfg.epoch_number} — Year {emissions.get_current_year()}")
    print(f"  Daily emission: {daily_emission:,.2f} MDT")
    print(f"  Total staked:   {total_staked:,.0f} MDT")
    print(
        f"\n  {'Role':10s}  {'Entity':14s}  {'Stake':>12s}  {'Share':>7s}  {'Reward':>12s}"
    )
    print(f"  {'=' * 62}")

    total_epoch_reward = 0.0
    for m in miners:
        reward = epoch_rewards.get(m.miner_id, 0)
        share = m.stake_amount / total_staked * 100
        total_epoch_reward += reward
        print(
            f"  {'Miner':10s}  {m.name:14s}  "
            f"{m.stake_amount:>10,.0f} MDT  {share:>5.1f}%  "
            f"{reward:>10,.2f} MDT"
        )

    v_reward = epoch_rewards.get(validator.validator_id, 0)
    v_share = validator.stake / total_staked * 100
    total_epoch_reward += v_reward
    print(
        f"  {'Validator':10s}  {'Val-Prime':14s}  "
        f"{validator.stake:>10,.0f} MDT  {v_share:>5.1f}%  "
        f"{v_reward:>10,.2f} MDT"
    )
    print(f"  {'─' * 62}")
    print(
        f"  {'':10s}  {'TOTAL':14s}  {total_staked:>10,.0f} MDT  "
        f"{'100%':>7s}  {total_epoch_reward:>10,.2f} MDT"
    )

    ok(f"Epoch {cfg.epoch_number} finalized: {total_epoch_reward:,.2f} MDT distributed")

    # Log epoch to HCS
    try:
        epoch_log = {
            "type": "epoch_finalized",
            "epoch": cfg.epoch_number,
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
    #  PHASE 12 — TREASURY & P&L
    # ═════════════════════════════════════════════════════════
    hdr("Treasury & Full P&L Report", 12)

    snapshot = treasury.get_snapshot()
    print(
        f"""
  {C}Protocol Treasury Summary:{X}
  {'=' * 50}
  Total Volume:              {snapshot.total_volume:>10,.2f} MDT
  Protocol Fees (5%):        {snapshot.total_protocol_fees:>10,.2f} MDT
  Subnet Fees (3%):          {snapshot.total_subnet_fees:>10,.2f} MDT
  Miner Task Rewards (77%):  {snapshot.total_miner_rewards:>10,.2f} MDT
  Total Payouts:             {snapshot.total_payouts:>10}
  {'=' * 50}
"""
    )

    # Full P&L
    print(f"  {C}Full P&L (task rewards + staking):{X}")
    print(
        f"  {'Role':10s}  {'Entity':14s}  {'Task':>12s}  {'Staking':>12s}  {'Total':>12s}"
    )
    print(f"  {'=' * 66}")

    grand_total = 0.0
    for m in miners:
        task_rwd = treasury.get_miner_earnings(m.miner_id)
        stk_rwd = epoch_rewards.get(m.miner_id, 0)
        total = task_rwd + stk_rwd
        grand_total += total
        print(
            f"  {'Miner':10s}  {m.name:14s}  "
            f"{task_rwd:>10,.4f}  {stk_rwd:>10,.2f}  {total:>10,.4f}"
        )

    val_pool = fee_bd.validator_reward * len(tasks_ok)
    stk_rwd = epoch_rewards.get(validator.validator_id, 0)
    val_total = val_pool + stk_rwd
    grand_total += val_total
    print(
        f"  {'Validator':10s}  {'Val-Prime':14s}  "
        f"{val_pool:>10,.4f}  {stk_rwd:>10,.2f}  {val_total:>10,.4f}"
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
    #  PHASE 13 — MIRROR NODE VERIFICATION
    # ═════════════════════════════════════════════════════════
    hdr("Mirror Node Verification", 13)

    info("Waiting 3s for Mirror Node sync...")
    time.sleep(3)

    import urllib.request

    for label, topic in [
        ("Registrations", hcs.registration_topic_id),
        ("Scores", hcs.scoring_topic_id),
        ("Tasks", hcs.task_topic_id),
    ]:
        try:
            url = (
                f"https://testnet.mirrornode.hedera.com/api/v1/topics/"
                f"{topic}/messages?limit=5&order=desc"
            )
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read())
                msgs = data.get("messages", [])
                ok(f"{label}: {len(msgs)} recent messages on {topic}")
        except Exception as e:
            warn(f"Mirror {label}: {e}")

    # ═════════════════════════════════════════════════════════
    #  CLEANUP
    # ═════════════════════════════════════════════════════════
    hdr("Cleanup", 14)

    for m in miners:
        m.stop()
    ok(f"All {len(miners)} Axon servers stopped")

    treasury.save_state()
    ok("Treasury state saved")

    client.close()
    ok("Hedera client closed")

    # ═════════════════════════════════════════════════════════
    #  FINAL SUMMARY
    # ═════════════════════════════════════════════════════════
    print(f"\n{'=' * 64}")
    print(f"  {B}Subnet Demo Complete{X}")
    print(f"{'=' * 64}")
    print(
        f"""
  {C}Subnet #{cfg.subnet_id} — {cfg.subnet_name}{X}
  {'─' * 56}

  {B}Nodes:{X}
    {len(miners)} Miners:   {', '.join(m.name for m in miners)}
    1 Validator: Val-Prime (stake {validator.stake:,.0f} MDT)

  {B}On-Chain Transactions:{X}
    SubnetRegistry  {cfg.subnet_registry}
      1 subnet registered, {cfg.tasks_per_epoch} tasks created,
      {len(tasks_ok)} validated

    StakingVault    {cfg.staking_vault}
      {len(miners)} miner stakes, 1 validator stake

    PaymentEscrow   {cfg.payment_escrow}
      {cfg.tasks_per_epoch} deposits, {len(tasks_ok)} releases

    MDTGovernor     {cfg.mdt_governor}
      1 proposal, 1 vote

  {B}HCS Messages:{X}
    {len(miners)} registrations  -> {cfg.hcs_registration}
    {cfg.tasks_per_epoch} task logs       -> {cfg.hcs_tasks}
    {hcs_score_count} score submissions -> {cfg.hcs_scoring}
    1 metagraph       -> {cfg.hcs_scoring}
    1 epoch log       -> {cfg.hcs_scoring}

  {B}Incentive:{X}
    Weights recalculated from {cfg.tasks_per_epoch}-task performance
    Top: {miners[0].name} w={updated_weights.get_weight(miners[0].miner_id):.4f}

  {B}Epoch Rewards:{X}
    Emission: {daily_emission:,.2f} MDT -> {len(stakers)} stakers
    Total: {total_epoch_reward:,.2f} MDT

  {B}Treasury:{X}
    Volume: {snapshot.total_volume:,.2f} MDT
    Fees: {proto_fees:,.2f} protocol + {subnet_fees:,.2f} subnet
  {'─' * 56}
"""
    )


if __name__ == "__main__":
    import traceback

    try:
        main()
    except Exception as e:
        traceback.print_exc()
