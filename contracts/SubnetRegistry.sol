// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SubnetRegistry
 * @dev ModernTensor Protocol - The Layer 0 for AI Economies on Hedera
 *
 * This contract manages:
 * - Subnet registration and configuration
 * - Protocol-level fee collection (1% tax on all subnets)
 * - Subnet owner fee management
 * - Cross-subnet task routing
 *
 * Architecture:
 * - Protocol Fee: 1% of ALL volume (goes to ModernTensor DAO)
 * - Subnet Fee: Custom % set by subnet owner (goes to subnet owner)
 * - Miner Reward: Remainder (goes to winning miner)
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

    /// @dev Protocol fee: 1% (100 basis points)
    uint256 public constant PROTOCOL_FEE_RATE = 100;

    /// @dev Maximum subnet fee: 20% (2000 basis points)
    uint256 public constant MAX_SUBNET_FEE_RATE = 2000;

    /// @dev Subnet registration cost (burned/locked)
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

    /// @dev Protocol treasury
    address public protocolTreasury;

    /// @dev Total protocol fees collected
    uint256 public totalProtocolFees;

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
        uint256 rewardAmount;
        uint256 protocolFee;            // 1% protocol fee
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
        uint256 score;
        bool validated;
        uint256 submittedAt;
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

    /// @dev Subnet ID => Miner addresses
    mapping(uint256 => mapping(address => bool)) public subnetMiners;

    /// @dev Subnet ID => Miner count
    mapping(uint256 => uint256) public subnetMinerCount;

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

    event TaskCreated(
        uint256 indexed taskId,
        uint256 indexed subnetId,
        address indexed requester,
        uint256 rewardAmount
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

        // Burn/lock registration cost
        mdtToken.safeTransferFrom(msg.sender, address(this), SUBNET_REGISTRATION_COST);

        subnetId = _createSubnet(name, description, msg.sender, feeRate);
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

        // Calculate fees
        uint256 protocolFee = (rewardAmount * PROTOCOL_FEE_RATE) / 10000;
        uint256 subnetFee = (rewardAmount * subnet.feeRate) / 10000;
        uint256 totalDeposit = rewardAmount + protocolFee + subnetFee;

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
     * @dev Submit result for a task
     */
    function submitResult(
        uint256 taskId,
        string calldata resultHash
    ) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created || task.status == TaskStatus.InProgress, "Cannot submit");
        require(block.timestamp < task.deadline, "Task expired");
        require(subnetMiners[task.subnetId][msg.sender], "Not registered in subnet");

        taskSubmissions[taskId].push(MinerSubmission({
            miner: msg.sender,
            resultHash: resultHash,
            score: 0,
            validated: false,
            submittedAt: block.timestamp
        }));

        task.status = TaskStatus.PendingReview;
    }

    /**
     * @dev Validate a submission (validator only)
     */
    function validateSubmission(
        uint256 taskId,
        uint256 submissionIndex,
        uint256 score
    ) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.PendingReview, "Not pending review");
        require(subnetValidators[task.subnetId][msg.sender], "Not a validator");
        require(score <= 10000, "Invalid score");

        MinerSubmission storage submission = taskSubmissions[taskId][submissionIndex];
        require(!submission.validated, "Already validated");

        submission.score = score;
        submission.validated = true;

        // Update winning miner if this is the highest score
        if (score > task.winningScore) {
            task.winningScore = score;
            task.winningMiner = submission.miner;
        }
    }

    /**
     * @dev Finalize task and distribute payments
     */
    function finalizeTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.PendingReview, "Not ready");
        require(task.winningMiner != address(0), "No winner");

        task.status = TaskStatus.Completed;

        Subnet storage subnet = subnets[task.subnetId];
        subnet.totalVolume += task.rewardAmount;
        subnet.totalTasks++;

        // Distribute payments
        // 1. Protocol fee to treasury
        totalProtocolFees += task.protocolFee;

        // 2. Subnet fee to subnet owner
        mdtToken.safeTransfer(subnet.owner, task.subnetFee);

        // 3. Reward to winning miner
        mdtToken.safeTransfer(task.winningMiner, task.rewardAmount);

        emit TaskCompleted(
            taskId,
            task.subnetId,
            task.winningMiner,
            task.rewardAmount,
            task.protocolFee,
            task.subnetFee
        );
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /**
     * @dev Add validator to a subnet
     */
    function addValidator(uint256 subnetId, address validator) external {
        require(msg.sender == subnets[subnetId].owner || msg.sender == owner(), "Not authorized");
        subnetValidators[subnetId][validator] = true;
    }

    /**
     * @dev Withdraw protocol fees to treasury
     */
    function withdrawProtocolFees() external {
        uint256 amount = totalProtocolFees;
        require(amount > 0, "No fees");

        totalProtocolFees = 0;
        mdtToken.safeTransfer(protocolTreasury, amount);

        emit ProtocolFeesWithdrawn(protocolTreasury, amount);
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
     * @dev Check if address is miner in subnet
     */
    function isMiner(uint256 subnetId, address miner) external view returns (bool) {
        return subnetMiners[subnetId][miner];
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
