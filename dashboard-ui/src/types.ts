export enum ViewState {
  HOME = 'HOME',
  EXPLORER = 'EXPLORER',
  SUBNETS = 'SUBNETS',
  SUBNET_NODES = 'SUBNET_NODES',
  SUBNET_REGISTRATION = 'SUBNET_REGISTRATION',
  SUBNET_DISTRIBUTION = 'SUBNET_DISTRIBUTION',
  SUBNET_WEIGHTS = 'SUBNET_WEIGHTS',
  SUBNET_DETAILS = 'SUBNET_DETAILS',
  MINERS = 'MINERS',
  MINER_DETAILS = 'MINER_DETAILS',
  VALIDATORS = 'VALIDATORS',
  VALIDATOR_DETAILS = 'VALIDATOR_DETAILS',
  TASKS = 'TASKS',
  ACCOUNT = 'ACCOUNT',
  ACCOUNT_HISTORY = 'ACCOUNT_HISTORY',
  ALL_TRANSACTIONS = 'ALL_TRANSACTIONS',
  ALL_BLOCKS = 'ALL_BLOCKS',
  CONTRACT_DETAILS = 'CONTRACT_DETAILS',
  GOVERNANCE = 'GOVERNANCE',
  PROPOSAL_DETAILS = 'PROPOSAL_DETAILS',
  TOKENOMICS = 'TOKENOMICS',
  CREATE_PROPOSAL = 'CREATE_PROPOSAL',
  TRANSACTION_DETAILS = 'TRANSACTION_DETAILS',
  BLOCK_DETAILS = 'BLOCK_DETAILS',
  REGISTER_ROLE = 'REGISTER_ROLE',
  MINER_DASHBOARD = 'MINER_DASHBOARD',
}

export interface Subnet {
  rank: number;
  name: string;
  netUid: number;
  emission: number;
  miners: number;
  staked: string;
  daily: string;
  status: 'active' | 'inactive' | 'warning';
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected';
  votes: {
    yes: number;
    no: number;
    abstain: number;
  };
  proposer: string;
  endsIn?: string;
  endedDate?: string;
  totalVotes: string;
}

export interface Validator {
  rank: number;
  identity: string;
  address: string;
  stake: string;
  stakeUsd: string;
  fee: number;
  apy: number;
  yield24h: string;
  verified: boolean;
  avatarColor: string;
}
