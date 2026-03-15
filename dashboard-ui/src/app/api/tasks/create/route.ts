/**
 * POST /api/tasks/create
 * Submit a real AI task to Hedera HCS topic
 */
import { NextResponse } from 'next/server';
import { submitHcsMessage } from '@/lib/hcs-submit';

const TASK_TOPIC_ID = process.env.NEXT_PUBLIC_TASK_TOPIC_ID || '0.0.8198585';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskType, prompt, rewardMDT, subnetId, deadline, requester, onChainTaskId, contractTs, transferTs } = body;

    if (!taskType || !prompt || !rewardMDT || !requester) {
      return NextResponse.json({ error: 'taskType, prompt, rewardMDT, requester required' }, { status: 400 });
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const hcsMessage: Record<string, any> = {
      type: 'task_create',
      task_id: taskId,
      task_type: taskType,
      prompt,
      reward_amount: Number(rewardMDT),
      subnet_id: subnetId ?? 0,
      requester_id: requester,
      deadline_hours: deadline ?? 24,
      timestamp: new Date().toISOString(),
    };

    if (onChainTaskId != null) hcsMessage.on_chain_task_id = String(onChainTaskId);
    if (contractTs) hcsMessage.contract_ts = contractTs;
    if (transferTs) hcsMessage.transfer_ts = transferTs;

    const hcsResult = await submitHcsMessage(TASK_TOPIC_ID, hcsMessage);

    return NextResponse.json({
      success: true,
      taskId,
      onChainTaskId: onChainTaskId ?? null,
      topicId: TASK_TOPIC_ID,
      sequence: hcsResult.sequence,
      transactionId: hcsResult.transaction_id,
      txUrl: hcsResult.consensus_timestamp
        ? `https://hashscan.io/testnet/transaction/${hcsResult.consensus_timestamp}`
        : `https://hashscan.io/testnet/topic/${TASK_TOPIC_ID}`,
      topicUrl: `https://hashscan.io/testnet/topic/${TASK_TOPIC_ID}`,
      message: hcsMessage,
    });
  } catch (err: any) {
    console.error('[tasks/create]', err);
    return NextResponse.json({ error: err.message || 'Task submission failed' }, { status: 500 });
  }
}
