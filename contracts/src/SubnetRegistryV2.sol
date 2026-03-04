// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SubnetRegistryV2
 * @dev ModernTensor Protocol V2 — Integrated with StakingVaultV2
 *
 * Features:
 *   1. registerMiner/addValidator CHECK StakingVaultV2.isMiner/isValidator
 *   2. finalizeTask sends 5% to StakingVaultV2.depositRewards() for passive stakers
 *   3. Updated fee split: Miner 85%, Validators 8%, Staking Pool 5%, Protocol 2%
 *   4. Validator Reputation: deviation-based scoring, accuracy tracking, weighted rewards
 *   5. Cross-Subnet Reputation Portability with 50% decay
 *   6. Adaptive minValidations: high-value tasks require more validators
 *
 * For ModernTensor on Hedera — Hello Future Hackathon 2026
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./ValidationLib.sol";

interface IStakingVaultV2 {
    function isMiner(address user) external view returns (bool);
    function isValidator(address user) external view returns (bool);
    function isStaked(address user) external view returns (bool);
    function getStakeAmount(address user) external view returns (uint256);
    function depositRewards(uint256 amount) external;
}

contract SubnetRegistryV2 is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // CONSTANTS — Updated Fee Split
    // =========================================================================

    uint256 public constant PROTOCOL_FEE_RATE = 200; // 2%
    uint256 public constant VALIDATOR_REWARD_RATE = 800; // 8%
    uint256 public constant STAKING_POOL_RATE = 500; // 5%
    // Miner gets remainder: 100% - 2% - 8% - 5% - subnetFee = ~85%
    uint256 public constant MAX_SUBNET_FEE_RATE = 1000; // 10% max
    uint256 public constant SUBNET_REGISTRATION_COST = 1000 * 1e8; // 1,000 MDT

    // =========================================================================
    // STATE
    // =========================================================================

    IERC20 public mdtToken;
    IStakingVaultV2 public stakingVault;
    address public protocolTreasury;

    uint256 public subnetCount;
    uint256 private _taskIdCounter;
    uint256 public maxSubmissionsPerTask = 10;
    uint256 public totalProtocolFees;

    mapping(uint256 => uint256) public subnetMinValidations;

    // ── Structs ──

    enum SubnetStatus {
        Active,
        Paused,
        Deprecated
    }

    struct Subnet {
        uint256 id;
        string name;
        string description;
        address owner;
        uint256 feeRate; // basis points
        uint256 minTaskReward;
        uint256 totalVolume;
        uint256 totalTasks;
        uint256 activeMiners;
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
        uint256 subnetId;
        address requester;
        string taskHash;
        uint256 totalDeposit; // total MDT deposited
        uint256 rewardAmount; // miner reward (85%)
        uint256 protocolFee; // 2%
        uint256 validatorReward; // 8%
        uint256 stakingPoolFee; // 5% → StakingVaultV2
        uint256 subnetFee; // subnet owner
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
        uint256 validationCount;
    }

    // ── Validator Reputation ──

    struct ValidatorReputation {
        uint256 totalValidations; // Total times participated in consensus
        uint256 accurateValidations; // Times within 20% of median
        uint256 reputationScore; // = accurate / total * 10000 (basis points)
        uint256 lastActiveAt; // Last activity timestamp
    }

    // ── Reputation Portability ──

    uint256 public constant REPUTATION_DECAY_FACTOR = 5000; // 50% decay for ported reputation
    uint256 public constant PORT_COOLDOWN = 1 days;

    // ── Adaptive Validation ──

    uint256 public constant HIGH_VALUE_THRESHOLD = 1000 * 1e8; // 1000 MDT
    uint256 public constant ULTRA_VALUE_THRESHOLD = 10000 * 1e8; // 10000 MDT

    // ── Mappings ──

    mapping(uint256 => Subnet) public subnets;
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => MinerSubmission[]) public taskSubmissions;
    mapping(uint256 => mapping(address => bool)) public subnetValidators;
    mapping(uint256 => uint256) public subnetValidatorCount;
    mapping(uint256 => mapping(address => bool)) public subnetMiners;
    mapping(uint256 => uint256) public subnetMinerCount;
    mapping(uint256 => mapping(address => bool)) public hasMinerSubmitted;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256)))
        public validatorScores;
    mapping(uint256 => mapping(uint256 => mapping(address => bool)))
        public hasValidatorScored;
    mapping(uint256 => mapping(uint256 => address[]))
        internal _submissionValidators;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(address => ValidatorReputation) public validatorReputation;
    mapping(address => uint256) public validatorEarnings;
    mapping(address => uint256) public minerEarnings;
    mapping(address => mapping(uint256 => uint256))
        public portedReputationBoost;
    mapping(address => uint256) public lastPortedAt;

    // ── Events ──

    event SubnetCreated(
        uint256 indexed subnetId,
        string name,
        address indexed owner,
        uint256 feeRate
    );
    event MinerRegistered(uint256 indexed subnetId, address indexed miner);
    event ValidatorAdded(uint256 indexed subnetId, address indexed validator);
    event ValidatorRemoved(uint256 indexed subnetId, address indexed validator);
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
        uint256 stakingPoolFee
    );
    event EarningsWithdrawn(address indexed account, uint256 amount);
    event StakingPoolFunded(uint256 indexed taskId, uint256 amount);
    event ValidatorRewarded(
        uint256 indexed taskId,
        address indexed validator,
        uint256 reward,
        uint256 deviation
    );
    event ValidatorPenalized(
        uint256 indexed taskId,
        address indexed validator,
        uint256 deviation
    );
    event ReputationUpdated(
        address indexed validator,
        uint256 score,
        uint256 totalValidations,
        uint256 accurateValidations
    );
    event ReputationPorted(
        address indexed validator,
        uint256 fromSubnet,
        uint256 toSubnet,
        uint256 portedScore
    );

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _mdtToken, address _treasury, address _stakingVault) {
        require(_mdtToken != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        require(_stakingVault != address(0), "Invalid staking vault");
        mdtToken = IERC20(_mdtToken);
        protocolTreasury = _treasury;
        stakingVault = IStakingVaultV2(_stakingVault);
    }

    // =========================================================================
    // SUBNET MANAGEMENT
    // =========================================================================

    function registerSubnet(
        string calldata name,
        string calldata description,
        uint256 feeRate
    ) external nonReentrant whenNotPaused returns (uint256 subnetId) {
        require(feeRate <= MAX_SUBNET_FEE_RATE, "Fee too high");
        require(bytes(name).length > 0, "Empty name");

        // Stake registration cost
        mdtToken.safeTransferFrom(
            msg.sender,
            address(this),
            SUBNET_REGISTRATION_COST
        );

        subnetId = subnetCount++;
        subnets[subnetId] = Subnet({
            id: subnetId,
            name: name,
            description: description,
            owner: msg.sender,
            feeRate: feeRate,
            minTaskReward: 1e8,
            totalVolume: 0,
            totalTasks: 0,
            activeMiners: 0,
            status: SubnetStatus.Active,
            createdAt: block.timestamp
        });

        subnetMinValidations[subnetId] = 2;
        emit SubnetCreated(subnetId, name, msg.sender, feeRate);
    }

    // =========================================================================
    // MINER REGISTRATION — REQUIRES StakingVaultV2 STAKE (FIX C2)
    // =========================================================================

    function registerMiner(uint256 subnetId) external {
        require(
            subnets[subnetId].status == SubnetStatus.Active,
            "Subnet not active"
        );
        require(!subnetMiners[subnetId][msg.sender], "Already registered");

        // ✅ FIX C2: Verify miner has staked in StakingVaultV2
        require(
            stakingVault.isMiner(msg.sender),
            "Must stake as Miner in StakingVault first"
        );

        subnetMiners[subnetId][msg.sender] = true;
        subnetMinerCount[subnetId]++;
        subnets[subnetId].activeMiners++;

        emit MinerRegistered(subnetId, msg.sender);
    }

    function addValidator(uint256 subnetId, address validator) external {
        require(
            msg.sender == subnets[subnetId].owner || msg.sender == owner(),
            "Not authorized"
        );
        require(validator != address(0), "Invalid address");
        require(!subnetValidators[subnetId][validator], "Already validator");

        // ✅ Verify validator has staked in StakingVaultV2
        require(
            stakingVault.isValidator(validator),
            "Must stake as Validator in StakingVault first"
        );

        subnetValidators[subnetId][validator] = true;
        subnetValidatorCount[subnetId]++;

        // Initialize reputation (50% = neutral starting point)
        if (
            validatorReputation[validator].reputationScore == 0 &&
            validatorReputation[validator].totalValidations == 0
        ) {
            validatorReputation[validator] = ValidatorReputation({
                totalValidations: 0,
                accurateValidations: 0,
                reputationScore: 5000,
                lastActiveAt: block.timestamp
            });
        }

        emit ValidatorAdded(subnetId, validator);
    }

    function removeValidator(uint256 subnetId, address validator) external {
        require(
            msg.sender == subnets[subnetId].owner || msg.sender == owner(),
            "Not authorized"
        );
        require(subnetValidators[subnetId][validator], "Not a validator");
        subnetValidators[subnetId][validator] = false;
        subnetValidatorCount[subnetId]--;
        emit ValidatorRemoved(subnetId, validator);
    }

    // =========================================================================
    // TASK MANAGEMENT
    // =========================================================================

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

        // Calculate fees: 2% protocol + 8% validator + 5% staking pool + subnet fee
        uint256 protocolFee = (rewardAmount * PROTOCOL_FEE_RATE) / 10000;
        uint256 valReward = (rewardAmount * VALIDATOR_REWARD_RATE) / 10000;
        uint256 stakingFee = (rewardAmount * STAKING_POOL_RATE) / 10000;
        uint256 subnetFee = (rewardAmount * subnet.feeRate) / 10000;
        uint256 totalDeposit = rewardAmount +
            protocolFee +
            valReward +
            stakingFee +
            subnetFee;

        mdtToken.safeTransferFrom(msg.sender, address(this), totalDeposit);

        taskId = ++_taskIdCounter;
        tasks[taskId] = Task({
            id: taskId,
            subnetId: subnetId,
            requester: msg.sender,
            taskHash: taskHash,
            totalDeposit: totalDeposit,
            rewardAmount: rewardAmount,
            protocolFee: protocolFee,
            validatorReward: valReward,
            stakingPoolFee: stakingFee,
            subnetFee: subnetFee,
            deadline: block.timestamp + duration,
            status: TaskStatus.Created,
            winningMiner: address(0),
            winningScore: 0,
            createdAt: block.timestamp
        });

        emit TaskCreated(taskId, subnetId, msg.sender, rewardAmount);
    }

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
        require(
            subnetMiners[task.subnetId][msg.sender],
            "Not registered in subnet"
        );
        require(!hasMinerSubmitted[taskId][msg.sender], "Already submitted");
        require(
            taskSubmissions[taskId].length < maxSubmissionsPerTask,
            "Max submissions"
        );

        hasMinerSubmitted[taskId][msg.sender] = true;
        taskSubmissions[taskId].push(
            MinerSubmission({
                miner: msg.sender,
                resultHash: resultHash,
                score: 0,
                validated: false,
                submittedAt: block.timestamp,
                validationCount: 0
            })
        );

        if (task.status == TaskStatus.Created) {
            task.status = TaskStatus.PendingReview;
        }

        emit SubmissionReceived(taskId, msg.sender, resultHash);
    }

    function expireTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.Created ||
                task.status == TaskStatus.InProgress ||
                task.status == TaskStatus.PendingReview,
            "Not expirable"
        );
        require(block.timestamp > task.deadline, "Not yet expired");

        uint256 refund = task.totalDeposit;
        task.status = TaskStatus.Expired;
        mdtToken.safeTransfer(task.requester, refund);
    }

    // =========================================================================
    // VALIDATION — Multi-Validator Consensus
    // =========================================================================

    function validateSubmission(
        uint256 taskId,
        uint256 submissionIndex,
        uint256 score
    ) external {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.PendingReview, "Not pending review");
        require(subnetValidators[task.subnetId][msg.sender], "Not a validator");
        require(
            submissionIndex < taskSubmissions[taskId].length,
            "Invalid index"
        );
        require(score <= 10000, "Invalid score");
        require(
            !hasValidatorScored[taskId][submissionIndex][msg.sender],
            "Already scored"
        );

        MinerSubmission storage submission = taskSubmissions[taskId][
            submissionIndex
        ];
        require(!submission.validated, "Already has consensus");

        validatorScores[taskId][submissionIndex][msg.sender] = score;
        hasValidatorScored[taskId][submissionIndex][msg.sender] = true;
        _submissionValidators[taskId][submissionIndex].push(msg.sender);
        submission.validationCount++;

        emit SubmissionValidated(taskId, submission.miner, score, msg.sender);

        uint256 minVals = getAdaptiveMinValidations(
            task.subnetId,
            task.rewardAmount
        );

        if (submission.validationCount >= minVals) {
            uint256 medianScore = _calculateMedianScore(
                taskId,
                submissionIndex,
                submission.validationCount
            );
            submission.score = medianScore;
            submission.validated = true;

            if (medianScore > task.winningScore) {
                task.winningScore = medianScore;
                task.winningMiner = submission.miner;
            }

            emit ConsensusReached(
                taskId,
                submissionIndex,
                medianScore,
                submission.validationCount
            );
        }
    }

    // =========================================================================
    // FINALIZE — With Staking Pool Funding (FIX C3)
    // =========================================================================

    function finalizeTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.PendingReview, "Not ready");
        require(task.winningMiner != address(0), "No winner");

        // Cache
        address winner = task.winningMiner;
        uint256 reward = task.rewardAmount;
        uint256 pFee = task.protocolFee;
        uint256 vReward = task.validatorReward;
        uint256 sFee = task.stakingPoolFee;
        uint256 subFee = task.subnetFee;
        uint256 sid = task.subnetId;

        // Effects
        task.status = TaskStatus.Completed;
        subnets[sid].totalVolume += reward;
        subnets[sid].totalTasks++;
        totalProtocolFees += pFee;

        // Miner reward (pull pattern)
        pendingWithdrawals[winner] += reward;

        // Subnet fee (pull pattern)
        if (subFee > 0) {
            pendingWithdrawals[subnets[sid].owner] += subFee;
        }

        // Validator rewards (stake × reputation × deviation weighted)
        if (vReward > 0) {
            _distributeValidatorRewards(taskId, vReward);
        }

        emit TaskCompleted(taskId, sid, winner, reward, pFee, sFee);

        // ✅ FIX C3: Fund StakingVaultV2 reward pool for passive stakers
        if (sFee > 0) {
            mdtToken.approve(address(stakingVault), sFee);
            stakingVault.depositRewards(sFee);
            emit StakingPoolFunded(taskId, sFee);
        }
    }

    /**
     * @dev Distribute validator rewards based on:
     *   share = deviation_weight × (reputationScore / 10000) × stakeAmount
     *
     * This means:
     *   - Accurate validators (deviation ≤20%) get higher weight
     *   - Higher reputation score → higher weight
     *   - More tokens staked → proportionally more reward
     *   - All three factors multiply together
     */
    function _distributeValidatorRewards(
        uint256 taskId,
        uint256 totalReward
    ) internal {
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
            totalProtocolFees += totalReward;
            return;
        }

        address[] storage scoringVals = _submissionValidators[taskId][
            winnerIndex
        ];
        uint256 numVals = scoringVals.length;

        if (numVals == 0) {
            totalProtocolFees += totalReward;
            return;
        }

        uint256 medianScore = subs[winnerIndex].score;

        // ── Calculate shares: deviation_weight × reputation × stakeAmount ──
        uint256[] memory shares = new uint256[](numVals);
        uint256 totalShares = 0;

        for (uint256 i = 0; i < numVals; i++) {
            address valAddr = scoringVals[i];
            uint256 vScore = validatorScores[taskId][winnerIndex][valAddr];
            uint256 deviation = _calculateDeviation(vScore, medianScore);

            // Update reputation
            ValidatorReputation storage rep = validatorReputation[valAddr];
            rep.totalValidations++;
            rep.lastActiveAt = block.timestamp;

            // Deviation weight: accurate=100, partial=50, penalized=0
            uint256 devWeight;
            if (deviation <= 2000) {
                rep.accurateValidations++;
                devWeight = 100;
                emit ValidatorRewarded(taskId, valAddr, 0, deviation);
            } else if (deviation <= 5000) {
                devWeight = 50;
                emit ValidatorRewarded(taskId, valAddr, 0, deviation);
            } else {
                devWeight = 0;
                emit ValidatorPenalized(taskId, valAddr, deviation);
            }

            // Update reputation score
            if (rep.totalValidations > 0) {
                rep.reputationScore =
                    (rep.accurateValidations * 10000) /
                    rep.totalValidations;
            }

            // Get stake amount from StakingVaultV2
            uint256 stakeAmt = stakingVault.getStakeAmount(valAddr);
            if (stakeAmt == 0) stakeAmt = 1; // fallback: prevent zero

            // Check for ported reputation boost (cross-subnet portability)
            uint256 effectiveRep = rep.reputationScore;
            uint256 portedBoost = portedReputationBoost[valAddr][task.subnetId];
            if (portedBoost > effectiveRep) {
                effectiveRep = portedBoost; // Use ported score if higher
            }

            // Final share = devWeight × (effectiveRep / 10000) × stakeAmount
            shares[i] = (devWeight * effectiveRep * stakeAmt) / 10000;
            totalShares += shares[i];

            emit ReputationUpdated(
                valAddr,
                rep.reputationScore,
                rep.totalValidations,
                rep.accurateValidations
            );
        }

        if (totalShares == 0) {
            totalProtocolFees += totalReward;
            return;
        }

        // Distribute proportionally
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

    function _calculateDeviation(
        uint256 score,
        uint256 median
    ) internal pure returns (uint256) {
        return ValidationLib.calculateDeviation(score, median);
    }

    function _calculateMedianScore(
        uint256 taskId,
        uint256 minerIndex,
        uint256 count
    ) internal view returns (uint256) {
        uint256[] memory scores = new uint256[](count);
        address[] storage scoringVals = _submissionValidators[taskId][
            minerIndex
        ];

        for (uint256 i = 0; i < count; i++) {
            scores[i] = validatorScores[taskId][minerIndex][scoringVals[i]];
        }

        return ValidationLib.sortAndMedian(scores);
    }

    // =========================================================================
    // WITHDRAWALS
    // =========================================================================

    function withdrawEarnings() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending earnings");
        pendingWithdrawals[msg.sender] = 0;
        emit EarningsWithdrawn(msg.sender, amount);
        mdtToken.safeTransfer(msg.sender, amount);
    }

    function withdrawProtocolFees() external onlyOwner {
        uint256 amount = totalProtocolFees;
        require(amount > 0, "No fees");
        totalProtocolFees = 0;
        mdtToken.safeTransfer(protocolTreasury, amount);
    }

    // =========================================================================
    // REPUTATION PORTABILITY — Cross-Subnet
    // =========================================================================

    /**
     * @dev Port reputation from one subnet context to boost starting reputation.
     *      Validators who proved themselves in Subnet A bring 50% reputation to Subnet B.
     *      Unique to ModernTensor — cross-domain AI validator reputation portability.
     */
    function portReputation(uint256 fromSubnetId, uint256 toSubnetId) external {
        require(
            subnetValidators[fromSubnetId][msg.sender],
            "Not validator in source subnet"
        );
        require(
            subnetValidators[toSubnetId][msg.sender],
            "Not validator in target subnet"
        );
        require(fromSubnetId != toSubnetId, "Same subnet");
        require(
            block.timestamp >= lastPortedAt[msg.sender] + PORT_COOLDOWN,
            "Port cooldown active"
        );

        ValidatorReputation storage rep = validatorReputation[msg.sender];
        require(rep.totalValidations > 0, "No reputation to port");

        uint256 portedScore = (rep.reputationScore * REPUTATION_DECAY_FACTOR) /
            10000;
        require(portedScore >= 5000, "Ported score not better than default");

        portedReputationBoost[msg.sender][toSubnetId] = portedScore;
        lastPortedAt[msg.sender] = block.timestamp;

        emit ReputationPorted(
            msg.sender,
            fromSubnetId,
            toSubnetId,
            portedScore
        );
    }

    // =========================================================================
    // ADAPTIVE VALIDATION — Value-based security scaling
    // =========================================================================

    /**
     * @dev Higher-value tasks require more validators for increased security.
     *   reward < 1000 MDT  → base minValidations (e.g. 2)
     *   reward >= 1000 MDT  → base + 1
     *   reward >= 10000 MDT → base + 2
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

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function getSubnet(uint256 id) external view returns (Subnet memory) {
        return subnets[id];
    }
    function getTask(uint256 id) external view returns (Task memory) {
        return tasks[id];
    }
    function getSubmissions(
        uint256 id
    ) external view returns (MinerSubmission[] memory) {
        return taskSubmissions[id];
    }
    function getSubmissionCount(uint256 id) external view returns (uint256) {
        return taskSubmissions[id].length;
    }
    function isMiner(uint256 sid, address m) external view returns (bool) {
        return subnetMiners[sid][m];
    }
    function isValidator(uint256 sid, address v) external view returns (bool) {
        return subnetValidators[sid][v];
    }

    function getValidatorReputation(
        address v
    )
        external
        view
        returns (
            uint256 totalValidations,
            uint256 accurateValidations,
            uint256 reputationScore,
            uint256 lastActiveAt
        )
    {
        ValidatorReputation storage rep = validatorReputation[v];
        return (
            rep.totalValidations,
            rep.accurateValidations,
            rep.reputationScore,
            rep.lastActiveAt
        );
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    function setProtocolTreasury(address t) external onlyOwner {
        protocolTreasury = t;
    }
    function setStakingVault(address v) external onlyOwner {
        stakingVault = IStakingVaultV2(v);
    }
    function setMinValidations(uint256 sid, uint256 min) external onlyOwner {
        subnetMinValidations[sid] = min;
    }
    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }
}
