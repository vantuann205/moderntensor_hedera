import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET() {
    try {
        const filePath = path.join(DATA_DIR, 'emissions.json');
        let data: any[] = [];

        try {
            const fileContents = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(fileContents);

            // Flatten epoch distributions into per-account emission records for the ledger
            const epochs = parsed.epochs || {};
            const totalDistributed = parsed.total_distributed || 0;

            // Build per-account cumulative emissions
            const accountTotals: Record<string, number> = {};
            const epochList: any[] = [];

            Object.entries(epochs).forEach(([epochNum, epoch]: [string, any]) => {
                const dists = epoch.distributions || {};
                const epochTotal = epoch.total_emission || 0;
                epochList.push({
                    epoch: parseInt(epochNum),
                    start_time: epoch.start_time,
                    end_time: epoch.end_time,
                    total_emission: epochTotal,
                    distributed: epoch.distributed || 0,
                    is_finalized: epoch.is_finalized,
                    top_earner: Object.entries(dists).sort(([, a], [, b]) => Number(b) - Number(a))[0]?.[0],
                });

                Object.entries(dists).forEach(([accountId, amount]) => {
                    accountTotals[accountId] = (accountTotals[accountId] || 0) + Number(amount);
                });
            });

            // Convert to list sorted by amount desc
            data = Object.entries(accountTotals)
                .map(([accountId, amount]) => {
                    const firstEpoch = Object.values(epochs)[0] as any;
                    return {
                        id: accountId,
                        subnet: `Subnet-1`,
                        name: accountId,
                        amount: amount.toFixed(2),
                        timestamp: new Date((firstEpoch?.end_time || Date.now() / 1000) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        epochs: epochList,
                        total_distributed: totalDistributed,
                    };
                })
                .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

            // Attach epoch metadata to first item for the chart
            if (data.length > 0) {
                (data as any)._meta = { epochs: epochList, total_distributed: totalDistributed };
            }

        } catch (err) {
            // emissions.json not available
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json([], { status: 200 });
    }
}
