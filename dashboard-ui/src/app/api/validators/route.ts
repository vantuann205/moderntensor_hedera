import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');
const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

async function indexValidatorsFromHCS() {
    try {
        const topicId = process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID || '0.0.5134721';
        const res = await fetch(`${MIRROR_BASE}/api/v1/topics/${topicId}/messages?limit=50&order=desc`);
        if (!res.ok) return [];
        const data = await res.json();

        const validatorsMap = new Map();
        data.messages.forEach((m: any) => {
            try {
                const payload = JSON.parse(Buffer.from(m.message, 'base64').toString());
                // In this protocol, validators might be marked by a specific type or capability
                if (payload.type === 'validator_register' || (payload.capabilities && payload.capabilities.includes('validation'))) {
                    const id = payload.validator_id || payload.account_id;
                    if (!validatorsMap.has(id)) {
                        validatorsMap.set(id, {
                            id,
                            validator_id: id,
                            account_id: payload.account_id,
                            status: 'active',
                            last_active: m.consensus_timestamp
                        });
                    }
                }
            } catch (e) { }
        });
        return Array.from(validatorsMap.values());
    } catch (e) {
        return [];
    }
}

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'validator_registry.json');
        let data: any[] = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);
            const valsObj = parsed.validators || parsed;

            if (typeof valsObj === 'object' && !Array.isArray(valsObj)) {
                data = Object.values(valsObj);
            } else {
                data = valsObj || [];
            }
        } catch (err) { }

        if (data.length === 0) {
            data = await indexValidatorsFromHCS();
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch real validators data', details: error.message }, { status: 500 });
    }
}
