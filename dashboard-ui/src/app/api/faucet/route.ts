import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

const PYTHON = process.env.PYTHON_PATH
  || 'C:\\Users\\NGO VAN TUAN\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

/**
 * Convert any Hedera tx identifier → HashScan URL using real consensus_timestamp.
 *
 * Accepts:
 *   - Python SDK format:  "0.0.8127455@1773559459.355786323"
 *   - Mirror node format: "0.0.8127455-1773559459-355786323"
 *   - EVM tx hash:        "0x1efc..."
 *   - Already a consensus_timestamp: "1773559463.066723000"
 */
export async function resolveTxUrl(txId: string): Promise<string | null> {
  if (!txId) return null;
  try {
    let mirrorId: string | null = null;

    if (txId.includes('@')) {
      // Python SDK: "0.0.8127455@1773559459.355786323"
      const [accountPart, timePart] = txId.split('@');
      // "1773559459.355786323" → split on first dot only → "1773559459-355786323"
      const dotIdx = timePart.indexOf('.');
      const secs = timePart.slice(0, dotIdx);
      const nanos = timePart.slice(dotIdx + 1);
      mirrorId = `${accountPart}-${secs}-${nanos}`;
    } else if (/^[\d.]+-[\d]+-[\d]+$/.test(txId)) {
      // Already mirror format: "0.0.8127455-1773559459-355786323"
      mirrorId = txId;
    } else if (/^\d+\.\d+$/.test(txId)) {
      // Already a consensus_timestamp: "1773559463.066723000"
      return `https://hashscan.io/testnet/transaction/${txId}`;
    } else if (txId.startsWith('0x')) {
      // EVM tx hash — query mirror node by hash
      const res = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${txId}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        const ts = data?.timestamp;
        if (ts) return `https://hashscan.io/testnet/transaction/${ts}`;
      }
      return null;
    }

    if (mirrorId) {
      const res = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/transactions/${mirrorId}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        const ts = data?.transactions?.[0]?.consensus_timestamp;
        if (ts) return `https://hashscan.io/testnet/transaction/${ts}`;
      }
      // Fallback: HashScan also accepts transaction_id format
      return `https://hashscan.io/testnet/transaction/${mirrorId}`;
    }
  } catch (_) {}
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accountId, amount = 100 } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }

    // Fixed 500 MDT per request
    const fixedAmount = 500;

    // Write params to temp file (same pattern as hcs_submit.py)
    const tmpFile = path.join(os.tmpdir(), `faucet_drip_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ account_id: accountId, amount: fixedAmount }), 'utf-8');

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
      txUrl: await resolveTxUrl(result.tx_id),
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
