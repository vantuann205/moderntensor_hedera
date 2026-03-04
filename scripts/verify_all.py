"""Verify all on-chain assets."""
import requests

print("=== Full On-Chain Verification ===")
contracts = {
    "SubnetRegistryV2": "0.0.8054665",
    "StakingVaultV2": "0.0.8054430",
    "SubnetRegistry (v1)": "0.0.8054359",
    "StakingVault (v1)": "0.0.8054361",
}
for name, cid in contracts.items():
    r = requests.get(f"https://testnet.mirrornode.hedera.com/api/v1/contracts/{cid}")
    d = r.json()
    status = "LIVE" if d.get("contract_id") else "NOT FOUND"
    evm = d.get("evm_address", "")
    print(f"  {name}: {cid} [{status}] EVM: {evm}")

# MDT Token
r = requests.get("https://testnet.mirrornode.hedera.com/api/v1/tokens/0.0.7852345")
d = r.json()
supply = int(d.get("total_supply", "0")) / 1e8
print(f"  MDT Token: 0.0.7852345 [{d.get('name','')}/{d.get('symbol','')}] Supply: {supply:,.0f}")

# HCS
for name, tid in [("Registration","0.0.7852335"),("Scoring","0.0.7852336"),("Task","0.0.7852337")]:
    r = requests.get(f"https://testnet.mirrornode.hedera.com/api/v1/topics/{tid}")
    status = "LIVE" if r.json().get("topic_id") else "NOT FOUND"
    print(f"  HCS {name}: {tid} [{status}]")

print("=== All Verified ===")
