import { NextResponse } from 'next/server';

const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';
const REGISTRATION_TOPIC = process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID || '0.0.5134721'; // Placeholder if not in env
const TASK_TOPIC = process.env.NEXT_PUBLIC_TASK_TOPIC_ID || '0.0.5134722';

export async function GET() {
    try {
        // Poll HCS topics for recent events
        // In a production app, we would cache this or use a more efficient sync
        const topics = [REGISTRATION_TOPIC, TASK_TOPIC];
        const allMessages = await Promise.all(topics.map(async (topicId) => {
            try {
                const res = await fetch(`${MIRROR_BASE}/api/v1/topics/${topicId}/messages?limit=10&order=desc`);
                if (!res.ok) return [];
                const data = await res.json();
                return data.messages.map((m: any) => {
                    let content = m.message;
                    try { content = JSON.parse(Buffer.from(m.message, 'base64').toString()); } catch (e) { }
                    return {
                        id: m.consensus_timestamp,
                        topic_id: topicId,
                        type: topicId === REGISTRATION_TOPIC ? 'REGISTRATION' : 'TASK',
                        content,
                        timestamp: m.consensus_timestamp
                    };
                });
            } catch (e) { return []; }
        }));

        const activeFeed = allMessages.flat().sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

        return NextResponse.json(activeFeed.slice(0, 20));
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch HCS activity', details: error.message }, { status: 500 });
    }
}
