import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// For this project, if we don't have a specific `validator_registry.json`,
// validators might be miners with specific capability, or we can mock/filter them.
// Let's assume there's a file or we return a placeholder representation.
const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'validator_registry.json');
        let data: any[] = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);

            // Handle {"validators": { "id": {...} }}
            const valsObj = parsed.validators || parsed;

            if (typeof valsObj === 'object' && !Array.isArray(valsObj)) {
                data = Object.values(valsObj);
            } else {
                data = valsObj || [];
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch validators data', details: error.message }, { status: 500 });
    }
}
