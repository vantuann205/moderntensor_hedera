import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'treasury_state.json');
        let data = {
            status: "operational",
            active_nodes: 0,
            total_tasks: 0,
            network_reward_pool: 0
        };

        // Aggregating network health from multiple files
        try {
            const treasuryContents = await fs.readFile(filePath, 'utf8');
            const parsedTreasury = JSON.parse(treasuryContents);
            data.network_reward_pool = parsedTreasury.balance || 0;
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }

        try {
            const minersFilePath = path.join(DATA_DIR, 'miner_registry.json');
            const minersContents = await fs.readFile(minersFilePath, 'utf8');
            const parsedMiners = JSON.parse(minersContents);
            data.active_nodes = typeof parsedMiners === 'object' && !Array.isArray(parsedMiners) ? Object.keys(parsedMiners).length : parsedMiners.length;
        } catch (err) {
            // fail silently for aggregation
        }

        try {
            const tasksFilePath = path.join(DATA_DIR, 'task_manager.json');
            const tasksContents = await fs.readFile(tasksFilePath, 'utf8');
            const parsedTasks = JSON.parse(tasksContents);
            data.total_tasks = typeof parsedTasks === 'object' && !Array.isArray(parsedTasks) ? Object.keys(parsedTasks).length : parsedTasks.length;
        } catch (err) {
            // fail silently
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch network data', details: error.message }, { status: 500 });
    }
}
