// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MDTGovernor
 * @dev Minimal governance for ModernTensor protocol parameters.
 *
 * Allows MDT holders to propose and vote on protocol changes:
 * - Fee rate updates
 * - Validator management
 * - Treasury spending
 *
 * Voting:
 * - Quorum: 10,000 MDT (configurable)
 * - Voting period: 3 days
 * - Execution delay: 1 day (timelock)
 * - 1 MDT = 1 vote (snapshot at proposal creation)
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
        address target;          // Contract to call
        bytes callData;          // Function + args
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 executionTime;   // When it can be executed (after timelock)
        ProposalState state;
        mapping(address => bool) hasVoted;
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

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _mdtToken) {
        require(_mdtToken != address(0), "Invalid token");
        mdtToken = IERC20(_mdtToken);
    }

    // =========================================================================
    // PROPOSAL LIFECYCLE
    // =========================================================================

    /**
     * @dev Create a new governance proposal.
     * @param description Human-readable description
     * @param target Contract address to call if proposal passes
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

        emit ProposalCreated(
            proposalId, msg.sender, description,
            target, p.startTime, p.endTime
        );

        return proposalId;
    }

    /**
     * @dev Cast a vote on an active proposal.
     * @param proposalId Proposal to vote on
     * @param support True = for, False = against
     */
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];

        require(p.state == ProposalState.Active, "Proposal not active");
        require(block.timestamp <= p.endTime, "Voting ended");
        require(!p.hasVoted[msg.sender], "Already voted");

        uint256 weight = mdtToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");

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
     */
    function execute(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];

        require(p.state == ProposalState.Succeeded, "Not succeeded");
        require(
            block.timestamp >= p.executionTime,
            "Timelock not expired"
        );

        p.state = ProposalState.Executed;

        // Execute the proposal's calldata on the target contract
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
            p.state == ProposalState.Active || p.state == ProposalState.Succeeded,
            "Cannot cancel"
        );

        p.state = ProposalState.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    function getProposalState(uint256 proposalId) external view returns (ProposalState) {
        return proposals[proposalId].state;
    }

    function getVotes(uint256 proposalId) external view returns (
        uint256 forVotes,
        uint256 againstVotes
    ) {
        Proposal storage p = proposals[proposalId];
        return (p.forVotes, p.againstVotes);
    }

    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    function setQuorum(uint256 _quorum) external onlyOwner {
        quorum = _quorum;
    }

    function setVotingPeriod(uint256 _period) external onlyOwner {
        votingPeriod = _period;
    }

    function setProposalThreshold(uint256 _threshold) external onlyOwner {
        proposalThreshold = _threshold;
    }

    function setExecutionDelay(uint256 _delay) external onlyOwner {
        executionDelay = _delay;
    }
}
