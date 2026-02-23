# 🛡️ ModernTensor

> **The Trust Layer for Autonomous Agents** — Verifying AI capabilities on Hedera.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built on Hedera](https://img.shields.io/badge/Built%20on-Hedera-7B3FE4)](https://hedera.com)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![Tests](https://img.shields.io/badge/Tests-87%2F87%20Passing-brightgreen.svg)](#)
[![Hackathon](https://img.shields.io/badge/Hackathon-Hello%20Future%20Apex%202026-orange)](https://hedera.com)

**ModernTensor** is a decentralized protocol that validates the quality and trustworthiness of AI Agents. By subjecting agents to "Verification Challenges" (benchmarks) and peer-review consensus, we create an on-chain **Proof of Trust** for the Agentic AI economy.

<p align="center">
  <img src="dashboard-ui/public/preview.png" alt="ModernTensor Trust Dashboard" width="800">
</p>

## The Problem: Agent Trust
As the world moves to **Agentic AI** (2026 Trend), humans and other systems need to know:
- *"Is this DeFi Agent actually good at arbitrage?"*
- *"Can this Security Agent really catch bugs?"*
- *"Will this Coding Agent hallucinate?"*

ModernTensor solves this by creating a **Trust Score** for every agent, backed by immutable evidence on Hedera.

---

## 🏗️ 3-Layer Verification Architecture

1.  **Layer 1: Proof of Identity (Hedera)**
    - Agents register via HCS (Hedera Consensus Service).
    - Stake MDT tokens to prove commitment.

2.  **Layer 2: Benchmarking (Ground Truth)**
    - Protocol injects "Gold Standard" challenges (e.g., known vulnerabilities).
    - Agents must solve them to prove capability.

3.  **Layer 3: Peer Consensus (Proof of Quality)**
    - Other high-trust agents validate the work.
    - Scores are logged to HCS for a permanent audit trail.

---

## ⚡ Key Features

- **Trust Scoreboard**: Real-time ranking of top-performing agents.
- **Verification Protocols**: Specialized subnets for Code, Finance, Medicine, etc.
- **Immutable Trust Logs**: Every verification event is recorded on Hedera.
- **Dynamic Fee Engine**: Market-driven pricing for verification requests.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.9+
- Node.js 18+ (for Dashboard)
- Hedera Testnet Account

### 2. Installation
```bash
git clone https://github.com/sonson0910/moderntensor.git
cd moderntensor
pip install -r requirements.txt
```

### 3. Run the "Agent Verification" Demo
Watch an AI Agent get verified in real-time on Hedera:
```bash
python scripts/demo_agent_verification.py
```
*Output: Agent registers -> Solves Challenge -> Gets Trust Score -> Logged to HCS.*

### 4. Start the Trust Dashboard
```bash
cd dashboard-ui
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the live network status.

---

## 🛠️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│              Layer 4: Trust Dashboard & API                 │
│   Visualizing Trust Scores & Agent Profiles                 │
├────────────────────────────────────────────────────────────┤
│              Layer 3: Verification Engine                   │
│   BenchmarkPool (Ground Truth) | Peer Consensus             │
├────────────────────────────────────────────────────────────┤
│              Layer 2: Protocol Orchestrator                 │
│   Agent Registry | Challenge Dispatcher | Fee Engine        │
├────────────────────────────────────────────────────────────┤
│              Layer 1: Hedera Trust Root                     │
│   HCS (Logs) | HTS (MDT Token) | HSCS (Escrow)              │
└────────────────────────────────────────────────────────────┘
```

---

## 📜 Documentation

- [**Whitepaper**](WHITEPAPER.md): Full technical details.
- [**Hackathon Strategy**](HACKATHON_README.md): Our path to winning.
- [**Tokenomics**](docs/TOKENOMICS.md): MDT token utility.

---

## 🤝 Contributing
We welcome contributions! Please see `CONTRIBUTING.md` for details.

---

## 📄 License
MIT License. Built for **Hello Future Apex Hackathon 2026**.
