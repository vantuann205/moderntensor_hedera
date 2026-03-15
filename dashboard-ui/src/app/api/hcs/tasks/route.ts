import { NextResponse } from 'next/server';
import { hcsMirrorClient } from '@/lib/hcs-mirror-client';
import { ethers } from 'ethers';

const HEDERA_RPC = process.env.NEXT_PUBLIC_HEDERA_RPC || 'https://testnet.hashio.io/api';
const SUBNET_REGISTRY = process.env.NEXT_PUBLIC_SUBNET_REGISTRY || '0xbdbd7a138c7f815b1A7f432C1d06b2B95E46Ba1F';
const SCORING_TOPIC_ID = process.env.NEXT_PUBLIC_SCORING_TOPIC_ID || '0.0.8198584';

const GET_TASK_ABI = [
  'function getTask(uint256 id) view returns (uint256 id, uint256 subnetId, address requester, string taskHash, uint256 totalDeposit, uint256 rewardAmount, uint256 protocolFee, uint256 validatorReward, uint256 stakingPoolFee, uint256 subnetFee, uint256 deadline, uint8 status, address winningMiner, uint256 winningScore, uint256 createdAt)',
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    // role=validator → show tasks that have submissions pending scoring (don't hide on result_submit)
    const isValidator = searchParams.get('role') === 'validator';

    // Fetch tasks + scoring topic messages in parallel
    const [tasks, scoringMessages] = await Promise.all([
      hcsMirrorClient.getTaskSubmissions(),
      hcsMirrorClient.getTopicMessages(SCORING_TOPIC_ID, 200),
    ]);

    // Build sets of "done" taskIds from HCS scoring topic
    const resultSubmittedIds = new Set<string>();
    const scoredIds = new Set<string>();
    for (const msg of scoringMessages) {
      const tid = String(msg.task_id || '');
      if (!tid) continue;
      if (msg.type === 'result_submit') resultSubmittedIds.add(tid);
      if (msg.type === 'score_submit') scoredIds.add(tid);
    }

    // Check on-chain status for tasks with onChainTaskId
    const provider = new ethers.JsonRpcProvider(HEDERA_RPC);
    const registry = new ethers.Contract(SUBNET_REGISTRY, GET_TASK_ABI, provider);

    const filtered = await Promise.all(
      tasks.map(async (t) => {
        const tid = String(t.taskId || '');
        const onChainId = t.onChainTaskId;

        if (onChainId) {
          // Check on-chain status — hide if Completed/Cancelled/Expired (status >= 3)
          try {
            const task = await registry.getTask(onChainId);
            const status = Number(task.status);
            if (status >= 3) return null;

            if (isValidator) {
              // Validator: show task as long as it's not finalized on-chain
              // status 2 = PendingReview (has submissions to score) — always show
              return t;
            } else {
              // Miner: hide if already submitted result
              if (resultSubmittedIds.has(tid)) return null;
              return t;
            }
          } catch (_) {
            // Can't read on-chain — show to validator, hide to miner if result submitted
            if (!isValidator && resultSubmittedIds.has(tid)) return null;
            return t;
          }
        } else {
          // HCS-only task
          if (isValidator) {
            // Validator: hide only if already scored
            if (scoredIds.has(tid)) return null;
            return t;
          } else {
            // Miner: hide if result submitted OR scored
            if (resultSubmittedIds.has(tid) || scoredIds.has(tid)) return null;
            return t;
          }
        }
      })
    );

    const active = filtered.filter(Boolean);

    return NextResponse.json({
      success: true,
      data: active,
      count: active.length,
    });
  } catch (error: any) {
    console.error('Error fetching tasks from HCS:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
