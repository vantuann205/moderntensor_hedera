# ModernTensor — Project Description

**For Hedera Hello Future Apex Hackathon 2026 Submission**

---

## Short Description (100 words)

ModernTensor is the first AI Subnet Protocol on Hedera — infrastructure that lets anyone deploy specialized AI agent networks with built-in consensus, quality validation, and instant micropayments. Our SubnetRegistry smart contract manages subnet creation, cross-subnet task routing, and a dual-fee model (1% protocol tax + custom subnet fees). The first vertical subnet, **AI Code Review**, demonstrates the protocol: developers submit code for AI-powered security audits, miners compete to find vulnerabilities, and Proof of Intelligence scores quality on-chain via HCS. Winners receive instant MDT payments. Built with HCS, HTS, HSCS, and Agent Kit. Where quality wins.

---

## Extended Description

### Problem
- Building AI agent networks requires consensus, payments, and validation infrastructure from scratch
- AI agents in different applications can't coordinate or compete
- Open-source AI models have no monetization mechanism
- No transparent, trustless quality verification for AI outputs

### Solution
A **Subnet Protocol** where:
1. Anyone can register a specialized AI subnet (code review, data labeling, DeFi agents, etc.)
2. Each subnet has its own miners, validators, and fee structure
3. The protocol handles consensus (HCS), payments (HTS + HSCS), and validation (Proof of Intelligence)
4. Subnet owners earn custom fees; the protocol earns 1% of all volume

### Live Demo: AI Code Review Subnet
Our reference subnet — AI Code Review — shows the protocol in action:
- Submit Solidity/Python code for AI-powered security audit
- AI miners review code across 5 dimensions (security, correctness, readability, best practices, gas efficiency)
- Validators score review quality, publish to HCS
- Winner paid instantly via smart contract escrow

### Hedera Services
- **HCS:** 3 topics for task coordination, miner registration, and score logging
- **HTS:** MDT fungible token for payments across all subnets
- **HSCS:** SubnetRegistry (protocol) + PaymentEscrow (payments) smart contracts
- **Agent Kit:** AI validator integration (OpenAI, Anthropic, Google)

### Market
- TAM: $12B (Decentralized AI, 2024)
- SAM: $600M (Quality-focused AI infrastructure)
- Key differentiator: First subnet protocol for AI on Hedera — community builds the verticals

### Team
*(Add team info)*

---

## Links

- **GitHub:** https://github.com/sonson0910/moderntensor
- **Demo:** See `dashboard/index.html` or run `python scripts/demo_code_review.py`
- **Pitch Deck:** docs/PITCH_DECK.md
