import { NextResponse } from 'next/server';
import { submitHcsMessage } from '@/lib/hcs-submit';

const REGISTRATION_TOPIC_ID = process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID || '0.0.8198583';
const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';
const MDT_TOKEN_ID = process.env.NEXT_PUBLIC_MDT_TOKEN_ID || '0.0.8198586';

// Min stakes per StakingVaultV2.sol
const MIN_MINER_STAKE = 10;    // MDT (StakingVaultV2: minMinerStake = 10 MDT)
const MIN_VALIDATOR_STAKE = 500; // MDT (StakingVaultV2: minValidatorStake = 500 MDT)

async function getMDTBalance(accountId: string): Promise<number> {
  const res = await fetch(
    `${MIRROR}/accounts/${accountId}/tokens?token.id=${MDT_TOKEN_ID}&limit=1`,
    { cache: 'no-store' }
  );
  const data = await res.json();
  const entry = (data.tokens || []).find((t: any) => t.token_id === MDT_TOKEN_ID);
  return entry ? Number(BigInt(entry.balance)) / 1e8 : 0;
}

async function getEVMAddress(accountId: string): Promise<string> {
  const res = await fetch(`${MIRROR}/accounts/${accountId}`, { cache: 'no-store' });
  const data = await res.json();
  return data.evm_address || '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      role,
      accountId,
      stakeAmount,
      capabilities,
      subnetIds,
      // Optional: client sends private key for on-chain staking (MetaMask flow)
      // For HashPack, staking must be done client-side — skipOnChainStake=true
      privateKey,
      skipOnChainStake = false,
    } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const minStake = role === 'validator' ? MIN_VALIDATOR_STAKE : MIN_MINER_STAKE;

    // ── Step 1: Check MDT balance or on-chain stake ────────────────────────
    let mdtBalance = 0;
    let evmAddress = '';
    try {
      mdtBalance = await getMDTBalance(accountId);
      evmAddress = await getEVMAddress(accountId);
    } catch (e) {
      console.warn('[hcs/register] Mirror node check failed:', e);
    }

    // If skipOnChainStake=true, the client already staked — verify on-chain instead of wallet balance
    if (!skipOnChainStake && mdtBalance < minStake) {
      return NextResponse.json({
        error: `Insufficient MDT balance`,
        code: 'INSUFFICIENT_MDT',
        balance: mdtBalance,
        required: minStake,
        role,
        needFaucet: true,
        faucetAmount: minStake - mdtBalance + 100,
        message: `You have ${mdtBalance.toFixed(2)} MDT but need ${minStake} MDT to register as ${role}. Use the faucet to get testnet MDT.`,
      }, { status: 402 });
    }

    // ── Step 2: On-chain staking (if private key provided & vault deployed) ─
    let stakeResult: any = null;
    const vaultAddress = process.env.STAKING_VAULT_EVM_ADDRESS || '';

    if (!skipOnChainStake && privateKey && vaultAddress) {
      try {
        const stakeRes = await fetch(
          new URL('/api/staking/stake', req.url).toString(),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evmAddress,
              privateKey,
              role: role === 'holder' ? 'miner' : role, // holders use miner role on-chain
              amount: stakeAmount,
            }),
          }
        );
        stakeResult = await stakeRes.json();
        if (!stakeRes.ok && !stakeResult.alreadyStaked) {
          return NextResponse.json({
            error: stakeResult.error || 'On-chain staking failed',
            code: 'STAKE_FAILED',
            details: stakeResult,
          }, { status: 400 });
        }
      } catch (e: any) {
        console.warn('[hcs/register] On-chain stake failed:', e.message);
        // Non-fatal if vault not deployed — continue to HCS
      }
    }

    // ── Step 3: Submit HCS message ─────────────────────────────────────────
    const hcsMessage: Record<string, any> = {
      type: 'miner_register',
      miner_id: accountId,
      account_id: accountId,
      capabilities: role === 'holder' ? ['passive_holder'] : (capabilities || ['text_generation']),
      stake_amount: Math.floor(stakeAmount * 1e8),
      subnet_ids: subnetIds || [0],
      timestamp: new Date().toISOString(),
      ...(role === 'holder' ? { role: 'holder' } : {}),
      ...(stakeResult?.txHash ? { stake_tx: stakeResult.txHash } : {}),
    };

    const hcsResult = await submitHcsMessage(REGISTRATION_TOPIC_ID, hcsMessage);
    const sequence = hcsResult.sequence || '0';
    const rawTxId = hcsResult.transaction_id || '';
    const txTimestamp = hcsResult.consensus_timestamp || '';

    return NextResponse.json({
      success: true,
      role,
      accountId,
      evmAddress,
      stakeAmount,
      mdtBalance,
      // HCS result
      topicId: REGISTRATION_TOPIC_ID,
      sequence,
      transactionId: rawTxId,
      // Direct link to the specific HCS submit transaction
      txUrl: txTimestamp
        ? `https://hashscan.io/testnet/transaction/${txTimestamp}`
        : `https://hashscan.io/testnet/topic/${REGISTRATION_TOPIC_ID}`,
      // Topic overview link (separate)
      topicUrl: `https://hashscan.io/testnet/topic/${REGISTRATION_TOPIC_ID}`,
      message: `${role === 'miner' ? 'Miner' : role === 'validator' ? 'Validator' : 'Holder'} registered on Hedera HCS`,
      // On-chain stake info
      onChainStake: stakeResult ? {
        txHash: stakeResult.txHash,
        alreadyStaked: stakeResult.alreadyStaked,
        hashscanUrl: stakeResult.hashscanUrl,
      } : null,
    });

  } catch (err: any) {
    console.error('[hcs/register]', err);
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 500 });
  }
}
