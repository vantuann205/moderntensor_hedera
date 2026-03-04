#!/usr/bin/env python3
"""
Deploy ModernTensor contracts using pre-compiled Hardhat artifacts.

Uses artifacts from contracts/artifacts/src/ — no solcx compilation needed.

Usage:
    python scripts/deploy_from_artifacts.py
"""

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv, set_key
load_dotenv()


def load_artifact(contract_name: str) -> dict:
    """Load pre-compiled Hardhat artifact."""
    artifact_path = (
        ROOT / "contracts" / "artifacts" / "src"
        / f"{contract_name}.sol" / f"{contract_name}.json"
    )
    if not artifact_path.exists():
        raise FileNotFoundError(f"Artifact not found: {artifact_path}")
    return json.loads(artifact_path.read_text(encoding="utf-8"))


def deploy_contract(client, contract_name: str, gas: int, constructor_params=None):
    """Deploy a single contract to Hedera using File Service + ContractCreate."""
    from hiero_sdk_python import (
        FileCreateTransaction, FileAppendTransaction,
        ContractCreateTransaction,
    )

    print(f"\n📦 Deploying {contract_name}...")

    artifact = load_artifact(contract_name)
    bytecode_hex = artifact.get("bytecode", "")

    # Remove 0x prefix if present
    if bytecode_hex.startswith("0x"):
        bytecode_hex = bytecode_hex[2:]

    if not bytecode_hex:
        print(f"  ❌ No bytecode in artifact for {contract_name}")
        return None

    bytecode_bytes = bytes.fromhex(bytecode_hex)
    print(f"  Bytecode size: {len(bytecode_bytes)} bytes")

    # Step 1: Upload bytecode to File Service (chunked)
    chunk_size = 3000
    print(f"  Uploading bytecode (chunk_size={chunk_size})...")

    file_tx = FileCreateTransaction()
    file_tx.set_contents(bytecode_bytes[:chunk_size])
    file_tx.set_keys([client._operator_key.public_key()])

    resp = file_tx.execute(client.client)
    file_receipt = resp.get_receipt(client.client) if hasattr(resp, "get_receipt") else resp
    bytecode_file_id = file_receipt.file_id
    print(f"  File ID: {bytecode_file_id}")

    # Append remaining chunks
    if len(bytecode_bytes) > chunk_size:
        cursor = chunk_size
        chunk_num = 1
        while cursor < len(bytecode_bytes):
            end = min(cursor + chunk_size, len(bytecode_bytes))
            chunk = bytecode_bytes[cursor:end]
            chunk_num += 1

            append_tx = FileAppendTransaction()
            append_tx.set_file_id(bytecode_file_id)
            append_tx.set_contents(chunk)

            resp = append_tx.execute(client.client)
            if hasattr(resp, "get_receipt"):
                resp.get_receipt(client.client)
            cursor += chunk_size
        print(f"  Uploaded {chunk_num} chunks")

    # Step 2: Create contract
    print(f"  Creating contract...")
    contract_tx = ContractCreateTransaction()
    contract_tx.set_bytecode_file_id(bytecode_file_id)
    contract_tx.set_gas(gas)

    if constructor_params:
        contract_tx.set_constructor_parameters(constructor_params)

    resp = contract_tx.execute(client.client)
    contract_receipt = resp.get_receipt(client.client) if hasattr(resp, "get_receipt") else resp

    if hasattr(contract_receipt, "contract_id") and contract_receipt.contract_id:
        contract_id = str(contract_receipt.contract_id)
        print(f"  ✅ {contract_name} deployed: {contract_id}")
        return contract_id
    else:
        print(f"  ❌ {contract_name} deployment failed")
        if hasattr(contract_receipt, "status"):
            print(f"     Status: {contract_receipt.status}")
        return None


def to_evm_address(account_id_str: str) -> str:
    """Convert 0.0.X to EVM address."""
    parts = str(account_id_str).split(".")
    return "0x" + hex(int(parts[2]))[2:].zfill(40)


def main():
    print("=" * 60)
    print("🚀 ModernTensor — Contract Deployment (from Artifacts)")
    print("=" * 60)

    # Connect
    from sdk.hedera.client import HederaClient

    try:
        client = HederaClient.from_env()
        print(f"✅ Connected as {client.operator_id_str}")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return

    mdt_token_id = os.getenv("HTS_TOKEN_ID_MDT") or os.getenv("HEDERA_MDT_TOKEN_ID")
    if not mdt_token_id:
        print("❌ MDT Token ID not found in .env")
        return

    print(f"   MDT Token: {mdt_token_id}")
    mdt_evm = to_evm_address(mdt_token_id)
    treasury_evm = to_evm_address(client.operator_id_str)
    print(f"   Treasury:  {client.operator_id_str}")

    env_file = str(ROOT / ".env")
    results = {}

    # ---- Deploy SubnetRegistry ----
    try:
        from hiero_sdk_python import ContractFunctionParameters
        params = ContractFunctionParameters()
        params.add_address(mdt_evm)      # _mdtToken
        params.add_address(treasury_evm) # _treasury

        contract_id = deploy_contract(
            client, "SubnetRegistry", gas=4_000_000,
            constructor_params=params,
        )
        if contract_id:
            results["SubnetRegistry"] = contract_id
            set_key(env_file, "CONTRACT_ID_SUBNET_REGISTRY", contract_id)
    except Exception as e:
        print(f"  ❌ SubnetRegistry error: {e}")

    # ---- Deploy PaymentEscrow ----
    try:
        from hiero_sdk_python import ContractFunctionParameters
        params = ContractFunctionParameters()
        params.add_address(mdt_evm)  # _mdtToken

        contract_id = deploy_contract(
            client, "PaymentEscrow", gas=4_000_000,
            constructor_params=params,
        )
        if contract_id:
            results["PaymentEscrow"] = contract_id
            set_key(env_file, "CONTRACT_ID_PAYMENT_ESCROW", contract_id)
    except Exception as e:
        print(f"  ❌ PaymentEscrow error: {e}")

    # ---- Deploy StakingVault ----
    try:
        from hiero_sdk_python import ContractFunctionParameters
        params = ContractFunctionParameters()
        params.add_address(mdt_evm)  # _mdtToken

        contract_id = deploy_contract(
            client, "StakingVault", gas=3_000_000,
            constructor_params=params,
        )
        if contract_id:
            results["StakingVault"] = contract_id
            set_key(env_file, "CONTRACT_ID_STAKING_VAULT", contract_id)
    except Exception as e:
        print(f"  ❌ StakingVault error: {e}")

    # ---- Deploy MDTGovernor ----
    try:
        from hiero_sdk_python import ContractFunctionParameters
        params = ContractFunctionParameters()
        params.add_address(mdt_evm)  # _mdtToken

        contract_id = deploy_contract(
            client, "MDTGovernor", gas=3_000_000,
            constructor_params=params,
        )
        if contract_id:
            results["MDTGovernor"] = contract_id
            set_key(env_file, "CONTRACT_ID_MDT_GOVERNOR", contract_id)
    except Exception as e:
        print(f"  ❌ MDTGovernor error: {e}")

    # ---- Summary ----
    print(f"\n{'=' * 60}")
    print(f"📋 Deployment Summary")
    print(f"{'=' * 60}")
    for name, cid in results.items():
        print(f"  ✅ {name:20s} → {cid}")

    if not results:
        print("  ❌ No contracts deployed")
    else:
        print(f"\n  Contract IDs saved to .env")
        print(f"  Total deployed: {len(results)}/4")

    client.close()


if __name__ == "__main__":
    main()
