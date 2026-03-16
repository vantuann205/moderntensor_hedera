import { Client, AccountId, PrivateKey, ContractExecuteTransaction, ContractCallQuery, Hbar } from '@hashgraph/sdk';
import { ethers } from 'ethers';

export class HederaClient {
  private client: Client | null = null;
  private accountId: string;
  private privateKey: string;
  private evmAddress: string;

  constructor() {
    this.accountId = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '';
    this.privateKey = process.env.HEDERA_PRIVATE_KEY || '';
    this.evmAddress = process.env.NEXT_PUBLIC_HEDERA_EVM_ADDRESS || '';
  }

  async initialize() {
    if (this.client) return this.client;

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    
    if (network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }

    if (this.accountId && this.privateKey) {
      this.client.setOperator(
        AccountId.fromString(this.accountId),
        PrivateKey.fromStringECDSA(this.privateKey)
      );
    }

    return this.client;
  }

  getClient() {
    return this.client;
  }

  getAccountId() {
    return this.accountId;
  }

  getEvmAddress() {
    return this.evmAddress;
  }
}

// Singleton instance
let hederaClientInstance: HederaClient | null = null;

export function getHederaClient(): HederaClient {
  if (!hederaClientInstance) {
    hederaClientInstance = new HederaClient();
  }
  return hederaClientInstance;
}

// EVM Provider for contract interactions
export function getEvmProvider() {
  const rpcUrl = 'https://testnet.hashio.io/api';
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getEvmSigner() {
  const provider = getEvmProvider();
  const privateKey = process.env.HEDERA_PRIVATE_KEY || '';
  return new ethers.Wallet(privateKey, provider);
}
