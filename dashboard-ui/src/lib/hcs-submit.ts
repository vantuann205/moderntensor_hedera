/**
 * hcs-submit.ts — Submit HCS messages using @hashgraph/sdk (JS)
 * Replaces Python hcs_submit.py — works on Vercel serverless
 */
import {
  Client,
  PrivateKey,
  AccountId,
  TopicMessageSubmitTransaction,
} from '@hashgraph/sdk';

const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
const OPERATOR_ID = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '';
const OPERATOR_KEY = process.env.HEDERA_PRIVATE_KEY || '';

function getClient(): Client {
  if (!OPERATOR_ID || !OPERATOR_KEY) {
    throw new Error('HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set');
  }
  const client = NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(OPERATOR_ID), PrivateKey.fromStringDer(OPERATOR_KEY));
  return client;
}

async function getMirrorSequence(topicId: string, afterSeq: number, retries = 8, delayMs = 3000): Promise<string> {
  const url = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=1&order=desc`;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        const msgs = d.messages || [];
        if (msgs.length > 0) {
          const seq = Number(msgs[0].sequence_number || 0);
          if (seq > afterSeq) return String(seq);
        }
      }
    } catch (_) {}
    if (i < retries - 1) await new Promise(res => setTimeout(res, delayMs));
  }
  return String(afterSeq + 1);
}

async function getBeforeSeq(topicId: string): Promise<number> {
  try {
    const r = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=1&order=desc`,
      { cache: 'no-store' }
    );
    if (r.ok) {
      const d = await r.json();
      const msgs = d.messages || [];
      return msgs.length > 0 ? Number(msgs[0].sequence_number || 0) : 0;
    }
  } catch (_) {}
  return 0;
}

export interface HcsSubmitResult {
  success: boolean;
  sequence: string;
  topic_id: string;
  transaction_id: string;
  consensus_timestamp?: string;
}

export async function submitHcsMessage(topicId: string, message: object): Promise<HcsSubmitResult> {
  const client = getClient();
  try {
    const beforeSeq = await getBeforeSeq(topicId);
    const messageStr = JSON.stringify(message);

    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(messageStr)
      .execute(client);

    const receipt = await tx.getReceipt(client);
    const txId = tx.transactionId?.toString() || '';

    // Poll mirror node for new sequence
    const sequence = await getMirrorSequence(topicId, beforeSeq);

    // Get consensus_timestamp for this sequence
    let consensusTimestamp = '';
    try {
      const r = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages/${sequence}`,
        { cache: 'no-store' }
      );
      if (r.ok) {
        const d = await r.json();
        consensusTimestamp = d.consensus_timestamp || '';
      }
    } catch (_) {}

    return {
      success: true,
      sequence,
      topic_id: topicId,
      transaction_id: txId,
      consensus_timestamp: consensusTimestamp,
    };
  } finally {
    client.close();
  }
}
