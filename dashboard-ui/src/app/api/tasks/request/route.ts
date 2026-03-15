/**
 * POST /api/tasks/request
 * Requester submits an AI request to HCS (type: 'task_request')
 */
import { NextResponse } from 'next/server';
import { submitHcsMessage } from '@/lib/hcs-submit';

const TASK_TOPIC_ID = process.env.NEXT_PUBLIC_TASK_TOPIC_ID || '0.0.8198585';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskType, prompt, rewardMDT, subnetId, deadline, requester } = body;

    if (!taskType || !prompt || !rewardMDT || !requester) {
      return NextResponse.json({ error: 'taskType, prompt, rewardMDT, requester required' }, { status: 400 });
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const hcsMessage = {
      type: 'task_request',
      request_id: requestId,
      task_type: taskType,
      prompt,
      reward_amount: Math.floor(Number(rewardMDT) * 1e8),
      subnet_id: subnetId ?? 0,
      requester_id: requester,
      deadline_hours: deadline ?? 24,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    const hcsResult = await submitHcsMessage(TASK_TOPIC_ID, hcsMessage);

    return NextResponse.json({
      success: true,
      requestId,
      topicId: TASK_TOPIC_ID,
      sequence: hcsResult.sequence,
      transactionId: hcsResult.transaction_id,
      txUrl: hcsResult.consensus_timestamp
        ? `https://hashscan.io/testnet/transaction/${hcsResult.consensus_timestamp}`
        : `https://hashscan.io/testnet/topic/${TASK_TOPIC_ID}`,
    });
  } catch (err: any) {
    console.error('[tasks/request]', err);
    return NextResponse.json({ error: err.message || 'Request submission failed' }, { status: 500 });
  }
}
