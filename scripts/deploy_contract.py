#!/usr/bin/env python3
"""
Deploy PaymentEscrow Contract to Hedera - Simple Version

Uses FileCreate for large bytecode.
"""

import os
import sys
import json
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
    print("Deploy PaymentEscrow Contract to Hedera")
    print("=" * 60)

    # Check config
    mdt_token_id = os.getenv("HEDERA_MDT_TOKEN_ID")
    if not mdt_token_id or mdt_token_id.startswith("0.0.XXX"):
        print("\n❌ MDT Token not found. Run setup_hedera.py first.")
        return 1

    # Load artifact
    artifact_path = project_root / "luxtensor" / "contracts" / "artifacts" / \
        "src" / "templates" / "PaymentEscrow.sol" / "PaymentEscrow.json"

    if not artifact_path.exists():
        print(f"\n❌ Artifact not found: {artifact_path}")
        return 1

    with open(artifact_path) as f:
        artifact = json.load(f)

    bytecode_hex = artifact["bytecode"]
    abi = artifact["abi"]

    # Remove 0x prefix
    if bytecode_hex.startswith("0x"):
        bytecode_hex = bytecode_hex[2:]

    print(f"\n📋 Contract: PaymentEscrow")
    print(f"   Bytecode size: {len(bytecode_hex)//2} bytes")
    print(f"   ABI functions: {len([x for x in abi if x.get('type') == 'function'])}")

    # Load Hedera modules
    config_mod = load_module("config", hedera_path / "config.py")
    errors_mod = load_module("errors", hedera_path / "errors.py")
    sys.modules["sdk.hedera.config"] = config_mod
    sys.modules["sdk.hedera.errors"] = errors_mod

    print("\n📡 Connecting to Hedera...")
    config = config_mod.load_hedera_config()

    from hiero_sdk_python import (
        Client, Network, AccountId, PrivateKey,
        ContractCreateTransaction, FileCreateTransaction, FileAppendTransaction,
        ContractFunctionParameters
    )

    # Connect
    network = Network(config.network.value)
    client = Client(network)

    operator_id = AccountId.from_string(config.account_id)
    pk = config.private_key
    if pk.startswith("0x"):
        operator_key = PrivateKey.from_bytes_ecdsa(bytes.fromhex(pk[2:]))
    else:
        operator_key = PrivateKey.from_string(pk)

    client.set_operator(operator_id, operator_key)
    print(f"✅ Connected as {config.account_id}")

    # Convert MDT token ID to EVM address
    parts = mdt_token_id.split(".")
    token_num = int(parts[2])
    mdt_evm_address = f"{token_num:040x}"

    print(f"\n🪙 MDT Token:")
    print(f"   Hedera ID: {mdt_token_id}")
    print(f"   EVM Address: 0x{mdt_evm_address}")

    # Append constructor args to bytecode
    constructor_args = mdt_evm_address.zfill(64)
    full_bytecode_hex = bytecode_hex + constructor_args
    full_bytecode = bytes.fromhex(full_bytecode_hex)

    print(f"   Full bytecode: {len(full_bytecode)} bytes")

    # Step 1: Create file with bytecode (for large contracts)
    print("\n📁 Step 1: Creating bytecode file...")

    try:
        # Hedera limits file chunks to ~4KB
        chunk_size = 4000

        # First chunk
        first_chunk = full_bytecode[:chunk_size]
        file_tx = FileCreateTransaction()
        file_tx.set_contents(first_chunk)
        file_receipt = file_tx.execute(client)
        file_id = file_receipt.file_id

        print(f"   File created: {file_id}")

        # Append remaining chunks
        if len(full_bytecode) > chunk_size:
            for i in range(chunk_size, len(full_bytecode), chunk_size):
                chunk = full_bytecode[i:i+chunk_size]
                append_tx = FileAppendTransaction()
                append_tx.set_file_id(file_id)
                append_tx.set_contents(chunk)
                append_tx.execute(client)
                print(f"   Appended chunk {i//chunk_size + 1}")

        print(f"   ✅ Bytecode uploaded")

        # Step 2: Deploy contract from file
        print("\n🚀 Step 2: Deploying contract...")

        contract_tx = ContractCreateTransaction()
        contract_tx.set_bytecode_file_id(file_id)
        contract_tx.set_gas(1_000_000)  # Increased gas
        contract_tx.set_admin_key(operator_key.public_key())

        contract_receipt = contract_tx.execute(client)
        contract_id = contract_receipt.contract_id

        if contract_id:
            print(f"\n✅ Contract Deployed!")
            print(f"   Contract ID: {contract_id}")

            # Save to .env
            env_path = project_root / ".env"
            with open(env_path, "a") as f:
                f.write(f"HEDERA_PAYMENT_ESCROW_CONTRACT_ID='{contract_id}'\n")

            print(f"\n📁 Saved to .env")

            # Save ABI
            abi_path = project_root / "contracts" / "PaymentEscrow.abi.json"
            abi_path.parent.mkdir(exist_ok=True)
            with open(abi_path, "w") as f:
                json.dump(abi, f, indent=2)
            print(f"   ABI saved to: contracts/PaymentEscrow.abi.json")
        else:
            print("\n❌ Contract ID is None")
            print("   This may indicate the transaction failed.")
            print("   Check Hedera explorer for details.")

    except Exception as e:
        print(f"\n❌ Deploy failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    print("\n" + "=" * 60)
    print("✅ Deployment Complete!")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
