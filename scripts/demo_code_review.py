#!/usr/bin/env python3
"""
ModernTensor Demo — AI Code Review Subnet

Demonstrates the full Subnet Protocol + AI Code Review flow:
1. Connect to Hedera testnet
2. Register "AI Code Review" subnet via HCS
3. Register code review miners
4. Submit Solidity code for review
5. AI validator scores the review
6. Submit score to HCS
7. Query results from mirror node

Usage:
    python scripts/demo_code_review.py
"""

import os
import sys
import time
from pathlib import Path

# Add project root to sys.path for clean imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

load_dotenv()

# Imports from SDK packages
from sdk.hedera.config import load_hedera_config
from sdk.hedera.client import HederaClient
from sdk.hedera.hcs import HCSService, MinerRegistration, TaskSubmission, ScoreSubmission
from sdk.hedera.hts import HTSService
from sdk.hedera.code_review import CodeReviewAgent


# Sample Solidity code to review (intentional vulnerabilities for demo)
SAMPLE_SOLIDITY_CODE = '''
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleVault {
    mapping(address => uint256) public balances;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    // Deposit ETH
    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // Withdraw ETH — potential reentrancy vulnerability
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // WARNING: State update AFTER external call (reentrancy risk)
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] -= amount;
    }

    // Admin function using tx.origin (phishing risk)
    function emergencyWithdraw() external {
        require(tx.origin == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }

    // No event emission for important state changes
    function setOwner(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        owner = newOwner;
    }
}
'''

# A well-written Solidity code for comparison
SAMPLE_GOOD_CODE = '''
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SecureVault
 * @dev A secure vault contract with proper guards
 * @notice Demonstrates best practices for Solidity development
 */
contract SecureVault is ReentrancyGuard, Ownable {
    mapping(address => uint256) public balances;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Deposit ETH into the vault
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit > 0");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw ETH from the vault
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // State update BEFORE external call (CEI pattern)
        balances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }
}
'''


def main():
    print("=" * 70)
    print("⚡ ModernTensor Demo — AI Code Review Subnet")
    print("   The AI Subnet Protocol on Hedera")
    print("=" * 70)

    # Check configuration
    required_vars = [
        "HEDERA_ACCOUNT_ID",
        "HEDERA_PRIVATE_KEY",
        "HEDERA_REGISTRATION_TOPIC_ID",
        "HEDERA_SCORING_TOPIC_ID",
    ]

    missing = [v for v in required_vars if not os.getenv(v) or os.getenv(v, "").startswith("0.0.XXX")]
    if missing:
        print(f"\n❌ Missing configuration: {missing}")
        print("   Run: python scripts/setup_hedera.py")
        return 1

    # =========================================================================
    # Connect to Hedera
    # =========================================================================
    print("\n📡 Connecting to Hedera Testnet...")
    config = load_hedera_config()
    client = HederaClient(config)
    hcs = HCSService(client)
    hts = HTSService(client)

    balance = client.get_balance()
    print(f"✅ Connected as {client.operator_id_str}")
    print(f"   Balance: {balance.hbars}")
    print(f"   Network: Hedera Testnet")

    # =========================================================================
    # Step 1: Register AI Code Review Subnet
    # =========================================================================
    print("\n" + "=" * 50)
    print("🌐 Step 1: Register AI Code Review Subnet")
    print("=" * 50)

    subnet_registration = MinerRegistration(
        miner_id="subnet-code-review",
        account_id=client.operator_id_str,
        capabilities=["solidity_audit", "python_review", "security_analysis", "gas_optimization"],
        stake_amount=10000_00000000,  # 10,000 MDT (subnet registration cost)
    )

    receipt = hcs.register_miner(subnet_registration)
    print(f"✅ AI Code Review Subnet registered on HCS")
    print(f"   Subnet Name: AI Code Review")
    print(f"   Subnet Fee: 3% (300 basis points)")
    print(f"   Capabilities: Solidity Audit, Python Review, Security Analysis")
    print(f"   HCS Topic: {hcs.registration_topic_id}")

    # =========================================================================
    # Step 2: Register Code Review Miners
    # =========================================================================
    print("\n" + "=" * 50)
    print("⛏️  Step 2: Register Code Review Miners")
    print("=" * 50)

    miners = [
        MinerRegistration(
            miner_id="code-miner-001",
            account_id=client.operator_id_str,
            capabilities=["solidity_audit", "security_analysis"],
            stake_amount=100_00000000,
        ),
        MinerRegistration(
            miner_id="code-miner-002",
            account_id=client.operator_id_str,
            capabilities=["python_review", "best_practices"],
            stake_amount=100_00000000,
        ),
    ]

    for miner in miners:
        receipt = hcs.register_miner(miner)
        print(f"   ✅ Registered: {miner.miner_id} ({', '.join(miner.capabilities)})")

    # =========================================================================
    # Step 3: Submit Code for Review
    # =========================================================================
    print("\n" + "=" * 50)
    print("📝 Step 3: Submit Solidity Code for AI Review")
    print("=" * 50)

    task = TaskSubmission(
        task_id="code-review-001",
        requester_id=client.operator_id_str,
        task_type="code_review",
        prompt="Review this Solidity smart contract for security vulnerabilities, "
               "correctness, readability, best practices, and gas efficiency.",
        reward_amount=50_00000000,  # 50 MDT
        deadline=int(time.time()) + 3600,
    )

    receipt = hcs.create_task(task)
    print(f"✅ Code review task submitted")
    print(f"   Task ID: {task.task_id}")
    print(f"   Reward: 50 MDT")
    print(f"   Code: SimpleVault.sol ({len(SAMPLE_SOLIDITY_CODE.strip().splitlines())} lines)")
    print(f"   HCS Topic: {hcs.task_topic_id or hcs.registration_topic_id}")

    # =========================================================================
    # Step 4: AI Code Review Agent Analyzes Code
    # =========================================================================
    print("\n" + "=" * 50)
    print("🤖 Step 4: AI Code Review Agent Analyzes Code")
    print("=" * 50)

    code_reviewer = CodeReviewAgent(client, hcs)

    print("\n--- Reviewing VULNERABLE code (SimpleVault.sol) ---\n")

    # Try LLM first, fall back to heuristic
    try:
        result_bad = code_reviewer.review_code(
            code=SAMPLE_SOLIDITY_CODE,
            language="solidity",
            context="Smart contract vault for holding user deposits",
            use_llm=True,
        )
    except Exception:
        result_bad = code_reviewer.review_code(
            code=SAMPLE_SOLIDITY_CODE,
            language="solidity",
            context="Smart contract vault for holding user deposits",
            use_llm=False,
        )

    print(f"📊 Review Results (SimpleVault.sol):")
    print(f"   Overall Score: {result_bad.overall_score}/100")
    print(f"   ├── Security:       {result_bad.security}/100")
    print(f"   ├── Correctness:    {result_bad.correctness}/100")
    print(f"   ├── Readability:    {result_bad.readability}/100")
    print(f"   ├── Best Practices: {result_bad.best_practices}/100")
    print(f"   └── Gas Efficiency: {result_bad.gas_efficiency}/100")
    print(f"   Confidence: {result_bad.confidence}")
    print(f"   Provider: {result_bad.provider}")

    if result_bad.vulnerabilities:
        print(f"\n   🚨 Vulnerabilities Found ({len(result_bad.vulnerabilities)}):")
        for vuln in result_bad.vulnerabilities:
            severity = vuln.get("severity", "unknown").upper()
            desc = vuln.get("description", "")
            print(f"      [{severity}] {desc}")

    if result_bad.suggestions:
        print(f"\n   💡 Suggestions:")
        for suggestion in result_bad.suggestions:
            print(f"      • {suggestion}")

    # Also review the good code for comparison
    print("\n--- Reviewing SECURE code (SecureVault.sol) ---\n")

    try:
        result_good = code_reviewer.review_code(
            code=SAMPLE_GOOD_CODE,
            language="solidity",
            context="Secure vault contract with proper guards",
            use_llm=True,
        )
    except Exception:
        result_good = code_reviewer.review_code(
            code=SAMPLE_GOOD_CODE,
            language="solidity",
            context="Secure vault contract with proper guards",
            use_llm=False,
        )

    print(f"📊 Review Results (SecureVault.sol):")
    print(f"   Overall Score: {result_good.overall_score}/100")
    print(f"   ├── Security:       {result_good.security}/100")
    print(f"   ├── Correctness:    {result_good.correctness}/100")
    print(f"   ├── Readability:    {result_good.readability}/100")
    print(f"   ├── Best Practices: {result_good.best_practices}/100")
    print(f"   └── Gas Efficiency: {result_good.gas_efficiency}/100")

    if result_good.vulnerabilities:
        print(f"\n   🚨 Vulnerabilities: {len(result_good.vulnerabilities)}")
    else:
        print(f"\n   ✅ No vulnerabilities found!")

    # =========================================================================
    # Step 5: Submit Scores to HCS
    # =========================================================================
    print("\n" + "=" * 50)
    print("📤 Step 5: Submit Review Scores to HCS (On-Chain)")
    print("=" * 50)

    # Submit score for the bad code review
    score = ScoreSubmission(
        validator_id=client.operator_id_str,
        miner_id="code-miner-001",
        task_id=task.task_id,
        score=result_bad.overall_score,
        confidence=result_bad.confidence,
        metrics={
            "security": result_bad.security,
            "correctness": result_bad.correctness,
            "readability": result_bad.readability,
            "best_practices": result_bad.best_practices,
            "gas_efficiency": result_bad.gas_efficiency,
            "vulnerabilities_count": len(result_bad.vulnerabilities),
            "review_type": "solidity_audit",
        },
    )

    receipt = hcs.submit_score(score)
    print(f"✅ Score submitted to HCS")
    print(f"   Task: {task.task_id}")
    print(f"   Score: {result_bad.overall_score}/100")
    print(f"   Vulnerabilities logged: {len(result_bad.vulnerabilities)}")
    print(f"   HCS Topic: {hcs.scoring_topic_id}")

    # =========================================================================
    # Step 6: Query Results from Mirror Node
    # =========================================================================
    print("\n" + "=" * 50)
    print("🔍 Step 6: Query HCS (Audit Trail)")
    print("=" * 50)

    print("   Waiting for mirror node sync...")
    time.sleep(3)

    print("\n📋 Recent Registrations (code review subnet):")
    regs = hcs.get_registrations(limit=5)
    if regs:
        for r in regs[-3:]:
            caps = r.get("capabilities", [])
            print(f"   - {r.get('miner_id')}: {caps}")
    else:
        print("   (Mirror node syncing — data will appear shortly)")

    print("\n📊 Recent Review Scores:")
    scores = hcs.get_scores(limit=5)
    if scores:
        for s in scores[-3:]:
            metrics = s.get("metrics", {})
            print(f"   - Task {s.get('task_id')}: {s.get('score')}/100 "
                  f"(sec:{metrics.get('security', '?')} "
                  f"cor:{metrics.get('correctness', '?')} "
                  f"read:{metrics.get('readability', '?')})")
    else:
        print("   (Mirror node syncing — data will appear shortly)")

    # =========================================================================
    # Summary
    # =========================================================================
    print("\n" + "=" * 70)
    print("✅ Demo Complete — AI Code Review Subnet on ModernTensor Protocol")
    print("=" * 70)
    print("\n📋 What was demonstrated:")
    print("  1. ✅ AI Code Review Subnet registered on HCS")
    print("  2. ✅ 2 code review miners registered")
    print("  3. ✅ Solidity code submitted for review")
    print("  4. ✅ AI analyzed code — found {} vulnerabilities".format(
        len(result_bad.vulnerabilities)))
    print("  5. ✅ Scores submitted to HCS (immutable audit trail)")
    print("  6. ✅ Results queryable via mirror node")

    print("\n📊 Score Comparison:")
    print(f"  SimpleVault.sol (buggy):  {result_bad.overall_score}/100")
    print(f"  SecureVault.sol (secure): {result_good.overall_score}/100")

    print("\n🔗 Hedera Resources Used:")
    print(f"  Registration Topic: {hcs.registration_topic_id}")
    print(f"  Scoring Topic: {hcs.scoring_topic_id}")
    if hcs.task_topic_id:
        print(f"  Task Topic: {hcs.task_topic_id}")
    print(f"  MDT Token: {hts.mdt_token_id}")

    print("\n💡 Protocol Economics:")
    print(f"  Protocol Fee (5%): 2.50 MDT")
    print(f"  Subnet Fee (3%):   1.50 MDT")
    print(f"  Miner Reward:     48.00 MDT")
    print(f"  Total Deposit:    50.00 MDT")

    print("\n⚡ ModernTensor — The AI Subnet Protocol on Hedera")
    print("   Where quality wins. Where communities build. Where everyone earns.")

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
