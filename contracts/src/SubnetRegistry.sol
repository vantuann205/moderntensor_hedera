// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SubnetRegistry
 * @dev ModernTensor Protocol - The Layer 0 for AI Economies on Hedera
 *
 * This contract manages:
 * - Subnet registration and configuration
 * - Protocol-level fee collection (5% of all volume)
 * - Validator reward distribution (15% of task rewards)
 * - Multi-validator consensus scoring (median-based)
 * - Anti-spam: one submission per miner per task
 *
 * Architecture:
 * - Protocol Fee: 5% of ALL volume (goes to ModernTensor DAO)
 * - Validator Reward: 15% pool (split equally among scoring validators)
 * - Subnet Fee: Custom % set by subnet owner (goes to subnet owner)
 * - Miner Reward: 80% (goes to winning miner)
 *
 * Security:
 * - Multi-validator consensus prevents single-validator manipulation
 * - Access control on finalizeTask (requester/owner only)
 * - hasMinerSubmitted prevents submission spam
 * - onlyOwner on withdrawProtocolFees
 *
 * For Hedera Hello Future Apex Hackathon 2026
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract SubnetRegistry is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// @dev Protocol fee: 5% (500 basis points)
    uint256 public constant PROTOCOL_FEE_RATE = 500;

    /// @dev Validator reward: 15% (1500 basis points)
    uint256 public constant VALIDATOR_REWARD_RATE = 1500;

    /// @dev Maximum subnet fee: 20% (2000 basis points)
    uint256 public constant MAX_SUBNET_FEE_RATE = 2000;

    /// @dev Subnet registration cost (staked, refundable on unregister)
    uint256 public constant SUBNET_REGISTRATION_COST = 10000 * 1e8; // 10,000 MDT

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /// @dev MDT Token address
    IERC20 public mdtToken;

    /// @dev Subnet counter
    uint256 public subnetCount;

    /// @dev Task counter (global across all subnets)
    uint256 private _taskIdCounter;

    /// @dev Maximum submissions per task (anti-spam)
    uint256 public maxSubmissionsPerTask = 10;

    /// @dev Protocol treasury
    address public protocolTreasury;

    /// @dev Total protocol fees collected
    uint256 public totalProtocolFees;

    /// @dev Minimum validators required for consensus per subnet
    mapping(uint256 => uint256) public subnetMinValidations;

    // =========================================================================
    // STRUCTS
    // =========================================================================

    enum SubnetStatus {
        Active,
        Paused,
        Deprecated
    }

    struct Subnet {
        uint256 id;
        string name;                    // e.g., "General Intelligence", "Data Labeling"
        string description;             // Subnet purpose
        address owner;                  // Subnet owner (receives subnet fees)
        uint256 feeRate;                // Subnet fee in basis points (max 2000 = 20%)
        uint256 minTaskReward;          // Minimum reward for tasks in this subnet
        uint256 totalVolume;            // Total MDT volume processed
        uint256 totalTasks;             // Total tasks completed
        uint256 activeMiners;           // Registered miners count
        SubnetStatus status;
        uint256 createdAt;
    }

    enum TaskStatus {
        Created,
        InProgress,
        PendingReview,
        Completed,
        Cancelled,
        Expired
    }

    struct Task {
        uint256 id;
        uint256 subnetId;               // Which subnet this task belongs to
        address requester;
        string taskHash;
        uint256 rewardAmount;           // Miner reward (80%)
        uint256 protocolFee;            // 5% protocol fee
        uint256 validatorReward;        // 15% validator pool
        uint256 subnetFee;              // Subnet owner fee
        uint256 deadline;
        TaskStatus status;
        address winningMiner;
        uint256 winningScore;
        uint256 createdAt;
    }

    struct MinerSubmission {
        address miner;
        string resultHash;
        uint256 score;                  // Consensus median score (0-10000)
        bool validated;                 // Has reached consensus (minValidations met)
        uint256 submittedAt;
        uint256 validationCount;        // Number of validators who have scored
    }

    // =========================================================================
    // MAPPINGS
    // =========================================================================

    /// @dev Subnet ID => Subnet
    mapping(uint256 => Subnet) public subnets;

    /// @dev Task ID => Task
    mapping(uint256 => Task) public tasks;

    /// @dev Task ID => Submissions
    mapping(uint256 => MinerSubmission[]) public taskSubmissions;

    /// @dev Subnet ID => Validator addresses
    mapping(uint256 => mapping(address => bool)) public subnetValidators;

    /// @dev Subnet ID => Validator count
    mapping(uint256 => uint256) public subnetValidatorCount;

    /// @dev Subnet ID => Miner addresses
    mapping(uint256 => mapping(address => bool)) public subnetMiners;

    /// @dev Subnet ID => Miner count
    mapping(uint256 => uint256) public subnetMinerCount;

    /// @dev Task ID => Miner address => has submitted (anti-spam)
    mapping(uint256 => mapping(address => bool)) public hasMinerSubmitted;

    /// @dev Task ID => Miner index => Validator address => Score
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public validatorScores;

    /// @dev Task ID => Miner index => Validator address => has scored
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasValidatorScored;

    /// @dev Task ID => Miner index => Validator addresses (for median calc)
    mapping(uint256 => mapping(uint256 => address[])) internal _submissionValidators;

    /// @dev Validator address => Total earnings
    mapping(address => uint256) public validatorEarnings;

    /// @dev Miner address => Total earnings
    mapping(address => uint256) public minerEarnings;

    /// @dev Miner/Validator => Pending withdrawable balance (Pull pattern)
    mapping(address => uint256) public pendingWithdrawals;

    /// @dev Validator Reputation tracking
    struct ValidatorReputation {
        uint256 totalValidations;    // Total times participated in consensus
        uint256 accurateValidations; // Times within 20% of median
        uint256 reputationScore;     // = accurate / total * 10000 (basis points)
        uint256 lastActiveAt;        // Last activity timestamp
    }

    /// @dev Validator address => Reputation data
    mapping(address => ValidatorReputation) public validatorReputation;

    // =========================================================================
    // PHASE 3: COMMIT-REVEAL SCHEME
    // =========================================================================

    struct ValidationCommit {
        bytes32 commitHash;
        uint256 committedAt;
        bool revealed;
        uint256 revealedScore;
    }

    mapping(uint256 => mapping(uint256 => mapping(address => ValidationCommit))) public validationCommits;
    mapping(uint256 => mapping(uint256 => uint256)) public commitCount;
    mapping(uint256 => mapping(uint256 => uint256)) public revealCount;
    mapping(uint256 => mapping(uint256 => uint256)) public commitPhaseStart;
    uint256 public commitPhaseDuration = 1 hours;
    uint256 public revealPhaseDuration = 30 minutes;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event SubnetCreated(
        uint256 indexed subnetId,
        string name,
        address indexed owner,
        uint256 feeRate
    );

    event SubnetUpdated(
        uint256 indexed subnetId,
        uint256 newFeeRate,
        SubnetStatus newStatus
    );

    event MinerRegistered(
        uint256 indexed subnetId,
        address indexed miner
    );

    event ValidatorAdded(
        uint256 indexed subnetId,
        address indexed validator
    );

    event ValidatorRemoved(
        uint256 indexed subnetId,
        address indexed validator
    );

    event TaskCreated(
        uint256 indexed taskId,
        uint256 indexed subnetId,
        address indexed requester,
        uint256 rewardAmount
    );

    event SubmissionReceived(
        uint256 indexed taskId,
        address indexed miner,
        string resultHash
    );

    event SubmissionValidated(
        uint256 indexed taskId,
        address indexed miner,
        uint256 score,
        address validator
    );

    event ConsensusReached(
        uint256 indexed taskId,
        uint256 minerIndex,
        uint256 medianScore,
        uint256 validatorCount
    );

    event TaskCompleted(
        uint256 indexed taskId,
        uint256 indexed subnetId,
        address indexed winner,
        uint256 minerReward,
        uint256 protocolFee,
        uint256 subnetFee
    );

    event ProtocolFeesWithdrawn(
        address indexed to,
        uint256 amount
    );

    event EarningsWithdrawn(address indexed account, uint256 amount);

    event ValidatorPenalized(uint256 indexed taskId, address indexed validator, uint256 deviation);
    event ValidatorRewarded(uint256 indexed taskId, address indexed validator, uint256 amount, uint256 deviation);

    event ReputationUpdated(address indexed validator, uint256 newScore, uint256 totalValidations, uint256 accurateValidations);

    event ScoreCommitted(uint256 indexed taskId, uint256 minerIndex, address indexed validator);
    event ScoreRevealed(uint256 indexed taskId, uint256 minerIndex, address indexed validator, uint256 score);
    event CommitPhaseConfigUpdated(uint256 commitDuration, uint256 revealDuration);
    event ReputationPorted(address indexed validator, uint256 fromSubnet, uint256 toSubnet, uint256 portedScore);
    event AdaptiveValidationsApplied(uint256 indexed taskId, uint256 baseMin, uint256 adaptiveMin);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _mdtToken, address _treasury) {
        require(_mdtToken != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        mdtToken = IERC20(_mdtToken);
        protocolTreasury = _treasury;

        // Create Subnet 0: General Intelligence (owned by protocol)
        _createSubnet("General Intelligence", "Text, Code, and General AI Tasks", msg.sender, 500);
    }

    // =========================================================================
    // SUBNET MANAGEMENT
    // =========================================================================

    /**
     * @dev Register a new subnet
     * @param name Subnet name
     * @param description Subnet description
     * @param feeRate Subnet fee rate in basis points
     */
    function registerSubnet(
        string calldata name,
        string calldata description,
        uint256 feeRate
    ) external nonReentrant whenNotPaused returns (uint256 subnetId) {
        require(bytes(name).length > 0, "Empty name");
        require(feeRate <= MAX_SUBNET_FEE_RATE, "Fee too high");

        // Stake registration cost (refundable on unregister)
        mdtToken.safeTransferFrom(msg.sender, address(this), SUBNET_REGISTRATION_COST);

        subnetId = _createSubnet(name, description, msg.sender, feeRate);
    }

    /**
     * @dev Unregister a subnet and refund staked MDT
     * @param subnetId Subnet to unregister
     */
    function unregisterSubnet(uint256 subnetId) external nonReentrant {
        Subnet storage subnet = subnets[subnetId];
        require(msg.sender == subnet.owner, "Not subnet owner");
        require(subnet.status == SubnetStatus.Active || subnet.status == SubnetStatus.Paused, "Already deprecated");

        // Effects first (CEI)
        subnet.status = SubnetStatus.Deprecated;

        // Refund staked registration cost
        mdtToken.safeTransfer(msg.sender, SUBNET_REGISTRATION_COST);
    }

    function _createSubnet(
        string memory name,
        string memory description,
        address owner,
        uint256 feeRate
    ) internal returns (uint256 subnetId) {
        subnetId = subnetCount++;

        subnets[subnetId] = Subnet({
            id: subnetId,
            name: name,
            description: description,
            owner: owner,
            feeRate: feeRate,
            minTaskReward: 1e8, // 1 MDT default
            totalVolume: 0,
            totalTasks: 0,
            activeMiners: 0,
            status: SubnetStatus.Active,
            createdAt: block.timestamp
        });

        // Default: require 2 validators for consensus
        subnetMinValidations[subnetId] = 2;

        emit SubnetCreated(subnetId, name, owner, feeRate);
    }

    /**
     * @dev Update subnet configuration (owner only)
     */
    function updateSubnet(
        uint256 subnetId,
        uint256 newFeeRate,
        SubnetStatus newStatus
    ) external {
        Subnet storage subnet = subnets[subnetId];
        require(msg.sender == subnet.owner, "Not subnet owner");
        require(newFeeRate <= MAX_SUBNET_FEE_RATE, "Fee too high");

        subnet.feeRate = newFeeRate;
        subnet.status = newStatus;

        emit SubnetUpdated(subnetId, newFeeRate, newStatus);
    }

    /**
     * @dev Update minimum validators required for consensus
     */
    function setMinValidations(uint256 subnetId, uint256 newMin) external {
        require(
            msg.sender == subnets[subnetId].owner || msg.sender == owner(),
            "Not authorized"
        );
        require(newMin >= 1, "Min validations must be >= 1");
        subnetMinValidations[subnetId] = newMin;
    }

    // =========================================================================
    // MINER REGISTRATION
    // =========================================================================

    /**
     * @dev Register as a miner in a subnet
     */
    function registerMiner(uint256 subnetId) external {
        require(subnets[subnetId].status == SubnetStatus.Active, "Subnet not active");
        require(!subnetMiners[subnetId][msg.sender], "Already registered");

        subnetMiners[subnetId][msg.sender] = true;
        subnetMinerCount[subnetId]++;
        subnets[subnetId].activeMiners++;

        emit MinerRegistered(subnetId, msg.sender);
    }

    // =========================================================================
    // TASK MANAGEMENT
    // =========================================================================

    /**
     * @dev Create a task in a specific subnet
     */
    function createTask(
        uint256 subnetId,
        string calldata taskHash,
        uint256 rewardAmount,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (uint256 taskId) {
        Subnet storage subnet = subnets[subnetId];
        require(subnet.status == SubnetStatus.Active, "Subnet not active");
        require(rewardAmount >= subnet.minTaskReward, "Reward too low");
        require(duration > 0 && duration <= 7 days, "Invalid duration");

        // Calculate fees: 5% protocol + 15% validator + subnet fee
        uint256 protocolFee = (rewardAmount * PROTOCOL_FEE_RATE) / 10000;
        uint256 valReward = (rewardAmount * VALIDATOR_REWARD_RATE) / 10000;
        uint256 subnetFee = (rewardAmount * subnet.feeRate) / 10000;
        uint256 totalDeposit = rewardAmount + protocolFee + valReward + subnetFee;

        // Transfer tokens
        mdtToken.safeTransferFrom(msg.sender, address(this), totalDeposit);

        // Create task
        taskId = _taskIdCounter++;

        tasks[taskId] = Task({
            id: taskId,
            subnetId: subnetId,
            requester: msg.sender,
            taskHash: taskHash,
            rewardAmount: rewardAmount,
            protocolFee: protocolFee,
            validatorReward: valReward,
            subnetFee: subnetFee,
            deadline: block.timestamp + duration,
            status: TaskStatus.Created,
            winningMiner: address(0),
            winningScore: 0,
            createdAt: block.timestamp
        });

        emit TaskCreated(taskId, subnetId, msg.sender, rewardAmount);
    }

    /**
     * @dev Submit result for a task. Each miner can only submit once.
     */
    function submitResult(
        uint256 taskId,
        string calldata resultHash
    ) external nonReentrant {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.Created ||
            task.status == TaskStatus.InProgress ||
            task.status == TaskStatus.PendingReview,
            "Cannot submit"
        );
        require(block.timestamp < task.deadline, "Task expired");
        require(subnetMiners[task.subnetId][msg.sender], "Not registered in subnet");
        require(!hasMinerSubmitted[taskId][msg.sender], "Miner already submitted");
        require(taskSubmissions[taskId].length < maxSubmissionsPerTask, "Max submissions reached");

        // Mark as submitted (anti-spam)
        hasMinerSubmitted[taskId][msg.sender] = true;

        taskSubmissions[taskId].push(MinerSubmission({
            miner: msg.sender,
            resultHash: resultHash,
            score: 0,
            validated: false,
            submittedAt: block.timestamp,
            validationCount: 0
        }));

        // FIX: transition from BOTH Created and InProgress
        if (task.status == TaskStatus.Created || task.status == TaskStatus.InProgress) {
            task.status = TaskStatus.PendingReview;
        }

        emit SubmissionReceived(taskId, msg.sender, resultHash);
    }

    /**
     * @dev Expire a task that has passed its deadline.
     *      Anyone can call this — trustless cleanup.
     *      Refunds the full deposit to the requester.
     * @param taskId The task to expire
     */
    function expireTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];

        require(
            task.status == TaskStatus.Created ||
            task.status == TaskStatus.InProgress ||
            task.status == TaskStatus.PendingReview,
            "Task not expirable"
        );
        require(block.timestamp > task.deadline, "Task not yet expired");
        require(task.winningMiner == address(0), "Task has a winner");

        // Effects before interactions (CEI)
        uint256 refund = task.rewardAmount + task.protocolFee + task.validatorReward + task.subnetFee;
        task.status = TaskStatus.Expired;

        // Refund to requester
        mdtToken.safeTransfer(task.requester, refund);
    }

    // =========================================================================
    // VALIDATOR FUNCTIONS — Multi-Validator Consensus
    // =========================================================================

    /**
     * @dev Submit validation score for a miner's submission.
     *      Multiple validators must score each submission independently.
     *      When minValidations is reached, the median score is calculated.
     *
     * @param taskId Task ID
     * @param submissionIndex Index of miner in submissions array
     * @param score Validation score (0-10000, basis points = 0-100%)
     */
    function validateSubmission(
        uint256 taskId,
        uint256 submissionIndex,
        uint256 score
    ) external {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.PendingReview ||
            task.status == TaskStatus.InProgress,
            "Not pending review"
        );
        require(subnetValidators[task.subnetId][msg.sender], "Not a validator");
        require(submissionIndex < taskSubmissions[taskId].length, "Invalid index");
        require(score <= 10000, "Invalid score");
        require(
            !hasValidatorScored[taskId][submissionIndex][msg.sender],
            "Validator already scored this submission"
        );

        MinerSubmission storage submission = taskSubmissions[taskId][submissionIndex];
        require(!submission.validated, "Submission already has consensus");

        // GUARD: If commit-reveal has started for this submission, block direct scoring
        require(
            commitPhaseStart[taskId][submissionIndex] == 0,
            "Commit-reveal active: use commitScore/revealScore"
        );

        // Record this validator's individual score
        validatorScores[taskId][submissionIndex][msg.sender] = score;
        hasValidatorScored[taskId][submissionIndex][msg.sender] = true;
        _submissionValidators[taskId][submissionIndex].push(msg.sender);
        submission.validationCount++;

        emit SubmissionValidated(taskId, submission.miner, score, msg.sender);

        // Check if we've reached consensus threshold
        uint256 minVals = subnetMinValidations[task.subnetId];
        if (minVals == 0) minVals = 2; // Safety default

        if (submission.validationCount >= minVals) {
            // Calculate median score from all validator scores
            uint256 medianScore = _calculateMedianScore(taskId, submissionIndex, submission.validationCount);

            submission.score = medianScore;
            submission.validated = true;

            // Update winning miner if this consensus score is highest
            if (medianScore > task.winningScore) {
                task.winningScore = medianScore;
                task.winningMiner = submission.miner;
            }

            emit ConsensusReached(taskId, submissionIndex, medianScore, submission.validationCount);
        }
    }

    // =========================================================================
    // PHASE 3: COMMIT-REVEAL FUNCTIONS
    // =========================================================================

    function commitScore(
        uint256 taskId,
        uint256 minerIndex,
        bytes32 commitHash
    ) external {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.PendingReview || task.status == TaskStatus.InProgress,
            "Not pending review"
        );
        require(subnetValidators[task.subnetId][msg.sender], "Not a validator");
        require(minerIndex < taskSubmissions[taskId].length, "Invalid index");
        require(commitHash != bytes32(0), "Empty commit hash");

        MinerSubmission storage submission = taskSubmissions[taskId][minerIndex];
        require(!submission.validated, "Already has consensus");
        require(
            validationCommits[taskId][minerIndex][msg.sender].commitHash == bytes32(0),
            "Already committed"
        );
        require(!hasValidatorScored[taskId][minerIndex][msg.sender], "Already scored directly");

        if (commitPhaseStart[taskId][minerIndex] == 0) {
            commitPhaseStart[taskId][minerIndex] = block.timestamp;
        }
        require(
            block.timestamp <= commitPhaseStart[taskId][minerIndex] + commitPhaseDuration,
            "Commit phase ended"
        );

        validationCommits[taskId][minerIndex][msg.sender] = ValidationCommit({
            commitHash: commitHash,
            committedAt: block.timestamp,
            revealed: false,
            revealedScore: 0
        });
        commitCount[taskId][minerIndex]++;

        emit ScoreCommitted(taskId, minerIndex, msg.sender);
    }

    function revealScore(
        uint256 taskId,
        uint256 minerIndex,
        uint256 score,
        bytes32 salt
    ) external {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.PendingReview || task.status == TaskStatus.InProgress,
            "Not pending review"
        );
        require(subnetValidators[task.subnetId][msg.sender], "Not a validator");
        require(minerIndex < taskSubmissions[taskId].length, "Invalid index");
        require(score <= 10000, "Invalid score");

        MinerSubmission storage submission = taskSubmissions[taskId][minerIndex];
        require(!submission.validated, "Already has consensus");

        uint256 commitEnd = commitPhaseStart[taskId][minerIndex] + commitPhaseDuration;
        uint256 revealEnd = commitEnd + revealPhaseDuration;
        require(block.timestamp > commitEnd, "Commit phase not ended yet");
        require(block.timestamp <= revealEnd, "Reveal phase ended");

        ValidationCommit storage vc = validationCommits[taskId][minerIndex][msg.sender];
        require(vc.commitHash != bytes32(0), "No commit found");
        require(!vc.revealed, "Already revealed");

        bytes32 expectedHash = keccak256(abi.encodePacked(score, salt));
        require(expectedHash == vc.commitHash, "Hash mismatch");

        vc.revealed = true;
        vc.revealedScore = score;
        revealCount[taskId][minerIndex]++;

        validatorScores[taskId][minerIndex][msg.sender] = score;
        hasValidatorScored[taskId][minerIndex][msg.sender] = true;
        _submissionValidators[taskId][minerIndex].push(msg.sender);
        submission.validationCount++;

        emit ScoreRevealed(taskId, minerIndex, msg.sender, score);

        uint256 minVals = subnetMinValidations[task.subnetId];
        if (minVals == 0) minVals = 2;

        if (submission.validationCount >= minVals) {
            uint256 medianScore = _calculateMedianScore(taskId, minerIndex, submission.validationCount);
            submission.score = medianScore;
            submission.validated = true;

            if (medianScore > task.winningScore) {
                task.winningScore = medianScore;
                task.winningMiner = submission.miner;
            }

            emit ConsensusReached(taskId, minerIndex, medianScore, submission.validationCount);
        }
    }

    function getCommitHash(
        uint256 score,
        bytes32 salt
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(score, salt));
    }

    function setCommitRevealConfig(
        uint256 _commitDuration,
        uint256 _revealDuration
    ) external onlyOwner {
        require(_commitDuration >= 5 minutes, "Commit phase too short");
        require(_revealDuration >= 5 minutes, "Reveal phase too short");
        commitPhaseDuration = _commitDuration;
        revealPhaseDuration = _revealDuration;
        emit CommitPhaseConfigUpdated(_commitDuration, _revealDuration);
    }

    /**
     * @dev Calculate median score from validator scores.
     *      Uses insertion sort (efficient for small arrays, typically 2-10 validators).
     */
    function _calculateMedianScore(
        uint256 taskId,
        uint256 minerIndex,
        uint256 count
    ) internal view returns (uint256 median) {
        uint256[] memory scores = new uint256[](count);

        // Collect scores from validators
        address[] storage scoringVals = _submissionValidators[taskId][minerIndex];
        require(scoringVals.length == count, "Validator tracking mismatch");

        for (uint256 i = 0; i < count; i++) {
            scores[i] = validatorScores[taskId][minerIndex][scoringVals[i]];
        }

        // Sort scores (insertion sort — optimal for small N)
        for (uint256 i = 1; i < count; i++) {
            uint256 key = scores[i];
            uint256 j = i;
            while (j > 0 && scores[j - 1] > key) {
                scores[j] = scores[j - 1];
                j--;
            }
            scores[j] = key;
        }

        // Calculate median
        if (count % 2 == 1) {
            median = scores[count / 2];
        } else {
            median = (scores[count / 2 - 1] + scores[count / 2]) / 2;
        }
    }

    /**
     * @dev Finalize task and distribute payments.
     *      Access restricted to requester or protocol owner.
     *      CEI pattern strictly followed.
     */
    function finalizeTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];

        // ── CHECKS ──────────────────────────────────────────────────────
        // FIX: Anyone can finalize once consensus is reached (trustless)
        require(task.status == TaskStatus.PendingReview, "Not ready");
        require(task.winningMiner != address(0), "No winner");

        // ── GAS OPTIMIZATION: Cache storage reads ───────────────────────
        uint256 cachedSubnetId = task.subnetId;
        address cachedWinner = task.winningMiner;
        uint256 cachedReward = task.rewardAmount;
        uint256 cachedProtocolFee = task.protocolFee;
        uint256 cachedValReward = task.validatorReward;
        uint256 cachedSubnetFee = task.subnetFee;

        // ── EFFECTS ─────────────────────────────────────────────────────
        task.status = TaskStatus.Completed;

        Subnet storage subnet = subnets[cachedSubnetId];
        subnet.totalVolume += cachedReward;
        subnet.totalTasks++;

        // Collect protocol fee
        totalProtocolFees += cachedProtocolFee;

        // Record miner earnings + credit pending withdrawal (Pull pattern)
        minerEarnings[cachedWinner] += cachedReward;
        pendingWithdrawals[cachedWinner] += cachedReward;

        // Credit subnet fee to subnet owner (Pull pattern)
        if (cachedSubnetFee > 0) {
            pendingWithdrawals[subnet.owner] += cachedSubnetFee;
        }

        // ── EVENTS (CEI: before external calls) ─────────────────────────
        emit TaskCompleted(
            taskId,
            cachedSubnetId,
            cachedWinner,
            cachedReward,
            cachedProtocolFee,
            cachedSubnetFee
        );

        // ── INTERACTIONS: Credit validator rewards (Pull pattern) ────────
        if (cachedValReward > 0) {
            _distributeValidatorRewards(taskId, cachedValReward);
        }
    }

    /**
     * @dev Distribute validator rewards equally among validators who
     *      scored the winning miner's submission.
     */
    function _distributeValidatorRewards(
        uint256 taskId,
        uint256 totalReward
    ) internal {
        Task storage task = tasks[taskId];
        address winner = task.winningMiner;
        uint256 winnerIndex = type(uint256).max;

        // Find the winning miner's submission index
        MinerSubmission[] storage subs = taskSubmissions[taskId];
        for (uint256 i = 0; i < subs.length; i++) {
            if (subs[i].miner == winner && subs[i].validated) {
                winnerIndex = i;
                break;
            }
        }

        if (winnerIndex == type(uint256).max) {
            totalProtocolFees += totalReward;
            return;
        }

        // Get validators who scored the winning submission
        address[] storage scoringVals = _submissionValidators[taskId][winnerIndex];
        uint256 numVals = scoringVals.length;

        if (numVals == 0) {
            totalProtocolFees += totalReward;
            return;
        }

        uint256 medianScore = subs[winnerIndex].score;

        // ── Score Deviation Penalty: Calculate weighted shares ──────────
        uint256[] memory shares = new uint256[](numVals);
        uint256 totalShares = 0;

        for (uint256 i = 0; i < numVals; i++) {
            address valAddr = scoringVals[i];
            uint256 vScore = validatorScores[taskId][winnerIndex][valAddr];
            uint256 deviation = _calculateDeviation(vScore, medianScore);

            // ── Phase 2: Update Reputation ────────────────────────────
            ValidatorReputation storage rep = validatorReputation[valAddr];
            rep.totalValidations++;
            rep.lastActiveAt = block.timestamp;

            if (deviation <= 2000) {
                rep.accurateValidations++;
                shares[i] = 100;
                emit ValidatorRewarded(taskId, valAddr, 0, deviation);
            } else if (deviation <= 5000) {
                shares[i] = 50;
                emit ValidatorRewarded(taskId, valAddr, 0, deviation);
            } else {
                shares[i] = 0;
                emit ValidatorPenalized(taskId, valAddr, deviation);
            }

            // Update reputation score
            if (rep.totalValidations > 0) {
                rep.reputationScore = (rep.accurateValidations * 10000) / rep.totalValidations;
            }

            // Apply reputation multiplier
            shares[i] = (shares[i] * rep.reputationScore) / 10000;
            totalShares += shares[i];

            emit ReputationUpdated(valAddr, rep.reputationScore, rep.totalValidations, rep.accurateValidations);
        }

        if (totalShares == 0) {
            totalProtocolFees += totalReward;
            return;
        }

        // ── Distribute proportionally based on reputation-weighted shares ─
        uint256 distributed = 0;
        for (uint256 i = 0; i < numVals; i++) {
            if (shares[i] == 0) continue;
            uint256 amount = (totalReward * shares[i]) / totalShares;
            distributed += amount;
            validatorEarnings[scoringVals[i]] += amount;
            pendingWithdrawals[scoringVals[i]] += amount;
        }

        // Dust goes to protocol
        if (distributed < totalReward) {
            totalProtocolFees += (totalReward - distributed);
        }
    }

    /**
     * @dev Calculate deviation between a score and the median, in basis points.
     * @param score Individual validator score
     * @param median Consensus median score
     * @return Deviation in basis points (0-10000)
     */
    function _calculateDeviation(
        uint256 score,
        uint256 median
    ) internal pure returns (uint256) {
        if (median == 0) return 0;
        uint256 diff = score > median ? score - median : median - score;
        return (diff * 10000) / median;
    }

    /**
     * @dev Withdraw pending earnings (Pull pattern).
     *      Miners and validators call this to collect their rewards.
     *      Prevents Hedera HTS disassociation DoS.
     */
    function withdrawEarnings() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending earnings");

        // CEI: Effects before Interactions
        pendingWithdrawals[msg.sender] = 0;

        emit EarningsWithdrawn(msg.sender, amount);

        mdtToken.safeTransfer(msg.sender, amount);
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /**
     * @dev Add validator to a subnet
     */
    function addValidator(uint256 subnetId, address validator) external {
        require(msg.sender == subnets[subnetId].owner || msg.sender == owner(), "Not authorized");
        require(validator != address(0), "Invalid address");
        require(!subnetValidators[subnetId][validator], "Already validator");

        subnetValidators[subnetId][validator] = true;
        subnetValidatorCount[subnetId]++;

        // Initialize default reputation (50% = neutral starting point)
        // If validator already has reputation from another subnet, it carries over
        if (validatorReputation[validator].reputationScore == 0 &&
            validatorReputation[validator].totalValidations == 0) {
            validatorReputation[validator] = ValidatorReputation({
                totalValidations: 0,
                accurateValidations: 0,
                reputationScore: 5000,
                lastActiveAt: block.timestamp
            });
        }

        emit ValidatorAdded(subnetId, validator);
    }

    // =========================================================================
    // PROOF-OF-INTELLIGENCE: Cross-Subnet Reputation Portability
    // =========================================================================

    /// @dev Decay factor for ported reputation (50% = 5000 basis points)
    uint256 public constant REPUTATION_DECAY_FACTOR = 5000;

    /**
     * @dev Port reputation from one subnet context to boost starting reputation.
     *      Validators who proved themselves in Subnet A can bring 50% of that
     *      reputation to Subnet B. This is UNIQUE to ModernTensor — no other
     *      protocol supports cross-domain AI validator reputation portability.
     *
     *      Formula: portedScore = existingScore * DECAY_FACTOR / 10000
     *      The ported score only applies if it's HIGHER than current score.
     *
     * @param fromSubnetId Source subnet where reputation was earned
     * @param toSubnetId Target subnet to port reputation to
     */
    /// @dev Track ported reputation boosts per validator per subnet
    mapping(address => mapping(uint256 => uint256)) public portedReputationBoost;

    /// @dev Cooldown: last time a validator ported reputation
    mapping(address => uint256) public lastPortedAt;
    uint256 public constant PORT_COOLDOWN = 1 days;

    function portReputation(
        uint256 fromSubnetId,
        uint256 toSubnetId
    ) external {
        require(subnetValidators[fromSubnetId][msg.sender], "Not validator in source subnet");
        require(subnetValidators[toSubnetId][msg.sender], "Not validator in target subnet");
        require(fromSubnetId != toSubnetId, "Same subnet");
        require(
            block.timestamp >= lastPortedAt[msg.sender] + PORT_COOLDOWN,
            "Port cooldown active"
        );

        ValidatorReputation storage rep = validatorReputation[msg.sender];
        require(rep.totalValidations > 0, "No reputation to port");

        // Calculate ported score with 50% decay
        uint256 portedScore = (rep.reputationScore * REPUTATION_DECAY_FACTOR) / 10000;

        // Only apply if ported score is better than default (5000 = 50%)
        require(portedScore >= 5000, "Ported score not better than default");

        // Store the ported boost for target subnet
        // This boost is used as a starting multiplier advantage
        portedReputationBoost[msg.sender][toSubnetId] = portedScore;
        lastPortedAt[msg.sender] = block.timestamp;

        emit ReputationPorted(msg.sender, fromSubnetId, toSubnetId, portedScore);
    }

    // =========================================================================
    // PROOF-OF-INTELLIGENCE: Adaptive minValidations
    // =========================================================================

    /// @dev Thresholds for adaptive validation requirements
    uint256 public constant HIGH_VALUE_THRESHOLD = 1000e8;   // 1000 MDT
    uint256 public constant ULTRA_VALUE_THRESHOLD = 10000e8;  // 10000 MDT

    /**
     * @dev Calculate adaptive minValidations based on task reward amount.
     *      Higher-value tasks require more validators for increased security.
     *      This is the "Proof-of-Intelligence" — security scales with value.
     *
     *      - reward < 1000 MDT  → base minValidations (e.g. 2)
     *      - reward >= 1000 MDT → base + 1
     *      - reward >= 10000 MDT → base + 2
     *
     * @param subnetId Subnet to check base minValidations
     * @param rewardAmount Task reward amount
     * @return Required minimum validators
     */
    function getAdaptiveMinValidations(
        uint256 subnetId,
        uint256 rewardAmount
    ) public view returns (uint256) {
        uint256 baseMin = subnetMinValidations[subnetId];
        if (baseMin == 0) baseMin = 2;

        if (rewardAmount >= ULTRA_VALUE_THRESHOLD) {
            return baseMin + 2;
        } else if (rewardAmount >= HIGH_VALUE_THRESHOLD) {
            return baseMin + 1;
        }
        return baseMin;
    }

    /**
     * @dev Remove validator from a subnet
     */
    function removeValidator(uint256 subnetId, address validator) external {
        require(msg.sender == subnets[subnetId].owner || msg.sender == owner(), "Not authorized");
        require(subnetValidators[subnetId][validator], "Not a validator");

        subnetValidators[subnetId][validator] = false;
        subnetValidatorCount[subnetId]--;

        emit ValidatorRemoved(subnetId, validator);
    }

    /**
     * @dev Withdraw protocol fees to treasury (onlyOwner)
     */
    function withdrawProtocolFees() external onlyOwner {
        uint256 amount = totalProtocolFees;
        require(amount > 0, "No fees");

        // CEI: Effects before Interactions
        totalProtocolFees = 0;

        emit ProtocolFeesWithdrawn(protocolTreasury, amount);

        mdtToken.safeTransfer(protocolTreasury, amount);
    }

    /**
     * @dev Update protocol treasury
     */
    function setProtocolTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        protocolTreasury = newTreasury;
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /**
     * @dev Get subnet info
     */
    function getSubnet(uint256 subnetId) external view returns (Subnet memory) {
        return subnets[subnetId];
    }

    /**
     * @dev Get task info
     */
    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    /**
     * @dev Get submissions for a task
     */
    function getSubmissions(uint256 taskId) external view returns (MinerSubmission[] memory) {
        return taskSubmissions[taskId];
    }

    /**
     * @dev Get submission count for a task
     */
    function getSubmissionCount(uint256 taskId) external view returns (uint256) {
        return taskSubmissions[taskId].length;
    }

    /**
     * @dev Check if address is miner in subnet
     */
    function isMiner(uint256 subnetId, address miner) external view returns (bool) {
        return subnetMiners[subnetId][miner];
    }

    /**
     * @dev Check if address is validator in subnet
     */
    function isValidator(uint256 subnetId, address validator) external view returns (bool) {
        return subnetValidators[subnetId][validator];
    }

    /**
     * @dev Get a specific validator's score for a submission
     */
    function getValidatorScore(
        uint256 taskId,
        uint256 minerIndex,
        address validator
    ) external view returns (uint256 score, bool scored) {
        scored = hasValidatorScored[taskId][minerIndex][validator];
        score = validatorScores[taskId][minerIndex][validator];
    }

    /**
     * @dev Get active subnet count
     */
    function getActiveSubnetCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < subnetCount; i++) {
            if (subnets[i].status == SubnetStatus.Active) {
                count++;
            }
        }
    }
}
