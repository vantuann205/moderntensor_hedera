#!/usr/bin/env python3
"""
ModernTensor CLI — mtcli

Command-line interface for interacting with the ModernTensor protocol.

Commands:
    mtcli submit-task   — Submit a task to the network
    mtcli status        — Check task status
    mtcli balance       — Check MDT token balance
    mtcli miners        — List registered miners
    mtcli register      — Register as a miner
    mtcli faucet        — Request testnet MDT tokens

Usage:
    pip install -e .
    mtcli submit-task --type code_review --file main.py --reward 10
    mtcli balance
    mtcli miners --subnet 0
"""

import json
import os
import sys
import time
from pathlib import Path

import click

# Ensure project root is in path
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))


@click.group()
@click.version_option(version="0.1.0", prog_name="mtcli")
def cli():
    """ModernTensor CLI — AI Marketplace on Hedera"""
    pass


# -----------------------------------------------------------------------
# submit-task
# -----------------------------------------------------------------------

@cli.command("submit-task")
@click.option("--type", "task_type", required=True,
              type=click.Choice(["code_review", "text_generation", "sentiment_analysis", "summarization"]),
              help="Type of AI task")
@click.option("--file", "file_path", type=click.Path(exists=True),
              help="File to submit for code review")
@click.option("--prompt", type=str, help="Text prompt for generation tasks")
@click.option("--reward", type=float, required=True, help="MDT reward amount")
@click.option("--subnet", type=int, default=0, help="Subnet ID (default: 0)")
@click.option("--priority", type=click.Choice(["low", "normal", "high", "urgent"]),
              default="normal", help="Task priority")
@click.option("--max-miners", type=int, default=3, help="Max miners to assign")
def submit_task(task_type, file_path, prompt, reward, subnet, priority, max_miners):
    """Submit a task to the ModernTensor network."""
    from dotenv import load_dotenv
    load_dotenv()

    # Build payload
    payload = {}
    if task_type == "code_review":
        if not file_path:
            click.echo("❌ --file is required for code_review tasks")
            sys.exit(1)
        code = Path(file_path).read_text(encoding="utf-8", errors="replace")
        payload = {
            "code": code,
            "language": _detect_language(file_path),
            "filename": Path(file_path).name,
        }
        click.echo(f"📄 File: {file_path} ({len(code)} chars, {payload['language']})")

    elif task_type in ("text_generation", "summarization"):
        if not prompt:
            click.echo("❌ --prompt is required for text generation tasks")
            sys.exit(1)
        payload = {"prompt": prompt, "max_tokens": 500}

    elif task_type == "sentiment_analysis":
        if not prompt:
            click.echo("❌ --prompt is required for sentiment analysis")
            sys.exit(1)
        payload = {"text": prompt}

    # Create task
    from sdk.protocol.types import TaskRequest, TaskPriority
    import uuid

    priority_map = {
        "low": TaskPriority.LOW,
        "normal": TaskPriority.NORMAL,
        "high": TaskPriority.HIGH,
        "urgent": TaskPriority.URGENT,
    }

    task = TaskRequest(
        task_id=str(uuid.uuid4()),
        subnet_id=subnet,
        task_type=task_type,
        payload=payload,
        reward_amount=reward,
        requester_id=os.getenv("HEDERA_ACCOUNT_ID", "0.0.unknown"),
        priority=priority_map[priority],
        max_miners=max_miners,
    )

    click.echo(f"\n📋 Task Created:")
    click.echo(f"   ID:       {task.task_id}")
    click.echo(f"   Type:     {task_type}")
    click.echo(f"   Subnet:   {subnet}")
    click.echo(f"   Reward:   {reward} MDT")
    click.echo(f"   Priority: {priority} ({priority_map[priority].multiplier}x)")
    click.echo(f"   Miners:   max {max_miners}")

    # Calculate fees
    from sdk.protocol.fee_engine import FeeEngine
    engine = FeeEngine()
    fees = engine.calculate(
        reward_amount=reward,
        subnet_fee_rate=0.03,
        priority=priority_map[priority],
    )

    click.echo(f"\n💰 Fee Breakdown (V2 Tokenomics):")
    click.echo(f"   Miner reward:     {fees.miner_reward:.2f} MDT (~85%)")
    click.echo(f"   Validator pool:   {fees.validator_reward:.2f} MDT (8%)")
    click.echo(f"   Staking pool:     {reward * 0.05:.2f} MDT (5% → passive stakers)")
    click.echo(f"   Protocol fee:     {fees.protocol_fee:.2f} MDT (2%)")
    click.echo(f"   Subnet fee:       {fees.subnet_fee:.2f} MDT")
    click.echo(f"   Total deposit:    {fees.total_deposit:.2f} MDT")

    # Try to submit on-chain
    try:
        _submit_onchain(task)
    except Exception as e:
        click.echo(f"\n⚠️  On-chain submission skipped: {e}")
        click.echo("   Task saved locally. Use demo mode for testing.")

    # Save task locally
    tasks_dir = ROOT / ".moderntensor" / "tasks"
    tasks_dir.mkdir(parents=True, exist_ok=True)
    task_file = tasks_dir / f"{task.task_id}.json"
    task_file.write_text(json.dumps(task.to_dict(), indent=2))
    click.echo(f"\n💾 Task saved: {task_file}")
    click.echo("✅ Done!")


def _submit_onchain(task):
    """Submit task to Hedera HCS (requires network connection)."""
    from sdk.hedera.config import load_hedera_config
    from sdk.hedera.client import HederaClient
    from sdk.hedera.hcs import HCSService, TaskSubmission

    config = load_hedera_config()
    client = HederaClient(config)
    hcs = HCSService(client)

    submission = TaskSubmission(
        task_id=task.task_id,
        requester_id=task.requester_id,
        task_type=task.task_type,
        prompt=json.dumps(task.payload),
        reward_amount=int(task.reward_amount * 10 ** 8),
        deadline=int(time.time()) + int(task.timeout_seconds),
    )

    receipt = hcs.create_task(submission)
    click.echo(f"\n📡 Submitted to Hedera HCS")
    client.close()


def _detect_language(file_path: str) -> str:
    """Detect programming language from file extension."""
    ext_map = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".sol": "solidity", ".rs": "rust", ".go": "go",
        ".java": "java", ".cpp": "cpp", ".c": "c",
        ".rb": "ruby", ".php": "php", ".swift": "swift",
    }
    ext = Path(file_path).suffix.lower()
    return ext_map.get(ext, "unknown")


# -----------------------------------------------------------------------
# balance
# -----------------------------------------------------------------------

@cli.command("balance")
def check_balance():
    """Check your HBAR and MDT token balances."""
    from dotenv import load_dotenv
    load_dotenv()

    account_id = os.getenv("HEDERA_ACCOUNT_ID")
    if not account_id:
        click.echo("❌ HEDERA_ACCOUNT_ID not set in .env")
        sys.exit(1)

    click.echo(f"💳 Account: {account_id}")

    try:
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient

        config = load_hedera_config()
        client = HederaClient(config)
        balance = client.get_balance()

        click.echo(f"   HBAR:  {balance.hbars}")
        click.echo(f"   Network: {config.network.value}")
        client.close()
    except Exception as e:
        click.echo(f"   ⚠️  Could not fetch balance: {e}")
        click.echo("   Make sure hiero-sdk-python is installed and .env is configured")


# -----------------------------------------------------------------------
# miners
# -----------------------------------------------------------------------

@cli.command("miners")
@click.option("--subnet", type=int, default=None, help="Filter by subnet ID")
@click.option("--top", type=int, default=10, help="Number of miners to show")
def list_miners(subnet, top):
    """List registered miners and their reputation."""
    from sdk.protocol.miner_registry import MinerRegistry

    registry = MinerRegistry()

    # Try to load saved state
    try:
        registry.load_state()
    except Exception:
        click.echo("⚠️  No saved miner registry found. Showing empty registry.")
        click.echo("   Miners register via HCS — run a demo to populate.")
        return

    miners = registry.get_active_miners(subnet_id=subnet)
    if not miners:
        click.echo("No active miners found.")
        return

    click.echo(f"\n⛏️  Active Miners ({len(miners)} total):")
    click.echo(f"{'ID':<20} {'Reputation':>10} {'Weight':>8} {'Tasks':>6} {'Subnets'}")
    click.echo("-" * 70)

    for miner in sorted(miners, key=lambda m: m.effective_weight, reverse=True)[:top]:
        click.echo(
            f"{miner.miner_id:<20} "
            f"{miner.reputation.score:>10.4f} "
            f"{miner.effective_weight:>8.4f} "
            f"{miner.reputation.total_tasks:>6} "
            f"{miner.subnet_ids}"
        )


# -----------------------------------------------------------------------
# faucet
# -----------------------------------------------------------------------

@cli.command("faucet")
@click.option("--amount", type=float, default=100.0, help="MDT amount to request")
def request_faucet(amount):
    """Request testnet MDT tokens from the faucet."""
    import requests as req

    faucet_url = os.getenv("MDT_FAUCET_URL", "http://localhost:8888")
    account_id = os.getenv("HEDERA_ACCOUNT_ID")

    if not account_id:
        click.echo("❌ HEDERA_ACCOUNT_ID not set in .env")
        sys.exit(1)

    click.echo(f"🚰 Requesting {amount} MDT from faucet...")
    click.echo(f"   Account: {account_id}")
    click.echo(f"   Faucet:  {faucet_url}")

    try:
        resp = req.post(
            f"{faucet_url}/drip",
            json={"account_id": account_id, "amount": amount},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            click.echo(f"✅ Received {data.get('amount', amount)} MDT!")
            if data.get("tx_id"):
                click.echo(f"   TX: {data['tx_id']}")
        else:
            click.echo(f"❌ Faucet error: {resp.text}")
    except req.ConnectionError:
        click.echo(f"❌ Cannot connect to faucet at {faucet_url}")
        click.echo("   Start faucet: python scripts/faucet_server.py")

# -----------------------------------------------------------------------
# stake (M3 fix)
# -----------------------------------------------------------------------

@cli.command("stake")
@click.option("--amount", type=float, required=True, help="MDT amount to stake")
@click.option("--role", type=click.Choice(["miner", "validator", "holder"]),
              required=True, help="Staking role")
def stake_tokens(amount, role):
    """Stake MDT tokens in StakingVaultV2. First stake charges dynamic registration fee (burned)."""
    from dotenv import load_dotenv
    load_dotenv()

    role_map = {"miner": 1, "validator": 2, "holder": 3}
    min_stakes = {"miner": 10, "validator": 500, "holder": 1}

    if amount < min_stakes[role]:
        click.echo(f"❌ Minimum stake for {role}: {min_stakes[role]} MDT")
        sys.exit(1)

    click.echo(f"\n🔒 Staking {amount} MDT as {role.upper()}")
    click.echo(f"   Min required: {min_stakes[role]} MDT")
    click.echo(f"   ⚠️  First stake also charges dynamic registration fee (burned)")

    try:
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient
        from sdk.hedera.contracts import StakingVaultService, StakeRole

        config = load_hedera_config()
        client = HederaClient(config)
        staking = StakingVaultService(client)

        # Get current reg fee
        try:
            result = staking.get_current_reg_fee()
            click.echo(f"   Current reg fee: {int(result.get_uint256(0)) / 1e8:.1f} MDT")
        except Exception:
            pass

        amount_tokens = int(amount * 1e8)
        receipt = staking.stake(amount_tokens, role_map[role])
        click.echo(f"\n✅ Staked {amount} MDT as {role.upper()}")
        client.close()
    except Exception as e:
        click.echo(f"\n⚠️  Staking error: {e}")
        click.echo("   Ensure CONTRACT_ID_STAKING_VAULT_V2 is set in .env")


@cli.command("unstake")
def unstake_tokens():
    """Request unstake from StakingVaultV2. 7-day cooldown."""
    from dotenv import load_dotenv
    load_dotenv()

    click.echo("🔓 Requesting unstake (7-day cooldown)...")
    try:
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient
        from sdk.hedera.contracts import StakingVaultService

        config = load_hedera_config()
        client = HederaClient(config)
        staking = StakingVaultService(client)
        staking.request_unstake()
        click.echo("✅ Unstake requested. Withdraw after 7 days with `mtcli withdraw`.")
        client.close()
    except Exception as e:
        click.echo(f"❌ Error: {e}")


@cli.command("claim-rewards")
def claim_rewards():
    """Claim accumulated passive staking rewards from StakingVaultV2."""
    from dotenv import load_dotenv
    load_dotenv()

    click.echo("💰 Claiming staking rewards...")
    try:
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient
        from sdk.hedera.contracts import StakingVaultService

        config = load_hedera_config()
        client = HederaClient(config)
        staking = StakingVaultService(client)
        staking.claim_rewards()
        click.echo("✅ Rewards claimed!")
        client.close()
    except Exception as e:
        click.echo(f"❌ Error: {e}")


@cli.command("pool-stats")
def pool_stats():
    """View StakingVaultV2 pool statistics."""
    from dotenv import load_dotenv
    load_dotenv()

    click.echo("📊 StakingVaultV2 Pool Stats")
    click.echo("-" * 40)

    contract_id = os.getenv("CONTRACT_ID_STAKING_VAULT_V2", "0.0.8054430")
    click.echo(f"   Contract: {contract_id}")
    click.echo(f"   Fee Split: Miner 85% | Validator 8% | Pool 5% | Protocol 2%")
    click.echo(f"   Min Stake: Miner 10 MDT | Validator 500 MDT | Holder 1 MDT")
    click.echo(f"   Reg Fee: Dynamic (EIP-1559 style, burned)")

    try:
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient
        from sdk.hedera.contracts import StakingVaultService

        config = load_hedera_config()
        client = HederaClient(config)
        staking = StakingVaultService(client)
        result = staking.get_pool_stats()
        click.echo(f"\n   On-chain data available via contract query")
        client.close()
    except Exception as e:
        click.echo(f"\n   ⚠️  On-chain query unavailable: {e}")

@cli.command("withdraw")
def withdraw_tokens():
    """Withdraw staked MDT after unstake cooldown (7 days)."""
    from dotenv import load_dotenv
    load_dotenv()

    click.echo("💸 Withdrawing staked tokens...")
    try:
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient
        from sdk.hedera.contracts import StakingVaultService

        config = load_hedera_config()
        client = HederaClient(config)
        staking = StakingVaultService(client)
        staking.withdraw()
        click.echo("✅ Withdrawn! Tokens returned to your account.")
        client.close()
    except Exception as e:
        click.echo(f"❌ Error: {e}")
        click.echo("   Ensure 7-day cooldown has passed after `mtcli unstake`.")


@cli.command("reputation")
@click.argument("address")
def check_reputation(address):
    """Check a validator's on-chain reputation score."""
    from dotenv import load_dotenv
    load_dotenv()

    click.echo(f"🏆 Validator Reputation: {address}")
    click.echo("-" * 50)

    try:
        from sdk.hedera.config import load_hedera_config
        from sdk.hedera.client import HederaClient
        from sdk.hedera.contracts import SubnetRegistryService

        config = load_hedera_config()
        client = HederaClient(config)
        registry = SubnetRegistryService(client)
        result = registry.get_validator_reputation(address)

        total = result.get_uint256(0)
        accurate = result.get_uint256(1)
        score = result.get_uint256(2)
        last_active = result.get_uint256(3)

        accuracy = (accurate / total * 100) if total > 0 else 0
        click.echo(f"   Total validations:    {total}")
        click.echo(f"   Accurate validations: {accurate}")
        click.echo(f"   Accuracy rate:        {accuracy:.1f}%")
        click.echo(f"   Reputation score:     {score} / 10000 ({score/100:.1f}%)")
        click.echo(f"   Last active:          {last_active}")
        client.close()
    except Exception as e:
        click.echo(f"   ⚠️  Query error: {e}")
        click.echo("   Ensure CONTRACT_ID_SUBNET_REGISTRY_V2 is set in .env")


if __name__ == "__main__":
    cli()
