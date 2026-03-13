import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');
const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

export async function GET(
    request: Request,
    { params }: { params: { topicId: string } }
) {
    const { topicId } = params;
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'hcs'; // type=miners|validators|tasks|hcs

    // Search by entity type
    if (type === 'miners') {
        try {
            const json = await fs.readFile(path.join(DATA_DIR, 'miner_registry.json'), 'utf8');
            const parsed = JSON.parse(json);
            const miners = parsed.miners || parsed;
            const arr = typeof miners === 'object' && !Array.isArray(miners) ? Object.values(miners) : miners;
            const found = (arr as any[]).filter((m: any) =>
                (m.miner_id || m.id || '').includes(topicId)
            );
            return NextResponse.json({ type: 'miners', results: found });
        } catch (e) {
            return NextResponse.json({ type: 'miners', results: [] });
        }
    }

    if (type === 'tasks') {
        try {
            const json = await fs.readFile(path.join(DATA_DIR, 'task_manager.json'), 'utf8');
            const parsed = JSON.parse(json);
            const tasks = parsed.tasks || {};
            const arr = Object.values(tasks) as any[];
            const assignments = parsed.assignments || {};
            const found = arr.filter((t: any) =>
                (t.task_id || '').includes(topicId) || (t.requester_id || '').includes(topicId)
            ).map((task: any) => ({
                ...task,
                assignments: assignments[task.task_id] || [],
            }));
            return NextResponse.json({ type: 'tasks', results: found });
        } catch (e) {
            return NextResponse.json({ type: 'tasks', results: [] });
        }
    }

    // Default: HCS topic messages
    try {
        const res = await fetch(`${MIRROR_BASE}/api/v1/topics/${topicId}/messages?limit=30&order=desc`);
        if (!res.ok) {
            return NextResponse.json({ type: 'hcs', results: [], error: `Mirror Node returned ${res.status}` });
        }

        const data = await res.json();
        const messages = (data.messages || []).map((m: any) => {
            let content: any = {};
            try {
                const decoded = Buffer.from(m.message, 'base64').toString();
                content = JSON.parse(decoded);
            } catch (e) {
                content = { raw: Buffer.from(m.message, 'base64').toString() };
            }

            return {
                sequence: m.sequence_number,
                timestamp: m.consensus_timestamp,
                payer: m.payer_account_id,
                content,
                topic_id: topicId
            };
        });

        return NextResponse.json({ type: 'hcs', results: messages, topic_id: topicId });
    } catch (error: any) {
        return NextResponse.json({ type: 'hcs', results: [], error: error.message });
    }
}
