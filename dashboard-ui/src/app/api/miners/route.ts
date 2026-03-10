import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Path to the backend data files
const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'miner_registry.json');
        let data: any[] = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);

            // Handle {"miners": { "id": {...} }}
            const minersObj = parsed.miners || parsed;

            if (typeof minersObj === 'object' && !Array.isArray(minersObj)) {
                data = Object.values(minersObj);
            } else {
                data = minersObj || [];
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch miners data', details: error.message }, { status: 500 });
    }
}
