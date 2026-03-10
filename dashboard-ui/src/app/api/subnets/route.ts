import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        let minersCount = 0;
        let validatorsCount = 0;
        let status = 'active';

        try {
            const minersJson = await fs.readFile(path.join(DATA_DIR, 'miner_registry.json'), 'utf8');
            const parsed = JSON.parse(minersJson);
            const miners = parsed.miners || parsed;
            minersCount = typeof miners === 'object' && !Array.isArray(miners)
                ? Object.keys(miners).length
                : (miners.length || 0);
        } catch (e) { }

        try {
            const validatorsJson = await fs.readFile(path.join(DATA_DIR, 'validator_registry.json'), 'utf8');
            const parsed = JSON.parse(validatorsJson);
            const validators = parsed.validators || parsed;
            validatorsCount = typeof validators === 'object' && !Array.isArray(validators)
                ? Object.keys(validators).length
                : (validators.length || 0);
        } catch (e) { }

        if (minersCount === 0 && validatorsCount === 0) {
            status = 'syncing';
        }

        const subnets = [
            {
                id: 1,
                name: "AI-CodeReview-v1",
                description: "Premium AI Code Review Subnet on Hedera HCS",
                fee_rate: 3,
                miners_count: minersCount > 0 ? minersCount : 3, // fallback to demo numbers if file is syncing
                validators_count: validatorsCount > 0 ? validatorsCount : 1,
                status: status,
                total_emissions: "150.00 MDT",
                minimum_stake: "1,000 MDT"
            }
        ];

        return NextResponse.json({ subnets });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch subnets', details: error.message }, { status: 500 });
    }
}
