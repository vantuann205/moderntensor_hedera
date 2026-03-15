/**
 * POST /api/tasks/request
 * Requester submits an AI request to HCS (type: 'task_request')
 * No MDT transfer, no contract call — just a request for validators to review.
 *
 * Validators see this in their dashboard and dispatch it as a real task
 * (createTask on-chain + HCS type:'task_create') after review.
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
    const { taskType, prompt, rewardMDT, subnetId, deadline, requester } = body;

    if (!taskType || !prompt || !rewardMDT || !requester) {
      return NextResponse.json({ error: 'taskType, prompt, rewardMDT, requester required' }, { status: 400 });
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rewardRaw = Math.floor(Number(rewardMDT) * 1e8);

    const hcsMessage = {
      type: 'task_request',
      request_id: requestId,
      task_type: taskType,
      prompt,
      reward_amount: rewardRaw,
      subnet_id: subnetId ?? 0,
      requester_id: requester,
      deadline_hours: deadline ?? 24,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    const tmpFile = path.join(os.tmpdir(), `hcs_req_${Date.now()}.json`);
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

    // Get consensus timestamp from mirror node
    let txTimestamp = '';
    try {
      const seq = hcsResult.sequence;
      const mirrorRes = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/topics/${TASK_TOPIC_ID}/messages/${seq}`,
        { cache: 'no-store' }
      );
      if (mirrorRes.ok) {
        const d = await mirrorRes.json();
        txTimestamp = d.consensus_timestamp || '';
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      requestId,
      topicId: TASK_TOPIC_ID,
      sequence: hcsResult.sequence,
      transactionId: hcsResult.transaction_id,
      txUrl: txTimestamp
        ? `https://hashscan.io/testnet/transaction/${txTimestamp}`
        : `https://hashscan.io/testnet/topic/${TASK_TOPIC_ID}`,
    });
  } catch (err: any) {
    console.error('[tasks/request]', err);
    return NextResponse.json({ error: err.message || 'Request submission failed' }, { status: 500 });
  }
}
