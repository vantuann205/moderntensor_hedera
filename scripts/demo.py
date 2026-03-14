#!/usr/bin/env python3
"""
ModernTensor Demo

Demonstrates the full flow:
1. Create task via HCS
2. Miner submits result
3. AI Validator scores submission
4. Payment distributed

Usage:
    python scripts/demo.py
"""

import os
import sys
import time
import importlib.util
from pathlib import Path

project_root = Path(__file__).parent.parent
hedera_path = project_root / "sdk" / "hedera"
sys.path.insert(0, str(hedera_path))
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

load_dotenv()


def load_module(name, path):
    """Load module directly to bypass sdk/__init__.py"""
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def main():
    print("=" * 60)
    print("ModernTensor Demo - AI Compute Network on Hedera")
    print("=" * 60)

    # Check configuration
    required_vars = [
        "HEDERA_ACCOUNT_ID",
        "HEDERA_PRIVATE_KEY",
        "HEDERA_REGISTRATION_TOPIC_ID",
        "HEDERA_SCORING_TOPIC_ID",
    ]

    missing = [v for v in required_vars if not os.getenv(v) or os.getenv(v, "").startswith("0.0.XXX")]
    if missing:
        print(f"\n❌ Missing configuration: {missing}")
        print("   Run: python scripts/setup_hedera.py")
        return 1

    # Load modules directly
    config_mod = load_module("config", hedera_path / "config.py")
    errors_mod = load_module("errors", hedera_path / "errors.py")
    sys.modules["sdk.hedera.config"] = config_mod
    sys.modules["sdk.hedera.errors"] = errors_mod

    client_mod = load_module("client", hedera_path / "client.py")
    hcs_mod = load_module("hcs", hedera_path / "hcs.py")
    hts_mod = load_module("hts", hedera_path / "hts.py")
    agent_mod = load_module("agent", hedera_path / "agent.py")

    HederaClient = client_mod.HederaClient
    HCSService = hcs_mod.HCSService
    MinerRegistration = hcs_mod.MinerRegistration
    TaskSubmission = hcs_mod.TaskSubmission
    ScoreSubmission = hcs_mod.ScoreSubmission
    HTSService = hts_mod.HTSService
    AIValidatorAgent = agent_mod.AIValidatorAgent

    print("\n📡 Connecting to Hedera Testnet...")
    config = config_mod.load_hedera_config()
    client = HederaClient(config)
    hcs = HCSService(client)
    hts = HTSService(client)
    agent = AIValidatorAgent(client, hcs)

    balance = client.get_balance()
    print(f"✅ Connected as {client.operator_id_str}")
    print(f"   Balance: {balance.hbars}")

    # Demo 1: Register Miner
    print("\n" + "=" * 40)
    print("📝 Demo 1: Miner Registration")
    print("=" * 40)

    registration = MinerRegistration(
        miner_id="demo-miner-001",
        account_id=client.operator_id_str,
        capabilities=["text_generation", "summarization"],
        stake_amount=100_00000000,  # 100 MDT
    )

    receipt = hcs.register_miner(registration)
    print(f"✅ Miner registered")
    print(f"   Topic: {hcs.registration_topic_id}")

    # Demo 2: Create Task
    print("\n" + "=" * 40)
    print("📋 Demo 2: Task Creation")
    print("=" * 40)

    task = TaskSubmission(
        task_id="task-demo-001",
        requester_id=client.operator_id_str,
        task_type="text_generation",
        prompt="Write a haiku about blockchain technology",
        reward_amount=50_00000000,  # 50 MDT
        deadline=int(time.time()) + 3600,  # 1 hour
    )

    receipt = hcs.create_task(task)
    print(f"✅ Task created")
    print(f"   Task ID: {task.task_id}")
    print(f"   Reward: 50 MDT")

    # Demo 3: AI Validation
    print("\n" + "=" * 40)
    print("🤖 Demo 3: AI Validation")
    print("=" * 40)

    # Simulate miner submission
    submission = """
    Blocks chain together
    Trust flows through the network wide
    Future is now here
    """

    print(f"📥 Miner submission:")
    print(f"   {submission.strip()}")

    # Validate with AI
    result = agent.validate_submission(
        task_prompt=task.prompt,
        submission=submission,
    )

    print(f"\n🎯 AI Validation Result:")
    print(f"   Score: {result['score']}/100")
    print(f"   Confidence: {result['confidence']}")
    print(f"   Metrics:")
    for k, v in result['metrics'].items():
        if k != 'confidence':
            print(f"      {k}: {v:.1f}")

    # Submit score to HCS
    print("\n📤 Submitting score to HCS...")

    score = ScoreSubmission(
        validator_id=client.operator_id_str,
        miner_id="demo-miner-001",
        task_id=task.task_id,
        score=result['score'],
        confidence=result['confidence'],
        metrics=result['metrics'],
    )

    receipt = hcs.submit_score(score)
    print(f"✅ Score submitted to HCS")

    # Demo 4: Query HCS via Mirror Node
    print("\n" + "=" * 40)
    print("🔍 Demo 4: Query HCS Messages")
    print("=" * 40)

    # Wait a bit for mirror node sync
    print("   Waiting for mirror node sync...")
    time.sleep(3)

    print("\n📋 Recent Registrations:")
    regs = hcs.get_registrations(limit=5)
    if regs:
        for r in regs[-3:]:
            print(f"   - {r.get('miner_id')}: {r.get('capabilities')}")
    else:
        print("   (Mirror node may take a few seconds to sync)")

    print("\n📊 Recent Scores:")
    scores = hcs.get_scores(limit=5)
    if scores:
        for s in scores[-3:]:
            print(f"   - Task {s.get('task_id')}: {s.get('score')}/100")
    else:
        print("   (Mirror node may take a few seconds to sync)")

    # Summary
    print("\n" + "=" * 60)
    print("✅ Demo Complete!")
    print("=" * 60)
    print("\nFlow demonstrated:")
    print("  1. ✅ Miner registered on HCS")
    print("  2. ✅ Task created on HCS")
    print("  3. ✅ AI validated submission (score: {:.1f})".format(result['score']))
    print("  4. ✅ Score submitted to HCS")
    print("\nHCS Topics:")
    print(f"  Registration: {hcs.registration_topic_id}")
    print(f"  Scoring: {hcs.scoring_topic_id}")
    if hcs.task_topic_id:
        print(f"  Tasks: {hcs.task_topic_id}")

    print(f"\nMDT Token: {hts.mdt_token_id}")

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
