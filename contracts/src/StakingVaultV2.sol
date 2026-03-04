// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title StakingVaultV2
 * @dev ModernTensor Staking with:
 *   1. Dynamic Registration Fee (EIP-1559 style anti-spam)
 *   2. Passive Staking Rewards (protocol fee → all stakers)
 *   3. Role-based staking (Miner / Validator / Holder)
 *
 * Registration Fee Mechanism (EIP-1559 inspired):
 *   - baseFee starts at 5 MDT
 *   - Each registration bumps fee by 12.5% (1/8)
 *   - Fee decays by 50% every decayInterval (1 hour) with no registrations
 *   - Min fee floor: 1 MDT, Max fee ceiling: 500 MDT
 *   - Fee is BURNED (sent to 0xdead) — deflationary pressure
 *
 * Staking:
 *   - Miner:     min 10 MDT    → can process tasks, earn 85% of reward
 *   - Validator:  min 500 MDT   → can score tasks, earn 8% of reward
 *   - Holder:     min 1 MDT     → passive only, earns from Reward Pool
 *
 * Reward Pool:
 *   - 5% of every task reward goes to Reward Pool
 *   - Distributed pro-rata based on stake amount
 *   - ALL stakers (miners, validators, holders) earn from pool
 *   - Claim anytime via claimRewards()
 *
 * For ModernTensor on Hedera — Hello Future Hackathon 2026
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract StakingVaultV2 is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // ENUMS & STRUCTS
    // =========================================================================

    enum StakeRole {
        None,
        Miner, // Active: processes tasks
        Validator, // Active: scores submissions
        Holder // Passive: stake-to-earn only
    }

    struct StakeInfo {
        uint256 amount;
        StakeRole role;
        uint256 stakedAt;
        uint256 unstakeRequestedAt;
        bool isActive;
        uint256 rewardDebt; // For reward accounting (scaled)
    }

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    address public constant BURN_ADDRESS = address(0xdEaD);

    // =========================================================================
    // STATE: Staking
    // =========================================================================

    IERC20 public mdtToken;

    uint256 public minMinerStake = 10 * 1e8; // 10 MDT
    uint256 public minValidatorStake = 500 * 1e8; // 500 MDT
    uint256 public minHolderStake = 1 * 1e8; // 1 MDT
    uint256 public unstakeCooldown = 7 days;

    uint256 public totalStaked;
    uint256 public totalSlashed;

    mapping(address => StakeInfo) public stakes;

    uint256 public activeMinerCount;
    uint256 public activeValidatorCount;
    uint256 public activeHolderCount;

    // =========================================================================
    // STATE: Dynamic Registration Fee (EIP-1559 Style)
    // =========================================================================

    /// @dev Current base fee for registration (in MDT smallest unit)
    uint256 public regBaseFee = 5 * 1e8; // 5 MDT initial

    /// @dev Minimum registration fee floor
    uint256 public regFeeFloor = 1 * 1e8; // 1 MDT

    /// @dev Maximum registration fee ceiling
    uint256 public regFeeCeiling = 500 * 1e8; // 500 MDT

    /// @dev Time interval for fee decay (fee halves every interval)
    uint256 public decayInterval = 1 hours;

    /// @dev Timestamp of last registration (for decay calculation)
    uint256 public lastRegTimestamp;

    /// @dev Total fees burned (deflationary counter)
    uint256 public totalFeesBurned;

    /// @dev Fee bump multiplier numerator/denominator (12.5% = 1/8)
    uint256 public feeBumpNumerator = 1;
    uint256 public feeBumpDenominator = 8;

    // =========================================================================
    // STATE: Reward Pool (Passive Staking Rewards)
    // =========================================================================

    /// @dev Accumulated reward per share (scaled by 1e18 for precision)
    uint256 public accRewardPerShare;

    /// @dev Total rewards deposited into pool
    uint256 public totalRewardsDeposited;

    /// @dev Total rewards claimed by stakers
    uint256 public totalRewardsClaimed;

    /// @dev Precision multiplier for reward math
    uint256 private constant REWARD_PRECISION = 1e18;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event Staked(
        address indexed user,
        uint256 amount,
        StakeRole role,
        uint256 regFeePaid
    );
    event UnstakeRequested(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Slashed(address indexed user, uint256 amount, string reason);
    event StakeIncreased(
        address indexed user,
        uint256 additionalAmount,
        uint256 newTotal
    );
    event RegFeeBurned(
        address indexed user,
        uint256 feeAmount,
        uint256 newBaseFee
    );
    event RewardDeposited(uint256 amount, uint256 newAccPerShare);
    event RewardClaimed(address indexed user, uint256 amount);
    event RegFeeUpdated(uint256 oldFee, uint256 newFee, string reason);

    event MinMinerStakeUpdated(uint256 oldValue, uint256 newValue);
    event MinValidatorStakeUpdated(uint256 oldValue, uint256 newValue);
    event MinHolderStakeUpdated(uint256 oldValue, uint256 newValue);
    event UnstakeCooldownUpdated(uint256 oldValue, uint256 newValue);
    event RegFeeFloorUpdated(uint256 oldValue, uint256 newValue);
    event RegFeeCeilingUpdated(uint256 oldValue, uint256 newValue);
    event DecayIntervalUpdated(uint256 oldValue, uint256 newValue);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _mdtToken) {
        require(_mdtToken != address(0), "Invalid token address");
        mdtToken = IERC20(_mdtToken);
        lastRegTimestamp = block.timestamp;
    }

    // =========================================================================
    // DYNAMIC REGISTRATION FEE
    // =========================================================================

    /**
     * @dev Calculate current registration fee with time decay.
     *
     * Fee decays by 50% for each decayInterval since last registration.
     * This creates EIP-1559-like dynamics:
     *   - Spam registrations → fee spikes
     *   - Quiet period → fee drops back to floor
     */
    function getCurrentRegFee() public view returns (uint256) {
        uint256 fee = regBaseFee;

        // Apply time decay: halve for each decay interval elapsed
        uint256 elapsed = block.timestamp - lastRegTimestamp;
        uint256 halvings = elapsed / decayInterval;

        // Cap halvings to prevent underflow (max 20 halvings = fee/1M)
        if (halvings > 20) halvings = 20;

        // Use bit-shift for gas-efficient halving: fee >> halvings
        fee = fee >> halvings;

        // Enforce floor
        if (fee < regFeeFloor) {
            fee = regFeeFloor;
        }

        return fee;
    }

    /**
     * @dev Internal: charge registration fee and bump base fee.
     */
    function _chargeRegFee(address user) internal returns (uint256 feePaid) {
        feePaid = getCurrentRegFee();

        // Collect fee from user
        mdtToken.safeTransferFrom(user, BURN_ADDRESS, feePaid);
        totalFeesBurned += feePaid;

        // Bump base fee by 12.5% (1/8)
        regBaseFee =
            regBaseFee +
            ((regBaseFee * feeBumpNumerator) / feeBumpDenominator);

        // Enforce ceiling
        if (regBaseFee > regFeeCeiling) {
            regBaseFee = regFeeCeiling;
        }

        lastRegTimestamp = block.timestamp;

        emit RegFeeBurned(user, feePaid, regBaseFee);
        return feePaid;
    }

    // =========================================================================
    // STAKING
    // =========================================================================

    /**
     * @dev Stake MDT for a role. Charges dynamic registration fee on first stake.
     *
     * Total cost = registration fee (burned) + stake amount (refundable)
     * User must approve BOTH amounts to this contract.
     *
     * @param amount Amount to stake (refundable)
     * @param role Role to stake for
     */
    function stake(
        uint256 amount,
        StakeRole role
    ) external nonReentrant whenNotPaused {
        require(
            role == StakeRole.Miner ||
                role == StakeRole.Validator ||
                role == StakeRole.Holder,
            "Invalid role"
        );
        require(amount > 0, "Amount must be > 0");

        StakeInfo storage info = stakes[msg.sender];

        if (info.isActive) {
            // Increase existing stake (no reg fee on increase)
            require(info.role == role, "Cannot change role while staked");
            require(info.unstakeRequestedAt == 0, "Unstake in progress");

            // Claim pending rewards first
            _claimRewards(msg.sender);

            info.amount += amount;
            totalStaked += amount;

            // Update reward debt
            info.rewardDebt =
                (info.amount * accRewardPerShare) /
                REWARD_PRECISION;

            mdtToken.safeTransferFrom(msg.sender, address(this), amount);
            emit StakeIncreased(msg.sender, amount, info.amount);
            return;
        }

        // New stake — charge dynamic registration fee
        uint256 minStake;
        if (role == StakeRole.Validator) {
            minStake = minValidatorStake;
        } else if (role == StakeRole.Miner) {
            minStake = minMinerStake;
        } else {
            minStake = minHolderStake;
        }
        require(amount >= minStake, "Below minimum stake");

        // Charge registration fee (burned, non-refundable)
        uint256 regFee = _chargeRegFee(msg.sender);

        // Transfer stake amount (refundable)
        mdtToken.safeTransferFrom(msg.sender, address(this), amount);

        stakes[msg.sender] = StakeInfo({
            amount: amount,
            role: role,
            stakedAt: block.timestamp,
            unstakeRequestedAt: 0,
            isActive: true,
            rewardDebt: (amount * accRewardPerShare) / REWARD_PRECISION
        });

        totalStaked += amount;

        if (role == StakeRole.Miner) {
            activeMinerCount++;
        } else if (role == StakeRole.Validator) {
            activeValidatorCount++;
        } else {
            activeHolderCount++;
        }

        emit Staked(msg.sender, amount, role, regFee);
    }

    // =========================================================================
    // UNSTAKING
    // =========================================================================

    function requestUnstake() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        require(info.isActive, "Not staked");
        require(info.unstakeRequestedAt == 0, "Already requested");

        // Claim pending rewards before unstaking
        _claimRewards(msg.sender);

        info.unstakeRequestedAt = block.timestamp;
        info.isActive = false;

        if (info.role == StakeRole.Miner) {
            activeMinerCount--;
        } else if (info.role == StakeRole.Validator) {
            activeValidatorCount--;
        } else {
            activeHolderCount--;
        }

        emit UnstakeRequested(msg.sender, info.amount);
    }

    function withdraw() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        require(info.unstakeRequestedAt > 0, "No unstake request");
        require(
            block.timestamp >= info.unstakeRequestedAt + unstakeCooldown,
            "Cooldown not expired"
        );
        require(info.amount > 0, "Nothing to withdraw");

        uint256 amount = info.amount;
        info.amount = 0;
        info.role = StakeRole.None;
        info.unstakeRequestedAt = 0;
        info.rewardDebt = 0;
        totalStaked -= amount;

        mdtToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // =========================================================================
    // REWARD POOL (Passive Staking Rewards)
    // =========================================================================

    /**
     * @dev Deposit rewards into the pool. Called by SubnetRegistry on task finalize.
     *
     * Distributes rewards pro-rata to all stakers.
     * Anyone can call this — typically the SubnetRegistry contract.
     *
     * @param amount MDT amount to distribute
     */
    function depositRewards(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(totalStaked > 0, "No stakers");

        mdtToken.safeTransferFrom(msg.sender, address(this), amount);

        accRewardPerShare += (amount * REWARD_PRECISION) / totalStaked;
        totalRewardsDeposited += amount;

        emit RewardDeposited(amount, accRewardPerShare);
    }

    /**
     * @dev Claim accumulated staking rewards.
     */
    function claimRewards() external nonReentrant {
        _claimRewards(msg.sender);
    }

    /**
     * @dev View pending rewards for a user.
     */
    function pendingRewards(address user) external view returns (uint256) {
        StakeInfo storage info = stakes[user];
        if (info.amount == 0) return 0;

        uint256 accumulated = (info.amount * accRewardPerShare) /
            REWARD_PRECISION;
        if (accumulated <= info.rewardDebt) return 0;
        return accumulated - info.rewardDebt;
    }

    function _claimRewards(address user) internal {
        StakeInfo storage info = stakes[user];
        if (info.amount == 0) return;

        uint256 accumulated = (info.amount * accRewardPerShare) /
            REWARD_PRECISION;
        uint256 pending = 0;

        if (accumulated > info.rewardDebt) {
            pending = accumulated - info.rewardDebt;
        }

        info.rewardDebt = accumulated;

        if (pending > 0) {
            mdtToken.safeTransfer(user, pending);
            totalRewardsClaimed += pending;
            emit RewardClaimed(user, pending);
        }
    }

    // =========================================================================
    // SLASHING
    // =========================================================================

    function slash(
        address user,
        uint256 basisPoints,
        string calldata reason
    ) external onlyOwner nonReentrant {
        require(
            basisPoints > 0 && basisPoints <= 10000,
            "Invalid basis points"
        );

        StakeInfo storage info = stakes[user];
        require(info.amount > 0, "No stake to slash");

        // Claim rewards first
        _claimRewards(user);

        uint256 slashAmount = (info.amount * basisPoints) / 10000;
        info.amount -= slashAmount;
        totalStaked -= slashAmount;
        totalSlashed += slashAmount;

        // Update reward debt
        info.rewardDebt = (info.amount * accRewardPerShare) / REWARD_PRECISION;

        // Deactivate if below minimum
        uint256 minStake = info.role == StakeRole.Validator
            ? minValidatorStake
            : info.role == StakeRole.Miner
                ? minMinerStake
                : minHolderStake;

        if (info.amount < minStake && info.isActive) {
            info.isActive = false;
            if (info.role == StakeRole.Miner) activeMinerCount--;
            else if (info.role == StakeRole.Validator) activeValidatorCount--;
            else activeHolderCount--;
        }

        mdtToken.safeTransfer(BURN_ADDRESS, slashAmount);
        emit Slashed(user, slashAmount, reason);
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    function isStaked(address user) external view returns (bool) {
        return stakes[user].isActive;
    }

    function isValidator(address user) external view returns (bool) {
        return
            stakes[user].isActive && stakes[user].role == StakeRole.Validator;
    }

    function isMiner(address user) external view returns (bool) {
        return stakes[user].isActive && stakes[user].role == StakeRole.Miner;
    }

    function getStakeInfo(
        address user
    )
        external
        view
        returns (
            uint256 amount,
            StakeRole role,
            uint256 stakedAt,
            uint256 unstakeRequestedAt,
            bool isActive,
            uint256 pendingReward
        )
    {
        StakeInfo storage info = stakes[user];
        uint256 pending = 0;
        if (info.amount > 0) {
            uint256 acc = (info.amount * accRewardPerShare) / REWARD_PRECISION;
            if (acc > info.rewardDebt) pending = acc - info.rewardDebt;
        }
        return (
            info.amount,
            info.role,
            info.stakedAt,
            info.unstakeRequestedAt,
            info.isActive,
            pending
        );
    }

    /// @dev Returns the raw staked amount for a user (used by SubnetRegistryV2)
    function getStakeAmount(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    /**
     * @dev Get pool statistics for frontend display.
     */
    function getPoolStats()
        external
        view
        returns (
            uint256 _totalStaked,
            uint256 _totalRewards,
            uint256 _totalClaimed,
            uint256 _totalBurned,
            uint256 _currentRegFee,
            uint256 _activeMinerCount,
            uint256 _activeValidatorCount,
            uint256 _activeHolderCount
        )
    {
        return (
            totalStaked,
            totalRewardsDeposited,
            totalRewardsClaimed,
            totalFeesBurned,
            getCurrentRegFee(),
            activeMinerCount,
            activeValidatorCount,
            activeHolderCount
        );
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    function setMinMinerStake(uint256 _min) external onlyOwner {
        require(_min > 0, "Must be > 0");
        require(_min <= 100_000 * 1e8, "Too high");
        uint256 old = minMinerStake;
        minMinerStake = _min;
        emit MinMinerStakeUpdated(old, _min);
    }
    function setMinValidatorStake(uint256 _min) external onlyOwner {
        require(_min > 0, "Must be > 0");
        require(_min <= 1_000_000 * 1e8, "Too high");
        uint256 old = minValidatorStake;
        minValidatorStake = _min;
        emit MinValidatorStakeUpdated(old, _min);
    }
    function setMinHolderStake(uint256 _min) external onlyOwner {
        require(_min > 0, "Must be > 0");
        require(_min <= 10_000 * 1e8, "Too high");
        uint256 old = minHolderStake;
        minHolderStake = _min;
        emit MinHolderStakeUpdated(old, _min);
    }
    function setUnstakeCooldown(uint256 _c) external onlyOwner {
        require(_c >= 1 hours, "Too short");
        require(_c <= 90 days, "Too long");
        uint256 old = unstakeCooldown;
        unstakeCooldown = _c;
        emit UnstakeCooldownUpdated(old, _c);
    }
    function setRegFeeFloor(uint256 _f) external onlyOwner {
        require(_f > 0, "Must be > 0");
        require(_f < regFeeCeiling, "Must be < ceiling");
        uint256 old = regFeeFloor;
        regFeeFloor = _f;
        emit RegFeeFloorUpdated(old, _f);
    }
    function setRegFeeCeiling(uint256 _c) external onlyOwner {
        require(_c > regFeeFloor, "Must be > floor");
        require(_c <= 10_000 * 1e8, "Too high");
        uint256 old = regFeeCeiling;
        regFeeCeiling = _c;
        emit RegFeeCeilingUpdated(old, _c);
    }
    function setDecayInterval(uint256 _d) external onlyOwner {
        require(_d >= 1 minutes, "Too short");
        require(_d <= 7 days, "Too long");
        uint256 old = decayInterval;
        decayInterval = _d;
        emit DecayIntervalUpdated(old, _d);
    }

    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }
}
