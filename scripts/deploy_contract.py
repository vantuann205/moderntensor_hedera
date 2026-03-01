#!/usr/bin/env python3
"""Deploy PaymentEscrow contract to Hedera testnet."""
import sys, os, logging
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s", datefmt="%H:%M:%S")

from dotenv import load_dotenv
load_dotenv()

from sdk.hedera.config import load_hedera_config
from sdk.hedera.client import HederaClient
from sdk.hedera.contracts import SmartContractService

config = load_hedera_config()
client = HederaClient(config)
contracts = SmartContractService(client)

print(f"Account: {client.operator_id_str}")
bal = client.get_balance()
print(f"Balance: {bal.hbars}")

# Load freshly compiled bytecode
contracts.load_bytecode("./contracts/artifacts/PaymentEscrow.bin")
print(f"Bytecode loaded: {len(contracts._bytecode)} bytes")

# MDT token EVM address
mdt_id = config.hts_token.mdt_token_id
mdt_num = int(mdt_id.split(".")[-1])
mdt_evm = "0x" + hex(mdt_num)[2:].zfill(40)
print(f"MDT: {mdt_id} -> {mdt_evm}")

# Deploy
print("Deploying PaymentEscrow via FileCreate + ContractCreate...")
try:
    contract_id = contracts.deploy_payment_escrow(mdt_token_address=mdt_evm, gas=800_000)
    print(f"CONTRACT DEPLOYED: {contract_id}")

    # Save to .env
    with open(".env", "r") as f:
        env_content = f.read()

    # Replace or append
    if "HEDERA_PAYMENT_ESCROW_CONTRACT_ID=" in env_content:
        lines = env_content.split("\n")
        new_lines = []
        for line in lines:
            if line.startswith("HEDERA_PAYMENT_ESCROW_CONTRACT_ID="):
                new_lines.append(f"HEDERA_PAYMENT_ESCROW_CONTRACT_ID='{contract_id}'")
            else:
                new_lines.append(line)
        with open(".env", "w") as f:
            f.write("\n".join(new_lines))
    else:
        with open(".env", "a") as f:
            f.write(f"\nHEDERA_PAYMENT_ESCROW_CONTRACT_ID='{contract_id}'\n")

    print(f"Contract ID saved to .env")

except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"DEPLOY FAILED: {e}")

bal2 = client.get_balance()
print(f"Balance after: {bal2.hbars}")
client.close()
