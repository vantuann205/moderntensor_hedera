/**
 * POST /api/hcs/results/submit
 * Miner submits result for an HCS-only task
 */
import { NextResponse } from 'next/server';
import { submitHcsMessage } from '@/lib/hcs-submit';

const SCORING_TOPIC_ID = process.env.NEXT_PUBLIC_SCORING_TOPIC_ID || '0.0.8198584';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, minerId, resultHash } = body;

    if (!taskId || !minerId || !resultHash) {
      return NextResponse.json({ error: 'taskId, minerId, resultHash required' }, { status: 400 });
    }

    const hcsMessage = {
      type: 'result_submit',
      task_id: taskId,
      miner_id: minerId,
      result_hash: resultHash,
      timestamp: new Date().toISOString(),
    };

    const hcsResult = await submitHcsMessage(SCORING_TOPIC_ID, hcsMessage);

    return NextResponse.json({
      success: true,
      taskId,
      sequence: hcsResult.sequence,
      transactionId: hcsResult.transaction_id,
      consensusTimestamp: hcsResult.consensus_timestamp || '',
    });
  } catch (err: any) {
    console.error('[hcs/results/submit]', err);
    return NextResponse.json({ error: err.message || 'Result submission failed' }, { status: 500 });
  }
}
