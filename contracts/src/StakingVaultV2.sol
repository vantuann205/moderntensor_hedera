// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title StakingVaultV2
 * @dev ModernTensor Staking — Hedera HTS Compatible
 *
 * Hedera HTS tokens cannot be transferred via EVM transferFrom/transfer from contracts.
 * Solution: deposit-tracking pattern
 *   1. User sends MDT to vault via Hedera SDK TransferTransaction (native HTS)
 *   2. Owner calls recordDeposit(user, amount) to credit the deposit on-chain
 *   3. User calls stake(amount, role) — deducts from pendingDeposit
 *
 * Reg fee is deducted from deposit and tracked as burned (not actually sent to 0xdead
 * since HTS transfer from contract is not supported — fee is simply locked in vault).
 *
 * For ModernTensor on Hedera — Hello Future Hackathon 2026
 */

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract StakingVaultV2 is ReentrancyGuard, Ownable, Pausable {

    // =========================================================================
    // ENUMS & STRUCTS
    // =========================================================================

    enum StakeRole { None, Miner, Validator, Holder }

    struct StakeInfo {
        uint256 amount;
        StakeRole role;
        uint256 stakedAt;
        uint256 unstakeRequestedAt;
        bool isActive;
        uint256 rewardDebt;
    }

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    address public constant BURN_ADDRESS = address(0xdEaD);

    // =========================================================================
    // STATE: Token & Deposits
    // =========================================================================

    address public mdtToken; // HTS token address (read-only, for reference)

    /// @dev MDT credited to each user after Hedera SDK transfer to vault
    mapping(address => uint256) public pendingDeposit;

    // =========================================================================
    // STATE: Staking
    // =========================================================================

    uint256 public minMinerStake     = 10  * 1e8;  // 10 MDT
    uint256 public minValidatorStake = 500 * 1e8;  // 500 MDT
    uint256 public minHolderStake    = 1   * 1e8;  // 1 MDT
    uint256 public unstakeCooldown   = 7 days;

    uint256 public totalStaked;
    uint256 public totalSlashed;

    mapping(address => StakeInfo) public stakes;

    uint256 public activeMinerCount;
    uint256 public activeValidatorCount;
    uint256 public activeHolderCount;

    // =========================================================================
    // STATE: Dynamic Registration Fee (EIP-1559 Style)
    // =========================================================================

    uint256 public regBaseFee      = 5 * 1e8;    // 5 MDT initial
    uint256 public regFeeFloor     = 1 * 1e8;    // 1 MDT min
    uint256 public regFeeCeiling   = 500 * 1e8;  // 500 MDT max
    uint256 public decayInterval   = 1 hours;
    uint256 public lastRegTimestamp;
    uint256 public totalFeesBurned;
    uint256 public feeBumpNumerator   = 1;
    uint256 public feeBumpDenominator = 8;

    // =========================================================================
    // STATE: Reward Pool
    // =========================================================================

    uint256 public accRewardPerShare;
    uint256 public totalRewardsDeposited;
    uint256 public totalRewardsClaimed;
    uint256 private constant REWARD_PRECISION = 1e18;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event DepositRecorded(address indexed user, uint256 amount);
    event Staked(address indexed user, uint256 amount, StakeRole role, uint256 regFeePaid);
    event UnstakeRequested(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Slashed(address indexed user, uint256 amount, string reason);
    event StakeIncreased(address indexed user, uint256 additionalAmount, uint256 newTotal);
    event RegFeeBurned(address indexed user, uint256 feeAmount, uint256 newBaseFee);
    event RewardDeposited(uint256 amount, uint256 newAccPerShare);
    event RewardClaimed(address indexed user, uint256 amount);

    event MinMinerStakeUpdated(uint256 oldValue, uint256 newValue);
    event MinValidatorStakeUpdated(uint256 oldValue, uint256 newValue);
    event MinHolderStakeUpdated(uint256 oldValue, uint256 newValue);
    event UnstakeCooldownUpdated(uint256 oldValue, uint256 newValue);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _mdtToken) {
        require(_mdtToken != address(0), "Invalid token address");
        mdtToken = _mdtToken;
        lastRegTimestamp = block.timestamp;
    }

    // =========================================================================
    // DEPOSIT RECORDING (called by owner/backend after Hedera SDK transfer)
    // =========================================================================

    /**
     * @dev Record MDT deposit for a user after they sent tokens via Hedera SDK.
     * Only owner can call this (backend relayer confirms the Hedera transfer).
     */
    function recordDeposit(address user, uint256 amount) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(amount > 0, "Amount must be > 0");
        pendingDeposit[user] += amount;
        emit DepositRecorded(user, amount);
    }

    /**
     * @dev Batch record deposits for multiple users.
     */
    function recordDepositBatch(address[] calldata users, uint256[] calldata amounts) external onlyOwner {
        require(users.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            pendingDeposit[users[i]] += amounts[i];
            emit DepositRecorded(users[i], amounts[i]);
        }
    }

    // =========================================================================
    // DYNAMIC REGISTRATION FEE
    // =========================================================================

    function getCurrentRegFee() public view returns (uint256) {
        uint256 fee = regBaseFee;
        if (lastRegTimestamp == 0) return fee;
        uint256 elapsed = block.timestamp - lastRegTimestamp;
        uint256 halvings = elapsed / decayInterval;
        if (halvings > 20) halvings = 20;
        fee = fee >> halvings;
        if (fee < regFeeFloor) fee = regFeeFloor;
        return fee;
    }

    // =========================================================================
    // STAKING
    // =========================================================================

    /**
     * @dev Stake MDT for a role.
     *
     * Prerequisites:
     *   1. User sent (regFee + amount) MDT to vault via Hedera SDK
     *   2. Owner called recordDeposit(user, regFee + amount)
     *   3. User calls stake(amount, role)
     *
     * @param amount Amount to stake (refundable after cooldown)
     * @param role   Miner=1, Validator=2, Holder=3
     */
    function stake(uint256 amount, StakeRole role) external nonReentrant whenNotPaused {
        require(
            role == StakeRole.Miner || role == StakeRole.Validator || role == StakeRole.Holder,
            "Invalid role"
        );
        require(amount > 0, "Amount must be > 0");

        StakeInfo storage info = stakes[msg.sender];

        if (info.isActive) {
            // Increase existing stake (no reg fee)
            require(info.role == role, "Cannot change role while staked");
            require(info.unstakeRequestedAt == 0, "Unstake in progress");
            require(pendingDeposit[msg.sender] >= amount, "Insufficient deposit");

            _claimRewards(msg.sender);
            pendingDeposit[msg.sender] -= amount;
            info.amount += amount;
            totalStaked += amount;
            info.rewardDebt = (info.amount * accRewardPerShare) / REWARD_PRECISION;
            emit StakeIncreased(msg.sender, amount, info.amount);
            return;
        }

        // New stake
        uint256 minStake;
        if (role == StakeRole.Validator)     { minStake = minValidatorStake; }
        else if (role == StakeRole.Miner)    { minStake = minMinerStake; }
        else                                  { minStake = minHolderStake; }
        require(amount >= minStake, "Below minimum stake");

        uint256 regFee = getCurrentRegFee();
        uint256 totalNeeded = regFee + amount;
        require(pendingDeposit[msg.sender] >= totalNeeded, "Insufficient deposit - send MDT to vault first");

        // Deduct from deposit
        pendingDeposit[msg.sender] -= totalNeeded;

        // Reg fee is locked in vault (burned conceptually — HTS transfer from contract not supported)
        totalFeesBurned += regFee;

        // Bump base fee EIP-1559 style
        regBaseFee = regBaseFee + ((regBaseFee * feeBumpNumerator) / feeBumpDenominator);
        if (regBaseFee > regFeeCeiling) regBaseFee = regFeeCeiling;
        lastRegTimestamp = block.timestamp;
        emit RegFeeBurned(msg.sender, regFee, regBaseFee);

        stakes[msg.sender] = StakeInfo({
            amount: amount,
            role: role,
            stakedAt: block.timestamp,
            unstakeRequestedAt: 0,
            isActive: true,
            rewardDebt: (amount * accRewardPerShare) / REWARD_PRECISION
        });
        totalStaked += amount;

        if (role == StakeRole.Miner)          { activeMinerCount++; }
        else if (role == StakeRole.Validator) { activeValidatorCount++; }
        else                                   { activeHolderCount++; }

        emit Staked(msg.sender, amount, role, regFee);
    }

    // =========================================================================
    // UNSTAKING
    // =========================================================================

    function requestUnstake() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        require(info.isActive, "Not staked");
        require(info.unstakeRequestedAt == 0, "Already requested");

        _claimRewards(msg.sender);
        info.unstakeRequestedAt = block.timestamp;
        info.isActive = false;

        if (info.role == StakeRole.Miner)          { activeMinerCount--; }
        else if (info.role == StakeRole.Validator) { activeValidatorCount--; }
        else                                        { activeHolderCount--; }

        emit UnstakeRequested(msg.sender, info.amount);
    }

    /**
     * @dev After cooldown, credits stake back to pendingDeposit.
     * User can then withdraw via Hedera SDK (owner sends back via recordWithdraw).
     */
    function withdraw() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        require(!info.isActive, "Must request unstake first");
        require(info.unstakeRequestedAt > 0, "No unstake request");
        require(
            block.timestamp >= info.unstakeRequestedAt + unstakeCooldown,
            "Cooldown not elapsed"
        );
        require(info.amount > 0, "Nothing to withdraw");

        uint256 amount = info.amount;
        info.amount = 0;
        info.role = StakeRole.None;
        info.unstakeRequestedAt = 0;
        info.rewardDebt = 0;
        totalStaked -= amount;

        // Credit back to pendingDeposit — owner will send MDT back via Hedera SDK
        pendingDeposit[msg.sender] += amount;
        emit Withdrawn(msg.sender, amount);
    }

    // =========================================================================
    // REWARD POOL
    // =========================================================================

    /**
     * @dev Deposit rewards into pool. Owner calls after sending MDT to vault via Hedera SDK.
     */
    function depositRewards(uint256 amount) external onlyOwner nonReentrant {
        require(totalStaked > 0, "No stakers");
        require(amount > 0, "Amount must be > 0");
        accRewardPerShare += (amount * REWARD_PRECISION) / totalStaked;
        totalRewardsDeposited += amount;
        emit RewardDeposited(amount, accRewardPerShare);
    }

    function claimRewards() external nonReentrant {
        _claimRewards(msg.sender);
    }

    function pendingRewards(address user) external view returns (uint256) {
        StakeInfo storage info = stakes[user];
        if (info.amount == 0) return 0;
        uint256 acc = (info.amount * accRewardPerShare) / REWARD_PRECISION;
        return acc > info.rewardDebt ? acc - info.rewardDebt : 0;
    }

    function _claimRewards(address user) internal {
        StakeInfo storage info = stakes[user];
        if (info.amount == 0) return;
        uint256 acc = (info.amount * accRewardPerShare) / REWARD_PRECISION;
        if (acc > info.rewardDebt) {
            uint256 pending = acc - info.rewardDebt;
            info.rewardDebt = acc;
            // Credit to pendingDeposit — owner sends MDT back via Hedera SDK
            pendingDeposit[user] += pending;
            totalRewardsClaimed += pending;
            emit RewardClaimed(user, pending);
        }
    }

    // =========================================================================
    // SLASH
    // =========================================================================

    function slash(address user, uint256 amount, string calldata reason) external onlyOwner nonReentrant {
        StakeInfo storage info = stakes[user];
        require(info.isActive, "Not staked");
        require(amount <= info.amount, "Slash exceeds stake");

        info.amount -= amount;
        totalStaked -= amount;
        totalSlashed += amount;
        // Slashed amount stays in vault (burned conceptually)
        emit Slashed(user, amount, reason);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function isStaked(address user) external view returns (bool) {
        return stakes[user].isActive;
    }

    function isValidator(address user) external view returns (bool) {
        return stakes[user].isActive && stakes[user].role == StakeRole.Validator;
    }

    function isMiner(address user) external view returns (bool) {
        return stakes[user].isActive && stakes[user].role == StakeRole.Miner;
    }

    function getStakeInfo(address user) external view returns (
        uint256 amount, StakeRole role, uint256 stakedAt,
        uint256 unstakeRequestedAt, bool isActive, uint256 pendingReward
    ) {
        StakeInfo storage info = stakes[user];
        uint256 pending = 0;
        if (info.amount > 0) {
            uint256 acc = (info.amount * accRewardPerShare) / REWARD_PRECISION;
            if (acc > info.rewardDebt) pending = acc - info.rewardDebt;
        }
        return (info.amount, info.role, info.stakedAt, info.unstakeRequestedAt, info.isActive, pending);
    }

    function getStakeAmount(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    function getPoolStats() external view returns (
        uint256 _totalStaked, uint256 _activeMinerCount, uint256 _activeValidatorCount,
        uint256 _activeHolderCount, uint256 _totalRewardsDeposited, uint256 _totalRewardsClaimed,
        uint256 _totalFeesBurned, uint256 _currentRegFee
    ) {
        return (
            totalStaked, activeMinerCount, activeValidatorCount, activeHolderCount,
            totalRewardsDeposited, totalRewardsClaimed, totalFeesBurned, getCurrentRegFee()
        );
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    function setMinMinerStake(uint256 _min) external onlyOwner {
        require(_min > 0 && _min <= 100_000 * 1e8, "Out of range");
        uint256 old = minMinerStake; minMinerStake = _min;
        emit MinMinerStakeUpdated(old, _min);
    }

    function setMinValidatorStake(uint256 _min) external onlyOwner {
        require(_min > 0 && _min <= 1_000_000 * 1e8, "Out of range");
        uint256 old = minValidatorStake; minValidatorStake = _min;
        emit MinValidatorStakeUpdated(old, _min);
    }

    function setMinHolderStake(uint256 _min) external onlyOwner {
        require(_min > 0 && _min <= 10_000 * 1e8, "Out of range");
        uint256 old = minHolderStake; minHolderStake = _min;
        emit MinHolderStakeUpdated(old, _min);
    }

    function setUnstakeCooldown(uint256 _c) external onlyOwner {
        require(_c >= 1 hours && _c <= 90 days, "Out of range");
        uint256 old = unstakeCooldown; unstakeCooldown = _c;
        emit UnstakeCooldownUpdated(old, _c);
    }

    function setRegFeeFloor(uint256 _f) external onlyOwner { regFeeFloor = _f; }
    function setRegFeeCeiling(uint256 _c) external onlyOwner { regFeeCeiling = _c; }
    function setDecayInterval(uint256 _d) external onlyOwner { decayInterval = _d; }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
