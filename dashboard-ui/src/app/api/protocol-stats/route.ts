import { NextResponse } from 'next/server';
import { hcsMirrorClient } from '@/lib/hcs-mirror-client';

export async function GET() {
  try {
    const [miners, tasks, scores] = await Promise.all([
      hcsMirrorClient.getMinerRegistrations(),
      hcsMirrorClient.getTaskSubmissions(),
      hcsMirrorClient.getScoreSubmissions()
    ]);

    // Calculate stats from real HCS data
    const totalMiners = miners.length;
    const totalTasks = tasks.length;
    const totalScores = scores.length;
    
    // Calculate total staked from miners
    const totalStaked = miners.reduce((sum, m) => sum + (m.stakeAmount || 0), 0);
    
    // Calculate average score
    const avgScore = scores.length > 0 
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length 
      : 0;

    // Get unique validators
    const uniqueValidators = new Set(scores.map(s => s.validatorId));
    const totalValidators = uniqueValidators.size;

    // Get unique subnets
    const uniqueSubnets = new Set(miners.flatMap(m => m.subnetIds || []));
    const totalSubnets = uniqueSubnets.size || 1; // At least 1 subnet

    return NextResponse.json({
      success: true,
      data: {
        totalMiners,
        totalValidators,
        totalSubnets,
        totalTasks,
        totalScores,
        totalStaked,
        avgScore: Math.round(avgScore * 100) / 100,
        miners: miners.slice(-10), // Last 10 miners
        tasks: tasks.slice(-10), // Last 10 tasks
        scores: scores.slice(-10) // Last 10 scores
      }
    });
  } catch (error: any) {
    console.error('Error fetching protocol stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch protocol stats' },
      { status: 500 }
    );
  }
}
