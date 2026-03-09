import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Path to the backend data files
const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'miner_registry.json');
        let data = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);
            // The registry might be a dict mapped by miner ID, convert to array if needed.
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                data = Object.values(parsed);
            } else {
                data = parsed;
            }
        } catch (err: any) {
            // If file doesn't exist yet, return empty list
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch miners data', details: error.message }, { status: 500 });
    }
}
