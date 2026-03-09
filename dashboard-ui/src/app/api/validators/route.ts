import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// For this project, if we don't have a specific `validator_registry.json`,
// validators might be miners with specific capability, or we can mock/filter them.
// Let's assume there's a file or we return a placeholder representation.
const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        // Attempting to read from miner_registry but filtering for 'is_validator' or 'validator' role 
        // or just returning a mock if file doesn't explicitly track them separated
        const filePath = path.join(DATA_DIR, 'miner_registry.json');
        let data = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);
            const allNodes = typeof parsed === 'object' && !Array.isArray(parsed) ? Object.values(parsed) : parsed;

            // Filter hack for validators if they exist in the same file. 
            // Real logic should match the python backend's JSON structure.
            data = allNodes.filter((node: any) => node.role === 'validator' || node.type === 'validator' || node.capabilities?.includes('validator'));

            // If we didn't find any explicit ones, maybe they are in another file or hardcoded operators.
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch validators data', details: error.message }, { status: 500 });
    }
}
