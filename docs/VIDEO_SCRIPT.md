# 🎬 ModernTensor — Video Script & Talking Points

## Video Structure (5-7 minutes recommended)

---

## Scene 1: Intro (30s)

**Show:** Terminal with project logo / banner

**Say:**
> "ModernTensor is a decentralized AI marketplace built on Hedera.
> Miners provide AI services, validators verify quality, and everyone
> gets rewarded fairly based on their stake and reputation."

---

## Scene 2: On-Chain Verification (45s)

**Run:** `python scripts/demo_video_e2e.py` (it auto-shows verification)

**Show:** All 6 assets verified LIVE on mirror node

**Say:**
> "Everything is deployed on Hedera testnet — 2 smart contracts,
> 1 MDT token, and 3 HCS topics for consensus messaging.
> Let's verify each one is live..."

**Alt:** Open HashScan in browser:

- `https://hashscan.io/testnet/contract/0.0.8054802` (SubnetRegistryV2)
- `https://hashscan.io/testnet/token/0.0.7852345` (MDT Token)

---

## Scene 3: Architecture (60s)

**Show:** Architecture diagram from demo script

**Say:**
> "The fee split is: 85% to the miner, 8% to validators,
> 5% to passive stakers, and 2% to the protocol.
>
> What makes us unique is the validator reputation system —
> rewards are weighted by THREE factors:
>
> 1. How accurate your scoring is compared to the median
> 2. Your accumulated reputation score
> 3. How much you've staked
>
> So a validator staking 5000 MDT with 90% accuracy earns
> dramatically more than one with 500 MDT and 50% accuracy."

---

## Scene 4: Smart Contract Features (90s)

**Show:** Open `SubnetRegistryV2.sol` in editor, scroll through key sections

**Highlight these sections:**

1. **Lines 120-127:** `ValidatorReputation` struct
2. **Lines 620-660:** Reward calculation with stake × reputation
3. **Lines 794-807:** Adaptive min validators
4. **Lines 751-782:** Cross-subnet portability

**Say:**
> "The SubnetRegistryV2 contract handles the entire protocol lifecycle.
>
> Here's the reputation struct — tracking total validations,
> accurate ones, and a score in basis points.
>
> In the reward distribution, each validator's share is calculated
> as deviation weight times reputation times their stake amount.
> If they scored within 20% of the median, they get full weight.
> If beyond 50%, they get zero — penalized.
>
> High-value tasks automatically require more validators —
> tasks over 10,000 MDT need 4 validators instead of 2.
>
> And validators can port their reputation across subnets
> with a 50% decay, so good validators are incentivized
> to participate in multiple AI domains."

---

## Scene 5: CLI Demo (60s)

**Show:** Terminal

**Run these commands live:**

```bash
# Show available commands
python -m sdk.cli.main --help

# Check balance
python -m sdk.cli.main balance

# Show pool stats
python -m sdk.cli.main pool-stats

# Stake as validator (if tokens available)
python -m sdk.cli.main stake --amount 500 --role validator

# Check reputation
python -m sdk.cli.main reputation 0xb62687a27095B0bC47C840a1EC0c4cC001Cda547
```

**Say:**
> "We have a full CLI for interacting with the protocol.
> You can stake tokens, check balances, query validator
> reputation — all directly from the command line."

---

## Scene 6: StakingVaultV2 (45s)

**Show:** Open `StakingVaultV2.sol` or HashScan

**Say:**
> "The StakingVaultV2 uses an EIP-1559-style dynamic registration fee
> that gets burned — reducing MDT supply over time.
>
> Miners stake 10 MDT minimum, validators 500 MDT.
> Even simple holders can stake and earn passive rewards
> from the 5% staking pool.
>
> There's a 7-day unstake cooldown to prevent hit-and-run attacks."

---

## Scene 7: Hedera-Specific Benefits (30s)

**Say:**
> "We chose Hedera because:
>
> - HCS gives us fast, ordered consensus messaging for task coordination
> - HTS provides native token support without custom ERC-20 contracts
> - Low transaction costs make micro-payments for AI tasks viable
> - Finality in seconds — miners and validators get paid fast"

---

## Scene 8: Outro (30s)

**Show:** Final demo outro banner

**Say:**
> "ModernTensor — decentralized AI with reputation-weighted rewards,
> cross-subnet portability, and adaptive security.
> Built on Hedera for Hello Future Hackathon 2026.
> Thank you for watching!"

---

## HashScan Links for Browser Demo

| What to Show | URL |
|-------------|-----|
| SubnetRegistryV2 | <https://hashscan.io/testnet/contract/0.0.8054802> |
| StakingVaultV2 | <https://hashscan.io/testnet/contract/0.0.8054801> |
| MDT Token | <https://hashscan.io/testnet/token/0.0.7852345> |
| Account | <https://hashscan.io/testnet/account/0.0.7851838> |

## Pre-Recording Checklist

- [ ] Terminal font size large (16-18pt)
- [ ] Terminal theme dark with good contrast
- [ ] `.env` file NOT shown on camera (contains private keys)
- [ ] Demo script tested: `python scripts/demo_video_e2e.py`
- [ ] HashScan tabs pre-opened in browser
- [ ] Editor has SubnetRegistryV2.sol open at key sections
