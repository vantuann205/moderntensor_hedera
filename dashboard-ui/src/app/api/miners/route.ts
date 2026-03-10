import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');
const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

async function indexFromHCS() {
    try {
        const topicId = process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID || '0.0.5134721';
        const res = await fetch(`${MIRROR_BASE}/api/v1/topics/${topicId}/messages?limit=50&order=desc`);
        if (!res.ok) return [];
        const data = await res.json();

        const minersMap = new Map();
        data.messages.forEach((m: any) => {
            try {
                const payload = JSON.parse(Buffer.from(m.message, 'base64').toString());
                if (payload.type === 'miner_register' || payload.type === 'REGISTRATION') {
                    const id = payload.miner_id || payload.account_id;
                    if (!minersMap.has(id)) {
                        minersMap.set(id, {
                            id,
                            miner_id: id,
                            account_id: payload.account_id,
                            capabilities: payload.capabilities || [],
                            stake: payload.stake_amount || 0,
                            status: 'active',
                            last_seen: m.consensus_timestamp
                        });
                    }
                }
            } catch (e) { }
        });
        return Array.from(minersMap.values());
    } catch (e) {
        return [];
    }
}

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'miner_registry.json');
        let data: any[] = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);
            const minersObj = parsed.miners || parsed;

            if (typeof minersObj === 'object' && !Array.isArray(minersObj)) {
                data = Object.values(minersObj);
            } else {
                data = minersObj || [];
            }
        } catch (err) { }

        // If local data is empty, index from the actual blockchain (HCS)
        if (data.length === 0) {
            data = await indexFromHCS();
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch real miners data', details: error.message }, { status: 500 });
    }
}
