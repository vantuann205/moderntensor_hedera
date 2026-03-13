#!/usr/bin/env python3
"""
Create test data on Hedera HCS for dashboard
Creates multiple miners, validators, tasks, and scores
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
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

def main():
    print("=" * 60)
    print("Creating Test Data on Hedera HCS")
    print("=" * 60)

    # Load modules
    config_mod = load_module("config", hedera_path / "config.py")
    errors_mod = load_module("errors", hedera_path / "errors.py")
    sys.modules["sdk.hedera.config"] = config_mod
    sys.modules["sdk.hedera.errors"] = errors_mod

    client_mod = load_module("client", hedera_path / "client.py")
    hcs_mod = load_module("hcs", hedera_path / "hcs.py")
    agent_mod = load_module("agent", hedera_path / "agent.py")

    HederaClient = client_mod.HederaClient
    HCSService = hcs_mod.HCSService
    MinerRegistration = hcs_mod.MinerRegistration
    TaskSubmission = hcs_mod.TaskSubmission
    ScoreSubmission = hcs_mod.ScoreSubmission
    AIValidatorAgent = agent_mod.AIValidatorAgent

    config = config_mod.load_hedera_config()
    client = HederaClient(config)
    hcs = HCSService(client)
    agent = AIValidatorAgent(client, hcs)

    print(f"✅ Connected as {client.operator_id_str}\n")

    # Create 5 miners
    print("📝 Creating Miners...")
    miners = [
        {"id": "miner-alpha", "caps": ["text_generation", "code_review"], "stake": 200},
        {"id": "miner-beta", "caps": ["image_generation", "text_generation"], "stake": 150},
        {"id": "miner-gamma", "caps": ["code_review", "summarization"], "stake": 300},
        {"id": "miner-delta", "caps": ["sentiment_analysis", "translation"], "stake": 180},
        {"id": "miner-epsilon", "caps": ["text_generation", "qa"], "stake": 250},
    ]

    for m in miners:
        reg = MinerRegistration(
            miner_id=m["id"],
            account_id=client.operator_id_str,
            capabilities=m["caps"],
            stake_amount=m["stake"] * 100000000,
        )
        hcs.register_miner(reg)
        print(f"  ✅ {m['id']} - stake: {m['stake']} MDT, caps: {m['caps']}")
        time.sleep(0.5)

    # Create 5 tasks
    print("\n📋 Creating Tasks...")
    tasks = [
        {"id": "task-001", "type": "text_generation", "prompt": "Write a technical blog post about blockchain", "reward": 50},
        {"id": "task-002", "type": "code_review", "prompt": "Review this smart contract for security issues", "reward": 75},
        {"id": "task-003", "type": "image_generation", "prompt": "Generate a futuristic city landscape", "reward": 60},
        {"id": "task-004", "type": "summarization", "prompt": "Summarize this 10-page research paper", "reward": 40},
        {"id": "task-005", "type": "sentiment_analysis", "prompt": "Analyze sentiment of customer reviews", "reward": 45},
    ]

    for t in tasks:
        task = TaskSubmission(
            task_id=t["id"],
            requester_id=client.operator_id_str,
            task_type=t["type"],
            prompt=t["prompt"],
            reward_amount=t["reward"] * 100000000,
            deadline=int(time.time()) + 7200,
        )
        hcs.create_task(task)
        print(f"  ✅ {t['id']} - {t['type']} - reward: {t['reward']} MDT")
        time.sleep(0.5)

    # Create scores for tasks
    print("\n🎯 Creating Validation Scores...")
    
    # Simulate 2 validators scoring each task
    validators = ["validator-001", "validator-002"]
    
    for task in tasks[:3]:  # Score first 3 tasks
        for miner in miners[:2]:  # Each task scored by 2 miners
            for validator in validators:
                # Generate realistic score
                import random
                base_score = random.randint(60, 95)
                
                score = ScoreSubmission(
                    validator_id=validator,
                    miner_id=miner["id"],
                    task_id=task["id"],
                    score=base_score,
                    confidence=0.85 + random.random() * 0.1,
                    metrics={
                        "relevance": base_score + random.randint(-5, 5),
                        "quality": base_score + random.randint(-10, 10),
                        "completeness": base_score + random.randint(-8, 8),
                        "creativity": base_score + random.randint(-15, 15),
                    },
                )
                hcs.submit_score(score)
                print(f"  ✅ {validator} scored {miner['id']} on {task['id']}: {base_score}/100")
                time.sleep(0.3)

    print("\n" + "=" * 60)
    print("✅ Test Data Created Successfully!")
    print("=" * 60)
    print(f"\nCreated:")
    print(f"  - {len(miners)} Miners")
    print(f"  - {len(tasks)} Tasks")
    print(f"  - {len(tasks[:3]) * len(miners[:2]) * len(validators)} Scores")
    print(f"\nHCS Topics:")
    print(f"  Registration: {hcs.registration_topic_id}")
    print(f"  Scoring: {hcs.scoring_topic_id}")
    print(f"  Tasks: {hcs.task_topic_id}")
    print(f"\nVerify on HashScan:")
    print(f"  https://hashscan.io/testnet/topic/{hcs.registration_topic_id}")

    client.close()

if __name__ == "__main__":
    main()
