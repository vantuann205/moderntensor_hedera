import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'miner_registry.json');
        let data: any[] = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);
            const minersObj = parsed.miners || parsed;

            if (typeof minersObj === 'object' && !Array.isArray(minersObj)) {
                data = Object.values(minersObj);
            } else {
                data = Array.isArray(minersObj) ? minersObj : [];
            }
        } catch (err) {
            // file not found, return empty array immediately (no HCS fallback that causes infinite loading)
        }

        // Enrich miners with scores from task_manager.json
        try {
            const taskJson = await fs.readFile(path.join(DATA_DIR, 'task_manager.json'), 'utf8');
            const taskData = JSON.parse(taskJson);
            const assignments = Object.values(taskData.assignments || {}).flat() as any[];

            // Build per-miner score avg from assignments
            const scoreMap: Record<string, number[]> = {};
            const taskCountMap: Record<string, number> = {};
            assignments.forEach((a: any) => {
                if (a.miner_id) {
                    scoreMap[a.miner_id] = scoreMap[a.miner_id] || [];
                    scoreMap[a.miner_id].push(a.score || 0);
                    taskCountMap[a.miner_id] = (taskCountMap[a.miner_id] || 0) + 1;
                }
            });

            data = data.map((m: any) => {
                const scores = scoreMap[m.miner_id || m.id] || [];
                const avgScore = scores.length > 0
                    ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
                    : (m.reputation?.score || 0.5);
                return {
                    ...m,
                    trust_score: avgScore,
                    tasks_completed: taskCountMap[m.miner_id || m.id] || m.reputation?.successful_tasks || 0
                };
            });
        } catch (e) { }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json([], { status: 200 }); // Always return 200 empty array, not 500
    }
}
