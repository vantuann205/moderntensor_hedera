import { NextResponse } from 'next/server';
import { hcsMirrorClient } from '@/lib/hcs-mirror-client';
import { ethers } from 'ethers';

const HEDERA_RPC = 'https://testnet.hashio.io/api';
const STAKING_VAULT = '0x99968cF6Aa38337a4dD3cBf40D13011293Cf718f';
const MDT_DECIMALS = 8;

// Use getPoolStats() which returns totalStaked as first element — more reliable than state var getter
const STAKING_VAULT_ABI = [
  'function getPoolStats() view returns (uint256 _totalStaked, uint256 _activeMinerCount, uint256 _activeValidatorCount, uint256 _activeHolderCount, uint256 _totalRewardsDeposited, uint256 _totalRewardsClaimed, uint256 _totalFeesBurned, uint256 _currentRegFee)',
];

async function fetchOnChainTotalStaked(): Promise<number> {
  try {
    const provider = new ethers.JsonRpcProvider(HEDERA_RPC);
    // 8 second timeout
    const vault = new ethers.Contract(STAKING_VAULT, STAKING_VAULT_ABI, provider);
    const statsPromise = vault.getPoolStats();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('RPC timeout')), 8000)
    );
    const stats = await Promise.race([statsPromise, timeoutPromise]);
    const raw: bigint = stats[0]; // _totalStaked
    const result = Number(ethers.formatUnits(raw, MDT_DECIMALS));
    console.log('[protocol-stats] on-chain totalStaked:', result);
    return result;
  } catch (e) {
    console.error('[protocol-stats] fetchOnChainTotalStaked failed:', e);
    return 0;
  }
}

export async function GET() {
  try {
    const [miners, tasks, scores, onChainTotalStaked] = await Promise.all([
      hcsMirrorClient.getMinerRegistrations(),
      hcsMirrorClient.getTaskSubmissions(), // Get ALL tasks directly from client
      hcsMirrorClient.getScoreSubmissions(),
      fetchOnChainTotalStaked(),
    ]);

    // Deduplicate miners by minerId — keep latest registration (highest sequenceNumber)
    // This matches the dedup logic in MinersView so all counts are consistent
    const minerMap = new Map<string, typeof miners[0]>();
    miners.forEach(m => {
      const id = m.minerId || m.accountId;
      if (!id) return;
      const existing = minerMap.get(id);
      if (!existing || (m.sequenceNumber ?? 0) > (existing.sequenceNumber ?? 0)) {
        minerMap.set(id, m);
      }
    });
    const uniqueMiners = Array.from(minerMap.values());

    const totalMiners = uniqueMiners.length;
    const totalTasks = tasks.length;
    const totalScores = scores.length;

    // totalStaked = sum of latest stake per unique miner from HCS (authoritative for this protocol)
    // HCS stakeAmount is raw (8 decimals), divide by 1e8 to get MDT
    const hcsTotalStaked = uniqueMiners.reduce((sum, m) => sum + (m.stakeAmount || 0), 0) / 1e8;
    // On-chain is secondary (only tracks users who called stake() contract directly)
    const totalStaked = hcsTotalStaked > 0 ? hcsTotalStaked : onChainTotalStaked;

    // Calculate average score
    const avgScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;

    // Get unique validators
    const uniqueValidators = new Set(scores.map(s => s.validatorId));
    const totalValidators = uniqueValidators.size;

    // Get unique subnets from deduplicated miners
    const uniqueSubnets = new Set(uniqueMiners.flatMap(m => m.subnetIds || []));
    const totalSubnets = uniqueSubnets.size || 1;

    // minersPerSubnet from deduplicated miners — each unique miner counted once per subnet
    const minersPerSubnet: Record<number, number> = {};
    uniqueMiners.forEach(m => {
      (m.subnetIds || []).forEach((sid: number) => {
        minersPerSubnet[sid] = (minersPerSubnet[sid] || 0) + 1;
      });
    });

    const tasksPerSubnet: Record<number, number> = {};
    const taskSubnetMap = new Map();
    tasks.forEach(t => {
      const sid = t.subnetId || 0;
      tasksPerSubnet[sid] = (tasksPerSubnet[sid] || 0) + 1;
      taskSubnetMap.set(t.taskId, sid);
    });

    const valSetPerSubnet: Record<number, Set<string>> = {};
    scores.forEach((s: any) => {
        const sid = taskSubnetMap.get(s.taskId) ?? 0;
        if(!valSetPerSubnet[sid]) valSetPerSubnet[sid] = new Set();
        if(s.validatorId) valSetPerSubnet[sid].add(s.validatorId);
    });
    
    const validatorsPerSubnet: Record<number, number> = {};
    Object.keys(valSetPerSubnet).forEach(key => {
        validatorsPerSubnet[Number(key)] = valSetPerSubnet[Number(key)].size;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalMiners,
        totalValidators,
        totalSubnets,
        totalTasks,
        totalScores,
        totalStaked,
        avgScore: Math.round(avgScore * 100) / 100,
        minersPerSubnet,
        tasksPerSubnet,
        validatorsPerSubnet,
        miners: uniqueMiners.slice(-10), // Last 10 unique miners
        tasks: tasks.slice(-10), // Last 10 tasks
        scores: scores.slice(-10) // Last 10 scores
      }
    });
  } catch (error: any) {
    console.error('Error fetching protocol stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch protocol stats' },
      { status: 500 }
    );
  }
}
