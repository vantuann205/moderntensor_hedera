#!/usr/bin/env python3
"""
task_create.py — Deployer calls approve_token_allowance + createTask on SubnetRegistryV2

Usage: python scripts/task_create.py <params_json_file>

Params JSON:
{
  "subnet_id": 0,
  "task_hash": "text_generation:...",
  "reward_raw": "100000000",
  "duration_secs": 86400
}

Output (last stdout line):
{ "success": true, "on_chain_task_id": "3", "tx_id": "...", "contract_ts": "..." }
"""

import sys, json, os, time
from pathlib import Path

project_root = Path(__file__).parent.parent
hedera_path = project_root / "sdk" / "hedera"
sys.path.insert(0, str(hedera_path))
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")


def load_hedera_modules():
    import importlib.util
    def lm(name, path):
        spec = importlib.util.spec_from_file_location(name, path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules[name] = mod
        spec.loader.exec_module(mod)
        return mod
    cm = lm("config", hedera_path / "config.py")
    em = lm("errors", hedera_path / "errors.py")
    sys.modules["sdk.hedera.config"] = cm
    sys.modules["sdk.hedera.errors"] = em
    clm = lm("client", hedera_path / "client.py")
    return cm, clm


def get_task_id_from_mirror(registry_id: str, tx_id: str, retries: int = 8, delay: float = 3.0) -> str | None:
    """Poll mirror node for TaskCreated event to get on-chain task ID."""
    import httpx
    # Convert tx_id to mirror format
    mirror_id = tx_id
    if "@" in tx_id:
        acc, time_part = tx_id.split("@")
        dot = time_part.index(".")
        mirror_id = f"{acc}-{time_part[:dot]}-{time_part[dot+1:]}"

    url = f"https://testnet.mirrornode.hedera.com/api/v1/contracts/{registry_id}/results"
    for attempt in range(retries):
        try:
            r = httpx.get(url, params={"limit": 10, "order": "desc"}, timeout=15)
            r.raise_for_status()
            results = r.json().get("results", [])
            for result in results:
                # Check logs for TaskCreated event
                # TaskCreated topic0 = keccak256("TaskCreated(uint256,uint256,address,uint256)")
                logs_url = f"https://testnet.mirrornode.hedera.com/api/v1/contracts/{registry_id}/results/logs"
                lr = httpx.get(logs_url, params={"limit": 5, "order": "desc"}, timeout=15)
                if lr.status_code == 200:
                    logs = lr.json().get("logs", [])
                    for log in logs:
                        topics = log.get("topics", [])
                        # TaskCreated has 4 topics (event + 3 indexed params)
                        if len(topics) >= 2:
                            # topics[1] = taskId (indexed uint256)
                            task_id_hex = topics[1]
                            if task_id_hex and task_id_hex != "0x":
                                return str(int(task_id_hex, 16))
                break
        except Exception:
            pass
        if attempt < retries - 1:
            time.sleep(delay)
    return None


def get_contract_ts(tx_id: str, retries: int = 8, delay: float = 3.0) -> str:
    """Get consensus_timestamp for a transaction."""
    import httpx
    mirror_id = tx_id
    if "@" in tx_id:
        acc, time_part = tx_id.split("@")
        dot = time_part.index(".")
        mirror_id = f"{acc}-{time_part[:dot]}-{time_part[dot+1:]}"

    url = f"https://testnet.mirrornode.hedera.com/api/v1/transactions/{mirror_id}"
    for attempt in range(retries):
        try:
            r = httpx.get(url, timeout=15)
            if r.status_code == 200:
                txs = r.json().get("transactions", [])
                if txs:
                    return txs[0].get("consensus_timestamp", "")
        except Exception:
            pass
        if attempt < retries - 1:
            time.sleep(delay)
    return ""


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: task_create.py <params_json_file>"}))
        sys.exit(1)

    try:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            params = json.load(f)
    except Exception as e:
        print(json.dumps({"error": f"Failed to read params: {e}"}))
        sys.exit(1)

    subnet_id = params.get("subnet_id", 0)
    task_hash = params.get("task_hash", "")
    reward_raw = int(params.get("reward_raw", 0))
    duration_secs = int(params.get("duration_secs", 86400))

    if not task_hash or reward_raw <= 0:
        print(json.dumps({"error": "task_hash and reward_raw required"}))
        sys.exit(1)

    # totalDeposit = reward * 1.15
    total_raw = (reward_raw * 115) // 100

    # Contract IDs from env
    mdt_token_id = os.getenv("NEXT_PUBLIC_MDT_TOKEN_ID", "0.0.8198586")
    registry_id = os.getenv("NEXT_PUBLIC_SUBNET_REGISTRY_ID", "0.0.8219634")

    try:
        cm, clm = load_hedera_modules()
    except Exception as e:
        print(json.dumps({"error": f"Failed to load SDK: {e}"}))
        sys.exit(1)

    try:
        config = cm.load_hedera_config()
        client = clm.HederaClient(config)
    except Exception as e:
        print(json.dumps({"error": f"Failed to connect to Hedera: {e}"}))
        sys.exit(1)

    try:
        from hiero_sdk_python import ContractFunctionParameters

        # Step 1: AccountAllowanceApproveTransaction — deployer approves registry for totalDeposit
        client.approve_token_allowance(
            token_id=mdt_token_id,
            spender_account_id=registry_id,
            amount=total_raw,
        )

        # Step 2: execute_contract → createTask(subnetId, taskHash, rewardAmount, duration)
        params_fn = ContractFunctionParameters()
        params_fn.add_uint256(subnet_id)
        params_fn.add_string(task_hash)
        params_fn.add_uint256(reward_raw)
        params_fn.add_uint256(duration_secs)

        receipt = client.execute_contract(
            contract_id=registry_id,
            function_name="createTask",
            params=params_fn,
            gas=500000,
        )
        tx_id = str(getattr(receipt, "transaction_id", ""))
        client.close()

        # Get consensus_timestamp
        contract_ts = get_contract_ts(tx_id) if tx_id else ""

        # Get on-chain task ID from mirror node logs
        on_chain_task_id = get_task_id_from_mirror(registry_id, tx_id) if tx_id else None

        print(json.dumps({
            "success": True,
            "on_chain_task_id": on_chain_task_id,
            "tx_id": tx_id,
            "contract_ts": contract_ts,
        }))
        sys.exit(0)

    except Exception as e:
        try:
            client.close()
        except Exception:
            pass
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
