import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

const REGISTRATION_TOPIC_ID = process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID || '0.0.8198583';
const PYTHON = 'C:\\Users\\NGO VAN TUAN\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { role, accountId, stakeAmount, capabilities, subnetIds } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Build HCS message exactly matching MinerRegistration.to_json() format
    let hcsMessage: Record<string, any>;

    if (role === 'miner') {
      if (!stakeAmount || stakeAmount < 10) {
        return NextResponse.json({ error: 'Miner requires minimum 10 MDT stake' }, { status: 400 });
      }
      hcsMessage = {
        type: 'miner_register',
        miner_id: accountId,
        account_id: accountId,
        capabilities: capabilities || ['text_generation'],
        stake_amount: Math.floor(stakeAmount * 1e8), // MDT → smallest unit (8 decimals)
        subnet_ids: subnetIds || [0],
        timestamp: new Date().toISOString(),
      };
    } else if (role === 'holder') {
      if (!stakeAmount || stakeAmount < 1) {
        return NextResponse.json({ error: 'Holder requires minimum 1 MDT stake' }, { status: 400 });
      }
      hcsMessage = {
        type: 'miner_register',
        miner_id: accountId,
        account_id: accountId,
        capabilities: ['passive_holder'],
        stake_amount: Math.floor(stakeAmount * 1e8),
        subnet_ids: [0],
        role: 'holder',
        timestamp: new Date().toISOString(),
      };
    } else {
      return NextResponse.json({ error: 'Invalid role. Must be miner or holder' }, { status: 400 });
    }

    // Write params to a temp file (avoids shell escaping issues on Windows)
    const tmpFile = path.join(os.tmpdir(), `hcs_register_${Date.now()}.json`);
    const params = { topic_id: REGISTRATION_TOPIC_ID, message: hcsMessage };
    fs.writeFileSync(tmpFile, JSON.stringify(params), 'utf-8');

    // Project root is one level up from dashboard-ui
    const projectRoot = path.join(process.cwd(), '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'hcs_submit.py');

    let result: any = {};
    try {
      const { stdout, stderr } = await execAsync(
        `"${PYTHON}" "${scriptPath}" "${tmpFile}"`,
        {
          cwd: projectRoot,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          timeout: 30000,
        }
      );

      // Parse last JSON line from stdout
      const lines = stdout.trim().split('\n').filter(Boolean);
      const lastLine = lines[lines.length - 1];
      result = JSON.parse(lastLine);

      if (result.error) {
        throw new Error(result.error);
      }
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    const sequence = result.sequence || '0';

    return NextResponse.json({
      success: true,
      role,
      accountId,
      stakeAmount,
      topicId: REGISTRATION_TOPIC_ID,
      sequence,
      message: `${role === 'miner' ? 'Miner' : 'Holder'} registered on Hedera HCS`,
      // Link to the specific topic on HashScan
      hashscanUrl: `https://hashscan.io/testnet/topic/${REGISTRATION_TOPIC_ID}`,
      // Direct transaction link using sequence number
      txUrl: `https://hashscan.io/testnet/topic/${REGISTRATION_TOPIC_ID}?sequenceNumber=${sequence}`,
    });

  } catch (err: any) {
    console.error('HCS register error:', err);
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 500 });
  }
}
