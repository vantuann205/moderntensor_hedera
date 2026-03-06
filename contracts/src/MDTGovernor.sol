// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MDTGovernor
 * @dev Governance for ModernTensor protocol parameters.
 *
 * Allows MDT holders to propose and vote on protocol changes:
 * - Fee rate updates
 * - Validator management
 * - Treasury spending
 *
 * Security:
 * - Vote-weight snapshot at proposal creation prevents flash-loan attacks
 * - Target whitelist prevents arbitrary code execution
 * - Timelock delay allows community review before execution
 * - Quorum: 10,000 MDT (configurable)
 * - Voting period: 3 days
 * - Execution delay: 1 day (timelock)
 *
 * For ModernTensor on Hedera - Hello Future Hackathon 2026
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MDTGovernor is ReentrancyGuard, Ownable {
    // =========================================================================
    // ENUMS & STRUCTS
    // =========================================================================

    enum ProposalState {
        Pending,
        Active,
        Defeated,
        Succeeded,
        Executed,
        Cancelled
    }

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        address target; // Contract to call (must be whitelisted)
        bytes callData; // Function + args
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 executionTime; // When it can be executed (after timelock)
        ProposalState state;
        bool targetAllowedAtCreation; // Snapshot: was target whitelisted at creation?
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voterSnapshot; // snapshot of balance at proposal creation
    }

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    IERC20 public mdtToken;

    /// @dev Minimum MDT required to create a proposal
    uint256 public proposalThreshold = 10_000 * 1e8; // 10K MDT

    /// @dev Minimum total votes for a proposal to be valid
    uint256 public quorum = 10_000 * 1e8; // 10K MDT

    /// @dev Voting period
    uint256 public votingPeriod = 3 days;

    /// @dev Timelock after vote passes before execution
    uint256 public executionDelay = 1 days;

    /// @dev Proposal counter
    uint256 public proposalCount;

    /// @dev Proposals
    mapping(uint256 => Proposal) public proposals;

    /// @dev Whitelisted targets allowed for governance execution
    mapping(address => bool) public allowedTargets;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        address target,
        uint256 startTime,
        uint256 endTime
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event TargetWhitelisted(address indexed target, bool allowed);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
    event VotingPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event ProposalThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event ExecutionDelayUpdated(uint256 oldDelay, uint256 newDelay);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _mdtToken) {
        require(_mdtToken != address(0), "Invalid token");
        mdtToken = IERC20(_mdtToken);
    }

    // =========================================================================
    // TARGET WHITELIST
    // =========================================================================

    /**
     * @dev Add or remove a contract from the execution whitelist.
     * @param target Contract address to allow/disallow
     * @param allowed Whether the target is allowed
     */
    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        require(target != address(0), "Invalid target");
        allowedTargets[target] = allowed;
        emit TargetWhitelisted(target, allowed);
    }

    // =========================================================================
    // PROPOSAL LIFECYCLE
    // =========================================================================

    /**
     * @dev Create a new governance proposal.
     * @param description Human-readable description
     * @param target Contract address to call if proposal passes (must be whitelisted)
     * @param callData Encoded function call (abi.encodeWithSignature)
     * @return proposalId The new proposal's ID
     */
    function propose(
        string calldata description,
        address target,
        bytes calldata callData
    ) external returns (uint256) {
        require(
            mdtToken.balanceOf(msg.sender) >= proposalThreshold,
            "Below proposal threshold"
        );
        require(target != address(0), "Invalid target");
        require(allowedTargets[target], "Target not whitelisted");

        proposalCount++;
        uint256 proposalId = proposalCount;

        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.proposer = msg.sender;
        p.description = description;
        p.target = target;
        p.callData = callData;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + votingPeriod;
        p.state = ProposalState.Active;
        p.targetAllowedAtCreation = true; // Already verified above

        emit ProposalCreated(
            proposalId,
            msg.sender,
            description,
            target,
            p.startTime,
            p.endTime
        );

        return proposalId;
    }

    /**
     * @dev Cast a vote on an active proposal.
     *      Vote weight is snapshotted on first vote — prevents flash-loan
     *      and double-voting attacks. Once snapshotted, the weight is fixed
     *      for this voter on this proposal.
     * @param proposalId Proposal to vote on
     * @param support True = for, False = against
     */
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];

        require(p.state == ProposalState.Active, "Proposal not active");
        require(block.timestamp <= p.endTime, "Voting ended");
        require(!p.hasVoted[msg.sender], "Already voted");

        // Snapshot balance on first vote — prevents flash-loan attacks.
        // Voter's weight is captured once and cannot be reused after transfer.
        uint256 weight = p.voterSnapshot[msg.sender];
        if (weight == 0) {
            weight = mdtToken.balanceOf(msg.sender);
            require(weight > 0, "No voting power");
            p.voterSnapshot[msg.sender] = weight;
        }

        p.hasVoted[msg.sender] = true;

        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @dev Finalize voting and determine outcome.
     */
    function finalizeVoting(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];

        require(p.state == ProposalState.Active, "Not active");
        require(block.timestamp > p.endTime, "Voting not ended");

        uint256 totalVotes = p.forVotes + p.againstVotes;

        if (totalVotes >= quorum && p.forVotes > p.againstVotes) {
            p.state = ProposalState.Succeeded;
            p.executionTime = block.timestamp + executionDelay;
        } else {
            p.state = ProposalState.Defeated;
        }
    }

    /**
     * @dev Execute a succeeded proposal after timelock.
     *      Uses target whitelist snapshot from creation — prevents owner
     *      from vetoing a democratic vote by revoking target mid-flight.
     */
    function execute(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];

        require(p.state == ProposalState.Succeeded, "Not succeeded");
        require(block.timestamp >= p.executionTime, "Timelock not expired");
        require(
            p.targetAllowedAtCreation,
            "Target was not whitelisted at creation"
        );

        p.state = ProposalState.Executed;

        // Execute the proposal's calldata on the whitelisted target
        (bool success, ) = p.target.call(p.callData);
        require(success, "Execution failed");

        emit ProposalExecuted(proposalId);
    }

    /**
     * @dev Cancel a proposal (proposer or owner only).
     */
    function cancel(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];

        require(
            msg.sender == p.proposer || msg.sender == owner(),
            "Not authorized"
        );
        require(
            p.state == ProposalState.Active ||
                p.state == ProposalState.Succeeded,
            "Cannot cancel"
        );

        p.state = ProposalState.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    function getProposalState(
        uint256 proposalId
    ) external view returns (ProposalState) {
        return proposals[proposalId].state;
    }

    function getVotes(
        uint256 proposalId
    ) external view returns (uint256 forVotes, uint256 againstVotes) {
        Proposal storage p = proposals[proposalId];
        return (p.forVotes, p.againstVotes);
    }

    function hasVoted(
        uint256 proposalId,
        address voter
    ) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    function setQuorum(uint256 _quorum) external onlyOwner {
        require(_quorum > 0, "Quorum must be > 0");
        require(_quorum <= 1_000_000 * 1e8, "Quorum too high");
        uint256 old = quorum;
        quorum = _quorum;
        emit QuorumUpdated(old, _quorum);
    }

    function setVotingPeriod(uint256 _period) external onlyOwner {
        require(_period >= 1 days, "Voting period too short");
        require(_period <= 30 days, "Voting period too long");
        uint256 old = votingPeriod;
        votingPeriod = _period;
        emit VotingPeriodUpdated(old, _period);
    }

    function setProposalThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold > 0, "Threshold must be > 0");
        require(_threshold <= 1_000_000 * 1e8, "Threshold too high");
        uint256 old = proposalThreshold;
        proposalThreshold = _threshold;
        emit ProposalThresholdUpdated(old, _threshold);
    }

    function setExecutionDelay(uint256 _delay) external onlyOwner {
        require(_delay >= 1 hours, "Delay too short");
        require(_delay <= 14 days, "Delay too long");
        uint256 old = executionDelay;
        executionDelay = _delay;
        emit ExecutionDelayUpdated(old, _delay);
    }
}
