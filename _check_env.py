"""Quick .env sanity check for hackathon readiness."""

import os
from dotenv import load_dotenv

load_dotenv()

checks = {
    "HEDERA_ACCOUNT_ID": os.environ.get("HEDERA_ACCOUNT_ID", ""),
    "HEDERA_PRIVATE_KEY": os.environ.get("HEDERA_PRIVATE_KEY", ""),
    "HEDERA_EVM_PRIVATE_KEY": os.environ.get("HEDERA_EVM_PRIVATE_KEY", ""),
    "HCS_REGISTRATION_TOPIC_ID": os.environ.get("HEDERA_REGISTRATION_TOPIC_ID", ""),
    "HCS_SCORING_TOPIC_ID": os.environ.get("HEDERA_SCORING_TOPIC_ID", ""),
    "HCS_TASK_TOPIC_ID": os.environ.get(
        "HEDERA_TASK_TOPIC_ID", os.environ.get("HCS_TASK_TOPIC_ID", "")
    ),
    "HEDERA_MDT_TOKEN_ID": os.environ.get("HEDERA_MDT_TOKEN_ID", ""),
    "HEDERA_PAYMENT_ESCROW_CONTRACT_ID": os.environ.get(
        "HEDERA_PAYMENT_ESCROW_CONTRACT_ID", ""
    ),
    "HEDERA_SUBNET_REGISTRY_CONTRACT_ID": os.environ.get(
        "HEDERA_SUBNET_REGISTRY_CONTRACT_ID", ""
    ),
}

print("=" * 60)
print("  .env Credential Check")
print("=" * 60)
for key, val in checks.items():
    if not val:
        print(f"  MISSING  {key}")
    elif key == "HEDERA_PRIVATE_KEY":
        raw = val.replace("0x", "")
        byte_len = (
            len(bytes.fromhex(raw))
            if all(c in "0123456789abcdef" for c in raw.lower())
            else -1
        )
        print(f"  OK       {key} = {val[:10]}...  ({byte_len} bytes)")
        if byte_len == 33:
            print(
                f"  WARNING  This looks like a compressed public key (33 bytes with 02/03 prefix)"
            )
            print(f"           Private keys should be 32 bytes. Check Hedera Portal.")
        elif byte_len == 32:
            print(f"           (32 bytes - valid private key length)")
    elif key == "HEDERA_EVM_PRIVATE_KEY":
        raw = val.replace("0x", "")
        byte_len = (
            len(bytes.fromhex(raw))
            if all(c in "0123456789abcdef" for c in raw.lower())
            else -1
        )
        print(f"  OK       {key} = {val[:10]}...  ({byte_len} bytes)")
    else:
        print(f"  OK       {key} = {val}")

# Check requirements
print("\n  Python Requirements:")
required = ["dotenv", "requests"]
for mod in required:
    try:
        __import__(mod)
        print(f"  OK       {mod}")
    except ImportError:
        print(f"  MISSING  {mod}")

# Check eth_abi/eth_utils (optional)
for mod in ["eth_abi", "eth_utils"]:
    try:
        __import__(mod)
        print(f"  OK       {mod} (optional)")
    except ImportError:
        print(f"  ABSENT   {mod} (optional — governance demo only)")

print("=" * 60)
