import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        let stats = {
            status: "operational",
            active_miners: 0,
            active_validators: 0,
            tasks_running: 0,
            tasks_completed: 0,
            network_uptime: "99.9%",
            total_emissions: 0,
            last_updated: new Date().toISOString()
        };

        // 1. Calculate Miners
        try {
            const minersJson = await fs.readFile(path.join(DATA_DIR, 'miner_registry.json'), 'utf8');
            const parsed = JSON.parse(minersJson);
            const miners = parsed.miners || parsed;
            stats.active_miners = typeof miners === 'object' && !Array.isArray(miners)
                ? Object.keys(miners).length
                : miners.length || 0;
        } catch (e) { }

        // 2. Calculate Validators
        try {
            const validatorsJson = await fs.readFile(path.join(DATA_DIR, 'validator_registry.json'), 'utf8');
            const parsed = JSON.parse(validatorsJson);
            const validators = parsed.validators || parsed;
            stats.active_validators = typeof validators === 'object' && !Array.isArray(validators)
                ? Object.keys(validators).length
                : validators.length || 0;
        } catch (e) { }

        // 3. Calculate Tasks & Total Emissions
        try {
            const tasksJson = await fs.readFile(path.join(DATA_DIR, 'task_manager.json'), 'utf8');
            const parsed = JSON.parse(tasksJson);
            const tasks = parsed.tasks || parsed;
            const tasksArray = typeof tasks === 'object' && !Array.isArray(tasks) ? Object.values(tasks) : (tasks || []);

            stats.tasks_completed = tasksArray.filter((t: any) => t.status === 'completed' || t.status === 'paid').length;
            stats.tasks_running = tasksArray.filter((t: any) => t.status === 'pending' || t.status === 'assigned').length;

            stats.total_emissions = tasksArray.reduce((acc: number, t: any) => acc + (Number(t.reward_amount || t.reward || 0)), 0);
        } catch (e) { }

        // 4. Override with explicit network_state.json if available
        try {
            const stateJson = await fs.readFile(path.join(DATA_DIR, 'network_state.json'), 'utf8');
            const parsed = JSON.parse(stateJson);
            stats = { ...stats, ...parsed };
        } catch (e) { }

        return NextResponse.json(stats);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to aggregate real network metrics', details: error.message }, { status: 500 });
    }
}
