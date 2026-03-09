import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'emissions.json');
        let data = {};

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            data = JSON.parse(fileContents);
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch emissions data', details: error.message }, { status: 500 });
    }
}
