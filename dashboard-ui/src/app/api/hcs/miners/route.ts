import { NextResponse } from 'next/server';
import { hcsMirrorClient } from '@/lib/hcs-mirror-client';

export async function GET() {
  try {
    // Fetch miner registrations from HCS registration topic
    const miners = await hcsMirrorClient.getMinerRegistrations();

    // Enrich with scores from HCS scoring topic
    let scoreMap: Record<string, number[]> = {};
    try {
      const scores = await hcsMirrorClient.getScoreSubmissions();
      scores.forEach((s) => {
        if (s.minerId) {
          scoreMap[s.minerId] = scoreMap[s.minerId] || [];
          scoreMap[s.minerId].push(s.score);
        }
      });
    } catch (_) {}

    const enriched = miners.map((m) => {
      const scores = scoreMap[m.minerId] || [];
      const trust_score = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0.5;
      return {
        // Normalize field names to match what miners/page.tsx expects
        miner_id: m.minerId,
        account_id: m.accountId || m.minerId,
        stake_amount: m.stakeAmount,
        subnet_ids: m.subnetIds,
        capabilities: m.capabilities,
        registered_at: m.consensusTimestamp
          ? Math.floor(parseFloat(m.consensusTimestamp))
          : undefined,
        status: 'active',
        trust_score,
        tasks_completed: scoreMap[m.minerId]?.length ?? 0,
        hcs_sequence: m.sequenceNumber,
        consensusTimestamp: m.consensusTimestamp,
      };
    });

    return NextResponse.json({ success: true, data: enriched, count: enriched.length });
  } catch (error: any) {
    console.error('Error fetching miners from HCS:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch miners' },
      { status: 500 }
    );
  }
}
