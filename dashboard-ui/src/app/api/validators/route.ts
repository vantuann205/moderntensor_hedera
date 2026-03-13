import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        let data: any[] = [];

        // Try reading from validator_registry.json (created by sync_real_data.py from Hedera HCS)
        try {
            const fileContents = await fs.readFile(path.join(DATA_DIR, 'validator_registry.json'), 'utf8');
            const parsed = JSON.parse(fileContents);
            const valsObj = parsed.validators || parsed;

            if (typeof valsObj === 'object' && !Array.isArray(valsObj)) {
                data = Object.values(valsObj);
            } else {
                data = Array.isArray(valsObj) ? valsObj : [];
            }
        } catch (err) {
            // No validator_registry.json — return empty, no fake fallback
            data = [];
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json([], { status: 200 });
    }
}

// Staking endpoint: POST /api/validators { validator_id, amount, staker_account }
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { validator_id, amount, staker_account } = body;

        if (!validator_id || !amount) {
            return NextResponse.json({ error: 'Missing validator_id or amount' }, { status: 400 });
        }

        const stakeRecord = {
            validator_id,
            staker_account: staker_account || 'unknown',
            amount: Number(amount),
            status: 'simulated',
            timestamp: new Date().toISOString(),
            message: `Stake of ${amount} HBAR recorded for validator ${validator_id}. Run sync_real_data.py to verify on-chain state.`,
        };

        return NextResponse.json(stakeRecord);
    } catch (error: any) {
        return NextResponse.json({ error: 'Stake failed', details: error.message }, { status: 500 });
    }
}
