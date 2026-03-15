/**
 * POST /api/staking/stake-proxy
 * For HashPack users: deployer calls stake() on behalf of user
 * since HashPack HIP-338 ContractExecute requires additional client-side setup.
 *
 * Flow: pendingDeposit must already be credited (via /api/staking/deposit)
 * Then deployer calls vault.stake(amount, role) with user's evmAddress
 * NOTE: stake() uses msg.sender — so this only works if deployer IS the user.
 * For real HashPack: user must call stake() themselves via hashconnect.
 * This is a fallback proxy for demo/testnet.
 */
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const RPC = 'https://testnet.hashio.io/api';
const VAULT_EVM = process.env.STAKING_VAULT_EVM_ADDRESS || '0x99968cF6Aa38337a4dD3cBf40D13011293Cf718f';
const DEPLOYER_KEY = process.env.HEDERA_PRIVATE_KEY || '';

const VAULT_ABI = [
  'function stake(uint256 amount, uint8 role) nonpayable',
  'function stakes(address) view returns (uint256 amount, uint8 role, uint256 stakedAt, uint256 unstakeRequestedAt, bool isActive)',
  'function pendingDeposit(address) view returns (uint256)',
  'function isMiner(address) view returns (bool)',
];

export async function POST(req: Request) {
  try {
    const { evmAddress, role, amount } = await req.json();
    if (!evmAddress || !role || !amount) {
      return NextResponse.json({ error: 'evmAddress, role, amount required' }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(RPC);
    const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
    const vault = new ethers.Contract(VAULT_EVM, VAULT_ABI, deployer);

    // Check if already staked
    const existing = await vault.stakes(evmAddress);
    if (existing.isActive) {
      return NextResponse.json({ success: true, alreadyStaked: true, stakeAmount: Number(existing.amount) / 1e8 });
    }

    // Check pendingDeposit for user
    const pending = await vault.pendingDeposit(evmAddress);
    const amountRaw = BigInt(Math.floor(Number(amount) * 1e8));

    if (pending < amountRaw) {
      return NextResponse.json({
        error: `Insufficient pendingDeposit: have ${Number(pending) / 1e8} MDT, need ${amount} MDT. Call recordDeposit first.`,
      }, { status: 400 });
    }

    // stake() uses msg.sender — deployer can only stake for themselves
    // For user staking: user must call stake() directly via their wallet
    // This endpoint is only valid if deployer == user (not typical)
    // Return instructions for HashPack user to call stake() manually
    return NextResponse.json({
      success: false,
      requiresUserSignature: true,
      message: 'HashPack users must call vault.stake() directly via their wallet. pendingDeposit is credited — open HashScan to call stake().',
      vaultAddress: VAULT_EVM,
      stakeCalldata: vault.interface.encodeFunctionData('stake', [amountRaw, role === 'miner' ? 1 : 3]),
      pendingDeposit: Number(pending) / 1e8,
      hashscanVault: `https://hashscan.io/testnet/contract/${VAULT_EVM}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
