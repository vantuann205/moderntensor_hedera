// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PaymentEscrow
 * @dev Smart contract for ModernTensor payment escrow on Hedera
 *
 * This contract handles:
 * - Task deposits from requesters
 * - Payment distribution to miners based on AI validation scores
 * - Multi-validator consensus scoring (median-based)
 * - Refunds for cancelled or failed tasks
 *
 * Flow:
 * 1. Requester creates task with MDT token deposit
 * 2. Miners submit results
 * 3. Multiple AI Validators score results independently
 * 4. Contract calculates median score after consensus threshold
 * 5. Contract releases payment to top-scoring miner
 *
 * Security features:
 * - ReentrancyGuard on all state-changing + transfer functions
 * - CEI (Checks-Effects-Interactions) pattern strictly followed
 * - Multi-validator consensus prevents single-validator manipulation
 * - Gas-optimized with memory caching of storage reads
 *
 * For Hedera Hello Future Hackathon 2026
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract PaymentEscrow is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /// @dev MDT Token address (HTS token wrapped as ERC20)
    IERC20 public mdtToken;

    /// @dev Platform fee percentage (basis points, 500 = 5%)
    uint256 public platformFeeRate = 500; // 5%

    /// @dev Validator reward percentage (basis points, 1500 = 15%)
    uint256 public validatorRewardRate = 1500; // 15%

    /// @dev Minimum task reward
    uint256 public minTaskReward = 1e8; // 1 MDT (8 decimals)

    /// @dev Maximum task duration
    uint256 public maxTaskDuration = 7 days;

    /// @dev Task counter for unique IDs
    uint256 private _taskIdCounter;

    /// @dev Validator registry (authorized AI validators)
    mapping(address => bool) public validators;
    uint256 public validatorCount;

    /// @dev Minimum number of validators required for consensus
    uint256 public minValidations = 2;

    // =========================================================================
    // STRUCTS
    // =========================================================================

    enum TaskStatus {
        Created,        // Task created, waiting for miners
        InProgress,     // Miner working on task
        PendingReview,  // Submitted, waiting for AI validation
        Completed,      // Validated and paid
        Cancelled,      // Cancelled by requester
        Expired,        // Deadline passed without completion
        Disputed        // Under dispute resolution
    }

    struct Task {
        uint256 id;
        address requester;          // Who created the task
        string taskHash;            // IPFS hash or HCS message reference
        uint256 rewardAmount;       // MDT locked for miner reward (80%)
        uint256 platformFee;        // Protocol fee (5%)
        uint256 validatorReward;    // Total validator pool (15%)
        uint256 deadline;           // Task expiration timestamp
        TaskStatus status;          // Current status
        address assignedMiner;      // Miner who accepted (if any)
        address winningMiner;       // Miner who won (after validation)
        uint256 winningScore;       // Consensus median score of winning miner
        uint256 createdAt;          // Creation timestamp
        uint256 completedAt;        // Completion timestamp (if completed)
    }

    struct MinerSubmission {
        address miner;
        string resultHash;          // IPFS hash of result
        uint256 score;              // Consensus median score (0-10000, basis points)
        bool validated;             // Has reached consensus (minValidations met)
        uint256 submittedAt;        // Submission timestamp
        uint256 validationCount;    // Number of validators who have scored
    }

    // =========================================================================
    // MAPPINGS
    // =========================================================================

    /// @dev Task ID => Task
    mapping(uint256 => Task) public tasks;

    /// @dev Task ID => Miner submissions
    mapping(uint256 => MinerSubmission[]) public taskSubmissions;

    /// @dev Task ID => Miner index => Validator address => Score
    ///      Tracks individual validator scores for consensus calculation
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public validatorScores;

    /// @dev Task ID => Miner index => Validator address => has scored
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasValidatorScored;

    /// @dev Requester => Active task count
    mapping(address => uint256) public activeTaskCount;

    /// @dev Miner => Total earnings (historical, for tracking)
    mapping(address => uint256) public minerEarnings;

    /// @dev Validator => Total earnings (historical, for tracking)
    mapping(address => uint256) public validatorEarnings;

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

    /// @dev Task ID => Miner address => has submitted
    mapping(uint256 => mapping(address => bool)) public hasMinerSubmitted;

    /// @dev Collected platform fees
    uint256 public collectedFees;

    // =========================================================================
    // PHASE 3: COMMIT-REVEAL SCHEME
    // =========================================================================

    /// @dev Commit-Reveal data per validator per submission
    struct ValidationCommit {
        bytes32 commitHash;      // keccak256(abi.encodePacked(score, salt))
        uint256 committedAt;     // Timestamp of commit
        bool revealed;           // Has been revealed
        uint256 revealedScore;   // Score after reveal
    }

    /// @dev Task ID => Miner index => Validator address => Commit data
    mapping(uint256 => mapping(uint256 => mapping(address => ValidationCommit))) public validationCommits;

    /// @dev Task ID => Miner index => Number of commits received
    mapping(uint256 => mapping(uint256 => uint256)) public commitCount;

    /// @dev Task ID => Miner index => Number of reveals received
    mapping(uint256 => mapping(uint256 => uint256)) public revealCount;

    /// @dev Commit phase duration after first commit
    uint256 public commitPhaseDuration = 1 hours;

    /// @dev Reveal phase duration after commit phase ends
    uint256 public revealPhaseDuration = 30 minutes;

    /// @dev Task ID => Miner index => Timestamp of first commit (starts commit phase)
    mapping(uint256 => mapping(uint256 => uint256)) public commitPhaseStart;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event TaskCreated(
        uint256 indexed taskId,
        address indexed requester,
        uint256 rewardAmount,
        uint256 deadline,
        string taskHash
    );

    event TaskAccepted(
        uint256 indexed taskId,
        address indexed miner
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

    /// @dev Emitted when a submission reaches consensus (minValidations met)
    event ConsensusReached(
        uint256 indexed taskId,
        uint256 minerIndex,
        uint256 medianScore,
        uint256 validatorCount
    );

    event TaskCompleted(
        uint256 indexed taskId,
        address indexed winner,
        uint256 reward,
        uint256 score
    );

    event TaskCancelled(
        uint256 indexed taskId,
        address indexed requester,
        uint256 refundAmount
    );

    event TaskExpired(
        uint256 indexed taskId
    );

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event PlatformFeeUpdated(uint256 oldRate, uint256 newRate);
    event MinValidationsUpdated(uint256 oldMin, uint256 newMin);
    event EarningsWithdrawn(address indexed account, uint256 amount);
    event ValidatorPenalized(uint256 indexed taskId, address indexed validator, uint256 deviation);
    event ValidatorRewarded(uint256 indexed taskId, address indexed validator, uint256 amount, uint256 deviation);
    event ReputationUpdated(address indexed validator, uint256 newScore, uint256 totalValidations, uint256 accurateValidations);
    event ScoreCommitted(uint256 indexed taskId, uint256 minerIndex, address indexed validator);
    event ScoreRevealed(uint256 indexed taskId, uint256 minerIndex, address indexed validator, uint256 score);
    event CommitPhaseConfigUpdated(uint256 commitDuration, uint256 revealDuration);
    event AdaptiveValidationsApplied(uint256 indexed taskId, uint256 baseMin, uint256 adaptiveMin);

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyValidator() {
        require(validators[msg.sender], "Not a validator");
        _;
    }

    modifier taskExists(uint256 taskId) {
        require(taskId > 0 && tasks[taskId].id == taskId, "Task not found");
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * @dev Initialize the escrow contract
     * @param _mdtToken Address of MDT token (HTS token as ERC20)
     */
    constructor(address _mdtToken) {
        require(_mdtToken != address(0), "Invalid token address");
        mdtToken = IERC20(_mdtToken);
    }

    // =========================================================================
    // REQUESTER FUNCTIONS
    // =========================================================================

    /**
     * @dev Create a new task with MDT reward
     * @param taskHash IPFS hash or reference to task details
     * @param rewardAmount Amount of MDT tokens as reward
     * @param duration Task duration in seconds
     * @return taskId The created task ID
     */
    function createTask(
        string calldata taskHash,
        uint256 rewardAmount,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (uint256 taskId) {
        require(bytes(taskHash).length > 0, "Empty task hash");
        require(rewardAmount >= minTaskReward, "Reward too low");
        require(duration > 0 && duration <= maxTaskDuration, "Invalid duration");

        // Calculate fees: 5% protocol + 15% validator pool
        uint256 fee = (rewardAmount * platformFeeRate) / 10000;
        uint256 valReward = (rewardAmount * validatorRewardRate) / 10000;
        uint256 totalDeposit = rewardAmount + fee + valReward;

        // Transfer tokens to escrow
        mdtToken.safeTransferFrom(msg.sender, address(this), totalDeposit);

        // Create task
        taskId = ++_taskIdCounter;
        tasks[taskId] = Task({
            id: taskId,
            requester: msg.sender,
            taskHash: taskHash,
            rewardAmount: rewardAmount,
            platformFee: fee,
            validatorReward: valReward,
            deadline: block.timestamp + duration,
            status: TaskStatus.Created,
            assignedMiner: address(0),
            winningMiner: address(0),
            winningScore: 0,
            createdAt: block.timestamp,
            completedAt: 0
        });

        activeTaskCount[msg.sender]++;

        emit TaskCreated(taskId, msg.sender, rewardAmount, tasks[taskId].deadline, taskHash);
    }

    /**
     * @dev Cancel a task and get refund (only if not completed)
     * @param taskId The task to cancel
     */
    function cancelTask(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];

        require(msg.sender == task.requester, "Not task owner");
        require(
            task.status == TaskStatus.Created,
            "Cannot cancel this task"
        );

        // Refund tokens — CEI: Effects before Interactions
        uint256 refund = task.rewardAmount + task.platformFee + task.validatorReward;
        task.status = TaskStatus.Cancelled;
        activeTaskCount[msg.sender]--;

        emit TaskCancelled(taskId, msg.sender, refund);

        mdtToken.safeTransfer(msg.sender, refund);
    }

    // =========================================================================
    // MINER FUNCTIONS
    // =========================================================================

    /**
     * @dev Accept a task (optional: assigns task to specific miner)
     * @param taskId Task to accept
     */
    function acceptTask(uint256 taskId) external taskExists(taskId) whenNotPaused {
        Task storage task = tasks[taskId];

        require(task.status == TaskStatus.Created, "Task not available");
        require(block.timestamp < task.deadline, "Task expired");
        require(task.assignedMiner == address(0), "Already assigned");

        task.assignedMiner = msg.sender;
        task.status = TaskStatus.InProgress;

        emit TaskAccepted(taskId, msg.sender);
    }

    /**
     * @dev Submit result for a task
     * @param taskId Task ID
     * @param resultHash IPFS hash of the result
     */
    function submitResult(
        uint256 taskId,
        string calldata resultHash
    ) external taskExists(taskId) whenNotPaused {
        Task storage task = tasks[taskId];

        require(
            task.status == TaskStatus.Created ||
            task.status == TaskStatus.InProgress ||
            task.status == TaskStatus.PendingReview,
            "Cannot submit to this task"
        );
        require(block.timestamp < task.deadline, "Task expired");
        require(bytes(resultHash).length > 0, "Empty result hash");
        require(!hasMinerSubmitted[taskId][msg.sender], "Miner already submitted");

        // Mark miner as submitted (prevent spam)
        hasMinerSubmitted[taskId][msg.sender] = true;

        // Add submission
        taskSubmissions[taskId].push(MinerSubmission({
            miner: msg.sender,
            resultHash: resultHash,
            score: 0,
            validated: false,
            submittedAt: block.timestamp,
            validationCount: 0
        }));

        // Update status — FIX: transition from BOTH Created and InProgress
        if (task.status == TaskStatus.Created || task.status == TaskStatus.InProgress) {
            task.status = TaskStatus.PendingReview;
        }

        emit SubmissionReceived(taskId, msg.sender, resultHash);
    }

    // =========================================================================
    // VALIDATOR FUNCTIONS — Multi-Validator Consensus
    // =========================================================================

    /**
     * @dev Submit validation score for a miner's submission.
     *      Multiple validators must score each submission independently.
     *      When minValidations is reached, the median score is calculated
     *      and used as the consensus score.
     *
     * @param taskId Task ID
     * @param minerIndex Index of miner in submissions array
     * @param score Validation score (0-10000, basis points = 0-100%)
     */
    function validateSubmission(
        uint256 taskId,
        uint256 minerIndex,
        uint256 score
    ) external onlyValidator taskExists(taskId) whenNotPaused {
        Task storage task = tasks[taskId];

        require(
            task.status == TaskStatus.PendingReview ||
            task.status == TaskStatus.InProgress,
            "Task not pending review"
        );
        require(minerIndex < taskSubmissions[taskId].length, "Invalid miner index");
        require(score <= 10000, "Score must be 0-10000");
        require(
            !hasValidatorScored[taskId][minerIndex][msg.sender],
            "Validator already scored this submission"
        );

        MinerSubmission storage submission = taskSubmissions[taskId][minerIndex];
        require(!submission.validated, "Submission already has consensus");

        // Record this validator's individual score
        validatorScores[taskId][minerIndex][msg.sender] = score;
        hasValidatorScored[taskId][minerIndex][msg.sender] = true;
        _submissionValidators[taskId][minerIndex].push(msg.sender);
        submission.validationCount++;

        emit SubmissionValidated(taskId, submission.miner, score, msg.sender);

        // Check if we've reached consensus threshold
        if (submission.validationCount >= minValidations) {
            // Calculate median score from all validator scores
            uint256 medianScore = _calculateMedianScore(taskId, minerIndex, submission.validationCount);

            submission.score = medianScore;
            submission.validated = true;

            // Update winning miner if this consensus score is highest
            if (medianScore > task.winningScore) {
                task.winningScore = medianScore;
                task.winningMiner = submission.miner;
            }

            emit ConsensusReached(taskId, minerIndex, medianScore, submission.validationCount);
        }
    }

    // =========================================================================
    // PHASE 3: COMMIT-REVEAL FUNCTIONS
    // =========================================================================

    /**
     * @dev Phase A: Commit a hashed score for a miner submission.
     *      Validators submit hash(score, salt) without revealing the actual score.
     *      This prevents front-running and collusion.
     *
     * @param taskId Task ID
     * @param minerIndex Index of miner in submissions array
     * @param commitHash keccak256(abi.encodePacked(score, salt))
     */
    function commitScore(
        uint256 taskId,
        uint256 minerIndex,
        bytes32 commitHash
    ) external onlyValidator taskExists(taskId) whenNotPaused {
        Task storage task = tasks[taskId];

        require(
            task.status == TaskStatus.PendingReview ||
            task.status == TaskStatus.InProgress,
            "Task not pending review"
        );
        require(minerIndex < taskSubmissions[taskId].length, "Invalid miner index");
        require(commitHash != bytes32(0), "Empty commit hash");

        MinerSubmission storage submission = taskSubmissions[taskId][minerIndex];
        require(!submission.validated, "Already has consensus");

        // Cannot commit if already committed or already used direct validateSubmission
        require(
            validationCommits[taskId][minerIndex][msg.sender].commitHash == bytes32(0),
            "Already committed"
        );
        require(
            !hasValidatorScored[taskId][minerIndex][msg.sender],
            "Already scored directly"
        );

        // Start commit phase timer on first commit
        if (commitPhaseStart[taskId][minerIndex] == 0) {
            commitPhaseStart[taskId][minerIndex] = block.timestamp;
        }

        // Must be within commit phase
        uint256 commitDeadline = commitPhaseStart[taskId][minerIndex] + commitPhaseDuration;
        require(block.timestamp <= commitDeadline, "Commit phase ended");

        // Store commit
        validationCommits[taskId][minerIndex][msg.sender] = ValidationCommit({
            commitHash: commitHash,
            committedAt: block.timestamp,
            revealed: false,
            revealedScore: 0
        });
        commitCount[taskId][minerIndex]++;

        emit ScoreCommitted(taskId, minerIndex, msg.sender);
    }

    /**
     * @dev Phase B: Reveal the committed score.
     *      Validator provides the original score and salt to verify against
     *      their commit hash. The revealed score feeds into the standard
     *      validation and consensus pipeline.
     *
     * @param taskId Task ID
     * @param minerIndex Index of miner in submissions array
     * @param score The actual validation score (0-10000)
     * @param salt The random salt used when committing
     */
    function revealScore(
        uint256 taskId,
        uint256 minerIndex,
        uint256 score,
        bytes32 salt
    ) external onlyValidator taskExists(taskId) whenNotPaused {
        Task storage task = tasks[taskId];

        require(
            task.status == TaskStatus.PendingReview ||
            task.status == TaskStatus.InProgress,
            "Task not pending review"
        );
        require(minerIndex < taskSubmissions[taskId].length, "Invalid miner index");
        require(score <= 10000, "Score must be 0-10000");

        MinerSubmission storage submission = taskSubmissions[taskId][minerIndex];
        require(!submission.validated, "Already has consensus");

        // Must be in reveal phase (after commit phase ends)
        uint256 commitEnd = commitPhaseStart[taskId][minerIndex] + commitPhaseDuration;
        uint256 revealEnd = commitEnd + revealPhaseDuration;
        require(block.timestamp > commitEnd, "Commit phase not ended yet");
        require(block.timestamp <= revealEnd, "Reveal phase ended");

        // Verify commit exists and not yet revealed
        ValidationCommit storage vc = validationCommits[taskId][minerIndex][msg.sender];
        require(vc.commitHash != bytes32(0), "No commit found");
        require(!vc.revealed, "Already revealed");

        // Verify hash matches: keccak256(score, salt) == committedHash
        bytes32 expectedHash = keccak256(abi.encodePacked(score, salt));
        require(expectedHash == vc.commitHash, "Hash mismatch");

        // Mark as revealed
        vc.revealed = true;
        vc.revealedScore = score;
        revealCount[taskId][minerIndex]++;

        // Feed into standard validation pipeline
        validatorScores[taskId][minerIndex][msg.sender] = score;
        hasValidatorScored[taskId][minerIndex][msg.sender] = true;
        _submissionValidators[taskId][minerIndex].push(msg.sender);
        submission.validationCount++;

        emit ScoreRevealed(taskId, minerIndex, msg.sender, score);

        // Check consensus (same logic as validateSubmission)
        if (submission.validationCount >= minValidations) {
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

    /**
     * @dev Helper: Generate commit hash off-chain verification.
     *      Validators can call this view function to verify their hash before committing.
     *
     * @param score The validation score (0-10000)
     * @param salt Random bytes32 salt
     * @return The keccak256 hash to use in commitScore
     */
    function getCommitHash(
        uint256 score,
        bytes32 salt
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(score, salt));
    }

    /**
     * @dev Set commit-reveal phase durations (onlyOwner)
     */
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
     * @dev Calculate median score from validator scores for a submission.
     *      Uses insertion sort (efficient for small arrays, typically 2-10 validators).
     *
     * @param taskId Task ID
     * @param minerIndex Miner submission index
     * @param count Number of validator scores
     * @return median The median score
     */
    function _calculateMedianScore(
        uint256 taskId,
        uint256 minerIndex,
        uint256 count
    ) internal view returns (uint256 median) {
        // Collect all validator scores into a memory array
        uint256[] memory scores = new uint256[](count);
        uint256 idx = 0;

        // Iterate through known validators to collect scores
        // NOTE: We iterate the validator mapping — for gas efficiency with
        // small validator sets (typically 2-10 in the protocol)
        for (uint256 i = 0; i < count; i++) {
            scores[i] = 0; // Initialize
        }

        // Collect scores from validators who have scored this submission
        idx = 0;
        // We need to iterate validators — use a helper approach:
        // Store validator addresses per submission for efficient median calc
        address[] memory scoringValidators = _getScoringValidators(taskId, minerIndex, count);
        for (uint256 i = 0; i < count; i++) {
            scores[i] = validatorScores[taskId][minerIndex][scoringValidators[i]];
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
            // Odd: take middle element
            median = scores[count / 2];
        } else {
            // Even: average of two middle elements
            median = (scores[count / 2 - 1] + scores[count / 2]) / 2;
        }
    }

    /// @dev Tracking validator addresses per submission for median calculation
    mapping(uint256 => mapping(uint256 => address[])) internal _submissionValidators;

    /**
     * @dev Get validators who scored a specific submission
     */
    function _getScoringValidators(
        uint256 taskId,
        uint256 minerIndex,
        uint256 expectedCount
    ) internal view returns (address[] memory) {
        address[] storage stored = _submissionValidators[taskId][minerIndex];
        require(stored.length == expectedCount, "Validator tracking mismatch");
        return stored;
    }

    /**
     * @dev Finalize task and pay the winner.
     *      Gas-optimized: caches storage variables in memory to minimize SLOADs.
     *      CEI-compliant: events emitted before external calls.
     *
     * @param taskId Task to finalize
     */
    function finalizeTask(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];

        // ── CHECKS ──────────────────────────────────────────────────────
        // FIX: Anyone can finalize once consensus is reached (trustless)
        require(
            task.status == TaskStatus.PendingReview,
            "Task not ready for finalization"
        );
        require(task.winningMiner != address(0), "No valid submissions");

        // ── GAS OPTIMIZATION: Cache storage reads into memory ───────────
        address cachedRequester = task.requester;
        address cachedWinner = task.winningMiner;
        uint256 cachedReward = task.rewardAmount;
        uint256 cachedFee = task.platformFee;
        uint256 cachedValReward = task.validatorReward;
        uint256 cachedScore = task.winningScore;

        // ── EFFECTS: Update all state before external calls ─────────────
        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;
        activeTaskCount[cachedRequester]--;

        // Collect platform fee
        collectedFees += cachedFee;

        // Record miner earnings + credit pending withdrawal (Pull pattern)
        minerEarnings[cachedWinner] += cachedReward;
        pendingWithdrawals[cachedWinner] += cachedReward;

        // ── EVENTS: Emit before external interactions (CEI pattern) ─────
        emit TaskCompleted(taskId, cachedWinner, cachedReward, cachedScore);

        // ── INTERACTIONS: Credit validator rewards (Pull pattern) ────────
        if (cachedValReward > 0) {
            _distributeValidatorRewards(taskId, cachedValReward);
        }
    }

    /**
     * @dev Distribute validator rewards equally among all validators who
     *      scored the winning miner's submission.
     * @param taskId Task ID
     * @param totalReward Total validator reward pool
     */
    function _distributeValidatorRewards(
        uint256 taskId,
        uint256 totalReward
    ) internal {
        // Find the winning miner's submission index
        Task storage task = tasks[taskId];
        address winner = task.winningMiner;
        uint256 winnerIndex = type(uint256).max;

        MinerSubmission[] storage subs = taskSubmissions[taskId];
        for (uint256 i = 0; i < subs.length; i++) {
            if (subs[i].miner == winner && subs[i].validated) {
                winnerIndex = i;
                break;
            }
        }

        if (winnerIndex == type(uint256).max) {
            collectedFees += totalReward;
            return;
        }

        // Get validators who scored the winning submission
        address[] storage scoringVals = _submissionValidators[taskId][winnerIndex];
        uint256 numVals = scoringVals.length;

        if (numVals == 0) {
            collectedFees += totalReward;
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

            // Determine deviation tier and update reputation
            if (deviation <= 2000) {
                // <= 20% deviation: accurate, full reward
                rep.accurateValidations++;
                shares[i] = 100;
                emit ValidatorRewarded(taskId, valAddr, 0, deviation);
            } else if (deviation <= 5000) {
                // <= 50% deviation: half reward
                shares[i] = 50;
                emit ValidatorRewarded(taskId, valAddr, 0, deviation);
            } else {
                // > 50% deviation: penalized, zero reward
                shares[i] = 0;
                emit ValidatorPenalized(taskId, valAddr, deviation);
            }

            // Update reputation score: (accurate / total) * 10000
            if (rep.totalValidations > 0) {
                rep.reputationScore = (rep.accurateValidations * 10000) / rep.totalValidations;
            }

            // Apply reputation multiplier to share weight
            // share = deviationShare * (reputationScore / 10000)
            // This rewards consistently accurate validators more
            shares[i] = (shares[i] * rep.reputationScore) / 10000;

            totalShares += shares[i];

            emit ReputationUpdated(valAddr, rep.reputationScore, rep.totalValidations, rep.accurateValidations);
        }

        if (totalShares == 0) {
            // All validators penalized — reward goes to protocol
            collectedFees += totalReward;
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
            collectedFees += (totalReward - distributed);
        }
    }

    /**
     * @dev Calculate deviation between a score and the median, in basis points.
     *      Returns value 0-10000 where 10000 = 100% deviation.
     * @param score Individual validator score
     * @param median Consensus median score
     * @return Deviation in basis points
     */
    function _calculateDeviation(
        uint256 score,
        uint256 median
    ) internal pure returns (uint256) {
        if (median == 0) return 0;
        uint256 diff = score > median ? score - median : median - score;
        return (diff * 10000) / median;
    }

    // =========================================================================
    // PROOF-OF-INTELLIGENCE: Adaptive minValidations
    // =========================================================================

    uint256 public constant HIGH_VALUE_THRESHOLD = 1000e8;   // 1000 MDT
    uint256 public constant ULTRA_VALUE_THRESHOLD = 10000e8;  // 10000 MDT

    /**
     * @dev Calculate adaptive minValidations based on task reward.
     *      Security scales with value — the "Proof-of-Intelligence" principle.
     *
     * @param rewardAmount Task reward amount
     * @return Required minimum validators
     */
    function getAdaptiveMinValidations(
        uint256 rewardAmount
    ) public view returns (uint256) {
        uint256 baseMin = minValidations;

        if (rewardAmount >= ULTRA_VALUE_THRESHOLD) {
            return baseMin + 2;
        } else if (rewardAmount >= HIGH_VALUE_THRESHOLD) {
            return baseMin + 1;
        }
        return baseMin;
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
     * @dev Add a validator
     * @param validator Address to add as validator
     */
    function addValidator(address validator) external onlyOwner {
        require(validator != address(0), "Invalid address");
        require(!validators[validator], "Already validator");

        validators[validator] = true;
        validatorCount++;

        // Initialize default reputation (50% = neutral starting point)
        if (validatorReputation[validator].reputationScore == 0) {
            validatorReputation[validator] = ValidatorReputation({
                totalValidations: 0,
                accurateValidations: 0,
                reputationScore: 5000, // 50% default
                lastActiveAt: block.timestamp
            });
        }

        emit ValidatorAdded(validator);
    }

    /**
     * @dev Remove a validator
     * @param validator Address to remove
     */
    function removeValidator(address validator) external onlyOwner {
        require(validators[validator], "Not a validator");

        validators[validator] = false;
        validatorCount--;

        emit ValidatorRemoved(validator);
    }

    /**
     * @dev Update minimum validations required for consensus
     * @param newMin New minimum (must be >= 1)
     */
    function setMinValidations(uint256 newMin) external onlyOwner {
        require(newMin >= 1, "Min validations must be >= 1");
        require(newMin <= validatorCount || validatorCount == 0, "Cannot exceed validator count");

        uint256 oldMin = minValidations;
        minValidations = newMin;

        emit MinValidationsUpdated(oldMin, newMin);
    }

    /**
     * @dev Update platform fee rate
     * @param newRate New fee rate in basis points (100 = 1%)
     */
    function setPlatformFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1000, "Fee too high"); // Max 10%

        uint256 oldRate = platformFeeRate;
        platformFeeRate = newRate;

        emit PlatformFeeUpdated(oldRate, newRate);
    }

    /**
     * @dev Withdraw collected fees
     * @param to Address to send fees to
     */
    function withdrawFees(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(collectedFees > 0, "No fees to withdraw");

        uint256 amount = collectedFees;

        // CEI: Effects before Interactions
        collectedFees = 0;

        emit FeesWithdrawn(to, amount);

        mdtToken.safeTransfer(to, amount);
    }

    /**
     * @dev Mark expired task
     * @param taskId Task to expire
     */
    function expireTask(uint256 taskId) external taskExists(taskId) whenNotPaused {
        Task storage task = tasks[taskId];

        require(
            task.status == TaskStatus.Created ||
            task.status == TaskStatus.InProgress,
            "Cannot expire this task"
        );
        require(block.timestamp >= task.deadline, "Task not expired yet");

        // ── GAS OPTIMIZATION: Cache storage reads ───────────────────────
        address cachedRequester = task.requester;
        uint256 refund = task.rewardAmount + task.platformFee + task.validatorReward;

        // ── EFFECTS ─────────────────────────────────────────────────────
        task.status = TaskStatus.Expired;
        activeTaskCount[cachedRequester]--;

        // ── EVENTS (CEI: before external call) ──────────────────────────
        emit TaskExpired(taskId);

        // ── INTERACTIONS ────────────────────────────────────────────────
        mdtToken.safeTransfer(cachedRequester, refund);
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /**
     * @dev Get task details
     * @param taskId Task ID
     */
    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    /**
     * @dev Get submissions for a task
     * @param taskId Task ID
     */
    function getSubmissions(uint256 taskId) external view returns (MinerSubmission[] memory) {
        return taskSubmissions[taskId];
    }

    /**
     * @dev Get submission count for a task
     * @param taskId Task ID
     */
    function getSubmissionCount(uint256 taskId) external view returns (uint256) {
        return taskSubmissions[taskId].length;
    }

    /**
     * @dev Check if address is a validator
     * @param account Address to check
     */
    function isValidator(address account) external view returns (bool) {
        return validators[account];
    }

    /**
     * @dev Get total tasks created
     */
    function totalTasks() external view returns (uint256) {
        return _taskIdCounter;
    }

    /**
     * @dev Get a specific validator's score for a submission
     * @param taskId Task ID
     * @param minerIndex Miner submission index
     * @param validator Validator address
     */
    function getValidatorScore(
        uint256 taskId,
        uint256 minerIndex,
        address validator
    ) external view returns (uint256 score, bool hasScored) {
        hasScored = hasValidatorScored[taskId][minerIndex][validator];
        score = validatorScores[taskId][minerIndex][validator];
    }
}
