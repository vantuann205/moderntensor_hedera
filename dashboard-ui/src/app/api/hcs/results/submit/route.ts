/**
 * POST /api/hcs/results/submit
 * Miner submits result for an HCS-only task (no on-chain taskId)
 * Records result hash to HCS scoring topic
 */
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

const SCORING_TOPIC_ID = process.env.NEXT_PUBLIC_SCORING_TOPIC_ID || '0.0.8198584';
const PYTHON = process.env.PYTHON_PATH
  || 'C:\\Users\\NGO VAN TUAN\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

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

    const tmpFile = path.join(os.tmpdir(), `hcs_result_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ topic_id: SCORING_TOPIC_ID, message: hcsMessage }), 'utf-8');

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

    return NextResponse.json({
      success: true,
      taskId,
      sequence: hcsResult.sequence,
      transactionId: hcsResult.transaction_id,
    });
  } catch (err: any) {
    console.error('[hcs/results/submit]', err);
    return NextResponse.json({ error: err.message || 'Result submission failed' }, { status: 500 });
  }
}
