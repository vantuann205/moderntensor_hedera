/**
 * POST /api/staking/deposit
 *
 * Hedera HTS compatible staking deposit flow:
 * 1. Receives user's Hedera accountId + amount
 * 2. Verifies user sent MDT to vault via Hedera SDK (checks mirror node balance)
 * 3. Calls vault.recordDeposit(userEVM, amount) using deployer key
 *
 * Called by frontend after user confirms Hedera SDK transfer.
 */
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

/** Resolve EVM tx hash → HashScan URL via mirror node contracts/results */
async function resolveEvmTxUrl(txHash: string): Promise<string> {
  try {
    const res = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${txHash}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      const ts = data?.timestamp;
      if (ts) return `https://hashscan.io/testnet/transaction/${ts}`;
    }
  } catch (_) {}
  return `https://hashscan.io/testnet/transaction/${txHash}`;
}

const HEDERA_RPC = 'https://testnet.hashio.io/api';
const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';
const VAULT_EVM = process.env.STAKING_VAULT_EVM_ADDRESS || '0x99968cF6Aa38337a4dD3cBf40D13011293Cf718f';
const DEPLOYER_KEY = process.env.HEDERA_PRIVATE_KEY || '';
const MDT_ID = process.env.NEXT_PUBLIC_MDT_TOKEN_ID || '0.0.8198586';

const VAULT_ABI = [
  'function recordDeposit(address user, uint256 amount) external',
  'function pendingDeposit(address user) view returns (uint256)',
];

export async function POST(req: Request) {
  try {
    const { accountId, evmAddress, amount } = await req.json();
    if (!accountId || !evmAddress || !amount) {
      return NextResponse.json({ error: 'accountId, evmAddress, amount required' }, { status: 400 });
    }

    const amountRaw = BigInt(Math.floor(Number(amount) * 1e8));

    // Verify vault received MDT (check mirror node)
    const vaultId = process.env.NEXT_PUBLIC_STAKING_VAULT_ID || '0.0.8219632';
    const tokRes = await fetch(
      `${MIRROR}/accounts/${vaultId}/tokens?token.id=${MDT_ID}&limit=1`,
      { cache: 'no-store' }
    );
    const tokData = await tokRes.json();
    const entry = (tokData.tokens || []).find((t: any) => t.token_id === MDT_ID);
    const vaultBalance = entry ? Number(BigInt(entry.balance)) / 1e8 : 0;
    console.log(`[deposit] Vault MDT balance: ${vaultBalance}`);

    // Call recordDeposit on-chain
    const provider = new ethers.JsonRpcProvider(HEDERA_RPC);
    const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
    const vault = new ethers.Contract(VAULT_EVM, VAULT_ABI, deployer);

    const tx = await vault.recordDeposit(evmAddress, amountRaw, { gasLimit: 200000 });
    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      return NextResponse.json({ error: 'recordDeposit failed on-chain' }, { status: 500 });
    }

    const pending = await vault.pendingDeposit(evmAddress);

    // Resolve real consensus_timestamp for HashScan link
    const hashscanUrl = await resolveEvmTxUrl(receipt.hash);

    return NextResponse.json({
      success: true,
      txHash: receipt.hash,
      pendingDeposit: Number(pending) / 1e8,
      hashscanUrl,
    });
  } catch (err: any) {
    console.error('[staking/deposit]', err);
    return NextResponse.json({ error: err.message || 'Deposit recording failed' }, { status: 500 });
  }
}
