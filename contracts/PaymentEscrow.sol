// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PaymentEscrow
 * @dev Smart contract for ModernTensor payment escrow on Hedera
 *
 * This contract handles:
 * - Task deposits from requesters
 * - Payment distribution to miners based on AI validation scores
 * - Refunds for cancelled or failed tasks
 *
 * Flow:
 * 1. Requester creates task with MDT token deposit
 * 2. Miners submit results
 * 3. AI Validators score results (via HCS)
 * 4. Contract releases payment to top-scoring miner
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

    /// @dev Platform fee percentage (basis points, 100 = 1%)
    uint256 public platformFeeRate = 100; // 1%

    /// @dev Minimum task reward
    uint256 public minTaskReward = 1e8; // 1 MDT (8 decimals)

    /// @dev Maximum task duration
    uint256 public maxTaskDuration = 7 days;

    /// @dev Task counter for unique IDs
    uint256 private _taskIdCounter;

    /// @dev Validator registry (authorized AI validators)
    mapping(address => bool) public validators;
    uint256 public validatorCount;

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
        uint256 rewardAmount;       // MDT tokens locked for reward
        uint256 platformFee;        // Fee to be collected
        uint256 deadline;           // Task expiration timestamp
        TaskStatus status;          // Current status
        address assignedMiner;      // Miner who accepted (if any)
        address winningMiner;       // Miner who won (after validation)
        uint256 winningScore;       // Score of winning miner
        uint256 createdAt;          // Creation timestamp
        uint256 completedAt;        // Completion timestamp (if completed)
    }

    struct MinerSubmission {
        address miner;
        string resultHash;          // IPFS hash of result
        uint256 score;              // Validation score (0-10000, basis points)
        bool validated;             // Has been validated
        uint256 submittedAt;        // Submission timestamp
    }

    // =========================================================================
    // MAPPINGS
    // =========================================================================

    /// @dev Task ID => Task
    mapping(uint256 => Task) public tasks;

    /// @dev Task ID => Miner submissions
    mapping(uint256 => MinerSubmission[]) public taskSubmissions;

    /// @dev Requester => Active task count
    mapping(address => uint256) public activeTaskCount;

    /// @dev Miner => Total earnings
    mapping(address => uint256) public minerEarnings;

    /// @dev Collected platform fees
    uint256 public collectedFees;

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

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyValidator() {
        require(validators[msg.sender], "Not a validator");
        _;
    }

    modifier taskExists(uint256 taskId) {
        require(tasks[taskId].id == taskId, "Task not found");
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

        // Calculate platform fee
        uint256 fee = (rewardAmount * platformFeeRate) / 10000;
        uint256 totalDeposit = rewardAmount + fee;

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

        // Refund tokens
        uint256 refund = task.rewardAmount + task.platformFee;
        task.status = TaskStatus.Cancelled;
        activeTaskCount[msg.sender]--;

        mdtToken.safeTransfer(msg.sender, refund);

        emit TaskCancelled(taskId, msg.sender, refund);
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
            task.status == TaskStatus.InProgress,
            "Cannot submit to this task"
        );
        require(block.timestamp < task.deadline, "Task expired");
        require(bytes(resultHash).length > 0, "Empty result hash");

        // Add submission
        taskSubmissions[taskId].push(MinerSubmission({
            miner: msg.sender,
            resultHash: resultHash,
            score: 0,
            validated: false,
            submittedAt: block.timestamp
        }));

        // Update status
        if (task.status == TaskStatus.Created) {
            task.status = TaskStatus.PendingReview;
        }

        emit SubmissionReceived(taskId, msg.sender, resultHash);
    }

    // =========================================================================
    // VALIDATOR FUNCTIONS
    // =========================================================================

    /**
     * @dev Submit validation score for a miner's submission
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

        MinerSubmission storage submission = taskSubmissions[taskId][minerIndex];
        require(!submission.validated, "Already validated");

        submission.score = score;
        submission.validated = true;

        // Update winning miner if this score is highest
        if (score > task.winningScore) {
            task.winningScore = score;
            task.winningMiner = submission.miner;
        }

        emit SubmissionValidated(taskId, submission.miner, score, msg.sender);
    }

    /**
     * @dev Finalize task and pay the winner
     * @param taskId Task to finalize
     */
    function finalizeTask(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];

        require(
            task.status == TaskStatus.PendingReview,
            "Task not ready for finalization"
        );
        require(task.winningMiner != address(0), "No valid submissions");

        // Update task status
        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;
        activeTaskCount[task.requester]--;

        // Collect platform fee
        collectedFees += task.platformFee;

        // Pay winner
        minerEarnings[task.winningMiner] += task.rewardAmount;
        mdtToken.safeTransfer(task.winningMiner, task.rewardAmount);

        emit TaskCompleted(taskId, task.winningMiner, task.rewardAmount, task.winningScore);
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
        collectedFees = 0;

        mdtToken.safeTransfer(to, amount);

        emit FeesWithdrawn(to, amount);
    }

    /**
     * @dev Mark expired task
     * @param taskId Task to expire
     */
    function expireTask(uint256 taskId) external taskExists(taskId) {
        Task storage task = tasks[taskId];

        require(
            task.status == TaskStatus.Created ||
            task.status == TaskStatus.InProgress,
            "Cannot expire this task"
        );
        require(block.timestamp >= task.deadline, "Task not expired yet");

        task.status = TaskStatus.Expired;
        activeTaskCount[task.requester]--;

        // Refund requester
        uint256 refund = task.rewardAmount + task.platformFee;
        mdtToken.safeTransfer(task.requester, refund);

        emit TaskExpired(taskId);
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
}
