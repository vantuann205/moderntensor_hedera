/**
 * POST /api/tasks/create-onchain
 *
 * HashPack flow — sau khi user transfer MDT → deployer:
 *   1. Gọi scripts/task_create.py (Hedera SDK Python)
 *      → AccountAllowanceApproveTransaction (deployer approves registry)
 *      → ContractExecuteTransaction → createTask()
 *      → emit TaskCreated(taskId) on-chain
 *
 * Dùng Python SDK vì AccountAllowanceApproveTransaction không support qua ethers.js RPC.
 */
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

const PYTHON = process.env.PYTHON_PATH
  || 'C:\\Users\\NGO VAN TUAN\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

export async function POST(req: Request) {
  try {
    const { subnetId, taskHash, rewardRaw, durationSecs } = await req.json();

    if (subnetId == null || !taskHash || !rewardRaw || !durationSecs) {
      return NextResponse.json(
        { error: 'subnetId, taskHash, rewardRaw, durationSecs required' },
        { status: 400 }
      );
    }

    const params = {
      subnet_id: Number(subnetId),
      task_hash: taskHash,
      reward_raw: String(rewardRaw),
      duration_secs: Number(durationSecs),
    };

    const tmpFile = path.join(os.tmpdir(), `task_create_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(params), 'utf-8');

    const projectRoot = path.join(process.cwd(), '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'task_create.py');

    let result: any = {};
    try {
      const { stdout, stderr } = await execAsync(
        `"${PYTHON}" "${scriptPath}" "${tmpFile}"`,
        { cwd: projectRoot, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 120000 }
      );
      if (stderr) console.warn('[task_create stderr]', stderr);
      const lines = stdout.trim().split('\n').filter(Boolean);
      result = JSON.parse(lines[lines.length - 1]);
      if (result.error) throw new Error(result.error);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      onChainTaskId: result.on_chain_task_id ? String(result.on_chain_task_id) : null,
      txId: result.tx_id || null,
      contractTs: result.contract_ts || null,
      hashscanUrl: result.contract_ts
        ? `https://hashscan.io/testnet/transaction/${result.contract_ts}`
        : null,
    });
  } catch (err: any) {
    console.error('[tasks/create-onchain]', err);
    return NextResponse.json(
      { error: err.message || 'createTask failed' },
      { status: 500 }
    );
  }
}
