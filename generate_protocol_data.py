#!/usr/bin/env python3
import os
import sys
import time
import json
import random
from datetime import datetime
from pathlib import Path

# Add project root and hedera module directly to path
project_root = Path(__file__).parent
hedera_path = project_root / "sdk" / "hedera"
sys.path.insert(0, str(hedera_path))
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv, set_key
load_dotenv()

# Use importlib to avoid triggering sdk package __init__
import importlib.util
def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

config_mod = load_module("config", hedera_path / "config.py")
errors_mod = load_module("errors", hedera_path / "errors.py")
sys.modules["sdk.hedera.config"] = config_mod
sys.modules["sdk.hedera.errors"] = errors_mod
client_mod = load_module("client", hedera_path / "client.py")
hcs_mod = load_module("hcs", hedera_path / "hcs.py")
hts_mod = load_module("hts", hedera_path / "hts.py")

HederaClient = client_mod.HederaClient
HCSService = hcs_mod.HCSService
HTSService = hts_mod.HTSService
MinerRegistration = hcs_mod.MinerRegistration
TaskSubmission = hcs_mod.TaskSubmission
ScoreSubmission = hcs_mod.ScoreSubmission

def main():
    print("🚀 Starting Real Protocol Data Generation...")
    
    config = config_mod.load_hedera_config()
    client = HederaClient(config)
    hcs = HCSService(client)
    hts = HTSService(client)
    
    print(f"✅ Connected as: {client.operator_id_str}")
    
    # 1. Register Miners
    print("\n⛏️  Registering Miners...")
    miners = [
        {"id": "Alpha-Miner", "caps": ["text_generation", "code"]},
        {"id": "Beta-Miner", "caps": ["image_generation", "analysis"]},
        {"id": "Gamma-Miner", "caps": ["summarization", "text_generation"]}
    ]
    
    for m in miners:
        reg = MinerRegistration(
            miner_id=m["id"],
            account_id=client.operator_id_str,
            capabilities=m["caps"],
            stake_amount=random.randint(500, 2000) * 10**8
        )
        hcs.register_miner(reg)
        print(f"   - Registered {m['id']}")
        time.sleep(1)

    # 2. Register Validators (Custom Message)
    print("\n🛡️  Registering Validators...")
    validators = ["Validator-Nexus-01", "Validator-Sentinel-02"]
    for v in validators:
        msg = {
            "type": "validator_register",
            "validator_id": v,
            "account_id": client.operator_id_str,
            "capabilities": ["validation", "scoring"],
            "timestamp": datetime.utcnow().isoformat()
        }
        client.submit_message(hcs.registration_topic_id, json.dumps(msg))
        print(f"   - Registered {v}")
        time.sleep(1)
        
    # 3. Create Tasks
    print("\n📋 Creating Tasks...")
    task_types = ["text_generation", "summarization", "code_review"]
    for i in range(5):
        t_id = f"task-real-{int(time.time())}-{i}"
        task = TaskSubmission(
            task_id=t_id,
            requester_id=client.operator_id_str,
            task_type=random.choice(task_types),
            prompt=f"ModernTensor Real-time protocol verification job {i}",
            reward_amount=random.randint(10, 100) * 10**8,
            deadline=int(time.time()) + 3600
        )
        hcs.create_task(task)
        print(f"   - Created Task {t_id}")
        
        # 4. Submit Scores
        time.sleep(1)
        score = ScoreSubmission(
            validator_id=random.choice(validators),
            miner_id=random.choice(miners)["id"],
            task_id=t_id,
            score=random.uniform(85, 99),
            confidence=0.98,
            metrics={"speed": random.uniform(0.5, 2.0), "accuracy": random.uniform(0.9, 1.0)}
        )
        hcs.submit_score(score)
        print(f"   - Scored Task {t_id}")
        time.sleep(1)

    print("\n✅ All data submitted to Hedera HCS!")
    client.close()

if __name__ == "__main__":
    main()
