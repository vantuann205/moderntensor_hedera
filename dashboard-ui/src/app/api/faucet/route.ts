import { NextResponse } from 'next/server';
import {
  Client,
  PrivateKey,
  AccountId,
  TransferTransaction,
  TokenId,
  Hbar,
} from '@hashgraph/sdk';

const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
const OPERATOR_ID = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '';
const OPERATOR_KEY = process.env.HEDERA_PRIVATE_KEY || '';
const MDT_TOKEN_ID = process.env.NEXT_PUBLIC_MDT_TOKEN_ID || '0.0.8198586';

function getClient(): Client {
  if (!OPERATOR_ID || !OPERATOR_KEY) throw new Error('Hedera operator not configured');
  const client = NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(OPERATOR_ID), PrivateKey.fromStringDer(OPERATOR_KEY));
  return client;
}

export async function resolveTxUrl(txId: string): Promise<string | null> {
  if (!txId) return null;
  try {
    if (/^\d+\.\d+$/.test(txId)) return `https://hashscan.io/testnet/transaction/${txId}`;
    if (txId.includes('@')) {
      const [acc, t] = txId.split('@');
      const dot = t.indexOf('.');
      const mirrorId = `${acc}-${t.slice(0, dot)}-${t.slice(dot + 1)}`;
      const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${mirrorId}`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        const ts = d?.transactions?.[0]?.consensus_timestamp;
        if (ts) return `https://hashscan.io/testnet/transaction/${ts}`;
      }
    }
    if (txId.startsWith('0x')) {
      const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${txId}`, { cache: 'no-store' });
      if (res.ok) { const d = await res.json(); if (d?.timestamp) return `https://hashscan.io/testnet/transaction/${d.timestamp}`; }
    }
  } catch (_) {}
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accountId } = body;

    if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

    const fixedAmount = 500;
    const rawAmount = BigInt(fixedAmount) * BigInt(1e8); // 8 decimals

    const client = getClient();
    try {
      const tx = await new TransferTransaction()
        .addTokenTransfer(TokenId.fromString(MDT_TOKEN_ID), AccountId.fromString(OPERATOR_ID), -rawAmount)
        .addTokenTransfer(TokenId.fromString(MDT_TOKEN_ID), AccountId.fromString(accountId), rawAmount)
        .execute(client);

      await tx.getReceipt(client);
      const txId = tx.transactionId?.toString() || '';

      return NextResponse.json({
        success: true,
        accountId,
        amount: fixedAmount,
        txId,
        txUrl: await resolveTxUrl(txId),
        mode: 'live',
        tokenId: MDT_TOKEN_ID,
        message: `Sent ${fixedAmount} MDT to ${accountId}`,
      });
    } finally {
      client.close();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Faucet failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ online: true, mode: 'js-sdk' });
}
