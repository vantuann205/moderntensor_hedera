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
            const tasksObj = parsed.tasks || parsed;

            if (typeof tasksObj === 'object' && !Array.isArray(tasksObj)) {
                data = Object.values(tasksObj);
            } else {
                data = Array.isArray(tasksObj) ? tasksObj : [];
            }

            const TASK_TOPIC_ID = process.env.HEDERA_TASK_TOPIC_ID || '0.0.8146317';
            const NETWORK = process.env.HEDERA_NETWORK || 'testnet';

            // Enrich tasks with assignment data
            const assignments = parsed.assignments || {};
            data = data
                .filter((task: any) => task.source === 'hedera_hcs' || task.hcs_sequence)
                .map((task: any) => {
                    const taskAssignments = assignments[task.task_id] || [];
                    const topAssignment = taskAssignments.sort((a: any, b: any) => (b.score || 0) - (a.score || 0))[0];
                    
                    return {
                        id: task.task_id,
                        task_id: task.task_id,
                        subnet_id: task.subnet_id || 1,
                        task_type: task.task_type,
                        status: task.status || 'pending',
                        reward: (task.reward_amount || 0) / 100000000,
                        reward_amount: (task.reward_amount || 0) / 100000000,
                        requester_id: task.requester_id,
                        assigned_to: topAssignment?.miner_id || null,
                        miner_id: topAssignment?.miner_id || null,
                        score: topAssignment?.score || null,
                        created_at: task.created_at,
                        timestamp: task.created_at,
                        hcs_sequence: task.hcs_sequence,
                        consensus_timestamp: task.consensus_timestamp,
                        topic_id: TASK_TOPIC_ID,
                    };
                });
        } catch (err) {
            // file not found
        }

        // Sort by timestamp desc
        data.sort((a: any, b: any) => {
            const tA = Number(a.timestamp || 0);
            const tB = Number(b.timestamp || 0);
            return tB - tA;
        });

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json([], { status: 200 });
    }
}
