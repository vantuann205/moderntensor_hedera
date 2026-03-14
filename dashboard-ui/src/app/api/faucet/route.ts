import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

// Same pattern as hcs_submit.py — run Python script directly, no server needed
const PYTHON = process.env.PYTHON_PATH
  || 'C:\\Users\\NGO VAN TUAN\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accountId, amount = 1000 } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }

    // Write params to temp file (same pattern as hcs_submit.py)
    const tmpFile = path.join(os.tmpdir(), `faucet_drip_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ account_id: accountId, amount }), 'utf-8');

    const projectRoot = path.join(process.cwd(), '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'faucet_drip.py');

    let result: any = {};
    try {
      const { stdout } = await execAsync(
        `"${PYTHON}" "${scriptPath}" "${tmpFile}"`,
        {
          cwd: projectRoot,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          timeout: 60000,
        }
      );
      // Parse last JSON line from stdout (same as hcs_submit.py)
      const lines = stdout.trim().split('\n').filter(Boolean);
      result = JSON.parse(lines[lines.length - 1]);
      if (result.error) throw new Error(result.error);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    return NextResponse.json({
      success: true,
      accountId,
      amount: result.amount,
      txId: result.tx_id,
      // Convert "0.0.xxx@timestamp" → hashscan transaction link
      txUrl: result.tx_id?.includes('@')
        ? `https://hashscan.io/testnet/transaction/${result.tx_id.split('@')[1]}`
        : null,
      mode: result.mode,
      tokenId: result.token_id,
      message: result.message,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Faucet failed' }, { status: 500 });
  }
}

export async function GET() {
  // Quick status check — just verify the script exists
  const projectRoot = path.join(process.cwd(), '..');
  const scriptPath = path.join(projectRoot, 'scripts', 'faucet_drip.py');
  const exists = fs.existsSync(scriptPath);
  return NextResponse.json({
    online: exists,
    mode: 'script', // runs via faucet_drip.py, no server needed
    scriptPath: 'scripts/faucet_drip.py',
  });
}
