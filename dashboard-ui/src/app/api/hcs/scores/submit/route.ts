/**
 * POST /api/hcs/scores/submit
 * Validator submits score for an HCS-only task (no on-chain taskId)
 */
import { NextResponse } from 'next/server';
import { submitHcsMessage } from '@/lib/hcs-submit';

const SCORING_TOPIC_ID = process.env.NEXT_PUBLIC_SCORING_TOPIC_ID || '0.0.8198584';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, validatorId, minerId, score, confidence, metrics } = body;

    if (!taskId || !validatorId || score == null) {
      return NextResponse.json({ error: 'taskId, validatorId, score required' }, { status: 400 });
    }

    const hcsMessage: any = {
      type: 'score_submit',
      validator_id: validatorId,
      miner_id: minerId || '',
      task_id: taskId,
      score: Number(score),
      confidence: confidence ?? 1,
      metrics: metrics || { relevance: 0, quality: 0, completeness: 0, creativity: 0 },
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
    console.error('[hcs/scores/submit]', err);
    return NextResponse.json({ error: err.message || 'Score submission failed' }, { status: 500 });
  }
}
