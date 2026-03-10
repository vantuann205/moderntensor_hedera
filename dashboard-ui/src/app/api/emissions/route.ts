import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');
const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'emissions.json');
        let data: any = null;

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            data = JSON.parse(fileContents);
        } catch (err) { }

        if (!data || Object.keys(data).length === 0) {
            // Fallback to real token supply from Mirror Node
            const tokenId = process.env.NEXT_PUBLIC_MDT_TOKEN_ID;
            if (tokenId) {
                const res = await fetch(`${MIRROR_BASE}/api/v1/tokens/${tokenId}`);
                if (res.ok) {
                    const tokenData = await res.json();
                    data = {
                        total_emitted: Number(tokenData.total_supply) / Math.pow(10, tokenData.decimals),
                        block_height: '-', // HBAR does not use block height in the same way
                        timestamp: new Date().toISOString()
                    };
                }
            }
        }

        if (!data) data = { total_emitted: 0, block_height: '-', timestamp: new Date().toISOString() };

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch real emissions data', details: error.message }, { status: 500 });
    }
}
