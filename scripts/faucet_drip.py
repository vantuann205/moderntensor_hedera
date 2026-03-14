#!/usr/bin/env python3
"""
Faucet Drip Script - Transfer MDT tokens to an account.
Called by Next.js API route /api/faucet

Usage: python scripts/faucet_drip.py <params_json_file>
Params JSON: { "account_id": "0.0.12345", "amount": 1000 }
Output (last stdout line): { "success": true, "amount": 1000, "tx_id": "...", "mode": "live" }
"""

import sys, json, time
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
    hts_mod = lm("hts", hedera_path / "hts.py")
    return cm, clm, hts_mod


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: faucet_drip.py <params_json_file>"}))
        sys.exit(1)

    try:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            params = json.load(f)
    except Exception as e:
        print(json.dumps({"error": f"Failed to read params: {e}"}))
        sys.exit(1)

    account_id = params.get("account_id", "")
    amount = float(params.get("amount", 100))

    if not account_id or not account_id.startswith("0.0."):
        print(json.dumps({"error": "Invalid account_id format (expected 0.0.XXXXX)"}))
        sys.exit(1)

    if amount <= 0 or amount > 500:
        print(json.dumps({"error": "Amount must be between 1 and 500 MDT"}))
        sys.exit(1)

    try:
        cm, clm, hts_mod = load_hedera_modules()
    except Exception as e:
        print(json.dumps({"error": f"Failed to load SDK: {e}"}))
        sys.exit(1)

    try:
        config = cm.load_hedera_config()
        client = clm.HederaClient(config)
        hts = hts_mod.HTSService(client)

        # Use MDT token from env
        import os
        token_id = os.getenv("HEDERA_MDT_TOKEN_ID") or os.getenv("HTS_TOKEN_ID_MDT")
        if not token_id:
            print(json.dumps({"error": "HEDERA_MDT_TOKEN_ID not set in .env"}))
            sys.exit(1)

        hts.mdt_token_id = token_id.strip("'\"")

        # Transfer MDT
        receipt = hts.transfer_mdt(account_id, amount)
        client.close()

        tx_id = str(getattr(receipt, "transaction_id", f"faucet-{int(time.time())}"))

        print(json.dumps({
            "success": True,
            "account_id": account_id,
            "amount": amount,
            "tx_id": tx_id,
            "mode": "live",
            "token_id": hts.mdt_token_id,
            "message": f"Sent {amount} MDT to {account_id}",
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
