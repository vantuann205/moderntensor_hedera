#!/usr/bin/env python3
"""
ModernTensor — Subnet Management Tool

Create, configure, and manage subnets on the ModernTensor network.

Commands:
    python scripts/manage_subnet.py create   — Create a new subnet
    python scripts/manage_subnet.py info      — View subnet details
    python scripts/manage_subnet.py miners    — List miners in subnet
    python scripts/manage_subnet.py stats     — Get subnet statistics
    python scripts/manage_subnet.py deploy    — Deploy SubnetRegistry contract

Usage:
    python scripts/manage_subnet.py create \
        --name "AI Code Review" \
        --fee-rate 0.03 \
        --min-stake 100
"""

import json
import logging
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import click
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [subnet] %(message)s",
)


@click.group()
def cli():
    """ModernTensor Subnet Manager"""
    pass


# -----------------------------------------------------------------------
# create
# -----------------------------------------------------------------------

@cli.command()
@click.option("--name", required=True, help="Subnet name")
@click.option("--fee-rate", type=float, default=0.03, help="Subnet fee rate (0-0.20)")
@click.option("--min-stake", type=float, default=100.0, help="Minimum stake for miners")
@click.option("--task-types", default="code_review,text_generation",
              help="Comma-separated task types")
@click.option("--max-miners", type=int, default=100, help="Maximum miners allowed")
def create(name, fee_rate, min_stake, task_types, max_miners):
    """Create a new subnet."""
    if not (0 <= fee_rate <= 0.20):
        click.echo("❌ Fee rate must be between 0 and 0.20 (0-20%)")
        return

    import uuid
    subnet_id = abs(hash(name)) % 10000  # Simple deterministic ID

    subnet_config = {
        "subnet_id": subnet_id,
        "name": name,
        "owner": os.getenv("HEDERA_ACCOUNT_ID", "0.0.unknown"),
        "fee_rate": fee_rate,
        "min_stake": min_stake,
        "task_types": task_types.split(","),
        "max_miners": max_miners,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "status": "active",
    }

    click.echo(f"\n{'=' * 50}")
    click.echo(f"  🌐 Creating Subnet: {name}")
    click.echo(f"{'=' * 50}")
    click.echo(f"  ID:          {subnet_id}")
    click.echo(f"  Owner:       {subnet_config['owner']}")
    click.echo(f"  Fee Rate:    {fee_rate * 100:.1f}%")
    click.echo(f"  Min Stake:   {min_stake} MDT")
    click.echo(f"  Task Types:  {task_types}")
    click.echo(f"  Max Miners:  {max_miners}")

    # Save subnet config locally
    subnets_dir = ROOT / ".moderntensor" / "subnets"
    subnets_dir.mkdir(parents=True, exist_ok=True)
    config_file = subnets_dir / f"subnet_{subnet_id}.json"
    config_file.write_text(json.dumps(subnet_config, indent=2))

    click.echo(f"\n💾 Config saved: {config_file}")

    # Try on-chain registration
    try:
        _register_onchain(subnet_config)
        click.echo("📡 Registered on Hedera SubnetRegistry contract")
    except Exception as e:
        click.echo(f"⚠️  On-chain registration skipped: {e}")
        click.echo("   Subnet saved locally. Deploy contract first.")

    click.echo("✅ Subnet created!")


def _register_onchain(config):
    """Register subnet on SubnetRegistry smart contract."""
    from sdk.hedera.config import load_hedera_config
    from sdk.hedera.client import HederaClient

    hedera_config = load_hedera_config()
    client = HederaClient(hedera_config)

    contract_id = os.getenv("CONTRACT_ID_SUBNET_REGISTRY")
    if not contract_id:
        raise RuntimeError("CONTRACT_ID_SUBNET_REGISTRY not set")

    # Call registerSubnet on the contract
    from sdk.hedera.contracts import SmartContractService
    contracts = SmartContractService(client)
    contracts.register_subnet(
        subnet_id=config["subnet_id"],
        name=config["name"],
        fee_rate=int(config["fee_rate"] * 10000),
        min_stake=int(config["min_stake"] * 10**8),
    )
    client.close()


# -----------------------------------------------------------------------
# info
# -----------------------------------------------------------------------

@cli.command()
@click.argument("subnet_id", type=int, required=False, default=None)
def info(subnet_id):
    """View subnet details."""
    subnets_dir = ROOT / ".moderntensor" / "subnets"

    if subnet_id is not None:
        config_file = subnets_dir / f"subnet_{subnet_id}.json"
        if config_file.exists():
            data = json.loads(config_file.read_text())
            _print_subnet(data)
        else:
            click.echo(f"❌ Subnet {subnet_id} not found locally")
    else:
        # List all subnets
        if not subnets_dir.exists():
            click.echo("No subnets found. Create one with: manage_subnet.py create")
            return

        files = sorted(subnets_dir.glob("subnet_*.json"))
        if not files:
            click.echo("No subnets found.")
            return

        click.echo(f"\n🌐 Registered Subnets ({len(files)}):")
        click.echo(f"{'ID':>6}  {'Name':<25} {'Fee':>6} {'Miners':>6}  {'Status'}")
        click.echo("─" * 65)

        for f in files:
            data = json.loads(f.read_text())
            click.echo(
                f"{data['subnet_id']:>6}  "
                f"{data['name']:<25} "
                f"{data['fee_rate']*100:>5.1f}% "
                f"{data.get('miner_count', 0):>6}  "
                f"{data['status']}"
            )


def _print_subnet(data):
    """Print detailed subnet info."""
    click.echo(f"\n{'=' * 50}")
    click.echo(f"  🌐 Subnet: {data['name']}")
    click.echo(f"{'=' * 50}")
    for k, v in data.items():
        click.echo(f"  {k:>15}: {v}")


# -----------------------------------------------------------------------
# miners
# -----------------------------------------------------------------------

@cli.command()
@click.argument("subnet_id", type=int, default=0)
def miners(subnet_id):
    """List miners in a subnet."""
    from sdk.protocol.miner_registry import MinerRegistry

    registry = MinerRegistry()
    try:
        registry.load_state()
        active = registry.get_active_miners(subnet_id=subnet_id)
    except Exception:
        active = []

    if not active:
        click.echo(f"No miners found in subnet {subnet_id}")
        click.echo("Miners register with: python miners/code_review_miner.py")
        return

    click.echo(f"\n⛏️  Miners in Subnet {subnet_id} ({len(active)}):")
    click.echo(f"{'Miner ID':<20} {'Reputation':>10} {'Weight':>8} {'Tasks':>6} {'Capabilities'}")
    click.echo("─" * 70)

    for miner in sorted(active, key=lambda m: m.effective_weight, reverse=True):
        click.echo(
            f"{miner.miner_id:<20} "
            f"{miner.reputation.score:>10.4f} "
            f"{miner.effective_weight:>8.4f} "
            f"{miner.reputation.total_tasks:>6} "
            f"{miner.capabilities}"
        )


# -----------------------------------------------------------------------
# stats
# -----------------------------------------------------------------------

@cli.command()
@click.argument("subnet_id", type=int, default=0)
def stats(subnet_id):
    """Get subnet statistics."""
    from sdk.protocol.miner_registry import MinerRegistry

    registry = MinerRegistry()
    try:
        registry.load_state()
        active = registry.get_active_miners(subnet_id=subnet_id)
    except Exception:
        active = []

    total_stake = sum(m.stake_amount for m in active) if active else 0
    avg_rep = (
        sum(m.reputation.score for m in active) / len(active)
        if active else 0
    )

    click.echo(f"\n📊 Subnet {subnet_id} Statistics:")
    click.echo(f"  Active miners:      {len(active)}")
    click.echo(f"  Total staked:       {total_stake:.2f} MDT")
    click.echo(f"  Average reputation: {avg_rep:.4f}")

    if active:
        capabilities = set()
        for m in active:
            capabilities.update(m.capabilities)
        click.echo(f"  Capabilities:       {sorted(capabilities)}")

        top = sorted(active, key=lambda m: m.effective_weight, reverse=True)[:3]
        click.echo(f"\n  🏆 Top Miners:")
        for i, m in enumerate(top, 1):
            click.echo(f"    #{i} {m.miner_id} (weight={m.effective_weight:.4f})")


# -----------------------------------------------------------------------
# deploy
# -----------------------------------------------------------------------

@cli.command()
def deploy():
    """Deploy SubnetRegistry smart contract to Hedera."""
    click.echo("\n🚀 Smart Contract Deployment")
    click.echo("─" * 50)
    click.echo("  Run the full deployment script:")
    click.echo("    python scripts/deploy_contracts.py")
    click.echo()
    click.echo("  This deploys:")
    click.echo("    1. SubnetRegistry.sol — Subnet & miner management")
    click.echo("    2. PaymentEscrow.sol  — Task payment escrow")
    click.echo("    3. StakingVault.sol   — Stake management")
    click.echo("    4. MDTGovernor.sol    — Governance")
    click.echo()
    click.echo("  Prerequisites:")
    click.echo("    - Hedera testnet account with HBAR")
    click.echo("    - .env configured with account credentials")
    click.echo("    - npm install in contracts/ (for OpenZeppelin)")


if __name__ == "__main__":
    cli()
