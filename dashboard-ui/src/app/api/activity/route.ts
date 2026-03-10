import { NextResponse } from 'next/server';

const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

let cachedTopics: string[] = [];
let lastDiscovery = 0;
const CACHE_TTL = 60000; // 60 seconds

async function discoverTopics() {
    const now = Date.now();
    if (cachedTopics.length > 0 && (now - lastDiscovery) < CACHE_TTL) {
        return cachedTopics;
    }

    try {
        const res = await fetch(`${MIRROR_BASE}/api/v1/topics?limit=25&order=desc`);
        if (!res.ok) return cachedTopics;
        const data = await res.json();

        cachedTopics = data.topics
            .filter((t: any) => t.memo && t.memo.toLowerCase().includes('moderntensor'))
            .map((t: any) => t.topic_id);

        lastDiscovery = now;
        return cachedTopics;
    } catch (e) {
        console.error('Topic discovery failed:', e);
        return cachedTopics;
    }
}

export async function GET() {
    try {
        let topics = [];
        const envReg = process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID;
        const envTask = process.env.NEXT_PUBLIC_TASK_TOPIC_ID;

        if (envReg && envTask) {
            topics = [envReg, envTask];
        } else {
            // Fallback to discovery
            topics = await discoverTopics();
        }

        if (topics.length === 0) {
            // Default known testnet topics for ModernTensor if discovery fails
            topics = ['0.0.5134721', '0.0.5134722'];
        }

        const allMessages = await Promise.all(topics.map(async (topicId: string) => {
            try {
                const res = await fetch(`${MIRROR_BASE}/api/v1/topics/${topicId}/messages?limit=15&order=desc`);
                if (!res.ok) return [];
                const data = await res.json();
                return data.messages.map((m: any) => {
                    let content: any = {};
                    try {
                        const decoded = Buffer.from(m.message, 'base64').toString();
                        content = JSON.parse(decoded);
                    } catch (e) {
                        content = { raw: Buffer.from(m.message, 'base64').toString().slice(0, 100) };
                    }

                    return {
                        id: m.consensus_timestamp,
                        topic_id: topicId,
                        type: content.type || 'PROTOCOL_EVENT',
                        content,
                        payer: m.payer_account_id,
                        timestamp: m.consensus_timestamp,
                        sequence: m.sequence_number
                    };
                });
            } catch (e) { return []; }
        }));

        const activeFeed = allMessages.flat().sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

        return NextResponse.json(activeFeed.slice(0, 30));
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch HCS activity', details: error.message }, { status: 500 });
    }
}
