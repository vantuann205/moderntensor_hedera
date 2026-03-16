// Contract addresses & ABIs for StakingVaultV2 + SubnetRegistryV2
// Deployed on Hedera Testnet

export const CONTRACTS = {
  MDT_EVM: '0x00000000000000000000000000000000007d257a', // HTS 0.0.8198586
  STAKING_VAULT: '0x99968cF6Aa38337a4dD3cBf40D13011293Cf718f', // 0.0.8219632
  SUBNET_REGISTRY: '0xbdbd7a138c7f815b1A7f432C1d06b2B95E46Ba1F', // 0.0.8219634
  PAYMENT_ESCROW: '0x6537c62E5062Ea8B64949536046075141009bE91', // 0.0.8231002
  HEDERA_CHAIN_ID: 296, // Hedera testnet
  HEDERA_RPC: 'https://testnet.hashio.io/api',
  // Hedera-native IDs (use with ContractId.fromString for HashPack)
  STAKING_VAULT_ID: '0.0.8219632',
  SUBNET_REGISTRY_ID: '0.0.8219634',
  PAYMENT_ESCROW_ID: '0.0.8231002',
  MDT_TOKEN_ID: '0.0.8198586',
};

// StakeRole enum (matches StakingVaultV2.sol)
export enum StakeRole { None = 0, Miner = 1, Validator = 2, Holder = 3 }

// Minimal ABI — only functions we call
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export const STAKING_VAULT_ABI = [
  'function stake(uint256 amount, uint8 role) external',
  'function recordDeposit(address user, uint256 amount) external',
  'function requestUnstake() external',
  'function withdraw() external',
  'function claimRewards() external',
  'function getCurrentRegFee() view returns (uint256)',
  'function isMiner(address user) view returns (bool)',
  'function isValidator(address user) view returns (bool)',
  'function getStakeInfo(address user) view returns (uint256 amount, uint8 role, uint256 stakedAt, uint256 unstakeRequestedAt, bool isActive, uint256 pendingReward)',
  'function pendingRewards(address user) view returns (uint256)',
  'function pendingDeposit(address user) view returns (uint256)',
  'function minMinerStake() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function activeMinerCount() view returns (uint256)',
];

export const SUBNET_REGISTRY_ABI = [
  'function registerMiner(uint256 subnetId) external',
  'function isMiner(uint256 subnetId, address miner) view returns (bool)',
  'function isValidator(uint256 subnetId, address validator) view returns (bool)',
  'function createTask(uint256 subnetId, string calldata taskHash, uint256 rewardAmount, uint256 duration) external returns (uint256 taskId)',
  'function submitResult(uint256 taskId, string calldata resultHash) external',
  'function validateSubmission(uint256 taskId, uint256 submissionIndex, uint256 score) external',
  'function finalizeTask(uint256 taskId) external',
  'function withdrawEarnings() external',
  'function pendingWithdrawals(address user) view returns (uint256)',
  'function getTask(uint256 id) view returns (uint256 id, uint256 subnetId, address requester, string taskHash, uint256 totalDeposit, uint256 rewardAmount, uint256 protocolFee, uint256 validatorReward, uint256 stakingPoolFee, uint256 subnetFee, uint256 deadline, uint8 status, address winningMiner, uint256 winningScore, uint256 createdAt)',
  'function getSubmissions(uint256 taskId) view returns (tuple(address miner, string resultHash, uint256 score, bool validated, uint256 submittedAt, uint256 validationCount)[])',
  'function getValidatorReputation(address v) view returns (uint256 totalValidations, uint256 accurateValidations, uint256 reputationScore, uint256 lastActiveAt)',
  'function validatorEarnings(address v) view returns (uint256)',
  'function minerEarnings(address m) view returns (uint256)',
  'function hasValidatorScored(uint256 taskId, uint256 submissionIndex, address validator) view returns (bool)',
  'function getAdaptiveMinValidations(uint256 subnetId, uint256 rewardAmount) view returns (uint256)',
  'function subnetCount() view returns (uint256)',
  'function getSubnet(uint256 id) view returns (uint256 id, string name, string description, address owner, uint256 feeRate, uint256 minTaskReward, uint256 totalVolume, uint256 totalTasks, uint256 activeMiners, uint8 status, uint256 createdAt)',
];

// HTS precompile for MDT transfer (MetaMask flow)
export const HTS_ABI = [
  'function cryptoTransfer((int64 amount, address accountID, bool isApproval)[] transferList, (address token, (int64 amount, address accountID, bool isApproval)[] transfers, bool deleteSpenderAllowance)[] tokenTransfers) external returns (int64 responseCode)',
];
export const HTS_PRECOMPILE = '0x0000000000000000000000000000000000000167';

export const STAKING_VAULT_VALIDATOR_ABI = [
  'function stake(uint256 amount, uint8 role) external',
  'function recordDeposit(address user, uint256 amount) external',
  'function requestUnstake() external',
  'function withdraw() external',
  'function getCurrentRegFee() view returns (uint256)',
  'function isValidator(address user) view returns (bool)',
  'function getStakeInfo(address user) view returns (uint256 amount, uint8 role, uint256 stakedAt, uint256 unstakeRequestedAt, bool isActive, uint256 pendingReward)',
  'function pendingDeposit(address user) view returns (uint256)',
];

// PaymentEscrow ABI — standalone escrow contract (0.0.8231002)
export const PAYMENT_ESCROW_ABI = [
  'function createTask(string calldata taskHash, uint256 rewardAmount, uint256 duration) external returns (uint256 taskId)',
  'function submitResult(uint256 taskId, string calldata resultHash) external',
  'function validateSubmission(uint256 taskId, uint256 minerIndex, uint256 score) external',
  'function finalizeTask(uint256 taskId) external',
  'function cancelTask(uint256 taskId) external',
  'function expireTask(uint256 taskId) external',
  'function withdrawEarnings() external',
  'function pendingWithdrawals(address user) view returns (uint256)',
  'function tasks(uint256 taskId) view returns (uint256 id, address requester, string taskHash, uint256 rewardAmount, uint256 platformFee, uint256 validatorReward, uint256 deadline, uint8 status, address assignedMiner, address winningMiner, uint256 winningScore, uint256 createdAt, uint256 completedAt)',
  'function taskSubmissions(uint256 taskId, uint256 index) view returns (address miner, string resultHash, uint256 score, bool validated, uint256 submittedAt, uint256 validationCount)',
  'function validators(address v) view returns (bool)',
  'function addValidator(address validator) external',
  'function minValidations() view returns (uint256)',
  'function platformFeeRate() view returns (uint256)',
  'function validatorRewardRate() view returns (uint256)',
];
