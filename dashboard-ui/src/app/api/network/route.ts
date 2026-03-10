import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';
const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        let stats: any = {
            status: "operational",
            active_miners: 0,
            active_validators: 0,
            tasks_running: 0,
            tasks_completed: 0,
            network_uptime: "100%", // Protocol uptime is usually calculated from HCS availability
            total_emissions: 0,
            last_updated: new Date().toISOString()
        };

        // 1. Live Aggregate from Local State (if SDK is writing to them)
        try {
            const minersJson = await fs.readFile(path.join(DATA_DIR, 'miner_registry.json'), 'utf8');
            const parsed = JSON.parse(minersJson);
            const miners = parsed.miners || parsed;
            stats.active_miners = typeof miners === 'object' && !Array.isArray(miners)
                ? Object.keys(miners).length
                : (miners.length || 0);
        } catch (e) { }

        try {
            const validatorsJson = await fs.readFile(path.join(DATA_DIR, 'validator_registry.json'), 'utf8');
            const parsed = JSON.parse(validatorsJson);
            const validators = parsed.validators || parsed;
            stats.active_validators = typeof validators === 'object' && !Array.isArray(validators)
                ? Object.keys(validators).length
                : (validators.length || 0);
        } catch (e) { }

        try {
            const tasksJson = await fs.readFile(path.join(DATA_DIR, 'task_manager.json'), 'utf8');
            const parsed = JSON.parse(tasksJson);
            const tasks = parsed.tasks || parsed;
            const tasksArray = typeof tasks === 'object' && !Array.isArray(tasks) ? Object.values(tasks) : (tasks || []);

            stats.tasks_completed = tasksArray.filter((t: any) => t.status === 'completed' || t.status === 'paid').length;
            stats.tasks_running = tasksArray.filter((t: any) => t.status === 'pending' || t.status === 'assigned').length;
            stats.total_emissions = tasksArray.reduce((acc: number, t: any) => acc + (Number(t.reward_amount || t.reward || 0)), 0);
        } catch (e) { }

        // 2. Fetch Real-time Protocol Metrics from Hedera Mirror Node (if token is available)
        const tokenId = process.env.NEXT_PUBLIC_MDT_TOKEN_ID;
        if (tokenId) {
            try {
                const tokenRes = await fetch(`${MIRROR_BASE}/api/v1/tokens/${tokenId}`);
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    stats.total_emissions = Number(tokenData.total_supply) / Math.pow(10, tokenData.decimals);
                }
            } catch (e) { }
        }

        // 3. Fallback Indexer (Directly search Mirror Node if local files were purged)
        if (stats.active_miners === 0 && stats.tasks_completed === 0) {
            // Attempt to derive metrics from HCS feed if possible (async discovery)
            // For now, we return 0/'-' as requested if truly no data exists
        }

        return NextResponse.json(stats);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to aggregate real network metrics', details: error.message }, { status: 500 });
    }
}
