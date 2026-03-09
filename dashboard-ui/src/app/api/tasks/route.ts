import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'task_manager.json');
        let data = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                data = Object.values(parsed);
            } else {
                data = parsed;
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }

        // Sort logic to make sure latest tasks are first, assuming a `timestamp` or `created_at` field exists.
        data.sort((a: any, b: any) => {
            const tA = new Date(a.timestamp || a.created_at || 0).getTime();
            const tB = new Date(b.timestamp || b.created_at || 0).getTime();
            return tB - tA; // Descending
        });

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch tasks data', details: error.message }, { status: 500 });
    }
}
