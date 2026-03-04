#!/usr/bin/env python3
"""
ModernTensor — Requester Example

Shows how developers can programmatically submit tasks, track results,
and integrate ModernTensor into their applications.

This file serves as both documentation and working code.

Usage:
    python examples/requester_example.py
"""

import json
import os
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv()


def banner(text: str):
    print(f"\n{'=' * 60}")
    print(f"  {text}")
    print(f"{'=' * 60}")


def main():
    banner("ModernTensor — Requester SDK Examples")

    # ------------------------------------------------------------------
    # Example 1: Submit a code review task
    # ------------------------------------------------------------------
    print("\n📋 Example 1: Submit a Code Review Task")
    print("─" * 50)

    from sdk.protocol.types import TaskRequest, TaskPriority
    from sdk.protocol.fee_engine import FeeEngine

    # Create task
    task = TaskRequest(
        task_id=str(uuid.uuid4()),
        subnet_id=0,
        task_type="code_review",
        payload={
            "code": """
def process_payment(amount, card_number):
    # TODO: add validation
    db.execute(f"INSERT INTO payments VALUES ({amount}, '{card_number}')")
    return True
""",
            "language": "python",
            "context": "Security-focused code review",
        },
        reward_amount=25.0,
        requester_id=os.getenv("HEDERA_ACCOUNT_ID", "0.0.requester"),
        priority=TaskPriority.HIGH,
        max_miners=3,
    )

    print(f"  Task ID:    {task.task_id[:16]}...")
    print(f"  Type:       {task.task_type}")
    print(f"  Priority:   HIGH (1.5x fee multiplier)")
    print(f"  Reward:     {task.reward_amount} MDT")

    # Calculate fees
    engine = FeeEngine()
    fees = engine.calculate(
        reward_amount=task.reward_amount,
        priority=task.priority,
        subnet_fee_rate=0.03,
    )

    print(f"\n  💰 Fee Breakdown:")
    print(f"     Miner reward:   {fees.miner_reward:.2f} MDT (80%)")
    print(f"     Validator pool: {fees.validator_reward:.2f} MDT (15%)")
    print(f"     Protocol fee:   {fees.protocol_fee:.2f} MDT (5%)")
    print(f"     Subnet fee:     {fees.subnet_fee:.2f} MDT (3%)")
    print(f"     ──────────────────────")
    print(f"     Total deposit:  {fees.total_deposit:.2f} MDT")

    # ------------------------------------------------------------------
    # Example 2: Submit task to miners via Dendrite
    # ------------------------------------------------------------------
    print("\n\n📋 Example 2: Send Task to Miners via Dendrite")
    print("─" * 50)

    from sdk.protocol.dendrite import Dendrite

    dendrite = Dendrite(
        validator_id=os.getenv("HEDERA_ACCOUNT_ID", "0.0.validator"),
        timeout=30.0,
    )

    # In production, you'd get this from MinerRegistry
    miners = [
        {"miner_id": "0.0.miner-1", "endpoint": "http://localhost:8091"},
        {"miner_id": "0.0.miner-2", "endpoint": "http://localhost:8092"},
    ]

    print(f"  Sending to {len(miners)} miners:")
    for m in miners:
        print(f"    → {m['miner_id']} at {m['endpoint']}")

    # Note: This would actually send HTTP requests if miners are running
    # results = dendrite.broadcast(
    #     miners=miners,
    #     task_id=task.task_id,
    #     task_type="code_review",
    #     payload=task.payload,
    # )

    print("  (Skipped — start miners first with `python miners/code_review_miner.py`)")

    # ------------------------------------------------------------------
    # Example 3: Batch task submission
    # ------------------------------------------------------------------
    print("\n\n📋 Example 3: Batch Task Submission")
    print("─" * 50)

    files_to_review = ["main.py", "utils.py", "config.py"]
    tasks = []

    for filename in files_to_review:
        t = TaskRequest(
            task_id=str(uuid.uuid4()),
            subnet_id=0,
            task_type="code_review",
            payload={
                "code": f"# Content of {filename}\npass",
                "language": "python",
                "filename": filename,
            },
            reward_amount=10.0,
            requester_id="0.0.batch-requester",
        )
        tasks.append(t)

    total_cost = sum(
        engine.calculate(t.reward_amount).total_deposit for t in tasks
    )

    print(f"  Created {len(tasks)} tasks:")
    for t in tasks:
        print(f"    {t.task_id[:12]}... → {t.payload['filename']}")
    print(f"\n  Total cost: {total_cost:.2f} MDT for {len(tasks)} code reviews")

    # ------------------------------------------------------------------
    # Example 4: Task with different priorities
    # ------------------------------------------------------------------
    print("\n\n📋 Example 4: Priority Comparison")
    print("─" * 50)

    base_reward = 20.0
    for priority in [TaskPriority.LOW, TaskPriority.NORMAL, TaskPriority.HIGH, TaskPriority.URGENT]:
        fees = engine.calculate(base_reward, priority=priority)
        print(f"  {priority.name:>8}: deposit={fees.total_deposit:>8.2f} MDT  (multiplier={priority.multiplier}x)")

    # ------------------------------------------------------------------
    # Example 5: Submit on-chain via HCS
    # ------------------------------------------------------------------
    print("\n\n📋 Example 5: On-Chain Submission (HCS)")
    print("─" * 50)

    print("""
  # Production code for on-chain task submission:

  from sdk.hedera.config import load_hedera_config
  from sdk.hedera.client import HederaClient
  from sdk.hedera.hcs import HCSService, TaskSubmission

  config = load_hedera_config()
  client = HederaClient(config)
  hcs = HCSService(client)

  task = TaskSubmission(
      task_id="your-task-uuid",
      requester_id=client.operator_id_str,
      task_type="code_review",
      prompt='{"code": "...", "language": "python"}',
      reward_amount=25_00000000,  # 25 MDT in raw units
      deadline=int(time.time()) + 3600,
  )

  receipt = hcs.create_task(task)
  print(f"Task on HCS: {receipt}")
  """)

    # ------------------------------------------------------------------
    # Example 6: Smart Contract Interaction
    # ------------------------------------------------------------------
    print("\n📋 Example 6: PaymentEscrow Smart Contract")
    print("─" * 50)

    print("""
  # Interact with deployed PaymentEscrow contract:

  from sdk.hedera.contracts import SmartContractService

  contracts = SmartContractService(client)

  # Create task with escrow deposit
  tx = contracts.create_task(
      task_id="your-task-uuid",
      reward_amount=25_00000000,
      deadline=int(time.time()) + 3600,
  )

  # After validation, finalize and distribute payment
  tx = contracts.finalize_task(
      task_id="your-task-uuid",
      miner_id="0.0.best-miner",
      score=85,
  )
  """)

    # Summary
    banner("Summary")
    print("""
  As a Requester, you can:

  1. Submit tasks via CLI:
     mtcli submit-task --type code_review --file main.py --reward 10

  2. Submit tasks via Python SDK:
     from sdk.protocol.types import TaskRequest
     task = TaskRequest(task_type="code_review", ...)

  3. Submit on-chain via HCS:
     hcs.create_task(TaskSubmission(...))

  4. Use PaymentEscrow for trustless payment:
     contracts.create_task(...)  →  contracts.finalize_task(...)

  5. Batch submit multiple tasks for efficiency

  Reward goes to: Miners (80%) + Validators (15%) + Protocol (5%)
  """)


if __name__ == "__main__":
    main()
