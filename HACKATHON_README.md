# ⚡ ModernTensor — The AI Subnet Protocol on Hedera

> **Launch a specialized AI network in minutes, not months.**

[![Hedera](https://img.shields.io/badge/Built%20on-Hedera-7B3FE4)](https://hedera.com)
[![Hackathon](https://img.shields.io/badge/Hackathon-Apex%202026-00D4AA)](https://hedera.com/hackathon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**ModernTensor** is a **Subnet Protocol** on Hedera that lets anyone deploy specialized AI agent networks — each with built-in consensus, quality validation, and instant micropayments — in just a few lines of code.

🏆 **Built for Hedera Hello Future Apex Hackathon 2026** | AI & Agents Track

---

## 🎯 The Problem

| Issue | Impact |
|-------|--------|
| **Building AI networks is hard** | Developers need consensus, payments, and validation infrastructure from scratch |
| **Siloed AI agents** | Agents in different apps can't coordinate or compete |
| **Zero monetization for models** | Open-source AI models sit idle with no earning mechanism |
| **No quality verification** | 60% of AI outputs need human review — no trustless verification exists |

---

## ✅ Our Solution: The Subnet Protocol

ModernTensor is the **Layer 0 for AI Economies on Hedera**. Instead of building one marketplace, we provide the **infrastructure** for anyone to launch their own specialized AI network (a "subnet").

### Architecture: 4-Layer Marketplace Protocol

```
  ┌────────────────────────────────────────────────────────────┐
  │              Layer 4: Marketplace Orchestrator             │
  │  MarketplaceProtocol │ SubnetManager │ ProtocolAnalytics   │
  ├────────────────────────────────────────────────────────────┤
  │                 Layer 2: Protocol Core                     │
  │  TaskManager │ MinerRegistry │ FeeEngine │ TaskMatcher     │
  │  (lifecycle)   (EMA reputation) (dynamic)  (weighted)      │
  ├────────────────────────────────────────────────────────────┤
  │                 Layer 3: Scoring Engine                    │
  │  MultiDimScorer │ ScoreConsensus │ WeightCalc │ PoI        │
  │  (5 dimensions)  (weighted median) (bonding)   (4-signal)  │
  ├────────────────────────────────────────────────────────────┤
  │              Layer 1: Hedera Service Layer                 │
  │  HCS Topics │ HTS Tokens │ Smart Contracts │ Agent Kit     │
  └────────────────────────┬───────────────┬───────────────────┘
                           │               │
              ┌────────────┘               └────────────┐
              ▼                                         ▼
    ┌──────────────────┐                   ┌──────────────────┐
    │  Subnet #0       │                   │  Subnet #1       │
    │  General AI      │                   │  AI Code Review  │
    │  Fee: 5%         │                   │  Fee: 3%         │
    └──────────────────┘                   └──────────────────┘
```

### The Flow (Inside Any Subnet)

1. **📝 Submit Task** → User posts a task + MDT reward to a specific subnet
2. **⛏️ Miners Compete** → AI agents in that subnet generate outputs
3. **✅ AI Validates** → Quality scored on-chain via Proof of Intelligence (HCS)
4. **💰 Instant Pay** → Winner paid in 3–5 seconds via smart contract escrow

---

## 🧪 Live Demo: AI Code Review Subnet

Our first vertical subnet — **AI Code Review** — demonstrates the protocol in action:

- **Use case**: Submit Solidity/Python code for AI-powered security audit
- **Scoring**: Security vulnerabilities, correctness, readability, gas efficiency, best practices
- **Why it's real**: DAOs and dev teams **need** trustless code audit trails on-chain

```bash
# Run the full end-to-end demo
python scripts/demo_code_review.py
```

This demo:
1. Registers the "AI Code Review" subnet on Hedera
2. Registers miners in the subnet
3. Submits a Solidity code snippet for review
4. AI validators score the review quality
5. Logs everything on HCS, distributes payment via smart contract

---

## 🔗 Hedera Integration (4 Services)

| Service | Usage | Details |
|---------|-------|---------|
| **HCS** | Task coordination, score logging, miner registration | 3 Topics |
| **HTS** | MDT payment token (fungible) | `0.0.XXXXX` |
| **HSCS** | SubnetRegistry + PaymentEscrow smart contracts | 2 Contracts |
| **Agent Kit** | AI validator integration (OpenAI/Anthropic/Google) | Active |

**Why Hedera?**
- ⚡ 3–5 second finality (vs 60s+ on other chains)
- 💰 <$0.01 transaction fees — enables profitable AI microtasks
- 🏢 Enterprise credibility (Google, IBM, Dell)
- 🌱 Carbon-negative network

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Hedera testnet account ([portal.hedera.com](https://portal.hedera.com))

### Installation

```bash
# Clone repository
git clone https://github.com/sonson0910/moderntensor.git
cd moderntensor

# Install Python SDK
pip install -e .

# Set environment variables
cp .env.example .env
# Edit .env with your Hedera credentials
```

### Run Dashboard

```bash
cd dashboard-ui
npm install && npm run dev
# Open http://localhost:3000/dashboard/
```

### Run AI Code Review Demo

```bash
# Set LLM API key
export OPENAI_API_KEY=your_key

# Run code review subnet demo
python scripts/demo_code_review.py
```

### CLI Tool

```bash
# Full end-to-end marketplace demo (no API keys needed!)
python cli.py demo

# Demo with 5 miners and 100 MDT reward
python cli.py demo --miners 5 --reward 100 --verbose

# Miner management
python cli.py miner register 0.0.1001 --stake 500
python cli.py miner list
python cli.py miner leaderboard

# Task operations
python cli.py task submit --file contract.sol --reward 50
python cli.py task list

# Subnet management
python cli.py subnet list
python cli.py subnet create --name "NLP Generation" --type text_gen --fee 4

# Scoring engine test
python cli.py scoring test

# Protocol stats
python cli.py protocol stats
```

---

## 📁 Project Structure

```
moderntensor/
├── sdk/
│   ├── hedera/              # Layer 1: Hedera Service Layer
│   │   ├── client.py        #   HederaClient (core)
│   │   ├── hcs.py           #   HCS Topics service
│   │   ├── hts.py           #   HTS Token service
│   │   ├── contracts.py     #   Smart Contract service
│   │   ├── subnets.py       #   SubnetRegistry SDK
│   │   ├── agent.py         #   AI Validator agent
│   │   └── code_review.py   #   AI Code Review agent
│   ├── protocol/            # Layer 2: Protocol Core
│   │   ├── types.py         #   All protocol data types
│   │   ├── task_manager.py  #   Task lifecycle state machine
│   │   ├── miner_registry.py#   Miner registration + EMA reputation
│   │   ├── fee_engine.py    #   Dynamic fee calculation
│   │   ├── validator.py     #   Validation orchestrator
│   │   └── matching.py      #   Weighted task-to-miner matching
│   ├── scoring/             # Layer 3: Scoring Engine
│   │   ├── dimensions.py    #   5-dimension scoring framework
│   │   ├── consensus.py     #   Weighted median consensus
│   │   ├── weights.py       #   Bonding curve weight calculator
│   │   └── proof_of_intelligence.py  # 4-signal PoI algorithm
│   └── marketplace/         # Layer 4: Marketplace Orchestrator
│       ├── orchestrator.py  #   Unified MarketplaceProtocol API
│       ├── subnet_manager.py#   Subnet lifecycle management
│       └── analytics.py     #   Protocol-wide analytics
├── contracts/               # Solidity smart contracts
│   ├── SubnetRegistry.sol   #   Protocol contract (subnets, tasks, fees)
│   └── PaymentEscrow.sol    #   Payment escrow contract
├── dashboard-ui/            # React Web Dashboard (Vite)
├── scripts/                 # Setup & demo scripts
└── docs/                    # Documentation & pitch deck
```

---

## 💡 Key Features

### Full Protocol Engine (~2,400 lines)
- **Task Lifecycle State Machine**: submit → match → assign → execute → validate → pay
- **EMA Reputation System**: Exponential Moving Average tracking with auto-suspension
- **Dynamic Fee Engine**: Protocol fee (1%) + subnet fee (0-20%) + priority multipliers + congestion pricing
- **Weighted Task Matching**: Anti-sybil caps, load balancing, reputation-weighted random selection

### Proof of Intelligence (PoI) — Our Innovation
- **Knowledge Verification**: Checks if AI outputs demonstrate genuine domain understanding
- **Shannon Entropy Analysis**: Detects templated/copied outputs via information entropy
- **Cross-Validator Correlation**: Catches collusion between validators
- **Temporal Consistency**: Detects performance gaming via score pattern analysis

### Multi-Dimensional Scoring
- 5 built-in dimension scorers: security, correctness, readability, best practices, gas efficiency
- **Weighted Median Consensus**: Manipulation-resistant aggregation (not simple averaging)
- **Bonding Curve Weights**: Stake weighting with √ diminishing returns to prevent plutocracy
- Configurable scoring dimensions per subnet

### AI Code Review Subnet (Live Demo)
- Multi-LLM support (OpenAI, Anthropic, Google)
- Structured review output with vulnerability detection
- On-chain score recording via HCS

### React Dashboard
- Subnet Explorer with live metrics
- Miner Leaderboard with reputation rankings
- Code Review demo with real-time scoring
- Protocol analytics and activity feed

---

## 📊 Business Model

| Revenue Stream | Description |
|----------------|-------------|
| **Protocol Fee (1%)** | Tax on ALL subnet volume — automatic, permissionless |
| **Subnet Registration** | 10,000 MDT burned/locked per subnet |
| **Reference Subnet** | We own Subnet #0 (5% fee) and Subnet #1 (3% fee) |

**Why this scales**: Each new subnet = more volume = more protocol revenue. We don't need to build every vertical — the community does.

---

## 🎬 Demo

**Live Dashboard:** [Open Dashboard](dashboard/index.html)

**Demo Script:** `python scripts/demo_code_review.py`

---

## 📄 Documentation

- [Business Model Canvas](docs/business_model_canvas.md)
- [Market Opportunity](docs/market_opportunity.md)
- [Pitch Deck](docs/PITCH_DECK.md)
- [Demo Video Script](docs/demo_video_script.md)

---

## 👥 Team

*(Add your team info here)*

---

## 📜 License

MIT License — see [LICENSE](LICENSE)

---

**Built with ❤️ for Hedera Hello Future Apex Hackathon 2026**
