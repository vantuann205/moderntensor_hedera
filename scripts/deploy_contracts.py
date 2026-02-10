#!/usr/bin/env python3
"""
ModernTensor Smart Contract Deployment Script

Deploys:
1. SubnetRegistry.sol (Main Protocol Contract)
2. PaymentEscrow.sol (Task Payment Logic)

Usage:
    python scripts/deploy_contracts.py
"""

import os
import sys
import solcx
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

load_dotenv()

from sdk.hedera.client import HederaClient
from hiero_sdk_python import ContractFunctionParameters, ContractCreateTransaction, FileCreateTransaction, FileAppendTransaction

def compile_contracts():
    """Compile Solidity contracts using py-solc-x."""
    print("🔨 Compiling contracts...")

    try:
        solcx.install_solc('0.8.24')
    except Exception as e:
        print(f"   (solc install skipped: {e})")

    contracts_dir = project_root / "contracts"
    node_modules = contracts_dir / "node_modules"

    # Check if node_modules exists, if not warn but try compiling (dependencies might fail)
    if not node_modules.exists():
        print("⚠️ 'contracts/node_modules' not found. OpenZeppelin imports might fail.")
        # We can try to use a local remapping if we had them downloaded, but for now we rely on npm

    remappings = {
        "@openzeppelin": str(node_modules / "@openzeppelin")
    } if node_modules.exists() else {}

    print("   Compiling SubnetRegistry.sol & PaymentEscrow.sol...")
    try:
        compiled = solcx.compile_files(
            [
                str(contracts_dir / "SubnetRegistry.sol"),
                str(contracts_dir / "PaymentEscrow.sol")
            ],
            output_values=["abi", "bin"],
            solc_version='0.8.24',
            allow_paths=[str(project_root)],
            import_remappings=remappings
        )
        return compiled
    except Exception as e:
        print(f"❌ Compilation failed: {e}")
        return None

def get_contract_artifact(compiled, contract_name):
    if not compiled: return None
    for key, val in compiled.items():
        if f":{contract_name}" in key:
            return val
    return None

def main():
    print("=" * 70)
    print("🚀 ModernTensor Smart Contract Deployment")
    print("=" * 70)

    try:
        client = HederaClient.from_env()
        print(f"✅ Connected to Hedera as {client.operator_id_str}")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        return

    mdt_token_id_str = os.getenv("HEDERA_MDT_TOKEN_ID")
    if not mdt_token_id_str:
        print("❌ HEDERA_MDT_TOKEN_ID not found in .env")
        return

    print(f"   MDT Token ID: {mdt_token_id_str}")

    # Helper to convert 0.0.X to EVM address (hex string with 0x)
    def to_evm(account_id_str):
        try:
            parts = str(account_id_str).split('.')
            return "0x" + hex(int(parts[2]))[2:].zfill(40)
        except:
            return str(account_id_str)

    # Prepare Token Address
    try:
        parts = mdt_token_id_str.split('.')
        mdt_token_address = "0x" + hex(int(parts[2]))[2:].zfill(40)
    except:
        mdt_token_address = mdt_token_id_str # Fallback

    compiled = compile_contracts()
    if not compiled: return

    # 1. Deploy SubnetRegistry
    registry_artifact = get_contract_artifact(compiled, "SubnetRegistry")
    if registry_artifact:
        print("\n📦 Deploying SubnetRegistry...")
        try:
            registry_bytecode = registry_artifact['bin']

            params = ContractFunctionParameters()
            params.add_address(mdt_token_address)
            params.add_address(to_evm(client.operator_id_str)) # Treasury

            # File Upload (Chunked)
            print("   Uploading bytecode to HCS File Service (chunked)...")
            bytecode_bytes = bytes.fromhex(registry_bytecode)
            chunk_size = 3000

            file_tx = FileCreateTransaction()
            file_tx.set_contents(bytecode_bytes[:chunk_size])
            file_tx.set_keys([client._operator_key.public_key()])

            resp = file_tx.execute(client.client)
            file_receipt = resp.get_receipt(client.client) if hasattr(resp, 'get_receipt') else resp
            bytecode_file_id = file_receipt.file_id
            print(f"   Created File ID: {bytecode_file_id}")

            if len(bytecode_bytes) > chunk_size:
                cursor = chunk_size
                while cursor < len(bytecode_bytes):
                    end = min(cursor + chunk_size, len(bytecode_bytes))
                    chunk = bytecode_bytes[cursor:end]
                    print(f"   Appending chunk {cursor} to {end}...")

                    append_tx = FileAppendTransaction()
                    append_tx.set_file_id(bytecode_file_id)
                    append_tx.set_contents(chunk)

                    resp = append_tx.execute(client.client)
                    if hasattr(resp, 'get_receipt'): resp.get_receipt(client.client)
                    cursor += chunk_size

            print("   Instantiating Contract...")
            contract_tx = ContractCreateTransaction()
            contract_tx.set_bytecode_file_id(bytecode_file_id)
            contract_tx.set_gas(4_000_000)
            contract_tx.set_constructor_parameters(params)

            resp = contract_tx.execute(client.client)
            contract_receipt = resp.get_receipt(client.client) if hasattr(resp, 'get_receipt') else resp

            print(f"   Receipt Status: {contract_receipt.status}")
            if contract_receipt.contract_id:
                print(f"✅ SubnetRegistry Deployed: {contract_receipt.contract_id}")
            else:
                print("❌ Deployment failed (No Contract ID)")
        except Exception as e:
            print(f"❌ SubnetRegistry Deployment failed: {e}")

    # 2. Deploy PaymentEscrow
    escrow_artifact = get_contract_artifact(compiled, "PaymentEscrow")
    if escrow_artifact:
        print("\n📦 Deploying PaymentEscrow...")
        try:
            escrow_bytecode = escrow_artifact['bin']

            params = ContractFunctionParameters()
            params.add_address(mdt_token_address)

            # File Upload (Chunked)
            print("   Uploading bytecode..." )
            bytecode_bytes = bytes.fromhex(escrow_bytecode)

            file_tx = FileCreateTransaction()
            file_tx.set_contents(bytecode_bytes[:chunk_size])
            file_tx.set_keys([client._operator_key.public_key()])

            resp = file_tx.execute(client.client)
            file_receipt = resp.get_receipt(client.client) if hasattr(resp, 'get_receipt') else resp
            bytecode_file_id = file_receipt.file_id

            if len(bytecode_bytes) > chunk_size:
                cursor = chunk_size
                while cursor < len(bytecode_bytes):
                    end = min(cursor + chunk_size, len(bytecode_bytes))
                    chunk = bytecode_bytes[cursor:end]
                    # print(f"   Appending chunk {cursor} to {end}...")

                    append_tx = FileAppendTransaction()
                    append_tx.set_file_id(bytecode_file_id)
                    append_tx.set_contents(chunk)

                    resp = append_tx.execute(client.client)
                    if hasattr(resp, 'get_receipt'): resp.get_receipt(client.client)
                    cursor += chunk_size

            print("   Instantiating Contract...")
            contract_tx = ContractCreateTransaction()
            contract_tx.set_bytecode_file_id(bytecode_file_id)
            contract_tx.set_gas(2_000_000)
            contract_tx.set_constructor_parameters(params)

            resp = contract_tx.execute(client.client)
            contract_receipt = resp.get_receipt(client.client) if hasattr(resp, 'get_receipt') else resp

            print(f"   Receipt Status: {contract_receipt.status}")
            if contract_receipt.contract_id:
                print(f"✅ PaymentEscrow Deployed: {contract_receipt.contract_id}")
            else:
                print("❌ Deployment failed (No Contract ID)")
        except Exception as e:
            print(f"❌ PaymentEscrow Deployment failed: {e}")

if __name__ == "__main__":
    main()
