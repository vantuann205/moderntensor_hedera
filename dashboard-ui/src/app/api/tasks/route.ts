import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'task_manager.json');
        let data: any[] = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);

            // Handle {"tasks": { "id": {...} }}
            const tasksObj = parsed.tasks || parsed;

            if (typeof tasksObj === 'object' && !Array.isArray(tasksObj)) {
                data = Object.values(tasksObj);
            } else {
                data = tasksObj || [];
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }

        // Sort logic
        data.sort((a: any, b: any) => {
            const tA = new Date(a.timestamp || a.created_at || 0).getTime();
            const tB = new Date(b.timestamp || b.created_at || 0).getTime();
            return tB - tA;
        });

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch tasks data', details: error.message }, { status: 500 });
    }
}
