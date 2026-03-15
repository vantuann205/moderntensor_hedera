/**
 * POST /api/tasks/create-onchain
 * Deployer approves MDT allowance + calls createTask() on SubnetRegistryV2
 * Uses @hashgraph/sdk JS (no Python required)
 */
import { NextResponse } from 'next/server';
import {
  Client,
  PrivateKey,
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  AccountAllowanceApproveTransaction,
  TokenId,
} from '@hashgraph/sdk';
import { ethers } from 'ethers';

const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
const OPERATOR_ID = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '';
const OPERATOR_KEY = process.env.HEDERA_PRIVATE_KEY || '';
const MDT_TOKEN_ID = process.env.NEXT_PUBLIC_MDT_TOKEN_ID || '0.0.8198586';
const REGISTRY_ID = process.env.NEXT_PUBLIC_SUBNET_REGISTRY_ID || '0.0.8219634';
const HEDERA_RPC = process.env.NEXT_PUBLIC_HEDERA_RPC || 'https://testnet.hashio.io/api';

const GET_TASK_ABI = ['event TaskCreated(uint256 indexed taskId, uint256 indexed subnetId, address indexed requester, uint256 rewardAmount)'];

function getClient(): Client {
  if (!OPERATOR_ID || !OPERATOR_KEY) throw new Error('Hedera operator not configured');
  const client = NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(OPERATOR_ID), PrivateKey.fromStringDer(OPERATOR_KEY));
  return client;
}

async function getContractTs(txId: string, retries = 8, delayMs = 3000): Promise<string> {
  if (!txId) return '';
  let mirrorId = txId;
  if (txId.includes('@')) {
    const [acc, t] = txId.split('@');
    const dot = t.indexOf('.');
    mirrorId = `${acc}-${t.slice(0, dot)}-${t.slice(dot + 1)}`;
  }
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${mirrorId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        const ts = d?.transactions?.[0]?.consensus_timestamp;
        if (ts) return ts;
      }
    } catch (_) {}
    if (i < retries - 1) await new Promise(res => setTimeout(res, delayMs));
  }
  return '';
}

async function getTaskIdFromLogs(registryId: string, retries = 8, delayMs = 3000): Promise<string | null> {
  const url = `https://testnet.mirrornode.hedera.com/api/v1/contracts/${registryId}/results/logs?limit=5&order=desc`;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        const logs = d.logs || [];
        for (const log of logs) {
          const topics: string[] = log.topics || [];
          if (topics.length >= 2 && topics[1] && topics[1] !== '0x') {
            return String(parseInt(topics[1], 16));
          }
        }
      }
    } catch (_) {}
    if (i < retries - 1) await new Promise(res => setTimeout(res, delayMs));
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { subnetId, taskHash, rewardRaw, durationSecs } = await req.json();

    if (subnetId == null || !taskHash || !rewardRaw || !durationSecs) {
      return NextResponse.json({ error: 'subnetId, taskHash, rewardRaw, durationSecs required' }, { status: 400 });
    }

    const totalRaw = (BigInt(rewardRaw) * BigInt(115)) / BigInt(100);
    const client = getClient();

    try {
      // Step 1: Approve token allowance
      await new AccountAllowanceApproveTransaction()
        .approveTokenAllowance(
          TokenId.fromString(MDT_TOKEN_ID),
          AccountId.fromString(OPERATOR_ID),
          ContractId.fromString(REGISTRY_ID),
          totalRaw,
        )
        .execute(client)
        .then(tx => tx.getReceipt(client));

      // Step 2: createTask(subnetId, taskHash, rewardAmount, duration)
      const params = new ContractFunctionParameters()
        .addUint256(Number(subnetId))
        .addString(taskHash)
        .addUint256(Number(rewardRaw))
        .addUint256(Number(durationSecs));

      const tx = await new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(REGISTRY_ID))
        .setGas(500000)
        .setFunction('createTask', params)
        .execute(client);

      await tx.getReceipt(client);
      const txId = tx.transactionId?.toString() || '';

      const contractTs = await getContractTs(txId);
      const onChainTaskId = await getTaskIdFromLogs(REGISTRY_ID);

      return NextResponse.json({
        success: true,
        onChainTaskId: onChainTaskId ? String(onChainTaskId) : null,
        txId,
        contractTs,
        hashscanUrl: contractTs ? `https://hashscan.io/testnet/transaction/${contractTs}` : null,
      });
    } finally {
      client.close();
    }
  } catch (err: any) {
    console.error('[tasks/create-onchain]', err);
    return NextResponse.json({ error: err.message || 'createTask failed' }, { status: 500 });
  }
}
