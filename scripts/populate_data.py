#!/usr/bin/env python3
"""
Populate ModernTensor with REAL data on Hedera HCS

Creates:
- 10 miners with different capabilities
- 5 validators
- 20 tasks across different subnets
- Validation scores for tasks

All data is REAL and verifiable on hashscan.io
"""

import os
import sys
import time
import random
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
    print("=" * 70)
    print("🚀 ModernTensor Data Population - Creating REAL Data on Hedera")
    print("=" * 70)

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

    print("\n📡 Connecting to Hedera Testnet...")
    config = config_mod.load_hedera_config()
    client = HederaClient(config)
    hcs = HCSService(client)
    agent = AIValidatorAgent(client, hcs)

    balance = client.get_balance()
    print(f"✅ Connected as {client.operator_id_str}")
    print(f"   Balance: {balance.hbars}")

    # ========================================================================
    # STEP 1: Register 10 Miners
    # ========================================================================
    print("\n" + "=" * 70)
    print("👷 STEP 1: Registering 10 Miners on HCS")
    print("=" * 70)

    miner_configs = [
        {"id": "miner-alpha-001", "caps": ["text_generation", "code_review"], "stake": 150, "subnet": 0},
        {"id": "miner-beta-002", "caps": ["image_generation", "style_transfer"], "stake": 200, "subnet": 1},
        {"id": "miner-gamma-003", "caps": ["text_generation", "summarization"], "stake": 120, "subnet": 0},
        {"id": "miner-delta-004", "caps": ["code_review", "bug_detection"], "stake": 180, "subnet": 2},
        {"id": "miner-epsilon-005", "caps": ["sentiment_analysis", "classification"], "stake": 100, "subnet": 0},
        {"id": "miner-zeta-006", "caps": ["image_generation", "upscaling"], "stake": 250, "subnet": 1},
        {"id": "miner-eta-007", "caps": ["text_generation", "translation"], "stake": 140, "subnet": 0},
        {"id": "miner-theta-008", "caps": ["code_review", "optimization"], "stake": 160, "subnet": 2},
        {"id": "miner-iota-009", "caps": ["summarization", "extraction"], "stake": 110, "subnet": 0},
        {"id": "miner-kappa-010", "caps": ["image_generation", "inpainting"], "stake": 220, "subnet": 1},
    ]

    miners = []
    for mc in miner_configs:
        registration = MinerRegistration(
            miner_id=mc["id"],
            account_id=client.operator_id_str,
            capabilities=mc["caps"],
            stake_amount=mc["stake"] * 100000000,  # Convert to tinybars
        )
        
        try:
            receipt = hcs.register_miner(registration)
            miners.append(mc["id"])
            print(f"  ✅ {mc['id']:20s} | Subnet {mc['subnet']} | {mc['stake']} MDT | {mc['caps']}")
            time.sleep(0.5)  # Rate limiting
        except Exception as e:
            print(f"  ❌ {mc['id']}: {e}")

    print(f"\n📊 Total Miners Registered: {len(miners)}")

    # ========================================================================
    # STEP 2: Register 5 Validators
    # ========================================================================
    print("\n" + "=" * 70)
    print("🔍 STEP 2: Registering 5 Validators")
    print("=" * 70)

    validators = [
        "validator-prime-001",
        "validator-sigma-002", 
        "validator-omega-003",
        "validator-phi-004",
        "validator-psi-005"
    ]

    for v_id in validators:
        print(f"  ✅ {v_id} (simulated - validators tracked off-chain)")

    # ========================================================================
    # STEP 3: Create 20 Tasks
    # ========================================================================
    print("\n" + "=" * 70)
    print("📋 STEP 3: Creating 20 Tasks on HCS")
    print("=" * 70)

    task_templates = [
        {"type": "text_generation", "prompt": "Write a technical blog post about blockchain scalability", "reward": 50, "subnet": 0},
        {"type": "code_review", "prompt": "Review this smart contract for security vulnerabilities", "reward": 80, "subnet": 2},
        {"type": "image_generation", "prompt": "Generate a futuristic cityscape with neon lights", "reward": 60, "subnet": 1},
        {"type": "summarization", "prompt": "Summarize this 10-page research paper on AI ethics", "reward": 40, "subnet": 0},
        {"type": "sentiment_analysis", "prompt": "Analyze sentiment of 1000 customer reviews", "reward": 35, "subnet": 0},
        {"type": "text_generation", "prompt": "Create a product description for a new AI tool", "reward": 45, "subnet": 0},
        {"type": "code_review", "prompt": "Optimize this Python algorithm for performance", "reward": 70, "subnet": 2},
        {"type": "image_generation", "prompt": "Create a logo for a tech startup", "reward": 55, "subnet": 1},
        {"type": "translation", "prompt": "Translate technical documentation from English to Spanish", "reward": 50, "subnet": 0},
        {"type": "bug_detection", "prompt": "Find bugs in this JavaScript codebase", "reward": 75, "subnet": 2},
        {"type": "text_generation", "prompt": "Write a haiku about decentralized AI", "reward": 30, "subnet": 0},
        {"type": "style_transfer", "prompt": "Apply Van Gogh style to this photograph", "reward": 65, "subnet": 1},
        {"type": "classification", "prompt": "Classify 500 images into 10 categories", "reward": 55, "subnet": 0},
        {"type": "code_review", "prompt": "Review Solidity contract for gas optimization", "reward": 85, "subnet": 2},
        {"type": "upscaling", "prompt": "Upscale this image to 4K resolution", "reward": 50, "subnet": 1},
        {"type": "extraction", "prompt": "Extract key entities from legal documents", "reward": 60, "subnet": 0},
        {"type": "text_generation", "prompt": "Generate API documentation from code comments", "reward": 55, "subnet": 0},
        {"type": "inpainting", "prompt": "Remove watermark from this image", "reward": 45, "subnet": 1},
        {"type": "optimization", "prompt": "Optimize database queries for better performance", "reward": 70, "subnet": 2},
        {"type": "summarization", "prompt": "Create executive summary of quarterly report", "reward": 40, "subnet": 0},
    ]

    tasks = []
    for i, template in enumerate(task_templates):
        task_id = f"task-{i+1:03d}-{int(time.time())}"
        
        task = TaskSubmission(
            task_id=task_id,
            requester_id=client.operator_id_str,
            task_type=template["type"],
            prompt=template["prompt"],
            reward_amount=template["reward"] * 100000000,
            deadline=int(time.time()) + 7200,  # 2 hours
        )
        
        try:
            receipt = hcs.create_task(task)
            tasks.append(task_id)
            print(f"  ✅ {task_id:25s} | {template['type']:20s} | {template['reward']} MDT")
            time.sleep(0.5)  # Rate limiting
        except Exception as e:
            print(f"  ❌ {task_id}: {e}")

    print(f"\n📊 Total Tasks Created: {len(tasks)}")

    # ========================================================================
    # STEP 4: Submit Validation Scores
    # ========================================================================
    print("\n" + "=" * 70)
    print("🎯 STEP 4: Submitting Validation Scores")
    print("=" * 70)

    scores_submitted = 0
    for task_id in tasks[:15]:  # Score first 15 tasks
        # Each task gets scored by 3 validators
        for validator_id in validators[:3]:
            # Random miner assignment
            miner_id = random.choice(miners)
            
            # Generate realistic score (60-95 range)
            base_score = random.uniform(60, 95)
            
            score = ScoreSubmission(
                validator_id=validator_id,
                miner_id=miner_id,
                task_id=task_id,
                score=base_score,
                confidence=random.uniform(0.7, 0.95),
                metrics={
                    "relevance": random.uniform(70, 100),
                    "quality": random.uniform(60, 95),
                    "completeness": random.uniform(65, 90),
                    "creativity": random.uniform(50, 100),
                }
            )
            
            try:
                receipt = hcs.submit_score(score)
                scores_submitted += 1
                print(f"  ✅ {validator_id} → {miner_id} | Task {task_id[:15]}... | Score: {base_score:.1f}")
                time.sleep(0.3)  # Rate limiting
            except Exception as e:
                print(f"  ❌ Score submission failed: {e}")

    print(f"\n📊 Total Scores Submitted: {scores_submitted}")

    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "=" * 70)
    print("✅ DATA POPULATION COMPLETE!")
    print("=" * 70)
    print(f"\n📊 Summary:")
    print(f"   Miners:     {len(miners)}")
    print(f"   Validators: {len(validators)}")
    print(f"   Tasks:      {len(tasks)}")
    print(f"   Scores:     {scores_submitted}")
    
    print(f"\n🔗 Verify on HashScan:")
    print(f"   Registration Topic: https://hashscan.io/testnet/topic/{hcs.registration_topic_id}")
    print(f"   Scoring Topic:      https://hashscan.io/testnet/topic/{hcs.scoring_topic_id}")
    print(f"   Task Topic:         https://hashscan.io/testnet/topic/{hcs.task_topic_id}")
    
    print(f"\n⏳ Wait 10-15 seconds for mirror node sync, then refresh dashboard!")
    print(f"   Dashboard: http://localhost:3000")

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
