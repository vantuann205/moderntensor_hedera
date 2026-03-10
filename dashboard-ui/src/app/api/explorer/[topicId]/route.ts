import { NextResponse } from 'next/server';

const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

export async function GET(
    request: Request,
    { params }: { params: { topicId: string } }
) {
    const { topicId } = params;

    try {
        const res = await fetch(`${MIRROR_BASE}/api/v1/topics/${topicId}/messages?limit=50&order=desc`);
        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to fetch messages from Mirror Node' }, { status: res.status });
        }

        const data = await res.json();
        const messages = data.messages.map((m: any) => {
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

        return NextResponse.json(messages);
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
