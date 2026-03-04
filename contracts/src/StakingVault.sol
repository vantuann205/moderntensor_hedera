// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title StakingVault
 * @dev Manages MDT staking for miners, validators, and subnet owners.
 *
 * Roles & minimum stakes:
 *   - Validator: 50,000 MDT (runs PoI verification, earns fees)
 *   - Miner:     1,000 MDT  (submits AI results, earns rewards)
 *   - SubnetOwner: handled by SubnetRegistry (10,000 MDT)
 *
 * Lifecycle:
 *   1. User approves MDT to this contract
 *   2. User calls stake(amount, role)
 *   3. User is now eligible for the chosen role
 *   4. Unstake initiates cooldown (7 days)
 *   5. After cooldown, user can withdraw
 *
 * Slashing:
 *   - Owner (or future GovernorContract) can slash bad actors
 *   - Slashed tokens are burned (sent to 0xdead)
 *
 * For ModernTensor on Hedera - Hello Future Hackathon 2026
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract StakingVault is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // ENUMS & STRUCTS
    // =========================================================================

    enum StakeRole {
        None,
        Miner,
        Validator
    }

    struct StakeInfo {
        uint256 amount;
        StakeRole role;
        uint256 stakedAt;
        uint256 unstakeRequestedAt; // 0 if not unstaking
        bool isActive;
    }

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    /// @dev MDT Token
    IERC20 public mdtToken;

    /// @dev Minimum stake for miners (1,000 MDT with 8 decimals)
    uint256 public minMinerStake = 1_000 * 1e8;

    /// @dev Minimum stake for validators (50,000 MDT with 8 decimals)
    uint256 public minValidatorStake = 50_000 * 1e8;

    /// @dev Cooldown period before unstaked tokens can be withdrawn
    uint256 public unstakeCooldown = 7 days;

    /// @dev Burn address for slashed tokens
    address public constant BURN_ADDRESS = address(0xdEaD);

    /// @dev Total MDT staked across all users
    uint256 public totalStaked;

    /// @dev Total MDT slashed (burned)
    uint256 public totalSlashed;

    /// @dev User stakes
    mapping(address => StakeInfo) public stakes;

    /// @dev Count of active stakers by role
    uint256 public activeMinerCount;
    uint256 public activeValidatorCount;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event Staked(address indexed user, uint256 amount, StakeRole role);
    event UnstakeRequested(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Slashed(address indexed user, uint256 amount, string reason);
    event StakeIncreased(
        address indexed user,
        uint256 additionalAmount,
        uint256 newTotal
    );

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _mdtToken) {
        require(_mdtToken != address(0), "Invalid token address");
        mdtToken = IERC20(_mdtToken);
    }

    // =========================================================================
    // STAKING
    // =========================================================================

    /**
     * @dev Stake MDT tokens for a specific role.
     * @param amount Amount of MDT to stake (in smallest unit)
     * @param role The role to stake for (Miner or Validator)
     */
    function stake(
        uint256 amount,
        StakeRole role
    ) external nonReentrant whenNotPaused {
        require(
            role == StakeRole.Miner || role == StakeRole.Validator,
            "Invalid role"
        );
        require(amount > 0, "Amount must be > 0");

        StakeInfo storage info = stakes[msg.sender];

        if (info.isActive) {
            // Already staked — increase stake (must be same role)
            require(info.role == role, "Cannot change role while staked");
            require(info.unstakeRequestedAt == 0, "Unstake in progress");

            info.amount += amount;
            totalStaked += amount;

            mdtToken.safeTransferFrom(msg.sender, address(this), amount);
            emit StakeIncreased(msg.sender, amount, info.amount);
            return;
        }

        // New stake
        uint256 minStake = role == StakeRole.Validator
            ? minValidatorStake
            : minMinerStake;
        require(amount >= minStake, "Below minimum stake");

        stakes[msg.sender] = StakeInfo({
            amount: amount,
            role: role,
            stakedAt: block.timestamp,
            unstakeRequestedAt: 0,
            isActive: true
        });

        totalStaked += amount;

        if (role == StakeRole.Miner) {
            activeMinerCount++;
        } else {
            activeValidatorCount++;
        }

        mdtToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount, role);
    }

    // =========================================================================
    // UNSTAKING
    // =========================================================================

    /**
     * @dev Request to unstake. Starts cooldown period.
     */
    function requestUnstake() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        require(info.isActive, "Not staked");
        require(info.unstakeRequestedAt == 0, "Already requested");

        info.unstakeRequestedAt = block.timestamp;
        info.isActive = false;

        if (info.role == StakeRole.Miner) {
            activeMinerCount--;
        } else {
            activeValidatorCount--;
        }

        emit UnstakeRequested(msg.sender, info.amount);
    }

    /**
     * @dev Withdraw staked tokens after cooldown period.
     */
    function withdraw() external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        require(info.unstakeRequestedAt > 0, "No unstake request");
        require(
            block.timestamp >= info.unstakeRequestedAt + unstakeCooldown,
            "Cooldown not expired"
        );
        require(info.amount > 0, "Nothing to withdraw");

        uint256 amount = info.amount;

        // Clear stake
        info.amount = 0;
        info.role = StakeRole.None;
        info.unstakeRequestedAt = 0;
        totalStaked -= amount;

        mdtToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // =========================================================================
    // SLASHING
    // =========================================================================

    /**
     * @dev Slash a staker's tokens. Burned to 0xdead.
     * @param user Address to slash
     * @param basisPoints Slash percentage in basis points (1000 = 10%)
     * @param reason Human-readable reason
     */
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

        uint256 slashAmount = (info.amount * basisPoints) / 10000;
        info.amount -= slashAmount;
        totalStaked -= slashAmount;
        totalSlashed += slashAmount;

        // If remaining stake is below minimum, deactivate
        uint256 minStake = info.role == StakeRole.Validator
            ? minValidatorStake
            : minMinerStake;

        if (info.amount < minStake && info.isActive) {
            info.isActive = false;
            if (info.role == StakeRole.Miner) {
                activeMinerCount--;
            } else {
                activeValidatorCount--;
            }
        }

        // Burn slashed tokens
        mdtToken.safeTransfer(BURN_ADDRESS, slashAmount);
        emit Slashed(user, slashAmount, reason);
    }

    // =========================================================================
    // QUERIES
    // =========================================================================

    /**
     * @dev Check if an address is actively staked for a given role.
     */
    function isStaked(address user) external view returns (bool) {
        return stakes[user].isActive;
    }

    /**
     * @dev Check if an address is staked as a validator.
     */
    function isValidator(address user) external view returns (bool) {
        StakeInfo storage info = stakes[user];
        return info.isActive && info.role == StakeRole.Validator;
    }

    /**
     * @dev Check if an address is staked as a miner.
     */
    function isMiner(address user) external view returns (bool) {
        StakeInfo storage info = stakes[user];
        return info.isActive && info.role == StakeRole.Miner;
    }

    /**
     * @dev Get stake details for a user.
     */
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
            bool isActive
        )
    {
        StakeInfo storage info = stakes[user];
        return (
            info.amount,
            info.role,
            info.stakedAt,
            info.unstakeRequestedAt,
            info.isActive
        );
    }

    // =========================================================================
    // ADMIN
    // =========================================================================

    event MinMinerStakeUpdated(uint256 oldValue, uint256 newValue);
    event MinValidatorStakeUpdated(uint256 oldValue, uint256 newValue);
    event UnstakeCooldownUpdated(uint256 oldValue, uint256 newValue);

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

    function setUnstakeCooldown(uint256 _cooldown) external onlyOwner {
        require(_cooldown >= 1 hours, "Too short");
        require(_cooldown <= 90 days, "Too long");
        uint256 old = unstakeCooldown;
        unstakeCooldown = _cooldown;
        emit UnstakeCooldownUpdated(old, _cooldown);
    }

    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }
}
