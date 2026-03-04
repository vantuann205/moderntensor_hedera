# ModernTensor — Validator Templates

Ready-to-run validator implementations for the ModernTensor network.

## Quick Start

```bash
# 1. Install SDK
cd moderntensor_hedera
pip install -e .

# 2. Configure
cp .env.example .env
# Set HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, OPENAI_API_KEY

# 3. Run validator
python validators/ai_validator_runner.py
```

## How Validators Work

```
Miner submits output → Validator receives via HCS/Dendrite
        ↓
Multi-Dimensional Scoring (correctness, completeness, security, readability)
        ↓
Proof of Intelligence Checks (entropy, repetition, length)
        ↓
Commit-Reveal Score Submission → HCS
        ↓
Consensus (weighted median across validators)
        ↓
Validator earns 15% of task reward
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HEDERA_ACCOUNT_ID` | Yes | Your Hedera testnet account ID |
| `HEDERA_PRIVATE_KEY` | Yes | Your Hedera private key |
| `OPENAI_API_KEY` | Recommended | For AI-enhanced validation |
| `VALIDATOR_POLL_INTERVAL` | No | Polling interval in seconds (default: 10) |
| `VALIDATOR_MIN_CONFIDENCE` | No | Minimum confidence threshold (default: 0.6) |
| `VALIDATOR_SUBNETS` | No | Comma-separated subnet IDs (default: 0) |

## Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Correctness | 30% | Is the output factually correct? |
| Completeness | 25% | Does it fully address the task? |
| Security | 25% | Any security concerns flagged? |
| Readability | 20% | Is the output well-structured? |

## Proof of Intelligence (PoI) Checks

Validators automatically detect:

- **Low entropy** — template/copy-paste output
- **Too short** — lazy or minimal effort
- **High repetition** — gibberish or filler text

PoI penalties reduce the miner's score proportionally.
