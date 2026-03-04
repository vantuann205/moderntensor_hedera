# ModernTensor — Miner Templates

Ready-to-run miner implementations for the ModernTensor network.

## Quick Start

```bash
# 1. Install SDK
cd moderntensor_hedera
pip install -e .

# 2. Configure
cp .env.example .env
# Edit .env with your Hedera account + API keys

# 3. Run a miner
python miners/code_review_miner.py
```

## Available Miners

| Miner | Port | LLM Required | Description |
|-------|------|-------------|-------------|
| `code_review_miner.py` | 8091 | OpenAI (optional) | AI-powered code review |
| `text_generator_miner.py` | 8092 | OpenAI (optional) | Text generation (creative/formal/technical) |
| `sentiment_analyzer_miner.py` | 8093 | ❌ No | Rule-based sentiment analysis |

## How It Works

Each miner runs an **Axon** HTTP server that:

1. Listens for tasks from validators on `http://0.0.0.0:<port>`
2. Processes the task using AI or rule-based logic
3. Returns structured JSON output
4. Gets scored by the ModernTensor scoring engine

## Creating Your Own Miner

```python
from sdk.protocol.axon import Axon

def my_handler(payload: dict, task_type: str) -> dict:
    # Your AI logic here
    return {"result": "...", "score": 0.9}

axon = Axon(
    miner_id="0.0.YOUR_ACCOUNT",
    handler=my_handler,
    port=8094,
    capabilities=["my_task_type"],
)
axon.start()
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HEDERA_ACCOUNT_ID` | Yes | Your Hedera testnet account ID |
| `HEDERA_PRIVATE_KEY` | Yes | Your Hedera private key |
| `OPENAI_API_KEY` | Optional | For AI-powered miners |
| `MINER_PORT` | Optional | Override default port |
| `MDT_STAKE_AMOUNT` | Optional | Stake amount (default: 100 MDT) |
