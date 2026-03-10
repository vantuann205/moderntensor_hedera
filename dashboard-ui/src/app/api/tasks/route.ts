import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');
const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

async function indexTasksFromHCS() {
    try {
        const topicId = process.env.NEXT_PUBLIC_TASK_TOPIC_ID || '0.0.5134722';
        const res = await fetch(`${MIRROR_BASE}/api/v1/topics/${topicId}/messages?limit=50&order=desc`);
        if (!res.ok) return [];
        const data = await res.json();

        const tasksMap = new Map();
        data.messages.forEach((m: any) => {
            try {
                const payload = JSON.parse(Buffer.from(m.message, 'base64').toString());
                if (payload.type === 'task_create' || payload.type === 'TASK') {
                    const id = payload.task_id || payload.id;
                    if (!tasksMap.has(id)) {
                        tasksMap.set(id, {
                            id,
                            task_id: id,
                            requester_id: payload.requester_id,
                            task_type: payload.task_type,
                            status: payload.status || 'pending',
                            reward: payload.reward_amount || 0,
                            created_at: m.consensus_timestamp,
                            timestamp: m.consensus_timestamp
                        });
                    }
                }
            } catch (e) { }
        });
        return Array.from(tasksMap.values());
    } catch (e) {
        return [];
    }
}

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'task_manager.json');
        let data: any[] = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);
            const tasksObj = parsed.tasks || parsed;

            if (typeof tasksObj === 'object' && !Array.isArray(tasksObj)) {
                data = Object.values(tasksObj);
            } else {
                data = tasksObj || [];
            }
        } catch (err) { }

        if (data.length === 0) {
            data = await indexTasksFromHCS();
        }

        // Sort by timestamp
        data.sort((a: any, b: any) => {
            const tA = Number(a.timestamp || a.created_at || 0);
            const tB = Number(b.timestamp || b.created_at || 0);
            return tB - tA;
        });

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch real tasks data', details: error.message }, { status: 500 });
    }
}
