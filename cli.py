"""
ModernTensor CLI — Command-line interface for the marketplace protocol.

Usage:
    python cli.py demo                    # Run full end-to-end demo
    python cli.py demo --miners 5         # Demo with 5 miners
    python cli.py protocol stats          # Show protocol stats
    python cli.py miner register 0.0.101  # Register a miner
    python cli.py miner register 0.0.101 --on-chain  # Register + HCS
    python cli.py miner list              # List all miners
    python cli.py miner leaderboard       # Show leaderboard
    python cli.py miner sync              # Sync miners from HCS on-chain
    python cli.py task submit             # Submit a code review task
    python cli.py task list               # List all tasks
    python cli.py subnet list             # List subnets
    python cli.py subnet create           # Create a new subnet
    python cli.py scoring test            # Test scoring on sample code
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import textwrap
from typing import Optional

# ── ANSI colors ──────────────────────────────────────────────────────
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
MAGENTA = "\033[95m"
BLUE = "\033[94m"
RESET = "\033[0m"
CHECK = f"{GREEN}✓{RESET}"
CROSS = f"{RED}✗{RESET}"
ARROW = f"{CYAN}→{RESET}"


def banner():
    print(f"""
{CYAN}{BOLD}  ╔══════════════════════════════════════════════╗
  ║        ⚡ ModernTensor Protocol CLI          ║
  ║    AI Marketplace on Hedera • Apex 2026      ║
  ╚══════════════════════════════════════════════╝{RESET}
""")


# ══════════════════════════════════════════════════════════════════════
# Initialize Protocol (lazy singleton)
# ══════════════════════════════════════════════════════════════════════
_protocol = None


def get_protocol():
    """Lazy-initialize the MarketplaceProtocol singleton."""
    global _protocol
    if _protocol is None:
        from sdk.protocol.types import ProtocolConfig
        from sdk.marketplace import MarketplaceProtocol

        _protocol = MarketplaceProtocol(
            config=ProtocolConfig(
                protocol_fee_rate=0.01,
                min_stake_amount=100.0,
            ),
            validator_id="0.0.99999",
            enable_poi=True,
        )
    return _protocol


# ══════════════════════════════════════════════════════════════════════
# DEMO COMMAND
# ══════════════════════════════════════════════════════════════════════
def cmd_demo(args):
    """Run a full end-to-end marketplace demo."""
    banner()
    num_miners = args.miners
    reward = args.reward
    verbose = args.verbose

    protocol = get_protocol()

    # ── Step 1: Register miners ──
    print(f"{BOLD}▶ Step 1: Registering {num_miners} miners{RESET}")
    miners = []
    for i in range(num_miners):
        miner_id = f"0.0.{1001 + i}"
        stake = 500 - (i * 50)
        m = protocol.register_miner(
            miner_id, subnet_ids=[1], stake=stake,
            capabilities=["code_review", "security_audit"],
        )
        miners.append(m)
        print(f"  {CHECK} Miner {CYAN}{miner_id}{RESET} registered "
              f"({DIM}stake={stake} MDT{RESET})")
    print()

    # ── Step 2: Submit task ──
    print(f"{BOLD}▶ Step 2: Submitting code review task{RESET}")
    sample_code = textwrap.dedent("""\
        // SPDX-License-Identifier: MIT
        pragma solidity ^0.8.0;

        contract Vault {
            mapping(address => uint256) public balances;

            function deposit() external payable {
                balances[msg.sender] += msg.value;
            }

            function withdraw() external {
                uint256 amount = balances[msg.sender];
                // BUG: State update AFTER external call → reentrancy!
                (bool success, ) = msg.sender.call{value: amount}("");
                require(success, "Transfer failed");
                balances[msg.sender] = 0;
            }

            function getBalance() external view returns (uint256) {
                return address(this).balance;
            }
        }
    """)

    task = protocol.submit_task(
        subnet_id=1,
        task_type="code_review",
        payload={
            "code": sample_code,
            "language": "solidity",
            "expected_fields": ["analysis", "findings", "score", "summary"],
        },
        reward_amount=reward,
        requester_id="0.0.2001",
        max_miners=min(num_miners, 3),
    )
    print(f"  {CHECK} Task {CYAN}{task.task_id[:12]}...{RESET} submitted")
    print(f"    Reward:  {YELLOW}{reward} MDT{RESET}")
    print(f"    Subnet:  {DIM}#1 AI Code Review{RESET}")
    fee_bd = protocol.task_manager.get_fee_breakdown(task.task_id)
    if fee_bd:
        print(f"    Fee:     {DIM}{fee_bd.total_fee:.2f} MDT "
              f"(protocol {fee_bd.protocol_fee:.2f} + "
              f"subnet {fee_bd.subnet_fee:.2f}){RESET}")
    print()

    # ── Step 3: Match ──
    print(f"{BOLD}▶ Step 3: Matching task to miners{RESET}")
    assignments = protocol.match_task(task.task_id)
    for a in assignments:
        print(f"  {ARROW} Assigned to {CYAN}{a.miner_id}{RESET}")
    print()

    # ── Step 4: Submit results ──
    print(f"{BOLD}▶ Step 4: Miners submitting results{RESET}")
    for idx, a in enumerate(assignments):
        # Simulate slightly different results
        output = {
            "analysis": (
                "Found a critical reentrancy vulnerability in the withdraw "
                "function. The contract updates balances[msg.sender] = 0 "
                "AFTER the external call, allowing recursive re-entry."
            ),
            "findings": [
                {
                    "type": "security",
                    "severity": "critical",
                    "description": "Reentrancy vulnerability in withdraw()",
                    "line": 14,
                    "code": 'msg.sender.call{value: amount}("")',
                    "fix": "Apply checks-effects-interactions pattern",
                    "location": "withdraw()",
                },
                {
                    "type": "best_practices",
                    "severity": "medium",
                    "description": "Missing access control modifier",
                    "line": 12,
                    "variable": "withdraw",
                    "fix": "Consider adding onlyOwner or withdrawal limits",
                },
                {
                    "type": "security",
                    "severity": "low",
                    "description": "No event emissions for state changes",
                    "fix": "Add Deposit and Withdrawal events",
                },
            ],
            "vulnerabilities": [
                {
                    "name": "Reentrancy",
                    "severity": "critical",
                    "location": "withdraw()",
                    "remediation": "Move balances[msg.sender] = 0 before call",
                },
            ],
            "score": 0.85 - (idx * 0.02),
            "summary": (
                "Critical reentrancy vulnerability found. The Vault contract "
                "follows the dangerous anti-pattern of state updates after "
                "external calls."
            ),
            "recommendations": [
                "Implement checks-effects-interactions pattern",
                "Use ReentrancyGuard from OpenZeppelin",
                "Add event emissions for deposits and withdrawals",
            ],
            "security_analysis": (
                "The Vault contract contains a classic reentrancy attack vector. "
                "An attacker can deploy a contract that calls withdraw() "
                "recursively in its receive() function, draining all ETH."
            ),
            "gas_analysis": "No significant gas optimizations needed.",
            "gas_optimizations": [
                {
                    "suggestion": "Use unchecked block for balance math (Solidity ≥0.8.0)"
                }
            ],
        }

        exec_time = 8.5 + (idx * 2.3)
        protocol.submit_result(
            task_id=task.task_id,
            miner_id=a.miner_id,
            output=output,
            execution_time=exec_time,
        )
        print(f"  {CHECK} {CYAN}{a.miner_id}{RESET} submitted result "
              f"({DIM}{exec_time:.1f}s{RESET})")
    print()

    # ── Step 5: Validate + PoI ──
    print(f"{BOLD}▶ Step 5: Validating results + Proof of Intelligence{RESET}")
    validation = protocol.validate_and_pay(task.task_id)
    print(f"  {CHECK} Validation complete!")
    print(f"    Winner:     {GREEN}{BOLD}{validation.winner_miner_id}{RESET}")
    print(f"    Score:      {YELLOW}{validation.winner_score:.4f}{RESET}")
    print(f"    Valid:      {GREEN if validation.is_valid else RED}"
          f"{validation.is_valid}{RESET}")

    if verbose and validation.consensus_scores:
        print(f"\n  {DIM}Score breakdown:{RESET}")
        for dim, score in validation.consensus_scores.items():
            bar_len = int(score * 20)
            bar = f"{'█' * bar_len}{'░' * (20 - bar_len)}"
            print(f"    {dim:20s} {bar} {score:.2f}")
    print()

    # ── Step 6: Protocol stats ──
    print(f"{BOLD}▶ Step 6: Protocol Statistics{RESET}")
    _print_stats(protocol)

    # ── Step 7: Leaderboard ──
    print(f"{BOLD}▶ Step 7: Miner Leaderboard{RESET}")
    _print_leaderboard(protocol, subnet_id=1)

    print(f"\n{GREEN}{BOLD}═══ Demo complete! ═══{RESET}\n")


# ══════════════════════════════════════════════════════════════════════
# MINER COMMANDS
# ══════════════════════════════════════════════════════════════════════
def cmd_miner_register(args):
    """Register a miner."""
    banner()
    protocol = get_protocol()

    subnets = [int(s) for s in args.subnets.split(",")]
    caps = args.capabilities.split(",") if args.capabilities else []

    miner = protocol.register_miner(
        miner_id=args.miner_id,
        subnet_ids=subnets,
        stake=args.stake,
        capabilities=caps,
        publish_to_hcs=args.on_chain,
    )
    on_chain_label = f" {GREEN}+ on-chain (HCS){RESET}" if args.on_chain else ""
    print(f"{CHECK} Miner {CYAN}{miner.miner_id}{RESET} registered!{on_chain_label}")
    print(f"  Stake:        {YELLOW}{miner.stake_amount} MDT{RESET}")
    print(f"  Subnets:      {subnets}")
    print(f"  Capabilities: {caps or 'none'}")
    print(f"  Status:       {GREEN}{miner.status.value}{RESET}")


def cmd_miner_list(args):
    """List all registered miners."""
    banner()
    protocol = get_protocol()
    miners = protocol.miner_registry.get_active_miners(
        subnet_id=args.subnet if args.subnet >= 0 else None
    )

    if not miners:
        print(f"  {DIM}No miners registered.{RESET}")
        print(f"  Run: {CYAN}python cli.py miner register 0.0.1001{RESET}")
        return

    print(f"  {BOLD}Active Miners ({len(miners)}){RESET}\n")
    print(f"  {'ID':<14} {'Stake':>8} {'Reputation':>12} {'Tasks':>7} {'Status'}")
    print(f"  {'─' * 14} {'─' * 8} {'─' * 12} {'─' * 7} {'─' * 8}")
    for m in miners:
        print(f"  {CYAN}{m.miner_id:<14}{RESET} "
              f"{YELLOW}{m.stake_amount:>7.0f}{RESET}  "
              f"{m.reputation.score:>11.4f}  "
              f"{m.reputation.total_tasks:>6}  "
              f"{GREEN}{m.status.value}{RESET}")


def cmd_miner_leaderboard(args):
    """Show miner leaderboard."""
    banner()
    protocol = get_protocol()
    subnet = args.subnet if args.subnet >= 0 else None
    _print_leaderboard(protocol, subnet_id=subnet, top_n=args.top)


def cmd_miner_sync(args):
    """Sync miners from HCS on-chain registrations."""
    banner()
    protocol = get_protocol()

    print(f"  {BOLD}Syncing miners from HCS...{RESET}\n")

    if protocol._hcs_sync is None:
        print(f"  {CROSS} HCS sync not available.")
        print(f"  {DIM}To enable, configure Hedera credentials in .env")
        print(f"  and pass hcs_service to MarketplaceProtocol.{RESET}")
        return

    new_miners = protocol.sync_miners_from_chain()

    if not new_miners:
        print(f"  {DIM}No new miners found on-chain.{RESET}")
        print(f"  Total local miners: {protocol.miner_registry.total_miners}")
        return

    print(f"  {CHECK} Synced {GREEN}{len(new_miners)}{RESET} new miners:\n")
    print(f"  {'ID':<14} {'Stake':>8} {'Subnets':<12} {'Source'}")
    print(f"  {'─' * 14} {'─' * 8} {'─' * 12} {'─' * 6}")
    for m in new_miners:
        print(f"  {CYAN}{m.miner_id:<14}{RESET} "
              f"{YELLOW}{m.stake_amount:>7.0f}{RESET}  "
              f"{str(m.subnet_ids):<12} "
              f"{DIM}HCS{RESET}")

    print(f"\n  Total local miners: {protocol.miner_registry.total_miners}")


def cmd_miner_tasks(args):
    """Show active assignments for a specific miner."""
    banner()
    protocol = get_protocol()
    miner_id = args.miner_id

    miner = protocol.get_miner(miner_id)
    if miner is None:
        print(f"  {CROSS} Miner {CYAN}{miner_id}{RESET} not found.")
        return

    pending = protocol.get_miner_tasks(miner_id)
    history = protocol.task_manager.get_miner_history(miner_id)

    print(f"  {BOLD}Miner {CYAN}{miner_id}{RESET}")
    print(f"  Status: {GREEN}{miner.status.value}{RESET}")
    print(f"  Reputation: {YELLOW}{miner.reputation.score:.4f}{RESET}")
    print()

    if pending:
        print(f"  {BOLD}Active Assignments ({len(pending)}):{RESET}")
        print(f"  {'Task ID':<12} {'Subnet':>6} {'Deadline'}")
        print(f"  {'─' * 12} {'─' * 6} {'─' * 10}")
        import time as _t
        for a in pending:
            remaining = max(0, a.deadline - _t.time())
            print(f"  {CYAN}{a.task_id[:10]:<12}{RESET} "
                  f"{a.subnet_id:>6}  "
                  f"{DIM}{remaining:.0f}s left{RESET}")
    else:
        print(f"  {DIM}No active assignments.{RESET}")

    if history:
        print(f"\n  {BOLD}Recent History ({len(history)} tasks):{RESET}")
        print(f"  {'Task':<12} {'Score':>8} {'Won?':>5} {'Earned':>8}")
        print(f"  {'─' * 12} {'─' * 8} {'─' * 5} {'─' * 8}")
        for h in history[:10]:
            won = f"{GREEN}✓{RESET}" if h.get("is_winner") else f"{DIM}—{RESET}"
            score = h.get("score") or 0
            earned = h.get("earnings", 0)
            print(f"  {CYAN}{h['task_id'][:10]:<12}{RESET} "
                  f"{score:>7.4f}  {won:>5}  "
                  f"{YELLOW}{earned:>7.2f}{RESET}")


def cmd_miner_earnings(args):
    """Show miner earnings summary."""
    banner()
    protocol = get_protocol()
    miner_id = args.miner_id

    miner = protocol.get_miner(miner_id)
    if miner is None:
        print(f"  {CROSS} Miner {CYAN}{miner_id}{RESET} not found.")
        return

    earnings = protocol.get_miner_earnings(miner_id)
    print(f"  {BOLD}Earnings Report — {CYAN}{miner_id}{RESET}")
    print()
    print(f"  Total Earned:    {YELLOW}{earnings['total_earned']:.4f} MDT{RESET}")
    print(f"  Tasks Completed: {earnings['tasks_completed']}")
    print(f"  Tasks Won:       {GREEN}{earnings['tasks_won']}{RESET}")
    print(f"  Win Rate:        {earnings['win_rate']:.1%}")


def cmd_miner_run(args):
    """Start miner worker (poll → process → submit loop)."""
    banner()
    protocol = get_protocol()
    miner_id = args.miner_id

    miner = protocol.get_miner(miner_id)
    if miner is None:
        print(f"  {CROSS} Miner {CYAN}{miner_id}{RESET} not found. Register first.")
        return

    from sdk.protocol.miner_worker import MinerWorker

    # Default handler: uses the code review scorer from the demo
    def default_handler(payload, task_type):
        from sdk.scoring.code_review import CodeReviewAgent
        agent = CodeReviewAgent()
        code = payload.get("code", "")
        language = payload.get("language", "solidity")
        result = agent.analyze(code, language)
        return result

    worker = MinerWorker(
        protocol=protocol,
        miner_id=miner_id,
        handler=default_handler,
    )

    interval = args.interval
    print(f"  {CHECK} Starting worker for miner {CYAN}{miner_id}{RESET}")
    print(f"  Poll interval: {interval}s")
    print(f"  Subnets: {miner.subnet_ids}")
    print(f"  Capabilities: {miner.capabilities or 'all'}")
    print(f"  {DIM}Press Ctrl+C to stop{RESET}\n")

    try:
        worker.start(
            poll_interval=interval,
            max_iterations=args.max_iter if args.max_iter > 0 else 0,
        )
    except KeyboardInterrupt:
        pass

    stats = worker.get_stats()
    print(f"\n  {BOLD}Worker stopped{RESET}")
    print(f"  Tasks processed: {stats['tasks_processed']}")
    print(f"  Errors:          {stats['errors']}")
    print(f"  Total earnings:  {YELLOW}{stats['total_earnings']:.4f} MDT{RESET}")


# ══════════════════════════════════════════════════════════════════════
# TASK COMMANDS
# ══════════════════════════════════════════════════════════════════════
def cmd_task_submit(args):
    """Submit a code review task."""
    banner()
    protocol = get_protocol()

    code = args.code
    if args.file:
        with open(args.file, "r") as f:
            code = f.read()

    if not code:
        code = textwrap.dedent("""\
            pragma solidity ^0.8.0;
            contract Example {
                uint256 public value;
                function set(uint256 _val) external { value = _val; }
            }
        """)
        print(f"  {DIM}No code provided, using example contract{RESET}\n")

    task = protocol.submit_task(
        subnet_id=args.subnet,
        task_type="code_review",
        payload={
            "code": code,
            "language": args.language,
            "expected_fields": ["analysis", "findings", "score", "summary"],
        },
        reward_amount=args.reward,
        requester_id=args.requester,
    )

    print(f"{CHECK} Task submitted!")
    print(f"  ID:       {CYAN}{task.task_id}{RESET}")
    print(f"  Subnet:   #{task.subnet_id}")
    print(f"  Reward:   {YELLOW}{args.reward} MDT{RESET}")
    fee_bd = protocol.task_manager.get_fee_breakdown(task.task_id)
    if fee_bd:
        print(f"  Fee:      {fee_bd.total_fee:.2f} MDT")
    print(f"  Status:   {task.status.value}")


def cmd_task_list(args):
    """List all tasks."""
    banner()
    protocol = get_protocol()
    tasks = protocol.task_manager.get_all_tasks()

    if not tasks:
        print(f"  {DIM}No tasks submitted yet.{RESET}")
        print(f"  Run: {CYAN}python cli.py demo{RESET}")
        return

    status_filter = args.status
    if status_filter:
        tasks = [t for t in tasks if t.status.value == status_filter]

    print(f"  {BOLD}Tasks ({len(tasks)}){RESET}\n")
    print(f"  {'ID':<14} {'Subnet':>7} {'Reward':>8} {'Status':<12} {'Winner'}")
    print(f"  {'─' * 14} {'─' * 7} {'─' * 8} {'─' * 12} {'─' * 14}")
    for t in tasks:
        tid = t.task_id[:12] + ".."
        winner = getattr(t, "winner_miner_id", "-") or "-"
        status_color = GREEN if t.status.value == "completed" else YELLOW
        print(f"  {CYAN}{tid:<14}{RESET} "
              f"#{t.subnet_id:>6}  "
              f"{YELLOW}{t.reward_amount:>7.1f}{RESET}  "
              f"{status_color}{t.status.value:<12}{RESET} "
              f"{winner}")


def cmd_task_status(args):
    """Show detailed status for a task (requester view)."""
    banner()
    protocol = get_protocol()
    task_id = args.task_id

    # Try partial match
    all_tasks = protocol.task_manager.get_all_tasks()
    matched = [t for t in all_tasks if t.task_id.startswith(task_id)]
    if not matched:
        print(f"  {CROSS} Task not found: {task_id}")
        return
    full_id = matched[0].task_id

    detail = protocol.get_task_detail(full_id)
    if not detail:
        print(f"  {CROSS} Task not found: {task_id}")
        return

    status = detail['status']
    status_color = GREEN if status == 'completed' else (RED if status == 'failed' else YELLOW)

    print(f"  {BOLD}Task Detail{RESET}")
    print(f"  ID:        {CYAN}{detail['task_id'][:16]}...{RESET}")
    print(f"  Type:      {detail['task_type']}")
    print(f"  Subnet:    #{detail['subnet_id']}")
    print(f"  Status:    {status_color}{status}{RESET}")
    print(f"  Requester: {detail['requester_id']}")
    print(f"  Reward:    {YELLOW}{detail['reward_amount']:.1f} MDT{RESET}")
    print(f"  Priority:  {detail['priority']}")
    print(f"  Miners:    {detail['max_miners']}")

    if detail.get('fee_breakdown'):
        fb = detail['fee_breakdown']
        print(f"\n  {BOLD}Fee Breakdown:{RESET}")
        print(f"  Miner reward:  {YELLOW}{fb.get('reward_amount', 0):.2f}{RESET}")
        print(f"  Protocol fee:  {fb.get('protocol_fee', 0):.2f}")
        print(f"  Subnet fee:    {fb.get('subnet_fee', 0):.2f}")

    if detail['assignments']:
        print(f"\n  {BOLD}Assignments ({len(detail['assignments'])}):{RESET}")
        print(f"  {'Miner':<14} {'Done?':>6} {'Timeout?':>9} {'Score':>8}")
        print(f"  {'─' * 14} {'─' * 6} {'─' * 9} {'─' * 8}")
        for a in detail['assignments']:
            done = f"{GREEN}✓{RESET}" if a['is_completed'] else f"{DIM}—{RESET}"
            tout = f"{RED}✓{RESET}" if a['is_timeout'] else f"{DIM}—{RESET}"
            score = f"{a['score']:.4f}" if a['score'] else "—"
            print(f"  {CYAN}{a['miner_id']:<14}{RESET} "
                  f"{done:>6}  {tout:>9}  {score:>8}")

    if detail.get('validation'):
        v = detail['validation']
        icon = CHECK if v['is_valid'] else CROSS
        print(f"\n  {BOLD}Validation:{RESET}")
        print(f"  Valid:   {icon} {v['is_valid']}")
        print(f"  Winner:  {CYAN}{v['winner_miner_id']}{RESET}")
        print(f"  Score:   {YELLOW}{v['winner_score']:.4f}{RESET}")

    if detail.get('payment'):
        p = detail['payment']
        print(f"\n  {BOLD}Payment:{RESET}")
        print(f"  Miner:   {CYAN}{p['miner_id']}{RESET}")
        print(f"  Amount:  {YELLOW}{p['amount']:.4f} MDT{RESET}")
        print(f"  Paid:    {CHECK if p['is_paid'] else CROSS} {p['is_paid']}")


def cmd_task_results(args):
    """Show AI results from miners for a task."""
    banner()
    protocol = get_protocol()
    task_id = args.task_id

    # Try partial match
    all_tasks = protocol.task_manager.get_all_tasks()
    matched = [t for t in all_tasks if t.task_id.startswith(task_id)]
    if not matched:
        print(f"  {CROSS} Task not found: {task_id}")
        return
    full_id = matched[0].task_id

    detail = protocol.get_task_detail(full_id)
    if not detail or not detail['results']:
        print(f"  {DIM}No results submitted yet for task {task_id[:12]}{RESET}")
        return

    print(f"  {BOLD}Results for task {CYAN}{full_id[:12]}...{RESET}")
    print()

    for i, r in enumerate(detail['results'], 1):
        is_winner = (
            detail.get('validation', {}) or {}
        ).get('winner_miner_id') == r['miner_id']
        winner_badge = f" {GREEN}★ WINNER{RESET}" if is_winner else ""

        print(f"  {BOLD}Result #{i} — {CYAN}{r['miner_id']}{RESET}{winner_badge}")
        if r.get('execution_time'):
            print(f"  Time: {r['execution_time']:.2f}s")

        output = r.get('output', {})
        if isinstance(output, dict):
            import json
            formatted = json.dumps(output, indent=4, ensure_ascii=False)
            for line in formatted.split('\n'):
                print(f"    {DIM}{line}{RESET}")
        else:
            print(f"    {DIM}{output}{RESET}")
        print()


# ══════════════════════════════════════════════════════════════════════
# SUBNET COMMANDS
# ══════════════════════════════════════════════════════════════════════
def cmd_subnet_list(args):
    """List all subnets."""
    banner()
    from sdk.marketplace import SubnetManager
    manager = SubnetManager()

    subnets = manager.list_subnets(active_only=not args.all)

    print(f"  {BOLD}Subnets ({len(subnets)}){RESET}\n")
    print(f"  {'ID':>4} {'Name':<20} {'Type':<16} {'Fee':>6} {'Miners':>8} {'Tasks':>7}")
    print(f"  {'─' * 4} {'─' * 20} {'─' * 16} {'─' * 6} {'─' * 8} {'─' * 7}")
    for s in subnets:
        print(f"  {CYAN}{s.subnet_id:>4}{RESET} "
              f"{s.name:<20} "
              f"{s.task_type:<16} "
              f"{YELLOW}{s.fee_rate * 100:>5.1f}%{RESET} "
              f"{s.active_miners:>8} "
              f"{s.total_tasks:>7}")


def cmd_subnet_create(args):
    """Create a new subnet."""
    banner()
    from sdk.marketplace import SubnetManager
    manager = SubnetManager()

    subnet = manager.create_subnet(
        name=args.name,
        owner_id=args.owner,
        task_type=args.type,
        fee_rate=args.fee / 100.0,
    )
    print(f"{CHECK} Subnet created!")
    print(f"  ID:       {CYAN}#{subnet.subnet_id}{RESET}")
    print(f"  Name:     {subnet.name}")
    print(f"  Type:     {subnet.task_type}")
    print(f"  Fee:      {YELLOW}{subnet.fee_rate * 100:.1f}%{RESET}")
    print(f"  Owner:    {subnet.owner_id}")


def cmd_subnet_info(args):
    """Show detailed info about a subnet."""
    banner()
    from sdk.marketplace import SubnetManager
    manager = SubnetManager()

    subnet = manager.get_subnet(args.subnet_id)
    if subnet is None:
        print(f"  {CROSS} Subnet #{args.subnet_id} not found.")
        return

    active_label = f"{GREEN}active{RESET}" if subnet.is_active else f"{RED}inactive{RESET}"
    print(f"  {BOLD}Subnet #{subnet.subnet_id} — {subnet.name}{RESET}")
    print(f"  Status:     {active_label}")
    print(f"  Owner:      {CYAN}{subnet.owner_id}{RESET}")
    print(f"  Task Type:  {subnet.task_type}")
    print(f"  Fee Rate:   {YELLOW}{subnet.fee_rate * 100:.1f}%{RESET}")
    print(f"  Min Stake:  {subnet.min_stake:.0f} MDT")
    print(f"  Max Miners: {subnet.max_miners}")
    print()
    print(f"  {BOLD}Metrics:{RESET}")
    print(f"  Total Tasks:   {subnet.total_tasks}")
    print(f"  Total Volume:  {YELLOW}{subnet.total_volume:.2f} MDT{RESET}")
    print(f"  Active Miners: {subnet.active_miners}")
    print(f"  Avg Score:     {subnet.avg_score:.4f}")

    if subnet.scoring_dimensions:
        print(f"\n  {BOLD}Scoring Dimensions ({len(subnet.scoring_dimensions)}):{RESET}")
        for d in subnet.scoring_dimensions:
            print(f"    • {d.name:<20} weight={YELLOW}{d.weight:.2f}{RESET}")

    if subnet.metadata:
        print(f"\n  {BOLD}Metadata:{RESET}")
        for k, v in subnet.metadata.items():
            print(f"    {k}: {DIM}{v}{RESET}")


# ══════════════════════════════════════════════════════════════════════
# SCORING COMMAND
# ══════════════════════════════════════════════════════════════════════
def cmd_scoring_test(args):
    """Test the scoring engine on a sample."""
    banner()
    from sdk.scoring import MultiDimensionScorer, ProofOfIntelligence
    from sdk.scoring import ProofOfQuality, BenchmarkPool
    from sdk.scoring.dimensions import CODE_REVIEW_DIMENSIONS

    scorer = MultiDimensionScorer(CODE_REVIEW_DIMENSIONS)
    poi = ProofOfIntelligence()

    task_payload = {
        "code": "contract Foo { function bar() external { } }",
        "language": "solidity",
        "expected_fields": ["analysis", "findings", "score"],
    }

    result_output = {
        "analysis": "The contract is minimal with no security issues found. "
                    "The function bar() is empty and has no access control.",
        "findings": [
            {
                "type": "best_practices",
                "severity": "low",
                "description": "Empty function body",
                "line": 1,
            }
        ],
        "vulnerabilities": [],
        "score": 0.9,
        "summary": "Simple contract with no major issues.",
        "gas_analysis": "No gas optimizations needed.",
        "gas_optimizations": [],
        "recommendations": ["Add NatSpec documentation"],
        "security_analysis": "No security vulnerabilities detected.",
    }

    print(f"  {BOLD}Multi-Dimension Scoring Test{RESET}\n")
    scored = scorer.score(task_payload, result_output)

    print(f"  {'Dimension':<20} {'Weight':>8} {'Score':>8} {'Weighted':>10}")
    print(f"  {'─' * 20} {'─' * 8} {'─' * 8} {'─' * 10}")
    for dim, score in scored["dimensions"].items():
        weight = scored["weights"].get(dim, 0)
        weighted = score * weight
        bar_len = int(score * 15)
        bar = f"{'█' * bar_len}{'░' * (15 - bar_len)}"
        print(f"  {dim:<20} {weight:>7.2f}  {bar} {score:>.2f} {weighted:>9.4f}")

    print(f"\n  Final Score:  {YELLOW}{BOLD}{scored['final_score']:.4f}{RESET}")
    print(f"  Confidence:   {scored['confidence']:.4f}")

    # PoI test
    print(f"\n  {BOLD}Proof of Intelligence Test (Layer 1){RESET}\n")
    poi_result = poi.verify(
        miner_id="0.0.test",
        output=result_output,
        dimension_scores=scored["dimensions"],
        task_payload=task_payload,
    )
    print(f"  Verified:     {GREEN if poi_result.is_verified else RED}"
          f"{poi_result.is_verified}{RESET}")
    print(f"  PoI Score:    {YELLOW}{poi_result.poi_score:.4f}{RESET}")
    print(f"  Knowledge:    {poi_result.knowledge_score:.4f}")
    print(f"  Entropy:      {poi_result.entropy_score:.4f}")
    print(f"  Correlation:  {poi_result.correlation_score:.4f}")
    print(f"  Consistency:  {poi_result.consistency_score:.4f}")
    if poi_result.flags:
        print(f"  Flags:        {RED}{', '.join(poi_result.flags)}{RESET}")

    # PoQ test
    print(f"\n  {BOLD}Proof of Quality Test (Layer 2){RESET}\n")
    poq = ProofOfQuality(min_validators=1)
    poq.submit_score("val_1", "miner-test", quality=0.8, relevance=0.85, depth=0.7)
    poq.submit_score("val_2", "miner-test", quality=0.75, relevance=0.8, depth=0.65)
    poq.submit_score("val_3", "miner-test", quality=0.1, relevance=0.1, depth=0.1)
    poq_result = poq.aggregate("miner-test")
    print(f"  Consensus:    {YELLOW}{poq_result.consensus_score:.4f}{RESET}")
    print(f"  Quality:      {GREEN if poq_result.is_quality else RED}"
          f"{poq_result.is_quality}{RESET}")
    print(f"  Validators:   {len(poq_result.individual_scores)}")
    if poq_result.clipped_validators:
        print(f"  Clipped:      {RED}{', '.join(poq_result.clipped_validators)}{RESET}")
    for vid, trust in poq_result.validator_trust.items():
        color = GREEN if trust > 0.5 else RED
        print(f"  Trust {vid}:  {color}{trust:.4f}{RESET}")


def cmd_scoring_benchmark(args):
    """Run a benchmark challenge test (Layer 3 — Ground Truth)."""
    banner()
    from sdk.scoring import BenchmarkPool

    pool = BenchmarkPool()
    difficulty = getattr(args, "difficulty", "easy")

    challenge = pool.get_challenge(difficulty=difficulty)
    if not challenge:
        print(f"  {CROSS} No challenges found for difficulty: {difficulty}")
        return

    print(f"  {BOLD}Benchmark Challenge — Ground Truth Test (Layer 3){RESET}\n")
    print(f"  Challenge:   {CYAN}{challenge.challenge_id}{RESET}")
    print(f"  Difficulty:  {difficulty}")
    print(f"  Language:    {challenge.language}")
    print(f"  Known bugs:  {len(challenge.vulnerabilities)}")
    print()

    for v in challenge.vulnerabilities:
        sev_color = RED if v.severity in ("critical", "high") else YELLOW
        print(f"    {sev_color}[{v.severity.upper()}]{RESET} {v.name}")
        print(f"    {DIM}{v.location}{RESET}")
    print()

    # Simulate a GOOD miner who finds all bugs
    good_output = {
        "vulnerabilities": [
            {"name": v.name, "severity": v.severity}
            for v in challenge.vulnerabilities
        ]
    }
    good_result = pool.score_response(
        challenge.challenge_id, "miner-good", good_output, 2.5,
    )

    # Simulate a BAD miner who finds nothing
    bad_output = {"vulnerabilities": [], "analysis": "Code looks fine"}
    bad_result = pool.score_response(
        challenge.challenge_id, "miner-bad", bad_output, 0.5,
    )

    print(f"  {BOLD}Scoring Results:{RESET}\n")
    print(f"  {'Miner':<16} {'Detection':>10} {'FP Rate':>9} {'Score':>8}")
    print(f"  {'─' * 16} {'─' * 10} {'─' * 9} {'─' * 8}")

    for label, r in [("miner-good ★", good_result), ("miner-bad", bad_result)]:
        det_color = GREEN if r.detection_rate >= 0.8 else (YELLOW if r.detection_rate >= 0.5 else RED)
        print(f"  {CYAN}{label:<16}{RESET} "
              f"{det_color}{r.detection_rate:>9.0%}{RESET}  "
              f"{r.false_positive_rate:>8.0%}  "
              f"{YELLOW}{r.overall_score:>7.4f}{RESET}")

    print(f"\n  {DIM}Good miner found: {', '.join(good_result.found_bugs)}{RESET}")
    print(f"  {DIM}Bad miner missed: {', '.join(bad_result.missed_bugs)}{RESET}")

    stats = pool.get_stats()
    print(f"\n  {BOLD}Pool Stats:{RESET}")
    print(f"  Total challenges: {stats['total_challenges']}")
    print(f"  Tests completed:  {stats['total_results']}")
    print(f"  Avg detection:    {stats['avg_detection_rate']:.0%}")


# ══════════════════════════════════════════════════════════════════════
# PROTOCOL STATS
# ══════════════════════════════════════════════════════════════════════
def cmd_protocol_stats(args):
    """Show protocol statistics."""
    banner()
    protocol = get_protocol()
    _print_stats(protocol)


# ══════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════
def _print_stats(protocol):
    stats = protocol.get_protocol_stats()
    ts = stats.get("task_stats", {})
    ms = stats.get("miner_stats", {})
    fs = stats.get("fee_stats", {})

    print(f"  {'Tasks submitted:':<24} {CYAN}{ts.get('total_tasks', 0)}{RESET}")
    print(f"  {'Tasks completed:':<24} {GREEN}{ts.get('completed_tasks', 0)}{RESET}")
    print(f"  {'Total volume:':<24} {YELLOW}{ts.get('total_volume', 0):.2f} MDT{RESET}")
    print(f"  {'Active miners:':<24} {CYAN}{ms.get('active_miners', 0)}{RESET}")
    print(f"  {'Suspended miners:':<24} {RED}{ms.get('suspended_miners', 0)}{RESET}")
    print(f"  {'Protocol revenue:':<24} {GREEN}{fs.get('total_protocol_fees', 0):.4f} MDT{RESET}")
    print(f"  {'Epoch:':<24} {stats.get('epoch', 0)}")

    poi_stats = stats.get("poi_stats")
    if poi_stats:
        print(f"  {'PoI verifications:':<24} {poi_stats.get('total_verifications', 0)}")
        print(f"  {'PoI pass rate:':<24} {poi_stats.get('pass_rate', 0):.1%}")

    poq_stats = stats.get("poq_stats")
    if poq_stats:
        print(f"  {'PoQ rounds:':<24} {poq_stats.get('total_rounds', 0)}")
        print(f"  {'PoQ avg trust:':<24} {poq_stats.get('avg_trust', 0):.4f}")

    bench_stats = stats.get("benchmark_stats")
    if bench_stats:
        print(f"  {'Benchmark challenges:':<24} {bench_stats.get('total_challenges', 0)}")
        print(f"  {'Benchmark tests run:':<24} {bench_stats.get('total_results', 0)}")
        print(f"  {'Avg detection rate:':<24} {bench_stats.get('avg_detection_rate', 0):.1%}")
    print()


def _print_leaderboard(protocol, subnet_id=None, top_n=10):
    leaderboard = protocol.get_leaderboard(subnet_id=subnet_id, top_n=top_n)

    if not leaderboard:
        print(f"  {DIM}No miners to rank. Register some miners first.{RESET}\n")
        return

    header = "Subnet #" + str(subnet_id) if subnet_id is not None else "All Subnets"
    print(f"  {BOLD}Leaderboard — {header}{RESET}\n")
    print(f"  {'Rank':<6} {'Miner':<14} {'Weight':>8} {'Reputation':>12} {'Tasks':>7}")
    print(f"  {'─' * 6} {'─' * 14} {'─' * 8} {'─' * 12} {'─' * 7}")
    for i, m in enumerate(leaderboard[:top_n], 1):
        medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else f" {i}"
        print(f"  {medal:<6} {CYAN}{m.miner_id:<14}{RESET} "
              f"{YELLOW}{m.effective_weight:>7.4f}{RESET}  "
              f"{m.reputation.score:>11.4f}  "
              f"{m.reputation.total_tasks:>6}")
    print()


# ══════════════════════════════════════════════════════════════════════
# Argument Parser
# ══════════════════════════════════════════════════════════════════════
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="moderntensor",
        description="⚡ ModernTensor — AI Marketplace Protocol on Hedera",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              python cli.py demo                     Full end-to-end demo
              python cli.py demo --miners 5          Demo with 5 miners
              python cli.py miner register 0.0.101   Register a miner
              python cli.py miner leaderboard        Show leaderboard
              python cli.py task submit --file code.sol
              python cli.py scoring test              Test scoring engine
              python cli.py subnet list               List all subnets
        """),
    )

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # ── demo ──
    demo = sub.add_parser("demo", help="Run full end-to-end demo")
    demo.add_argument("--miners", type=int, default=3, help="Number of miners (default: 3)")
    demo.add_argument("--reward", type=float, default=50.0, help="Task reward in MDT (default: 50)")
    demo.add_argument("-v", "--verbose", action="store_true", help="Show detailed score breakdown")
    demo.set_defaults(func=cmd_demo)

    # ── miner ──
    miner = sub.add_parser("miner", help="Miner management")
    miner_sub = miner.add_subparsers(dest="miner_cmd")

    m_reg = miner_sub.add_parser("register", help="Register a miner")
    m_reg.add_argument("miner_id", help="Miner account ID (e.g. 0.0.1001)")
    m_reg.add_argument("--subnets", default="1", help="Comma-separated subnet IDs (default: 1)")
    m_reg.add_argument("--stake", type=float, default=500.0, help="Stake amount (default: 500)")
    m_reg.add_argument("--capabilities", default="code_review", help="Capabilities (comma-separated)")
    m_reg.add_argument("--on-chain", action="store_true", help="Also publish to HCS on-chain")
    m_reg.set_defaults(func=cmd_miner_register)

    m_list = miner_sub.add_parser("list", help="List all miners")
    m_list.add_argument("--subnet", type=int, default=-1, help="Filter by subnet")
    m_list.set_defaults(func=cmd_miner_list)

    m_lb = miner_sub.add_parser("leaderboard", help="Show miner leaderboard")
    m_lb.add_argument("--subnet", type=int, default=-1, help="Filter by subnet")
    m_lb.add_argument("--top", type=int, default=10, help="Top N (default: 10)")
    m_lb.set_defaults(func=cmd_miner_leaderboard)

    m_sync = miner_sub.add_parser("sync", help="Sync miners from HCS on-chain")
    m_sync.set_defaults(func=cmd_miner_sync)

    m_tasks = miner_sub.add_parser("tasks", help="Show active tasks for a miner")
    m_tasks.add_argument("miner_id", help="Miner account ID")
    m_tasks.set_defaults(func=cmd_miner_tasks)

    m_earn = miner_sub.add_parser("earnings", help="Show miner earnings")
    m_earn.add_argument("miner_id", help="Miner account ID")
    m_earn.set_defaults(func=cmd_miner_earnings)

    m_run = miner_sub.add_parser("run", help="Start miner worker loop")
    m_run.add_argument("miner_id", help="Miner account ID")
    m_run.add_argument("--interval", type=float, default=5.0, help="Poll interval in seconds (default: 5)")
    m_run.add_argument("--max-iter", type=int, default=0, help="Max iterations (0=unlimited)")
    m_run.set_defaults(func=cmd_miner_run)

    # ── task ──
    task = sub.add_parser("task", help="Task management")
    task_sub = task.add_subparsers(dest="task_cmd")

    t_submit = task_sub.add_parser("submit", help="Submit a code review task")
    t_submit.add_argument("--code", default="", help="Inline code to review")
    t_submit.add_argument("--file", default="", help="File path to review")
    t_submit.add_argument("--language", default="solidity", help="Language (default: solidity)")
    t_submit.add_argument("--reward", type=float, default=50.0, help="Reward in MDT")
    t_submit.add_argument("--subnet", type=int, default=1, help="Subnet ID (default: 1)")
    t_submit.add_argument("--requester", default="0.0.2001", help="Requester ID")
    t_submit.set_defaults(func=cmd_task_submit)

    t_list = task_sub.add_parser("list", help="List all tasks")
    t_list.add_argument("--status", default="", help="Filter by status")
    t_list.set_defaults(func=cmd_task_list)

    t_status = task_sub.add_parser("status", help="Show task detail")
    t_status.add_argument("task_id", help="Task ID (full or prefix)")
    t_status.set_defaults(func=cmd_task_status)

    t_results = task_sub.add_parser("results", help="Show AI results for a task")
    t_results.add_argument("task_id", help="Task ID (full or prefix)")
    t_results.set_defaults(func=cmd_task_results)

    # ── subnet ──
    subnet = sub.add_parser("subnet", help="Subnet management")
    subnet_sub = subnet.add_subparsers(dest="subnet_cmd")

    s_list = subnet_sub.add_parser("list", help="List all subnets")
    s_list.add_argument("--all", action="store_true", help="Include inactive subnets")
    s_list.set_defaults(func=cmd_subnet_list)

    s_create = subnet_sub.add_parser("create", help="Create a new subnet")
    s_create.add_argument("--name", required=True, help="Subnet name")
    s_create.add_argument("--type", required=True, help="Task type (e.g. text_generation)")
    s_create.add_argument("--owner", default="0.0.5555", help="Owner account ID")
    s_create.add_argument("--fee", type=float, default=5.0, help="Fee rate in percent (default: 5)")
    s_create.set_defaults(func=cmd_subnet_create)

    s_info = subnet_sub.add_parser("info", help="Show subnet detail")
    s_info.add_argument("subnet_id", type=int, help="Subnet ID")
    s_info.set_defaults(func=cmd_subnet_info)

    # ── scoring ──
    scoring = sub.add_parser("scoring", help="Scoring engine tools")
    scoring_sub = scoring.add_subparsers(dest="scoring_cmd")

    s_test = scoring_sub.add_parser("test", help="Test scoring on sample code")
    s_test.set_defaults(func=cmd_scoring_test)

    s_bench = scoring_sub.add_parser("benchmark", help="Run benchmark challenge test")
    s_bench.add_argument("--difficulty", default="easy",
                         choices=["easy", "medium", "hard"],
                         help="Challenge difficulty (default: easy)")
    s_bench.set_defaults(func=cmd_scoring_benchmark)

    # ── protocol ──
    proto = sub.add_parser("protocol", help="Protocol operations")
    proto_sub = proto.add_subparsers(dest="proto_cmd")

    p_stats = proto_sub.add_parser("stats", help="Show protocol statistics")
    p_stats.set_defaults(func=cmd_protocol_stats)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.parse_args([args.command, "--help"])


if __name__ == "__main__":
    main()
