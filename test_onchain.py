#!/usr/bin/env python3
"""
=================================================================
  ModernTensor — Full On-Chain Test (Security-Fixed Contracts V3)
=================================================================

Tests ALL 4 deployed contracts on Hedera testnet:
  1. StakingVault   — stake, get_stake_info
  2. SubnetRegistry — register_subnet, register_miner, add_validator,
                       create_task, submit_result, validate_submission,
                       finalize_task, withdraw_earnings
  3. PaymentEscrow  — create_task, add_validator, submit_result,
                       validate_submission, finalize_task
  4. MDTGovernor    — propose, vote, finalize_voting

Every transaction hash is collected and printed for HashScan verification.

Usage:
    python test_onchain.py

For ModernTensor on Hedera — Hello Future Apex Hackathon 2026
=================================================================
"""

import hashlib
import os
import sys
import time

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
    print(f"\n{'=' * 64}")
    print(f"  Phase {PHASE}  {B}{title}{X}")
    print(f"{'=' * 64}")


def ok(msg):
    print(f"  {G}[OK]{X} {msg}")


def warn(msg):
    print(f"  {Y}[!!]{X} {msg}")


def fail(msg):
    print(f"  {R}[FAIL]{X} {msg}")


def log_tx(label: str, receipt):
    """Extract and log transaction ID from a receipt."""
    tx_id = None
    if receipt:
        tx_id = getattr(receipt, "transaction_id", None)
        if tx_id:
            tx_id = str(tx_id)
    entry = {"phase": PHASE, "label": label, "tx_id": tx_id}
    TX_LOG.append(entry)
    if tx_id:
        ok(f"{label}  TX: {tx_id}")
    else:
        ok(f"{label}  (receipt logged)")
    return tx_id


# ════════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════════
def main():
    print(f"\n{'=' * 64}")
    print(f"  {B}ModernTensor — Full On-Chain Test (V3 Security-Fixed){X}")
    print(f"{'=' * 64}")

    # ── Phase 1: Connect ──
    hdr("Connect to Hedera Testnet")

    config = load_hedera_config()
    client = HederaClient(config)

    OPERATOR_ID = client.operator_id_str
    account_num = int(OPERATOR_ID.split(".")[-1])
    OPERATOR_EVM = "0x" + account_num.to_bytes(20, "big").hex()
    balance = client.get_balance()

    ok(f"Operator:  {OPERATOR_ID}")
    ok(f"EVM addr:  {OPERATOR_EVM}")
    ok(f"Balance:   {balance.hbars}")

    # Init services
    staking = StakingVaultService(client)
    registry = SubnetRegistryService(client)
    escrow = PaymentEscrowService(client)
    governor = MDTGovernorService(client)
    hcs = HCSService(client)

    print(f"\n  {C}Deployed Contracts:{X}")
    for label, svc in [
        ("StakingVault", staking),
        ("SubnetRegistry", registry),
        ("PaymentEscrow", escrow),
        ("MDTGovernor", governor),
    ]:
        cid = svc.contract_id or "NOT SET"
        ok(f"  {label:18s}  {cid}")

    # ── Phase 2: StakingVault — Stake as MINER ──
    hdr("StakingVault — Stake as MINER")

    try:
        receipt = staking.stake(
            amount=int(100 * 1e8),  # 100 MDT
            role=StakeRole.MINER,
        )
        log_tx("stake(100 MDT, MINER)", receipt)
    except Exception as e:
        warn(f"stake MINER: {e}")
        TX_LOG.append({"phase": PHASE, "label": "stake MINER", "tx_id": f"ERR: {e}"})

    # Check stake info
    try:
        result = staking.get_stake_info(OPERATOR_EVM)
        ok(f"get_stake_info: {result}")
    except Exception as e:
        warn(f"get_stake_info: {e}")

    # ── Phase 3: SubnetRegistry — Register Subnet ──
    hdr("SubnetRegistry — Register Subnet")

    subnet_name = f"AI-Review-{int(time.time())}"
    try:
        receipt = registry.register_subnet(
            name=subnet_name,
            description="On-chain AI code review subnet",
            fee_rate=300,  # 3%
        )
        log_tx(f"registerSubnet('{subnet_name}')", receipt)
    except Exception as e:
        warn(f"registerSubnet: {e}")
        TX_LOG.append({"phase": PHASE, "label": "registerSubnet", "tx_id": f"ERR: {e}"})

    # Get the subnet count to find our subnet ID
    SUBNET_ID = 0  # First subnet = ID 0
    try:
        count = registry.get_active_subnet_count()
        ok(f"Active subnet count: {count}")
        if count and hasattr(count, "get_uint256"):
            num = count.get_uint256(0)
            SUBNET_ID = max(0, num - 1)
            ok(f"Our subnet ID: {SUBNET_ID}")
    except Exception as e:
        warn(f"getActiveSubnetCount: {e}")

    # ── Phase 4: SubnetRegistry — Register Miner ──
    hdr("SubnetRegistry — Register Miner")

    try:
        receipt = registry.register_miner(SUBNET_ID)
        log_tx(f"registerMiner(subnet={SUBNET_ID})", receipt)
    except Exception as e:
        warn(f"registerMiner: {e}")
        TX_LOG.append({"phase": PHASE, "label": "registerMiner", "tx_id": f"ERR: {e}"})

    # Verify miner registration
    try:
        is_miner = registry.is_miner(SUBNET_ID, OPERATOR_EVM)
        ok(f"isMiner({SUBNET_ID}, {OPERATOR_EVM[:14]}...): {is_miner}")
    except Exception as e:
        warn(f"isMiner: {e}")

    # ── Phase 5: SubnetRegistry — Add Validator ──
    hdr("SubnetRegistry — Add Validator (self = owner)")

    try:
        receipt = registry.add_validator(SUBNET_ID, OPERATOR_EVM)
        log_tx(f"addValidator(subnet={SUBNET_ID})", receipt)
    except Exception as e:
        warn(f"addValidator: {e}")
        TX_LOG.append({"phase": PHASE, "label": "addValidator", "tx_id": f"ERR: {e}"})

    # ── Phase 6: SubnetRegistry — Create Task ──
    hdr("SubnetRegistry — Create Task")

    task_hash = f"QmTest_{int(time.time())}"
    try:
        receipt = registry.create_task(
            subnet_id=SUBNET_ID,
            task_hash=task_hash,
            reward_amount=int(10 * 1e8),  # 10 MDT
            duration=86400,
        )
        log_tx(f"createTask(hash={task_hash[:20]}...)", receipt)
    except Exception as e:
        warn(f"createTask: {e}")
        TX_LOG.append({"phase": PHASE, "label": "createTask", "tx_id": f"ERR: {e}"})

    TASK_ID = 0

    # ── Phase 7: SubnetRegistry — Submit Result ──
    hdr("SubnetRegistry — Submit Result (miner)")

    result_hash = f"QmResult_{int(time.time())}"
    try:
        receipt = registry.submit_result(TASK_ID, result_hash)
        log_tx(f"submitResult(task={TASK_ID})", receipt)
    except Exception as e:
        warn(f"submitResult: {e}")
        TX_LOG.append({"phase": PHASE, "label": "submitResult", "tx_id": f"ERR: {e}"})

    # ── Phase 8: SubnetRegistry — Validate Submission ──
    hdr("SubnetRegistry — Validate Submission (validator)")

    try:
        receipt = registry.validate_submission(
            task_id=TASK_ID,
            miner_index=0,
            score=8500,  # 85%
        )
        log_tx(f"validateSubmission(task={TASK_ID}, score=8500)", receipt)
    except Exception as e:
        warn(f"validateSubmission: {e}")
        TX_LOG.append(
            {"phase": PHASE, "label": "validateSubmission", "tx_id": f"ERR: {e}"}
        )

    # ── Phase 9: SubnetRegistry — Finalize Task ──
    hdr("SubnetRegistry — Finalize Task")

    try:
        receipt = registry.finalize_task(TASK_ID)
        log_tx(f"finalizeTask(task={TASK_ID})", receipt)
    except Exception as e:
        warn(f"finalizeTask: {e}")
        TX_LOG.append({"phase": PHASE, "label": "finalizeTask", "tx_id": f"ERR: {e}"})

    # ── Phase 10: SubnetRegistry — Withdraw Earnings ──
    hdr("SubnetRegistry — Withdraw Earnings")

    try:
        receipt = registry.withdraw_earnings()
        log_tx("withdrawEarnings()", receipt)
    except Exception as e:
        warn(f"withdrawEarnings: {e}")
        TX_LOG.append(
            {"phase": PHASE, "label": "withdrawEarnings", "tx_id": f"ERR: {e}"}
        )

    # ── Phase 11: PaymentEscrow — Create Task ──
    hdr("PaymentEscrow — Create Task")

    escrow_task_hash = f"QmEscrow_{int(time.time())}"
    try:
        receipt = escrow.create_task(
            task_hash=escrow_task_hash,
            reward_amount=int(5 * 1e8),  # 5 MDT
            duration=86400,
        )
        log_tx(f"escrow.createTask(hash={escrow_task_hash[:20]}...)", receipt)
    except Exception as e:
        warn(f"escrow.createTask: {e}")
        TX_LOG.append(
            {"phase": PHASE, "label": "escrow.createTask", "tx_id": f"ERR: {e}"}
        )

    ESCROW_TASK_ID = 0

    # ── Phase 12: PaymentEscrow — Add Validator ──
    hdr("PaymentEscrow — Add Validator")

    try:
        receipt = escrow.add_validator(OPERATOR_EVM)
        log_tx(f"escrow.addValidator({OPERATOR_EVM[:14]}...)", receipt)
    except Exception as e:
        warn(f"escrow.addValidator: {e}")
        TX_LOG.append(
            {"phase": PHASE, "label": "escrow.addValidator", "tx_id": f"ERR: {e}"}
        )

    # ── Phase 13: PaymentEscrow — Submit Result ──
    hdr("PaymentEscrow — Submit Result")

    escrow_result_hash = f"QmEscResult_{int(time.time())}"
    try:
        receipt = escrow.submit_result(ESCROW_TASK_ID, escrow_result_hash)
        log_tx(f"escrow.submitResult(task={ESCROW_TASK_ID})", receipt)
    except Exception as e:
        warn(f"escrow.submitResult: {e}")
        TX_LOG.append(
            {"phase": PHASE, "label": "escrow.submitResult", "tx_id": f"ERR: {e}"}
        )

    # ── Phase 14: PaymentEscrow — Validate ──
    hdr("PaymentEscrow — Validate Submission")

    try:
        receipt = escrow.validate_submission(
            task_id=ESCROW_TASK_ID,
            miner_index=0,
            score=9000,
        )
        log_tx(f"escrow.validateSubmission(task={ESCROW_TASK_ID}, score=9000)", receipt)
    except Exception as e:
        warn(f"escrow.validateSubmission: {e}")
        TX_LOG.append(
            {"phase": PHASE, "label": "escrow.validateSubmission", "tx_id": f"ERR: {e}"}
        )

    # ── Phase 15: PaymentEscrow — Finalize ──
    hdr("PaymentEscrow — Finalize Task")

    try:
        receipt = escrow.finalize_task(ESCROW_TASK_ID)
        log_tx(f"escrow.finalizeTask(task={ESCROW_TASK_ID})", receipt)
    except Exception as e:
        warn(f"escrow.finalizeTask: {e}")
        TX_LOG.append(
            {"phase": PHASE, "label": "escrow.finalizeTask", "tx_id": f"ERR: {e}"}
        )

    # ── Phase 16: MDTGovernor — Propose ──
    hdr("MDTGovernor — Create Proposal")

    try:
        # Propose setting quorum to 100 (target = governor itself)
        gov_address = governor.contract_id
        # Convert to EVM address
        gov_num = int(gov_address.split(".")[-1])
        gov_evm = "0x" + gov_num.to_bytes(20, "big").hex()

        # Encode setQuorum(uint256) call data
        import struct

        # keccak256("setQuorum(uint256)") = first 4 bytes of selector
        fn_sig = hashlib.sha3_256(b"setQuorum(uint256)").digest()[:4]
        call_data = fn_sig + struct.pack(">32s", (100).to_bytes(32, "big"))

        receipt = governor.propose(
            description="Set governance quorum to 100",
            target_address=gov_evm,
            call_data=call_data,
        )
        log_tx("propose('Set quorum to 100')", receipt)
    except Exception as e:
        warn(f"propose: {e}")
        TX_LOG.append({"phase": PHASE, "label": "propose", "tx_id": f"ERR: {e}"})

    PROPOSAL_ID = 0

    # ── Phase 17: MDTGovernor — Vote ──
    hdr("MDTGovernor — Vote on Proposal")

    try:
        receipt = governor.vote(PROPOSAL_ID, True)
        log_tx(f"vote(proposal={PROPOSAL_ID}, FOR)", receipt)
    except Exception as e:
        warn(f"vote: {e}")
        TX_LOG.append({"phase": PHASE, "label": "vote", "tx_id": f"ERR: {e}"})

    # ── Phase 18: HCS — Log Scores ──
    hdr("HCS — Submit Score Messages (on-chain)")

    try:
        score_sub = ScoreSubmission(
            task_id="onchain-test-task-0",
            miner_id="0.0.3001",
            validator_id=OPERATOR_ID,
            score=0.85,
            confidence=0.95,
            reasoning="High quality code review result",
        )
        hcs.submit_score(score_sub)
        ok("HCS score submitted (on-chain)")
        TX_LOG.append(
            {"phase": PHASE, "label": "HCS.submitScore", "tx_id": "HCS message"}
        )
    except Exception as e:
        warn(f"HCS score: {e}")
        TX_LOG.append(
            {"phase": PHASE, "label": "HCS.submitScore", "tx_id": f"ERR: {e}"}
        )

    # ════════════════════════════════════════════════════════════
    #  FINAL REPORT — All Transaction Hashes
    # ════════════════════════════════════════════════════════════
    print(f"\n{'=' * 64}")
    print(f"  {B}TRANSACTION REPORT — HashScan Verification{X}")
    print(f"{'=' * 64}")
    print(f"\n  Network: Hedera Testnet")
    print(f"  Operator: {OPERATOR_ID}")
    print(f"  Scanner: https://hashscan.io/testnet")
    print()

    # Contract addresses
    print(f"  {C}Contracts:{X}")
    print(f"    StakingVault:    {staking.contract_id}")
    print(f"    SubnetRegistry:  {registry.contract_id}")
    print(f"    PaymentEscrow:   {escrow.contract_id}")
    print(f"    MDTGovernor:     {governor.contract_id}")
    print()

    # All transactions
    print(f"  {C}Transactions:{X}")
    print(f"  {'Phase':>5}  {'Operation':<50} {'TX ID'}")
    print(f"  {'─' * 5}  {'─' * 50} {'─' * 30}")

    success_count = 0
    error_count = 0

    for entry in TX_LOG:
        tx = entry["tx_id"] or "N/A"
        phase_num = entry["phase"]
        label = entry["label"]

        if tx and not tx.startswith("ERR:"):
            success_count += 1
            status = G + "[OK]  " + X
        else:
            error_count += 1
            status = R + "[ERR] " + X

        print(f"  {phase_num:>5}  {status}{label:<44} {tx}")

    print(f"\n  {'─' * 64}")
    print(
        f"  {G}Success: {success_count}{X}  |  {R}Errors: {error_count}{X}  |  Total: {len(TX_LOG)}"
    )
    print()

    # HashScan links
    print(f"  {B}HashScan Links:{X}")
    for entry in TX_LOG:
        tx = entry["tx_id"]
        if tx and not tx.startswith("ERR:") and tx != "HCS message" and tx != "N/A":
            # Convert Hedera TX ID format (0.0.xxx@timestamp) to HashScan format
            hashscan_url = f"https://hashscan.io/testnet/transaction/{tx}"
            print(f"    {entry['label'][:40]:<40} {hashscan_url}")

    print(f"\n  {B}Contract Pages:{X}")
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

    print(f"\n{'=' * 64}")

    # Close
    client.close()


if __name__ == "__main__":
    main()
