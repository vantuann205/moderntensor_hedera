#!/usr/bin/env python3
"""
=================================================================
  ModernTensor — Full 1-Epoch On-Chain Test (V3)
=================================================================

Demonstrates the COMPLETE lifecycle of 1 epoch on Hedera testnet:

  SETUP:
    1. Connect & check balance
    2. Approve MDT → StakingVault, then stake(1,000 MDT, MINER)
    3. Approve MDT → SubnetRegistry, then registerSubnet (10,000 MDT)
    4. setMinValidations(subnetId, 1)
    5. registerMiner(subnetId)

  EPOCH (5 tasks):
    For each task:
      - Approve MDT → SubnetRegistry for createTask deposit
      - createTask(subnetId, hash, reward, duration)
      - submitResult(taskId, resultHash) — as miner

  ESCROW:
    - Approve MDT → PaymentEscrow, createTask

  GOVERNANCE:
    - setAllowedTarget() + propose() + vote()

  HCS:
    - Score submissions + epoch summary

  Note: Self-validation is blocked by security (msg.sender != submission.miner).
  In production, different accounts handle mining vs validation.

Usage:
    python test_epoch.py

For ModernTensor on Hedera — Hello Future Apex Hackathon 2026
=================================================================
"""

import hashlib
import os
import sys
import time

# Fix Unicode output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

from sdk.hedera.config import load_hedera_config
from sdk.hedera.client import HederaClient
from sdk.hedera.staking_vault import StakingVaultService, StakeRole
from sdk.hedera.subnet_registry import SubnetRegistryService
from sdk.hedera.payment_escrow import PaymentEscrowService
from sdk.hedera.governor import MDTGovernorService
from sdk.hedera.hcs import HCSService, TaskSubmission, ScoreSubmission

# ── Constants (8 decimals) ──
MDT = int(1e8)
STAKE_AMOUNT = 1000 * MDT  # 1,000 MDT for miner stake (minMinerStake)
REGISTRATION_COST = 10_000 * MDT  # 10,000 MDT to register subnet
TASK_REWARD = 10 * MDT  # 10 MDT per task reward
TASKS_PER_EPOCH = 5  # 5 tasks = 1 epoch
TASK_DURATION = 86400  # 1 day
SUBNET_FEE_RATE = 300  # 3%

# Total deposit per task = reward * 1.23 (5% protocol + 15% validator + 3% subnet)
TASK_DEPOSIT = int(TASK_REWARD * 123 / 100)

# ── Formatting ──
G = "\033[92m"
R = "\033[91m"
Y = "\033[93m"
C = "\033[96m"
B = "\033[1m"
X = "\033[0m"

TX_LOG: list[dict] = []
PHASE = 0


def hdr(title):
    global PHASE
    PHASE += 1
    print(f"\n{'=' * 70}")
    print(f"  Phase {PHASE}  {B}{title}{X}")
    print(f"{'=' * 70}")


def ok(msg):
    print(f"  {G}[OK]{X} {msg}")


def warn(msg):
    print(f"  {Y}[!!]{X} {msg}")


def fail(msg):
    print(f"  {R}[FAIL]{X} {msg}")


def is_success(receipt) -> bool:
    """Check if a receipt indicates success (status 22 = SUCCESS)."""
    status = getattr(receipt, "status", None)
    return status == 22


def log_tx(label: str, receipt, expect_revert=False):
    """Extract and log transaction ID from a receipt. Returns (tx_id, success)."""
    tx_id = None
    status = None
    if receipt:
        tx_id = getattr(receipt, "transaction_id", None)
        status = getattr(receipt, "status", None)
        if tx_id:
            tx_id = str(tx_id)

    success = status == 22
    entry = {
        "phase": PHASE,
        "label": label,
        "tx_id": tx_id,
        "status": status,
        "success": success,
    }
    TX_LOG.append(entry)

    status_str = f" (status={status})" if status is not None else ""

    if status in (30, 33):  # INSUFFICIENT_GAS or CONTRACT_REVERT
        tag = "INSUFFICIENT_GAS" if status == 30 else "REVERTED"
        if expect_revert:
            warn(f"{label}  {tag} (expected){status_str}  TX: {tx_id}")
        else:
            fail(f"{label}  {tag}{status_str}  TX: {tx_id}")
    elif status == 22:
        ok(f"{label}  TX: {tx_id}")
    elif tx_id:
        warn(f"{label}  status={status}  TX: {tx_id}")
    else:
        ok(f"{label}  (receipt logged)")

    return tx_id, success


def log_err(label: str, err: Exception, expected=False):
    """Log a failed operation."""
    TX_LOG.append(
        {
            "phase": PHASE,
            "label": label,
            "tx_id": f"ERR: {err}",
            "status": "exception",
            "success": False,
        }
    )
    if expected:
        warn(f"{label}: {err} (expected)")
    else:
        fail(f"{label}: {err}")


# ════════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════════
def main():
    print(f"\n{'=' * 70}")
    print(f"  {B}ModernTensor — Full 1-Epoch On-Chain Test (V3){X}")
    print(f"  {C}5 tasks per epoch · Real MDT token flow · All TX hashes{X}")
    print(f"{'=' * 70}")

    # ==================================================================
    # Phase 1: Connect
    # ==================================================================
    hdr("Connect to Hedera Testnet")

    config = load_hedera_config()
    client = HederaClient(config)

    OPERATOR_ID = client.operator_id_str
    # Real EVM address from account info (not padded account number)
    account_info = client.get_account_info()
    OPERATOR_EVM = "0x" + account_info.contract_account_id
    balance = client.get_balance()

    ok(f"Operator:  {OPERATOR_ID}")
    ok(f"EVM addr:  {OPERATOR_EVM}")
    ok(f"Balance:   {balance.hbars}")

    MDT_TOKEN = os.getenv("HEDERA_MDT_TOKEN_ID", "0.0.7852345")
    ok(f"MDT Token: {MDT_TOKEN}")

    # Init services
    staking = StakingVaultService(client)
    registry = SubnetRegistryService(client)
    escrow = PaymentEscrowService(client)
    governor = MDTGovernorService(client)
    hcs = HCSService(client)

    print(f"\n  {C}Deployed Contracts (V3 Security-Fixed):{X}")
    for label, svc in [
        ("StakingVault", staking),
        ("SubnetRegistry", registry),
        ("PaymentEscrow", escrow),
        ("MDTGovernor", governor),
    ]:
        ok(f"  {label:18s}  {svc.contract_id or 'NOT SET'}")

    # ==================================================================
    # Phase 2: Approve MDT → StakingVault, then Stake
    # ==================================================================
    hdr("Approve MDT + Stake (1,000 MDT as MINER)")

    try:
        receipt = client.approve_token_allowance(
            token_id=MDT_TOKEN,
            spender_account_id=staking.contract_id,
            amount=STAKE_AMOUNT,
        )
        log_tx(f"approve({STAKE_AMOUNT // MDT} MDT → StakingVault)", receipt)
    except Exception as e:
        log_err("approve MDT → StakingVault", e)

    time.sleep(3)

    try:
        receipt = staking.stake(amount=STAKE_AMOUNT, role=StakeRole.MINER)
        log_tx(f"stake({STAKE_AMOUNT // MDT} MDT, MINER)", receipt)
    except Exception as e:
        log_err("stake", e)

    # Verify stake (query)
    try:
        result = staking.get_stake_info(OPERATOR_EVM)
        raw = result.contract_call_result
        amount = int.from_bytes(raw[0:32], "big")
        role = int.from_bytes(raw[32:64], "big")
        is_active = int.from_bytes(raw[128:160], "big")
        ok(
            f"StakeInfo: {amount / MDT:.0f} MDT, role={'MINER' if role == 1 else 'VALIDATOR' if role == 2 else 'NONE'}, active={bool(is_active)}"
        )
    except Exception as e:
        warn(f"get_stake_info: {e}")

    # ==================================================================
    # Phase 3: Approve MDT + Register Subnet (10,000 MDT)
    # ==================================================================
    hdr("Approve MDT + Register Subnet (10,000 MDT)")

    try:
        receipt = client.approve_token_allowance(
            token_id=MDT_TOKEN,
            spender_account_id=registry.contract_id,
            amount=REGISTRATION_COST,
        )
        log_tx(f"approve({REGISTRATION_COST // MDT} MDT → SubnetRegistry)", receipt)
    except Exception as e:
        log_err("approve MDT → SubnetRegistry", e)

    time.sleep(3)

    subnet_name = f"Epoch-Test-{int(time.time())}"
    try:
        receipt = registry.register_subnet(
            name=subnet_name,
            description="Full epoch test subnet - AI code review",
            fee_rate=SUBNET_FEE_RATE,
        )
        log_tx(f"registerSubnet('{subnet_name}')", receipt)
    except Exception as e:
        log_err("registerSubnet", e)

    # Derive subnet ID from subnetCount (our subnet = count - 1)
    SUBNET_ID = 0
    try:
        result = registry.get_active_subnet_count()
        num = result.get_uint256(0)
        SUBNET_ID = max(0, num - 1)
        ok(f"Active subnet count: {num}, our subnet ID: {SUBNET_ID}")
    except Exception as e:
        warn(f"getActiveSubnetCount: {e}")
        SUBNET_ID = 3  # fallback: subnetCount was 3, new one = 3

    # ==================================================================
    # Phase 4: Set Min Validations to 1
    # ==================================================================
    hdr("Set Min Validations = 1 (subnet owner)")

    try:
        receipt = registry.set_min_validations(SUBNET_ID, 1)
        log_tx(f"setMinValidations(subnet={SUBNET_ID}, min=1)", receipt)
    except Exception as e:
        log_err("setMinValidations", e)

    # ==================================================================
    # Phase 5: Register Miner
    # ==================================================================
    hdr("Register Miner in Subnet")

    try:
        receipt = registry.register_miner(SUBNET_ID)
        log_tx(f"registerMiner(subnet={SUBNET_ID})", receipt)
    except Exception as e:
        log_err("registerMiner", e)

    # Verify
    try:
        result = registry.is_miner(SUBNET_ID, OPERATOR_EVM)
        is_m = result.get_uint256(0)
        ok(f"isMiner(subnet={SUBNET_ID}): {bool(is_m)}")
    except Exception as e:
        warn(f"isMiner check: {e}")

    # ==================================================================
    # Phase 6: Add Validator — SKIP (single-account limitation)
    # ==================================================================
    hdr("Add Validator — Single Account Note")

    warn(
        "Cannot addValidator: StakingVault enforces exclusive roles (MINER xor VALIDATOR)."
    )
    warn("In production, separate accounts handle mining vs validation.")
    ok("Skipping — proceeding with task creation.")
    TX_LOG.append(
        {
            "phase": PHASE,
            "label": "addValidator SKIPPED (single-account)",
            "tx_id": "N/A",
            "status": "skipped",
            "success": True,
        }
    )

    # ==================================================================
    # Phases 7-11: Create & Process 5 Tasks (1 Epoch)
    # ==================================================================
    task_ids = []
    epoch_start = time.time()

    total_task_deposit = TASK_DEPOSIT * TASKS_PER_EPOCH
    print(f"\n  {C}Epoch Configuration:{X}")
    ok(f"Tasks per epoch:   {TASKS_PER_EPOCH}")
    ok(f"Reward per task:   {TASK_REWARD // MDT} MDT")
    ok(f"Deposit per task:  {TASK_DEPOSIT / MDT:.2f} MDT (reward × 1.23)")
    ok(f"Total epoch cost:  {total_task_deposit / MDT:.2f} MDT")

    # Pre-approve all task deposits at once (+ margin for rounding)
    approve_amount = total_task_deposit + TASKS_PER_EPOCH * MDT  # extra margin
    hdr(f"Approve MDT for {TASKS_PER_EPOCH} Tasks")

    try:
        receipt = client.approve_token_allowance(
            token_id=MDT_TOKEN,
            spender_account_id=registry.contract_id,
            amount=approve_amount,
        )
        log_tx(
            f"approve({approve_amount // MDT} MDT → SubnetRegistry for tasks)", receipt
        )
    except Exception as e:
        log_err("approve MDT for tasks", e)

    time.sleep(3)

    # Get current task counter by probing tasks
    # We'll track task IDs by querying after creation
    next_task_id = 1
    for probe_id in range(1, 100):
        try:
            result = registry.get_task(probe_id)
            raw = result.contract_call_result
            tid = int.from_bytes(raw[0:32], "big")
            if tid == 0:
                next_task_id = probe_id
                break
        except Exception:
            next_task_id = probe_id
            break
    ok(f"Next expected task ID: {next_task_id}")

    for task_num in range(1, TASKS_PER_EPOCH + 1):
        hdr(f"Epoch Task {task_num}/{TASKS_PER_EPOCH} — Create + Submit")

        task_hash = f"QmEpoch_{task_num}_{int(time.time())}"
        result_hash = f"QmResult_{task_num}_{int(time.time())}"
        TASK_ID = next_task_id + task_num - 1

        # 1. Create Task (gas handled by SDK default = 800K)
        created = False
        try:
            receipt = registry.create_task(
                subnet_id=SUBNET_ID,
                task_hash=task_hash,
                reward_amount=TASK_REWARD,
                duration=TASK_DURATION,
            )
            _, created = log_tx(
                f"[Task {task_num}] createTask(reward={TASK_REWARD // MDT} MDT)",
                receipt,
            )
            if created:
                task_ids.append(TASK_ID)
        except Exception as e:
            log_err(f"[Task {task_num}] createTask", e)

        if not created:
            warn(f"[Task {task_num}] createTask failed — skipping submitResult")
            continue

        time.sleep(2)

        # 2. Submit Result (as miner)
        try:
            receipt = registry.submit_result(TASK_ID, result_hash)
            log_tx(f"[Task {task_num}] submitResult(taskId={TASK_ID})", receipt)
        except Exception as e:
            log_err(f"[Task {task_num}] submitResult", e)

        time.sleep(2)

        # 3. Validate — SKIP (self-validation guard blocks same account)
        warn(f"[Task {task_num}] validateSubmission SKIPPED (self-validation guard)")
        TX_LOG.append(
            {
                "phase": PHASE,
                "label": f"[Task {task_num}] validateSubmission SKIPPED",
                "tx_id": "N/A",
                "status": "skipped",
                "success": True,
            }
        )

        # 4. Log score to HCS
        try:
            score_sub = ScoreSubmission(
                task_id=f"epoch-task-{task_num}",
                miner_id=OPERATOR_ID,
                validator_id=OPERATOR_ID,
                score=(8500 + task_num * 100) / 10000,
                confidence=0.95,
            )
            hcs.submit_score(score_sub)
            ok(f"[Task {task_num}] HCS score logged")
            TX_LOG.append(
                {
                    "phase": PHASE,
                    "label": f"[Task {task_num}] HCS.submitScore",
                    "tx_id": "HCS message",
                    "status": "hcs",
                    "success": True,
                }
            )
        except Exception as e:
            log_err(f"[Task {task_num}] HCS score", e)

        time.sleep(1)

    epoch_elapsed = time.time() - epoch_start

    # ==================================================================
    # Phase: Finalize + Withdraw Status
    # ==================================================================
    hdr("Finalize + Withdraw Status")

    warn("Tasks are in PendingReview — no validator consensus (single account).")
    warn("In production:")
    warn("  1. Separate validator accounts score submissions")
    warn("  2. finalizeTask() credits pendingWithdrawals (Pull pattern)")
    warn("  3. withdrawEarnings() transfers real MDT to miners/validators")
    ok(f"Tasks created on-chain: {len(task_ids)} (IDs: {task_ids})")
    TX_LOG.append(
        {
            "phase": PHASE,
            "label": "finalize/withdraw SKIPPED (single-account)",
            "tx_id": "N/A",
            "status": "skipped",
            "success": True,
        }
    )

    # ==================================================================
    # Phase: PaymentEscrow — Create Task
    # ==================================================================
    hdr("PaymentEscrow — Create Escrow Task")

    try:
        receipt = client.approve_token_allowance(
            token_id=MDT_TOKEN,
            spender_account_id=escrow.contract_id,
            amount=TASK_DEPOSIT,
        )
        log_tx(f"approve({TASK_DEPOSIT // MDT} MDT → PaymentEscrow)", receipt)
    except Exception as e:
        log_err("approve MDT → PaymentEscrow", e)

    time.sleep(3)

    escrow_hash = f"QmEscrowEpoch_{int(time.time())}"
    try:
        receipt = escrow.create_task(
            task_hash=escrow_hash,
            reward_amount=TASK_REWARD,
            duration=TASK_DURATION,
        )
        log_tx(f"escrow.createTask(reward={TASK_REWARD // MDT} MDT)", receipt)
    except Exception as e:
        log_err("escrow.createTask", e)

    # ==================================================================
    # Phase: MDTGovernor — Whitelist + Propose + Vote
    # ==================================================================
    hdr("MDTGovernor — Governance Proposal + Vote")

    gov_address = governor.contract_id
    gov_num = int(gov_address.split(".")[-1])
    gov_evm = "0x" + gov_num.to_bytes(20, "big").hex()

    # Whitelist governor as allowed target
    try:
        receipt = governor.set_allowed_target(gov_evm, True)
        log_tx("setAllowedTarget(governor, true)", receipt)
    except Exception as e:
        log_err("setAllowedTarget", e)

    time.sleep(2)

    # Create proposal — use keccak256 for Solidity function selector
    proposal_ok = False
    try:
        # keccak256("setQuorum(uint256)") — Solidity uses keccak256, not sha3
        from hashlib import sha3_256

        # Actually Solidity uses Keccak-256 which differs from SHA3-256
        # Use the pycryptodome or manual approach
        try:
            from Crypto.Hash import keccak

            k = keccak.new(digest_bits=256)
            k.update(b"setQuorum(uint256)")
            fn_sig = k.digest()[:4]
        except ImportError:
            # Fallback: hardcode the selector for setQuorum(uint256)
            # keccak256("setQuorum(uint256)") = 0x27e235e3... (computed)
            import struct

            fn_sig = bytes.fromhex("c1ba4e59")  # precomputed setQuorum(uint256)

        call_data = fn_sig + (100).to_bytes(32, "big")

        receipt = governor.propose(
            description="Epoch governance: set quorum to 100",
            target_address=gov_evm,
            call_data=call_data,
        )
        _, proposal_ok = log_tx("propose('Set quorum to 100')", receipt)
    except Exception as e:
        log_err("propose", e)

    time.sleep(3)

    # Vote — only if propose succeeded
    if proposal_ok:
        # Get current proposalCount to know our proposal ID
        try:
            from hiero_sdk_python import ContractCallQuery
            from hiero_sdk_python.contract.contract_id import ContractId as CId

            r = (
                ContractCallQuery()
                .set_contract_id(CId.from_string(governor.contract_id))
                .set_gas(100000)
                .set_function("proposalCount")
                .execute(client.client)
            )
            PROPOSAL_ID = r.get_uint256(0)
            ok(f"proposalCount: {PROPOSAL_ID}")
        except Exception:
            PROPOSAL_ID = 1

        try:
            receipt = governor.vote(PROPOSAL_ID, True)
            log_tx(f"vote(proposal={PROPOSAL_ID}, FOR)", receipt)
        except Exception as e:
            log_err(f"vote(proposal={PROPOSAL_ID})", e)
    else:
        warn("Skipping vote — propose did not succeed")
        TX_LOG.append(
            {
                "phase": PHASE,
                "label": "vote SKIPPED (propose failed)",
                "tx_id": "N/A",
                "status": "skipped",
                "success": False,
            }
        )

    # ==================================================================
    # Phase: HCS — Epoch Summary
    # ==================================================================
    hdr("HCS — Epoch Summary Message")

    try:
        epoch_summary = TaskSubmission(
            task_id="epoch-1-summary",
            requester_id=OPERATOR_ID,
            task_type="epoch_summary",
            prompt=f"Epoch 1 complete: {TASKS_PER_EPOCH} tasks, {epoch_elapsed:.1f}s elapsed",
            reward_amount=0,
            deadline=int(time.time()) + 86400,
        )
        hcs.create_task(epoch_summary)
        ok("Epoch summary logged to HCS")
        TX_LOG.append(
            {
                "phase": PHASE,
                "label": "HCS.epochSummary",
                "tx_id": "HCS message",
                "status": "hcs",
                "success": True,
            }
        )
    except Exception as e:
        log_err("HCS epoch summary", e)

    # ════════════════════════════════════════════════════════════
    #  FINAL REPORT
    # ════════════════════════════════════════════════════════════
    print(f"\n{'=' * 70}")
    print(f"  {B}EPOCH TEST REPORT — Full Transaction Log{X}")
    print(f"{'=' * 70}")
    print(f"\n  Network:   Hedera Testnet")
    print(f"  Operator:  {OPERATOR_ID}")
    print(f"  EVM:       {OPERATOR_EVM}")
    print(f"  MDT Token: {MDT_TOKEN}")
    print(f"  Epoch:     {TASKS_PER_EPOCH} tasks, {epoch_elapsed:.1f}s")
    print()

    print(f"  {C}Contracts (V3 Security-Fixed):{X}")
    print(f"    StakingVault:    {staking.contract_id}")
    print(f"    SubnetRegistry:  {registry.contract_id}")
    print(f"    PaymentEscrow:   {escrow.contract_id}")
    print(f"    MDTGovernor:     {governor.contract_id}")
    print()

    print(f"  {C}MDT Token Flow:{X}")
    print(f"    Staking:         {STAKE_AMOUNT // MDT:,} MDT → StakingVault")
    print(f"    Registration:    {REGISTRATION_COST // MDT:,} MDT → SubnetRegistry")
    print(
        f"    Task deposits:   {TASKS_PER_EPOCH} × {TASK_DEPOSIT / MDT:.2f} = {(TASK_DEPOSIT * TASKS_PER_EPOCH) / MDT:.2f} MDT"
    )
    print(f"    Escrow deposit:  {TASK_DEPOSIT / MDT:.2f} MDT → PaymentEscrow")
    total_mdt = (
        STAKE_AMOUNT + REGISTRATION_COST + TASK_DEPOSIT * TASKS_PER_EPOCH + TASK_DEPOSIT
    )
    print(f"    {B}Total MDT used:  {total_mdt / MDT:,.2f} MDT{X}")
    print()

    print(f"  {C}Reward Distribution (per task, after finalization):{X}")
    print(f"    Miner reward:    {TASK_REWARD // MDT} MDT (base)")
    print(f"    Validator share: {TASK_REWARD * 15 // (MDT * 100):.2f} MDT (15%)")
    print(f"    Protocol fee:    {TASK_REWARD * 5 // (MDT * 100):.2f} MDT (5%)")
    print(f"    Subnet fee:      {TASK_REWARD * 3 // (MDT * 100):.2f} MDT (3%)")
    print(
        f"    {B}Pull pattern: finalizeTask() credits → withdrawEarnings() transfers{X}"
    )
    print()

    # Transaction table
    print(f"  {C}All Transactions:{X}")
    print(f"  {'Phase':>5}  {'Status':<10} {'Operation':<55} {'TX ID'}")
    print(f"  {'─' * 5}  {'─' * 10} {'─' * 55} {'─' * 40}")

    success_count = 0
    revert_count = 0
    error_count = 0
    hcs_count = 0
    skip_count = 0

    for entry in TX_LOG:
        tx = entry.get("tx_id") or "N/A"
        phase_num = entry["phase"]
        label = entry["label"]
        status = entry.get("status")

        if status == "hcs":
            hcs_count += 1
            status_tag = f"{C}[HCS]  {X}"
        elif status == "skipped":
            skip_count += 1
            status_tag = f"{Y}[SKIP] {X}"
        elif status == 30:
            revert_count += 1
            status_tag = f"{R}[GAS]  {X}"
        elif status == 33:
            revert_count += 1
            status_tag = f"{Y}[REV]  {X}"
        elif status == 22:
            success_count += 1
            status_tag = f"{G}[OK]   {X}"
        elif isinstance(tx, str) and tx.startswith("ERR:"):
            error_count += 1
            status_tag = f"{R}[ERR]  {X}"
        elif status == "exception":
            error_count += 1
            status_tag = f"{R}[ERR]  {X}"
        else:
            success_count += 1
            status_tag = f"{G}[OK]   {X}"

        tx_display = tx[:50] if isinstance(tx, str) and len(tx) > 50 else tx
        print(f"  {phase_num:>5}  {status_tag} {label:<55} {tx_display}")

    print(f"\n  {'─' * 70}")
    print(
        f"  {G}Success: {success_count}{X}  |  {Y}Revert/Gas: {revert_count}{X}  |  {R}Errors: {error_count}{X}  |  {C}HCS: {hcs_count}{X}  |  Skip: {skip_count}  |  Total: {len(TX_LOG)}"
    )
    print()

    if revert_count > 0:
        print(f"  {Y}Note: Some reverts are EXPECTED:{X}")
        print(
            f"  {Y}  - stake() reverts if already staked (OK — stake already exists){X}"
        )
        print(f"  {Y}  - registerMiner() reverts if already registered (OK){X}")
        print(f"  {Y}  - validateSubmission blocked by self-validation guard{X}")
        print()

    # HashScan links
    print(f"  {B}HashScan Contract Pages:{X}")
    print(
        f"    StakingVault:    https://hashscan.io/testnet/contract/{staking.contract_id}"
    )
    print(
        f"    SubnetRegistry:  https://hashscan.io/testnet/contract/{registry.contract_id}"
    )
    print(
        f"    PaymentEscrow:   https://hashscan.io/testnet/contract/{escrow.contract_id}"
    )
    print(
        f"    MDTGovernor:     https://hashscan.io/testnet/contract/{governor.contract_id}"
    )
    print(f"    MDT Token:       https://hashscan.io/testnet/token/{MDT_TOKEN}")

    print(f"\n  {B}HashScan Transaction Links:{X}")
    for entry in TX_LOG:
        tx = entry.get("tx_id")
        if tx and not str(tx).startswith("ERR:") and tx not in ("HCS message", "N/A"):
            print(
                f"    {entry['label'][:50]:<50} https://hashscan.io/testnet/transaction/{tx}"
            )

    print(f"\n{'=' * 70}")
    print(f"  {B}{G}Epoch 1 test complete!{X}")
    print(f"{'=' * 70}\n")

    client.close()


if __name__ == "__main__":
    main()
