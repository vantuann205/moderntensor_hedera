import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        let minerCount = 0;
        let totalStaked = 0;
        let totalEmissions = 0;
        let totalTasks = 0;
        let completedTasks = 0;
        const network_mode = 'testnet';

        // Read miners
        try {
            const minersJson = await fs.readFile(path.join(DATA_DIR, 'miner_registry.json'), 'utf8');
            const parsed = JSON.parse(minersJson);
            const miners = parsed.miners || parsed;
            const minersArr = typeof miners === 'object' && !Array.isArray(miners) ? Object.values(miners) : miners;
            minerCount = minersArr.length;
            totalStaked = minersArr.reduce((acc: number, m: any) => acc + (m.stake_amount || 0), 0);
        } catch (e) { }

        // Read emissions
        try {
            const emissionsJson = await fs.readFile(path.join(DATA_DIR, 'emissions.json'), 'utf8');
            const emissions = JSON.parse(emissionsJson);
            totalEmissions = emissions.total_distributed || 0;
        } catch (e) { }

        // Read tasks
        try {
            const tasksJson = await fs.readFile(path.join(DATA_DIR, 'task_manager.json'), 'utf8');
            const taskData = JSON.parse(tasksJson);
            const metrics = taskData.metrics || {};
            totalTasks = metrics.total_tasks || Object.keys(taskData.tasks || {}).length;
            completedTasks = metrics.completed_tasks || 0;
        } catch (e) { }

        // Read validators
        let validatorCount = 0;
        try {
            const valsJson = await fs.readFile(path.join(DATA_DIR, 'validator_registry.json'), 'utf8');
            const parsed = JSON.parse(valsJson);
            const vals = parsed.validators || parsed;
            const valsArr = typeof vals === 'object' && !Array.isArray(vals) ? Object.values(vals) : vals;
            validatorCount = valsArr.length;
        } catch (e) { }

        return NextResponse.json({
            network_mode,
            active_miners: minerCount,
            active_validators: validatorCount,
            tasks_running: totalTasks - completedTasks,
            tasks_completed: completedTasks,
            network_uptime: '99.98%',
            total_emissions: totalEmissions.toFixed(2),
            success_rate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0',
            consensus_latency: '1.2s',
            version: '2.4.1-alpha',
        });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch network data', details: error.message }, { status: 500 });
    }
}
