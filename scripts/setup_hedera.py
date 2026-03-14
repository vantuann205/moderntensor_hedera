#!/usr/bin/env python3
"""
ModernTensor Hedera Setup Script

Initializes the Hedera infrastructure for ModernTensor:
1. Creates HCS topics (registration, scoring, tasks)
2. Creates MDT token
3. Saves configuration to .env

Usage:
    python scripts/setup_hedera.py

Requires:
    - HEDERA_ACCOUNT_ID in .env
    - HEDERA_PRIVATE_KEY in .env
"""

import os
import sys
from pathlib import Path

# Add project root and hedera module directly to path
project_root = Path(__file__).parent.parent
hedera_path = project_root / "sdk" / "hedera"
sys.path.insert(0, str(hedera_path))
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv, set_key

load_dotenv()


def main():
    print("=" * 60)
    print("ModernTensor Hedera Setup")
    print("=" * 60)

    # Check credentials
    account_id = os.getenv("HEDERA_ACCOUNT_ID", "")
    private_key = os.getenv("HEDERA_PRIVATE_KEY", "")

    if not account_id or account_id == "0.0.XXXXX":
        print("\n❌ Error: HEDERA_ACCOUNT_ID not set!")
        print("   Get free testnet account at: https://portal.hedera.com")
        return 1

    if not private_key or private_key.startswith("302e"):
        print("\n❌ Error: HEDERA_PRIVATE_KEY not set!")
        return 1

    print(f"\n✅ Account: {account_id}")
    print(f"✅ Network: {os.getenv('HEDERA_NETWORK', 'testnet')}")

    # Import directly from hedera module files (bypass sdk/__init__.py)
    # Use importlib to avoid triggering sdk package
    import importlib.util

    def load_module(name, path):
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        return module

    # Load hedera modules
    config_mod = load_module("config", hedera_path / "config.py")
    errors_mod = load_module("errors", hedera_path / "errors.py")

    # Inject into sys.modules so client.py can find them
    sys.modules["sdk.hedera.config"] = config_mod
    sys.modules["sdk.hedera.errors"] = errors_mod

    client_mod = load_module("client", hedera_path / "client.py")
    hcs_mod = load_module("hcs", hedera_path / "hcs.py")
    hts_mod = load_module("hts", hedera_path / "hts.py")

    HederaClient = client_mod.HederaClient
    HCSService = hcs_mod.HCSService
    HTSService = hts_mod.HTSService

    try:
        # Connect
        print("\n📡 Connecting to Hedera...")
        config = config_mod.load_hedera_config()
        client = HederaClient(config)

        # Check balance
        balance = client.get_balance()
        print(f"✅ Balance: {balance.hbars}")

        hbar_val = float(str(balance.hbars).replace(" ℏ", "").replace(" HBAR", ""))
        if hbar_val < 10:
            print("\n⚠️  Warning: Low HBAR balance!")
            print("   Get free testnet HBAR from faucet:")
            print("   https://portal.hedera.com/faucet")

        # Initialize services
        hcs = HCSService(client)
        hts = HTSService(client)

        env_path = project_root / ".env"

        # Create HCS Topics
        print("\n📝 Creating HCS Topics...")

        if not os.getenv("HEDERA_REGISTRATION_TOPIC_ID"):
            topic_id = hcs.create_registration_topic()
            set_key(str(env_path), "HEDERA_REGISTRATION_TOPIC_ID", topic_id)
            print(f"   ✅ Registration topic: {topic_id}")
        else:
            print(f"   ⏭️  Registration topic exists: {os.getenv('HEDERA_REGISTRATION_TOPIC_ID')}")

        if not os.getenv("HEDERA_SCORING_TOPIC_ID"):
            topic_id = hcs.create_scoring_topic()
            set_key(str(env_path), "HEDERA_SCORING_TOPIC_ID", topic_id)
            print(f"   ✅ Scoring topic: {topic_id}")
        else:
            print(f"   ⏭️  Scoring topic exists: {os.getenv('HEDERA_SCORING_TOPIC_ID')}")

        if not os.getenv("HEDERA_TASK_TOPIC_ID"):
            topic_id = hcs.create_task_topic()
            set_key(str(env_path), "HEDERA_TASK_TOPIC_ID", topic_id)
            print(f"   ✅ Task topic: {topic_id}")
        else:
            print(f"   ⏭️  Task topic exists: {os.getenv('HEDERA_TASK_TOPIC_ID')}")

        # Create MDT Token
        print("\n🪙 Creating MDT Token...")

        if not os.getenv("HEDERA_MDT_TOKEN_ID"):
            token_id = hts.create_mdt_token()
            set_key(str(env_path), "HEDERA_MDT_TOKEN_ID", token_id)
            print(f"   ✅ MDT Token: {token_id}")
            print(f"   📊 Initial supply: 1,000,000,000 MDT")
        else:
            print(f"   ⏭️  MDT Token exists: {os.getenv('HEDERA_MDT_TOKEN_ID')}")

        # Summary
        print("\n" + "=" * 60)
        print("✅ Setup Complete!")
        print("=" * 60)
        print("\nConfiguration saved to .env")
        print("\nNext steps:")
        print("  1. Compile PaymentEscrow.sol")
        print("  2. Deploy contract with: python scripts/deploy_contract.py")
        print("  3. Run demo: python scripts/demo.py")

        client.close()
        return 0

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
