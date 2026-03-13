import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const activities: any[] = [];

        try {
            // Derive activity feed from task assignments (the most real-time data we have)
            const taskJson = await fs.readFile(path.join(DATA_DIR, 'task_manager.json'), 'utf8');
            const taskData = JSON.parse(taskJson);
            const tasks = taskData.tasks || {};
            const assignments = taskData.assignments || {};

            // Task events
            Object.values(tasks).forEach((task: any) => {
                activities.push({
                    id: `task-${task.task_id}`,
                    type: task.status === 'completed' ? 'task_completed' : 'task_assigned',
                    message: `Task ${task.task_id.slice(0, 8)} [${task.task_type}] ${task.status}`,
                    timestamp: new Date(task.created_at * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    raw_timestamp: task.created_at,
                });
            });

            // Assignment events (individual miner scores)
            Object.values(assignments).forEach((assignList: any) => {
                if (!Array.isArray(assignList)) return;
                assignList.forEach((a: any) => {
                    if (a.is_completed) {
                        activities.push({
                            id: `assign-${a.task_id}-${a.miner_id}`,
                            type: 'task_completed',
                            message: `Miner ${a.miner_id} scored ${(a.score * 100).toFixed(0)}% on task ${a.task_id.slice(0, 8)}`,
                            timestamp: new Date((a.scored_at || a.assigned_at || Date.now() / 1000) * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            raw_timestamp: a.scored_at || a.assigned_at || Date.now() / 1000,
                        });
                    }
                });
            });
        } catch (e) { }

        // Miner join events from registry
        try {
            const minerJson = await fs.readFile(path.join(DATA_DIR, 'miner_registry.json'), 'utf8');
            const minerData = JSON.parse(minerJson);
            const miners = minerData.miners || minerData;
            const minersArr = typeof miners === 'object' && !Array.isArray(miners) ? Object.values(miners) : miners;
            
            minersArr.forEach((m: any) => {
                activities.push({
                    id: `miner-join-${m.miner_id}`,
                    type: 'miner_joined',
                    message: `Miner ${m.miner_id} registered on subnet ${(m.subnet_ids || [1]).join(',')}`,
                    timestamp: new Date((m.registered_at || Date.now() / 1000) * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    raw_timestamp: m.registered_at || 0,
                });
            });
        } catch (e) { }

        // Emission events
        try {
            const emissionsJson = await fs.readFile(path.join(DATA_DIR, 'emissions.json'), 'utf8');
            const emissionsData = JSON.parse(emissionsJson);
            Object.values(emissionsData.epochs || {}).forEach((epoch: any) => {
                if (epoch.is_finalized) {
                    activities.push({
                        id: `epoch-${epoch.epoch_number}`,
                        type: 'reward_emitted',
                        message: `Epoch ${epoch.epoch_number} finalized — ${epoch.distributed?.toFixed(2)} MDT distributed`,
                        timestamp: new Date(epoch.end_time * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        raw_timestamp: epoch.end_time,
                    });
                }
            });
        } catch (e) { }

        // Sort by most recent first
        activities.sort((a, b) => (b.raw_timestamp || 0) - (a.raw_timestamp || 0));

        return NextResponse.json(activities.slice(0, 30));
    } catch (error: any) {
        return NextResponse.json([], { status: 200 });
    }
}
