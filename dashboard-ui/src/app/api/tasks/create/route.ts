/**
 * POST /api/tasks/create
 * Submit a real AI task to Hedera HCS topic 0.0.8198585
 * Message format matches sdk/hedera/hcs.py TaskSubmission
 */
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

const TASK_TOPIC_ID = process.env.NEXT_PUBLIC_TASK_TOPIC_ID || '0.0.8198585';
const PYTHON = process.env.PYTHON_PATH
  || 'C:\\Users\\NGO VAN TUAN\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskType, prompt, rewardMDT, subnetId, deadline, requester, onChainTaskId, contractTs, transferTs } = body;

    if (!taskType || !prompt || !rewardMDT || !requester) {
      return NextResponse.json({ error: 'taskType, prompt, rewardMDT, requester required' }, { status: 400 });
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rewardRaw = Math.floor(Number(rewardMDT) * 1e8); // MDT → 8 decimals

    const hcsMessage: Record<string, any> = {
      type: 'task_submit',
      task_id: taskId,
      task_type: taskType,
      prompt,
      reward_amount: rewardRaw,
      subnet_id: subnetId ?? 0,
      requester_id: requester,
      deadline_hours: deadline ?? 24,
      timestamp: new Date().toISOString(),
    };

    // Include on-chain references if provided
    if (onChainTaskId != null) hcsMessage.on_chain_task_id = String(onChainTaskId);
    if (contractTs) hcsMessage.contract_ts = contractTs;
    if (transferTs) hcsMessage.transfer_ts = transferTs;

    const tmpFile = path.join(os.tmpdir(), `hcs_task_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ topic_id: TASK_TOPIC_ID, message: hcsMessage }), 'utf-8');

    const projectRoot = path.join(process.cwd(), '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'hcs_submit.py');

    let hcsResult: any = {};
    try {
      const { stdout } = await execAsync(
        `"${PYTHON}" "${scriptPath}" "${tmpFile}"`,
        { cwd: projectRoot, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 60000 }
      );
      const lines = stdout.trim().split('\n').filter(Boolean);
      hcsResult = JSON.parse(lines[lines.length - 1]);
      if (hcsResult.error) throw new Error(hcsResult.error);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    const rawTxId: string = hcsResult.transaction_id || '';

    // Query mirror node to get the real consensus_timestamp for this sequence
    // The transaction_id timestamp is the submit time, NOT the consensus time
    let txTimestamp = '';
    try {
      const seq = hcsResult.sequence;
      const mirrorRes = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/topics/${TASK_TOPIC_ID}/messages/${seq}`,
        { cache: 'no-store' }
      );
      if (mirrorRes.ok) {
        const mirrorData = await mirrorRes.json();
        txTimestamp = mirrorData.consensus_timestamp || '';
      }
    } catch (_) {}

    // Fallback: parse from transaction_id if mirror query failed
    if (!txTimestamp && rawTxId.includes('@')) {
      txTimestamp = rawTxId.split('@')[1];
    }

    return NextResponse.json({
      success: true,
      taskId,
      onChainTaskId: onChainTaskId ?? null,
      topicId: TASK_TOPIC_ID,
      sequence: hcsResult.sequence,
      transactionId: rawTxId,
      txUrl: txTimestamp
        ? `https://hashscan.io/testnet/transaction/${txTimestamp}`
        : `https://hashscan.io/testnet/topic/${TASK_TOPIC_ID}`,
      topicUrl: `https://hashscan.io/testnet/topic/${TASK_TOPIC_ID}`,
      message: hcsMessage,
    });
  } catch (err: any) {
    console.error('[tasks/create]', err);
    return NextResponse.json({ error: err.message || 'Task submission failed' }, { status: 500 });
  }
}
