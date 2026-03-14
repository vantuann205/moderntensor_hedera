import { NextResponse } from 'next/server';

const REGISTRATION_TOPIC_ID = process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID || '0.0.8198583';

// Submit HCS message via Hedera REST API (mirror node doesn't support writes)
// We use the Hedera SDK via a server-side call
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { role, accountId, stakeAmount, capabilities, subnetIds } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Build the HCS message based on role
    let message: Record<string, any>;

    if (role === 'miner') {
      if (!stakeAmount || stakeAmount < 10) {
        return NextResponse.json({ error: 'Miner requires minimum 10 MDT stake' }, { status: 400 });
      }
      message = {
        type: 'miner_register',
        miner_id: accountId,
        account_id: accountId,
        stake_amount: Math.floor(stakeAmount * 1e8), // convert to smallest unit
        capabilities: capabilities || ['text_generation'],
        subnet_ids: subnetIds || [0],
        timestamp: new Date().toISOString(),
      };
    } else if (role === 'holder') {
      if (!stakeAmount || stakeAmount < 1) {
        return NextResponse.json({ error: 'Holder requires minimum 1 MDT stake' }, { status: 400 });
      }
      message = {
        type: 'miner_register',
        miner_id: accountId,
        account_id: accountId,
        stake_amount: Math.floor(stakeAmount * 1e8),
        capabilities: ['passive_holder'],
        subnet_ids: [0],
        role: 'holder',
        timestamp: new Date().toISOString(),
      };
    } else {
      return NextResponse.json({ error: 'Invalid role. Must be miner or holder' }, { status: 400 });
    }

    // Submit to HCS via Python CLI (server-side, has operator key)
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const path = await import('path');
    const execAsync = promisify(exec);

    const PYTHON = "C:\\Users\\NGO VAN TUAN\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";
    const cwd = path.join(process.cwd(), '..');
    const msgJson = JSON.stringify(JSON.stringify(message)); // double stringify for shell

    const command = `"${PYTHON}" -c "
import sys, json
sys.path.insert(0, '.')
from sdk.hedera.client import HederaClient
from sdk.hedera.hcs import HCSService
import os

client = HederaClient.from_env()
hcs = HCSService(client)
msg = json.loads(${JSON.stringify(JSON.stringify(message))})
receipt = client.submit_message('${REGISTRATION_TOPIC_ID}', json.dumps(msg))
print(json.dumps({'sequence': str(receipt.topic_sequence_number), 'status': str(receipt.status)}))
"`;

    const { stdout, stderr } = await execAsync(command, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      timeout: 30000,
    });

    if (stderr && !stdout) {
      throw new Error(stderr);
    }

    let result: any = {};
    try {
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      result = JSON.parse(lastLine);
    } catch {
      result = { raw: stdout };
    }

    return NextResponse.json({
      success: true,
      role,
      accountId,
      stakeAmount,
      topicId: REGISTRATION_TOPIC_ID,
      sequence: result.sequence,
      message: `${role === 'miner' ? 'Miner' : 'Holder'} registered on Hedera HCS topic ${REGISTRATION_TOPIC_ID}`,
      hashscanUrl: `https://hashscan.io/testnet/topic/${REGISTRATION_TOPIC_ID}`,
    });

  } catch (err: any) {
    console.error('HCS register error:', err);
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 500 });
  }
}
