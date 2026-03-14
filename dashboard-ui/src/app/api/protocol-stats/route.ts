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

    // Calculate distributions accurately from full arrays
    const minersPerSubnet: Record<number, number> = {};
    miners.forEach(m => {
      (m.subnetIds || []).forEach((sid: number) => {
        minersPerSubnet[sid] = (minersPerSubnet[sid] || 0) + 1;
      });
    });

    const tasksPerSubnet: Record<number, number> = {};
    const taskSubnetMap = new Map();
    tasks.forEach(t => {
      const sid = t.subnetId || 0;
      tasksPerSubnet[sid] = (tasksPerSubnet[sid] || 0) + 1;
      taskSubnetMap.set(t.taskId, sid);
    });

    const valSetPerSubnet: Record<number, Set<string>> = {};
    scores.forEach((s: any) => {
        const sid = taskSubnetMap.get(s.taskId) ?? 0;
        if(!valSetPerSubnet[sid]) valSetPerSubnet[sid] = new Set();
        if(s.validatorId) valSetPerSubnet[sid].add(s.validatorId);
    });
    
    const validatorsPerSubnet: Record<number, number> = {};
    Object.keys(valSetPerSubnet).forEach(key => {
        validatorsPerSubnet[Number(key)] = valSetPerSubnet[Number(key)].size;
    });

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
        minersPerSubnet,
        tasksPerSubnet,
        validatorsPerSubnet,
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
