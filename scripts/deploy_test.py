#!/usr/bin/env python3
"""Deploy simple Test.sol to verify deployment pipeline works."""
import sys, os, json, logging
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s", datefmt="%H:%M:%S")

from dotenv import load_dotenv
load_dotenv()

from sdk.hedera.config import load_hedera_config
from sdk.hedera.client import HederaClient

config = load_hedera_config()
client = HederaClient(config)

# Load Test.sol bytecode
with open("contracts/artifacts/src/Test.sol/Test.json") as f:
    art = json.load(f)
bc_hex = art["bytecode"]
if bc_hex.startswith("0x"):
    bc_hex = bc_hex[2:]
bytecode = bytes.fromhex(bc_hex)
print(f"Test.sol bytecode: {len(bytecode)} bytes")

# Deploy (should be small enough for inline)
print("Deploying Test.sol...")
try:
    contract_id = client.deploy_contract(bytecode=bytecode, gas=100_000)
    print(f"SUCCESS! Contract ID: {contract_id}")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"FAILED: {e}")

# Check balance
bal = client.get_balance()
print(f"Balance: {bal.hbars}")
client.close()
