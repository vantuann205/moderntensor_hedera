import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

/**
 * Server-side staking: approve MDT + call StakingVault.stake()
 *
 * Flow per StakingVault.sol:
 *   1. mdtToken.approve(stakingVault, amount)
 *   2. stakingVault.stake(amount, role)  // role: 1=Miner, 2=Validator
 *
 * Called BEFORE HCS registration to enforce on-chain stake.
 * Uses the connected wallet's private key (MetaMask signs client-side,
 * HashPack signs via HIP-338 — for now server uses operator key for demo).
 */

const RPC = 'https://testnet.hashio.io/api';

// MDT token EVM address: 0x + token num hex padded
const MDT_TOKEN_NUM = 8198586;
const MDT_EVM = '0x' + MDT_TOKEN_NUM.toString(16).padStart(40, '0');

// StakingVault contract — set in env after deploy
const STAKING_VAULT_EVM = process.env.STAKING_VAULT_EVM_ADDRESS || '';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const STAKING_ABI = [
  'function stake(uint256 amount, uint8 role) nonpayable',
  'function stakes(address) view returns (uint256 amount, uint8 role, uint256 stakedAt, uint256 unstakeRequestedAt, bool isActive)',
  'function minMinerStake() view returns (uint256)',
  'function minValidatorStake() view returns (uint256)',
  'function isMiner(address) view returns (bool)',
  'function isValidator(address) view returns (bool)',
];

// StakeRole enum: 0=None, 1=Miner, 2=Validator
const STAKE_ROLE = { miner: 1, validator: 2 } as const;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { evmAddress, privateKey, role, amount } = body as {
      evmAddress: string;
      privateKey: string;
      role: 'miner' | 'validator';
      amount: number; // in MDT (human units)
    };

    if (!evmAddress || !privateKey || !role || !amount) {
      return NextResponse.json({ error: 'evmAddress, privateKey, role, amount required' }, { status: 400 });
    }

    if (!STAKING_VAULT_EVM) {
      return NextResponse.json({
        error: 'StakingVault not deployed yet. Set STAKING_VAULT_EVM_ADDRESS in .env.local',
        hint: 'Run: cd contracts && npx hardhat run scripts/deploy.js --network hedera_testnet',
      }, { status: 503 });
    }

    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Verify wallet matches evmAddress
    if (wallet.address.toLowerCase() !== evmAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Private key does not match evmAddress' }, { status: 400 });
    }

    const mdt = new ethers.Contract(MDT_EVM, ERC20_ABI, wallet);
    const vault = new ethers.Contract(STAKING_VAULT_EVM, STAKING_ABI, wallet);

    // MDT has 8 decimals
    const amountRaw = BigInt(Math.floor(amount * 1e8));

    // Check balance
    const balance: bigint = await mdt.balanceOf(evmAddress);
    if (balance < amountRaw) {
      return NextResponse.json({
        error: `Insufficient MDT. Have ${Number(balance) / 1e8} MDT, need ${amount} MDT`,
        balance: Number(balance) / 1e8,
        required: amount,
        needFaucet: true,
      }, { status: 400 });
    }

    // Check min stake
    const minStake: bigint = role === 'miner'
      ? await vault.minMinerStake()
      : await vault.minValidatorStake();

    if (amountRaw < minStake) {
      return NextResponse.json({
        error: `Below minimum stake. Min ${Number(minStake) / 1e8} MDT for ${role}`,
        minRequired: Number(minStake) / 1e8,
      }, { status: 400 });
    }

    // Check if already staked
    const existing = await vault.stakes(evmAddress);
    if (existing.isActive) {
      return NextResponse.json({
        success: true,
        alreadyStaked: true,
        stakeAmount: Number(existing.amount) / 1e8,
        role: existing.role === 1 ? 'miner' : 'validator',
        message: 'Already staked on-chain',
      });
    }

    // Step 1: Approve
    const allowance: bigint = await mdt.allowance(evmAddress, STAKING_VAULT_EVM);
    if (allowance < amountRaw) {
      const approveTx = await mdt.approve(STAKING_VAULT_EVM, amountRaw);
      await approveTx.wait();
    }

    // Step 2: Stake
    const stakeTx = await vault.stake(amountRaw, STAKE_ROLE[role]);
    const receipt = await stakeTx.wait();

    return NextResponse.json({
      success: true,
      alreadyStaked: false,
      txHash: receipt.hash,
      evmAddress,
      role,
      amount,
      amountRaw: amountRaw.toString(),
      hashscanUrl: `https://hashscan.io/testnet/tx/${receipt.hash}`,
    });
  } catch (err: any) {
    console.error('[staking/stake]', err);
    return NextResponse.json({ error: err.message || 'Staking failed' }, { status: 500 });
  }
}

// GET: check current stake status
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const evmAddress = searchParams.get('evmAddress');
  if (!evmAddress) return NextResponse.json({ error: 'evmAddress required' }, { status: 400 });

  if (!STAKING_VAULT_EVM) {
    return NextResponse.json({ staked: false, contractNotDeployed: true });
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC);
    const vault = new ethers.Contract(STAKING_VAULT_EVM, STAKING_ABI, provider);
    const info = await vault.stakes(evmAddress);

    return NextResponse.json({
      staked: info.isActive,
      amount: Number(info.amount) / 1e8,
      role: info.role === 1 ? 'miner' : info.role === 2 ? 'validator' : 'none',
      stakedAt: Number(info.stakedAt),
      unstakeRequestedAt: Number(info.unstakeRequestedAt),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
