#!/usr/bin/env python3
"""
ModernTensor CLI — mtcli

Command-line interface for ALL on-chain operations across 4 smart contracts:
  PaymentEscrow, SubnetRegistry, StakingVault, MDTGovernor

Commands:
    Staking:   stake, unstake, withdraw, stake-info
    Subnet:    register-subnet, register-miner, add-validator, subnet-info
    Task:      create-task, submit-result, validate, finalize-task, task-info
    Escrow:    escrow-create, escrow-submit, escrow-validate, escrow-finalize
    Earnings:  withdraw-earnings, withdraw-fees
    Governance: propose, vote, finalize-vote, execute-proposal, proposal-info
    General:   balance, faucet

Usage:
    pip install -e .
    mtcli balance
    mtcli stake --amount 100 --role miner
    mtcli register-subnet --name "AI Review" --description "Code review" --fee-rate 300
    mtcli create-task --subnet 0 --hash "QmTask..." --reward 10 --duration 86400
"""

import json
import os
import sys
import time
from pathlib import Path

import click

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))


def _get_client():
    """Create HederaClient from env."""
    from dotenv import load_dotenv

    load_dotenv()
    from sdk.hedera.config import load_hedera_config
    from sdk.hedera.client import HederaClient

    config = load_hedera_config()
    return HederaClient(config)


@click.group()
@click.version_option(version="0.2.0", prog_name="mtcli")
def cli():
    """ModernTensor CLI — AI Marketplace on Hedera (100% on-chain)"""
    pass


# ==========================================================================
# Balance
# ==========================================================================


@cli.command("balance")
def check_balance():
    """Check HBAR and MDT token balances."""
    try:
        client = _get_client()
        balance = client.get_balance()
        account_id = os.getenv("HEDERA_ACCOUNT_ID")
        click.echo(f"Account: {account_id}")
        click.echo(f"HBAR:    {balance.hbars}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


# ==========================================================================
# StakingVault Commands
# ==========================================================================


@cli.command("stake")
@click.option("--amount", type=float, required=True, help="MDT amount to stake")
@click.option(
    "--role",
    type=click.Choice(["miner", "validator"]),
    required=True,
    help="Staking role",
)
def stake_tokens(amount, role):
    """Stake MDT tokens in StakingVault."""
    role_map = {"miner": 1, "validator": 2}
    click.echo(f"Staking {amount} MDT as {role.upper()}...")
    try:
        client = _get_client()
        from sdk.hedera.staking_vault import StakingVaultService

        staking = StakingVaultService(client)
        amount_tokens = int(amount * 1e8)
        staking.stake(amount_tokens, role_map[role])
        click.echo(f"Staked {amount} MDT as {role.upper()}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("unstake")
def unstake_tokens():
    """Request unstake (7-day cooldown)."""
    try:
        client = _get_client()
        from sdk.hedera.staking_vault import StakingVaultService

        staking = StakingVaultService(client)
        staking.request_unstake()
        click.echo("Unstake requested. Withdraw after 7 days.")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("withdraw")
def withdraw_tokens():
    """Withdraw staked MDT after cooldown."""
    try:
        client = _get_client()
        from sdk.hedera.staking_vault import StakingVaultService

        staking = StakingVaultService(client)
        staking.withdraw()
        click.echo("Tokens withdrawn.")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("stake-info")
@click.argument("address")
def stake_info(address):
    """Check staking info for an EVM address."""
    try:
        client = _get_client()
        from sdk.hedera.staking_vault import StakingVaultService

        staking = StakingVaultService(client)
        result = staking.get_stake_info(address)
        click.echo(f"Stake info for {address}: {result}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


# ==========================================================================
# SubnetRegistry Commands
# ==========================================================================


@cli.command("register-subnet")
@click.option("--name", required=True, help="Subnet name")
@click.option("--description", required=True, help="Subnet description")
@click.option(
    "--fee-rate", type=int, default=300, help="Fee rate in basis points (300 = 3%)"
)
def register_subnet(name, description, fee_rate):
    """Register a new subnet on SubnetRegistry."""
    try:
        client = _get_client()
        from sdk.hedera.subnet_registry import SubnetRegistryService

        registry = SubnetRegistryService(client)
        registry.register_subnet(name, description, fee_rate)
        click.echo(f"Subnet '{name}' registered (fee: {fee_rate} bps)")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("register-miner")
@click.option("--subnet", type=int, required=True, help="Subnet ID")
def register_miner(subnet):
    """Register as miner in a subnet (must stake first)."""
    try:
        client = _get_client()
        from sdk.hedera.subnet_registry import SubnetRegistryService

        registry = SubnetRegistryService(client)
        registry.register_miner(subnet)
        click.echo(f"Registered as miner in subnet {subnet}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("add-validator")
@click.option("--subnet", type=int, required=True, help="Subnet ID")
@click.option("--address", required=True, help="Validator EVM address")
def add_validator(subnet, address):
    """Add a validator to a subnet (must stake first)."""
    try:
        client = _get_client()
        from sdk.hedera.subnet_registry import SubnetRegistryService

        registry = SubnetRegistryService(client)
        registry.add_validator(subnet, address)
        click.echo(f"Validator {address} added to subnet {subnet}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("subnet-info")
@click.option("--subnet", type=int, required=True, help="Subnet ID")
def subnet_info(subnet):
    """Get subnet info from SubnetRegistry."""
    try:
        client = _get_client()
        from sdk.hedera.subnet_registry import SubnetRegistryService

        registry = SubnetRegistryService(client)
        result = registry.get_subnet(subnet)
        click.echo(f"Subnet {subnet}: {result}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


# ==========================================================================
# SubnetRegistry Task Commands
# ==========================================================================


@cli.command("create-task")
@click.option("--subnet", type=int, required=True, help="Subnet ID")
@click.option("--hash", "task_hash", required=True, help="Task content hash")
@click.option("--reward", type=float, required=True, help="MDT reward amount")
@click.option("--duration", type=int, default=86400, help="Task duration in seconds")
def create_task(subnet, task_hash, reward, duration):
    """Create a task in SubnetRegistry (approve MDT first)."""
    try:
        client = _get_client()
        from sdk.hedera.subnet_registry import SubnetRegistryService

        registry = SubnetRegistryService(client)
        reward_tokens = int(reward * 1e8)
        registry.create_task(subnet, task_hash, reward_tokens, duration)
        click.echo(
            f"Task created in subnet {subnet}: reward={reward} MDT, duration={duration}s"
        )
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("submit-result")
@click.option("--task", type=int, required=True, help="Task ID")
@click.option("--hash", "result_hash", required=True, help="Result content hash")
def submit_result(task, result_hash):
    """Submit a result for a task (miner)."""
    try:
        client = _get_client()
        from sdk.hedera.subnet_registry import SubnetRegistryService

        registry = SubnetRegistryService(client)
        registry.submit_result(task, result_hash)
        click.echo(f"Result submitted for task {task}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("validate")
@click.option("--task", type=int, required=True, help="Task ID")
@click.option("--miner-index", type=int, required=True, help="Miner submission index")
@click.option("--score", type=int, required=True, help="Score (0-10000 bps)")
def validate_submission(task, miner_index, score):
    """Score a task submission (validator only)."""
    try:
        client = _get_client()
        from sdk.hedera.subnet_registry import SubnetRegistryService

        registry = SubnetRegistryService(client)
        registry.validate_submission(task, miner_index, score)
        click.echo(f"Scored task {task}, miner {miner_index}: {score}/10000")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("finalize-task")
@click.option("--task", type=int, required=True, help="Task ID")
def finalize_task(task):
    """Finalize a task and distribute rewards."""
    try:
        client = _get_client()
        from sdk.hedera.subnet_registry import SubnetRegistryService

        registry = SubnetRegistryService(client)
        registry.finalize_task(task)
        click.echo(f"Task {task} finalized")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("task-info")
@click.option("--task", type=int, required=True, help="Task ID")
def task_info(task):
    """Get task info from SubnetRegistry."""
    try:
        client = _get_client()
        from sdk.hedera.subnet_registry import SubnetRegistryService

        registry = SubnetRegistryService(client)
        result = registry.get_task(task)
        click.echo(f"Task {task}: {result}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


# ==========================================================================
# PaymentEscrow Commands
# ==========================================================================


@cli.command("escrow-create")
@click.option("--hash", "task_hash", required=True, help="Task content hash")
@click.option("--reward", type=float, required=True, help="MDT reward amount")
@click.option("--duration", type=int, default=86400, help="Task duration in seconds")
def escrow_create(task_hash, reward, duration):
    """Create a task in PaymentEscrow (approve MDT first)."""
    try:
        client = _get_client()
        from sdk.hedera.payment_escrow import PaymentEscrowService

        escrow = PaymentEscrowService(client)
        reward_tokens = int(reward * 1e8)
        escrow.create_task(task_hash, reward_tokens, duration)
        click.echo(f"Escrow task created: reward={reward} MDT, duration={duration}s")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("escrow-submit")
@click.option("--task", type=int, required=True, help="Task ID")
@click.option("--hash", "result_hash", required=True, help="Result hash")
def escrow_submit(task, result_hash):
    """Submit result to PaymentEscrow task (miner)."""
    try:
        client = _get_client()
        from sdk.hedera.payment_escrow import PaymentEscrowService

        escrow = PaymentEscrowService(client)
        escrow.submit_result(task, result_hash)
        click.echo(f"Result submitted for escrow task {task}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("escrow-validate")
@click.option("--task", type=int, required=True, help="Task ID")
@click.option("--miner-index", type=int, required=True, help="Miner index")
@click.option("--score", type=int, required=True, help="Score (0-10000)")
def escrow_validate(task, miner_index, score):
    """Score an escrow submission (validator)."""
    try:
        client = _get_client()
        from sdk.hedera.payment_escrow import PaymentEscrowService

        escrow = PaymentEscrowService(client)
        escrow.validate_submission(task, miner_index, score)
        click.echo(f"Escrow task {task}, miner {miner_index}: scored {score}/10000")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("escrow-finalize")
@click.option("--task", type=int, required=True, help="Task ID")
def escrow_finalize(task):
    """Finalize an escrow task."""
    try:
        client = _get_client()
        from sdk.hedera.payment_escrow import PaymentEscrowService

        escrow = PaymentEscrowService(client)
        escrow.finalize_task(task)
        click.echo(f"Escrow task {task} finalized")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("open-dispute")
@click.option("--task", type=int, required=True, help="Task ID")
def open_dispute(task):
    """Open a dispute on a completed task (requester only)."""
    try:
        client = _get_client()
        from sdk.hedera.payment_escrow import PaymentEscrowService

        escrow = PaymentEscrowService(client)
        escrow.open_dispute(task)
        click.echo(f"Dispute opened for task {task}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


# ==========================================================================
# Earnings Commands
# ==========================================================================


@cli.command("withdraw-earnings")
@click.option(
    "--contract",
    type=click.Choice(["escrow", "registry"]),
    default="registry",
    help="Which contract to withdraw from",
)
def withdraw_earnings(contract):
    """Withdraw accumulated earnings."""
    try:
        client = _get_client()
        if contract == "registry":
            from sdk.hedera.subnet_registry import SubnetRegistryService

            svc = SubnetRegistryService(client)
        else:
            from sdk.hedera.payment_escrow import PaymentEscrowService

            svc = PaymentEscrowService(client)
        svc.withdraw_earnings()
        click.echo(f"Earnings withdrawn from {contract}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


# ==========================================================================
# Governance Commands
# ==========================================================================


@cli.command("propose")
@click.option("--description", required=True, help="Proposal description")
@click.option("--target", required=True, help="Target contract EVM address")
@click.option("--calldata", required=True, help="Hex-encoded call data")
def create_proposal(description, target, calldata):
    """Create a governance proposal."""
    try:
        client = _get_client()
        from sdk.hedera.governor import MDTGovernorService

        gov = MDTGovernorService(client)
        call_bytes = bytes.fromhex(calldata.replace("0x", ""))
        gov.propose(description, target, call_bytes)
        click.echo(f"Proposal created: {description}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("vote")
@click.option("--proposal", type=int, required=True, help="Proposal ID")
@click.option("--support/--against", default=True, help="Vote for or against")
def vote_proposal(proposal, support):
    """Vote on a governance proposal."""
    try:
        client = _get_client()
        from sdk.hedera.governor import MDTGovernorService

        gov = MDTGovernorService(client)
        gov.vote(proposal, support)
        click.echo(f"Voted {'FOR' if support else 'AGAINST'} proposal {proposal}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("finalize-vote")
@click.option("--proposal", type=int, required=True, help="Proposal ID")
def finalize_vote(proposal):
    """Finalize voting on a proposal."""
    try:
        client = _get_client()
        from sdk.hedera.governor import MDTGovernorService

        gov = MDTGovernorService(client)
        gov.finalize_voting(proposal)
        click.echo(f"Voting finalized for proposal {proposal}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("execute-proposal")
@click.option("--proposal", type=int, required=True, help="Proposal ID")
def execute_proposal(proposal):
    """Execute a passed governance proposal."""
    try:
        client = _get_client()
        from sdk.hedera.governor import MDTGovernorService

        gov = MDTGovernorService(client)
        gov.execute(proposal)
        click.echo(f"Proposal {proposal} executed")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


@cli.command("proposal-info")
@click.option("--proposal", type=int, required=True, help="Proposal ID")
def proposal_info(proposal):
    """Get proposal state and votes."""
    try:
        client = _get_client()
        from sdk.hedera.governor import MDTGovernorService, ProposalState

        gov = MDTGovernorService(client)
        state = gov.get_proposal_state(proposal)
        votes = gov.get_votes(proposal)
        click.echo(f"Proposal {proposal}: state={state}, votes={votes}")
        client.close()
    except Exception as e:
        click.echo(f"Error: {e}")


# ==========================================================================
# Faucet
# ==========================================================================


@cli.command("faucet")
@click.option("--amount", type=float, default=100.0, help="MDT amount to request")
def request_faucet(amount):
    """Request testnet MDT tokens."""
    import requests as req

    faucet_url = os.getenv("MDT_FAUCET_URL", "http://localhost:8888")
    account_id = os.getenv("HEDERA_ACCOUNT_ID")
    if not account_id:
        click.echo("HEDERA_ACCOUNT_ID not set")
        sys.exit(1)

    click.echo(f"Requesting {amount} MDT from faucet...")
    try:
        resp = req.post(
            f"{faucet_url}/drip",
            json={"account_id": account_id, "amount": amount},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            click.echo(f"Received {data.get('amount', amount)} MDT")
        else:
            click.echo(f"Faucet error: {resp.text}")
    except req.ConnectionError:
        click.echo(f"Cannot connect to faucet at {faucet_url}")


if __name__ == "__main__":
    cli()
