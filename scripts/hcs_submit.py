#!/usr/bin/env python3
"""
HCS Submit Script - Submit a message to a Hedera HCS topic.
Called by Next.js API route /api/hcs/register

Usage: python scripts/hcs_submit.py <params_json_file>

Params JSON: { "topic_id": "0.0.8198583", "message": {...} }
Output (last stdout line): { "success": true, "sequence": "42", ... }
"""

import sys, json, os, time
from pathlib import Path

project_root = Path(__file__).parent.parent
hedera_path = project_root / "sdk" / "hedera"
sys.path.insert(0, str(hedera_path))
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")


def get_latest_sequence(topic_id: str, after_seq: int = 0, retries: int = 6, delay: float = 3.0) -> str:
    """Query Mirror Node to get the latest sequence number, with retry."""
    import httpx
    url = f"https://testnet.mirrornode.hedera.com/api/v1/topics/{topic_id}/messages"
    for attempt in range(retries):
        try:
            r = httpx.get(url, params={"limit": 1, "order": "desc"}, timeout=15)
            r.raise_for_status()
            msgs = r.json().get("messages", [])
            if msgs:
                seq = msgs[0].get("sequence_number", 0)
                if seq > after_seq:
                    return str(seq)
        except Exception:
            pass
        if attempt < retries - 1:
            time.sleep(delay)
    return str(after_seq + 1) if after_seq > 0 else "0"


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


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: hcs_submit.py <params_json_file>"}))
        sys.exit(1)

    try:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            params = json.load(f)
    except Exception as e:
        print(json.dumps({"error": f"Failed to read params: {e}"}))
        sys.exit(1)

    topic_id = params.get("topic_id")
    message = params.get("message")
    if not topic_id or not message:
        print(json.dumps({"error": "params must have topic_id and message"}))
        sys.exit(1)

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
        # Get current sequence before submit so we can detect the new one
        import httpx as _httpx
        try:
            _r = _httpx.get(
                f"https://testnet.mirrornode.hedera.com/api/v1/topics/{topic_id}/messages",
                params={"limit": 1, "order": "desc"}, timeout=10
            )
            _msgs = _r.json().get("messages", [])
            before_seq = _msgs[0].get("sequence_number", 0) if _msgs else 0
        except Exception:
            before_seq = 0

        message_str = json.dumps(message, ensure_ascii=False)
        receipt = client.submit_message(topic_id, message_str)
        client.close()

        # Query Mirror Node with retry until we see a new sequence
        sequence = get_latest_sequence(topic_id, after_seq=before_seq, retries=8, delay=3.0)

        print(json.dumps({
            "success": True,
            "sequence": sequence,
            "topic_id": topic_id,
            "message_type": message.get("type", "unknown"),
            "transaction_id": str(getattr(receipt, "transaction_id", "")),
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
