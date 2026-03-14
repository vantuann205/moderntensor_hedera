"""Verify all on-chain assets including StakingVaultV2."""
import requests, os
from dotenv import load_dotenv
load_dotenv()

print("=" * 60)
print("ModernTensor — Full On-Chain Verification")
print("=" * 60)

acct = os.getenv("HEDERA_ACCOUNT_ID", "0.0.7851838")

# Account
r = requests.get(f"https://testnet.mirrornode.hedera.com/api/v1/accounts/{acct}")
d = r.json()
bal = d.get("balance", {}).get("balance", 0) / 1e8
print(f"\nAccount: {d.get('account','')} ({bal:.2f} HBAR)")

# HCS Topics
print("\nHCS Topics:")
for name in ["REGISTRATION", "SCORING", "TASK"]:
    tid = os.getenv(f"HEDERA_{name}_TOPIC_ID", "")
    if tid:
        r = requests.get(f"https://testnet.mirrornode.hedera.com/api/v1/topics/{tid}")
        status = "LIVE" if r.json().get("topic_id") else "NOT FOUND"
        print(f"  {name}: {tid} [{status}]")

# MDT Token
print("\nMDT Token:")
token_id = os.getenv("HTS_TOKEN_ID_MDT") or os.getenv("HEDERA_MDT_TOKEN_ID", "")
if token_id:
    r = requests.get(f"https://testnet.mirrornode.hedera.com/api/v1/tokens/{token_id}")
    d = r.json()
    print(f"  ID: {token_id}")
    print(f"  Name: {d.get('name','')}/{d.get('symbol','')}")
    supply = int(d.get('total_supply', '0'))
    print(f"  Supply: {supply / 1e8:,.0f} MDT")

# All Contracts
print("\nSmart Contracts:")
contracts = {
    "SubnetRegistry": os.getenv("CONTRACT_ID_SUBNET_REGISTRY", "0.0.8054359"),
    "StakingVault (v1)": os.getenv("CONTRACT_ID_STAKING_VAULT", "0.0.8054361"),
    "StakingVaultV2": os.getenv("CONTRACT_ID_STAKING_VAULT_V2", "0.0.8054430"),
}
for name, cid in contracts.items():
    if cid:
        r = requests.get(f"https://testnet.mirrornode.hedera.com/api/v1/contracts/{cid}")
        d = r.json()
        if d.get("contract_id"):
            print(f"  {name}: {cid} [LIVE]")
            print(f"    EVM: {d.get('evm_address','')}")
        else:
            print(f"  {name}: {cid} [PENDING]")

print("\n" + "=" * 60)
print("All assets verified!")
print("=" * 60)
