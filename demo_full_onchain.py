#!/usr/bin/env python3
"""Full on-chain demo — ALL 4 deployed contracts + HCS + Axon/Dendrite."""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv; load_dotenv()

from sdk.hedera.config import load_hedera_config
from sdk.hedera.client import HederaClient
from sdk.hedera.hcs import HCSService, MinerRegistration, ScoreSubmission, TaskSubmission
from sdk.hedera.contracts import SmartContractService
from sdk.hedera.subnet_registry import SubnetRegistryService
from sdk.hedera.staking_vault import StakingVaultService, StakeRole
from sdk.hedera.governor import MDTGovernorService
from sdk.protocol.axon import Axon
from sdk.protocol.dendrite import Dendrite
from sdk.scoring.weights import WeightCalculator
from sdk.scoring.consensus import ScoreConsensus
import random

G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; C = "\033[96m"
B = "\033[1m"; D = "\033[2m"; X = "\033[0m"

def header(t, e=""):
    print(f"\n{'='*60}\n  {e}  {B}{t}{X}\n{'='*60}")

def ok(msg):    print(f"  {G}✓{X} {msg}")
def warn(msg):  print(f"  {Y}⚠{X} {msg}")
def fail(msg):  print(f"  {R}✗{X} {msg}")

def main():
    header("ModernTensor Full On-Chain Demo", "🔗")
    print(f"  {D}All 4 contracts + HCS + Axon/Dendrite + Mirror Node{X}")

    config = load_hedera_config()
    client = HederaClient(config)
    hcs = HCSService(client)

    escrow = SmartContractService(client)
    registry = SubnetRegistryService(client)
    staking = StakingVaultService(client)
    governor = MDTGovernorService(client)

    balance = client.get_balance()
    ok(f"Connected: {client.operator_id_str}")
    ok(f"Balance: {balance.hbars}")
    ok(f"HCS: reg={hcs.registration_topic_id} score={hcs.scoring_topic_id} task={hcs.task_topic_id}")
    print(f"\n  {C}Smart Contracts:{X}")
    ok(f"PaymentEscrow:   {escrow.contract_id or 'N/A'}")
    ok(f"SubnetRegistry:  {registry.contract_id or 'N/A'}")
    ok(f"StakingVault:    {staking.contract_id or 'N/A'}")
    ok(f"MDTGovernor:     {governor.contract_id or 'N/A'}")

    # ── PHASE 1: SubnetRegistry — Register subnet ──
    header("Phase 1: Register Subnet (SubnetRegistry)", "🌐")
    try:
        receipt = registry.register_subnet(
            name="AI-CodeReview-v1", min_validations=3, min_stake=100_00000000,
        )
        ok("Subnet registered on SubnetRegistry (on-chain tx)")
    except Exception as e:
        warn(f"SubnetRegistry.registerSubnet: {e}")

    # ── PHASE 2: StakingVault — Stake tokens ──
    header("Phase 2: Stake MDT (StakingVault)", "💰")
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

    # ── PHASE 3: Start Axon servers ──
    header("Phase 3: Start Miner Axon Servers", "⛏️")
    miners = [
        {"id": "0.0.1001", "port": 19201, "skill": 0.90, "name": "AlphaAI"},
        {"id": "0.0.1002", "port": 19202, "skill": 0.75, "name": "BetaML"},
        {"id": "0.0.1003", "port": 19203, "skill": 0.55, "name": "GammaBot"},
    ]
    def mkhandler(skill, name):
        def h(payload, tt):
            s = min(1.0, skill + random.uniform(-0.05, 0.05))
            return {"analysis": f"[{name}] reviewed", "score": round(s, 3),
                    "confidence": round(0.7 + skill*0.25, 2),
                    "findings": [{"msg": f"f{i}"} for i in range(int(skill*5))]}
        return h
    axons = []
    for m in miners:
        ax = Axon(miner_id=m["id"], handler=mkhandler(m["skill"], m["name"]),
                  port=m["port"], subnet_ids=[1])
        ax.start(); axons.append(ax)
        ok(f"{m['name']} -> {ax.endpoint}")
    time.sleep(0.5)

    # ── PHASE 4: Register miners on HCS ──
    header("Phase 4: Register Miners on HCS", "📝")
    for m in miners:
        reg = MinerRegistration(
            miner_id=m["id"], account_id=client.operator_id_str,
            capabilities=["code_review"], subnet_ids=[1],
        )
        try:
            receipt = hcs.register_miner(reg)
            ok(f"{m['name']} registered on HCS")
        except Exception as e:
            fail(f"{m['name']}: {e}")

    # ── PHASE 5: Create task (HCS + PaymentEscrow + SubnetRegistry) ──
    header("Phase 5: Create Task (HCS + 2 Contracts)", "📋")
    task_id = f"task-{int(time.time())}"
    try:
        task_sub = TaskSubmission(
            task_id=task_id, requester_id=client.operator_id_str,
            task_type="code_review",
            prompt="Review token transfer for vulnerabilities",
            reward_amount=50_00000000, deadline=int(time.time())+3600,
        )
        receipt = hcs.create_task(task_sub)
        ok("Task on HCS")
    except Exception as e:
        fail(f"HCS task: {e}")

    try:
        receipt = escrow.create_task(task_hash=task_id, reward_amount=50_00000000, duration=3600)
        ok("Task on PaymentEscrow (on-chain tx)")
    except Exception as e:
        warn(f"PaymentEscrow.createTask: {e}")

    try:
        receipt = registry.create_task(subnet_id=0, task_hash=task_id, reward_amount=50_00000000, duration=3600)
        ok("Task on SubnetRegistry (on-chain tx)")
    except Exception as e:
        warn(f"SubnetRegistry.createTask: {e}")

    # ── PHASE 6: Dendrite -> Axon ──
    header("Phase 6: Dendrite -> Axon (Real HTTP)", "📤")
    dendrite = Dendrite(validator_id=client.operator_id_str, timeout=10)
    payload = {"code": "def transfer(s,r,a): debit(s,a); credit(r,a)", "lang": "py"}
    eps = [{"miner_id": m["id"], "endpoint": f"http://127.0.0.1:{m['port']}"} for m in miners]
    results = dendrite.broadcast(miners=eps, task_id=task_id, task_type="code_review", payload=payload)
    for r in results:
        nm = next((m["name"] for m in miners if m["id"]==r.miner_id), r.miner_id)
        if r.success:
            ok(f"{nm:10s} score={r.output.get('score','?')}, lat={r.latency:.3f}s")
        else:
            fail(f"{nm}: {r.error}")

    # ── PHASE 7: Score -> HCS + Contracts ──
    header("Phase 7: Score -> HCS + Contracts", "🎯")
    scores = {}
    for r in results:
        if r.success:
            scores[r.miner_id] = r.output.get("score", 0.5)
    consensus = ScoreConsensus()
    cons = consensus.aggregate(scores)
    winner = max(scores, key=scores.get) if scores else None
    wname = next((m["name"] for m in miners if m["id"]==winner), winner)
    print(f"  Consensus: {cons.consensus_score:.3f}, Winner: {G}{wname}{X}")

    for mid, s in scores.items():
        try:
            sub = ScoreSubmission(
                validator_id=client.operator_id_str, miner_id=mid,
                task_id=task_id, score=s, confidence=cons.consensus_score,
            )
            receipt = hcs.submit_score(sub)
            nm = next((m["name"] for m in miners if m["id"]==mid), mid)
            ok(f"{nm} score={s:.3f} -> HCS")
        except Exception as e:
            fail(f"Score for {mid}: {e}")

    try:
        receipt = escrow.validate_submission(task_id=0, miner_index=0, score=int(scores.get(winner, 0)*10000))
        ok("Score -> PaymentEscrow (on-chain tx)")
    except Exception as e:
        warn(f"PaymentEscrow.validate: {e}")

    try:
        receipt = registry.validate_submission(task_id=0, miner_index=0, score=int(scores.get(winner, 0)*10000))
        ok("Score -> SubnetRegistry (on-chain tx)")
    except Exception as e:
        warn(f"SubnetRegistry.validate: {e}")

    # ── PHASE 8: Governance (MDTGovernor) ──
    header("Phase 8: Governance (MDTGovernor)", "🏛️")
    try:
        from eth_abi import encode
        from eth_utils import function_signature_to_4byte_selector
        selector = function_signature_to_4byte_selector("setMinMinerStake(uint256)")
        encoded_args = encode(["uint256"], [200_00000000])
        call_data = selector + encoded_args
        staking_evm = "0x" + hex(int(staking.contract_id.split(".")[-1]))[2:].zfill(40)
        receipt = governor.propose(target_address=staking_evm, call_data=call_data,
                                   description="Increase min miner stake to 200 MDT")
        ok("Governance proposal created (on-chain tx)")
    except Exception as e:
        warn(f"MDTGovernor.propose: {e}")
    try:
        receipt = governor.vote(proposal_id=0, support=True)
        ok("Voted FOR proposal #0 (on-chain tx)")
    except Exception as e:
        warn(f"MDTGovernor.vote: {e}")

    # ── PHASE 9: Metagraph -> HCS ──
    header("Phase 9: Metagraph -> HCS", "🧠")
    calc = WeightCalculator(min_stake=100.0)
    mdata = [{"miner_id": m["id"], "reputation_score": scores.get(m["id"], 0.5),
              "stake_amount": 0, "success_rate": 0.8+m["skill"]*0.15,
              "timeout_rate": 0, "total_tasks": 1} for m in miners]
    weights = calc.calculate(mdata, epoch=1)
    metagraph = {"type": "metagraph_update", "epoch": 1,
                 "validator": client.operator_id_str,
                 "ts": time.time(), "subnet": 1, "miners": {}}
    for mid, w in weights.top_miners(10):
        nm = next((m["name"] for m in miners if m["id"]==mid), mid)
        bar = chr(9608)*int(w*40)+chr(9617)*(40-int(w*40))
        print(f"    {nm:10s} {bar} w={w:.4f}")
        metagraph["miners"][mid] = {"weight": round(w, 6), "score": round(scores.get(mid, 0), 4)}
    try:
        receipt = client.submit_message(topic_id=hcs.scoring_topic_id, message=json.dumps(metagraph))
        ok(f"{B}Metagraph submitted to HCS{X}")
    except Exception as e:
        fail(f"Metagraph: {e}")

    # ── PHASE 10: Mirror Node ──
    header("Phase 10: Mirror Node Query", "🔍")
    print("  Waiting 3s for sync...")
    time.sleep(3)
    for label, fn in [("Registrations", hcs.get_registrations),
                       ("Scores", hcs.get_scores), ("Tasks", hcs.get_tasks)]:
        try:
            msgs = fn(limit=3)
            print(f"\n  {label}:")
            for msg in msgs[-3:]:
                print(f"    - {json.dumps(msg)[:100]}")
            if not msgs:
                print(f"    {D}(syncing...){X}")
        except Exception as e:
            fail(str(e))

    # ── Cleanup ──
    header("Cleanup", "🧹")
    for ax in axons:
        ax.stop()
    client.close()
    ok("Done")

    # ── Summary ──
    header("Summary: All 4 Contracts + HCS", "🎉")
    print(f"""
  {C}Smart Contracts (on-chain):{X}
    PaymentEscrow:   {os.getenv('HEDERA_PAYMENT_ESCROW_CONTRACT_ID','N/A')}
    SubnetRegistry:  {os.getenv('HEDERA_SUBNET_REGISTRY_CONTRACT_ID','N/A')}
    StakingVault:    {os.getenv('HEDERA_STAKING_VAULT_CONTRACT_ID','N/A')}
    MDTGovernor:     {os.getenv('HEDERA_MDT_GOVERNOR_CONTRACT_ID','N/A')}

  {C}HCS (on-chain):{X}
    3 miner registrations -> {hcs.registration_topic_id}
    1 task created         -> {hcs.task_topic_id}
    {len(scores)} score submissions   -> {hcs.scoring_topic_id}
    1 metagraph update     -> {hcs.scoring_topic_id}

  {C}Networking:{X}
    3 Axon servers + 1 Dendrite
    {sum(1 for r in results if r.success)}/{len(results)} tasks delivered via HTTP
""")

if __name__ == "__main__":
    import traceback
    try:
        main()
    except Exception as e:
        traceback.print_exc()
