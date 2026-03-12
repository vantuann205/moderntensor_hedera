import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
    try {
        const dataDir = path.join(process.cwd(), '..', 'data');
        
        // Read source data
        const minerFile = path.join(dataDir, 'miner_registry.json');
        const taskFile = path.join(dataDir, 'task_manager.json');
        
        if (!fs.existsSync(minerFile)) {
            return NextResponse.json({ rewards: [] });
        }
        
        const minersRaw = JSON.parse(fs.readFileSync(minerFile, 'utf-8'));
        const tasksRaw = fs.existsSync(taskFile) ? JSON.parse(fs.readFileSync(taskFile, 'utf-8')) : {};
        
        const miners: any[] = Array.isArray(minersRaw) ? minersRaw : Object.values(minersRaw.miners || minersRaw);
        const tasks: any[] = Array.isArray(tasksRaw) ? tasksRaw : Object.values(tasksRaw.tasks || tasksRaw);
        
        // Calculate rewards for each miner
        // Formula: reward_share = (miner_score / total_scores) * pool_reward
        // Weighted by quality_score (from validator scoring) x stake_factor
        
        const completedTasks = tasks.filter((t: any) => t.status === 'completed' || t.assignments?.length > 0);
        const totalPool = completedTasks.reduce((acc: number, t: any) => 
            acc + Number(t.reward_amount || t.reward || 0), 0);
        
        // Create scored miner map
        const rewardMap: Record<string, { 
            scores: number[], 
            stake: number,
            tasks_completed: number,
            miner_id: string,
            name: string
        }> = {};
        
        // Build from miner registry
        for (const miner of miners) {
            const mid = miner.miner_id || miner.id;
            if (!mid) continue;
            rewardMap[mid] = {
                miner_id: mid,
                name: miner.name || mid,
                stake: Number(miner.stake_amount || miner.stake || 0),
                scores: [],
                tasks_completed: 0,
            };
        }
        
        // Aggregate task scores per miner
        for (const task of completedTasks) {
            const assignments = task.assignments || [];
            for (const a of assignments) {
                const mid = a.miner_id;
                if (!mid || !rewardMap[mid]) continue;
                const score = Number(a.score || a.final_score || 0);
                if (score > 0) {
                    rewardMap[mid].scores.push(score);
                    rewardMap[mid].tasks_completed++;
                }
            }
        }
        
        // Compute rewards
        const minerList = Object.values(rewardMap);
        const totalScoreSum = minerList.reduce((acc, m) => {
            const avgScore = m.scores.length > 0 
                ? m.scores.reduce((a, b) => a + b, 0) / m.scores.length 
                : 0;
            return acc + avgScore;
        }, 0);
        
        const rewards = minerList.map(m => {
            const avgScore = m.scores.length > 0 
                ? m.scores.reduce((a, b) => a + b, 0) / m.scores.length 
                : 50; // Default score for inactive
            
            // Stake factor adds up to 20% boost
            const stakeFactor = m.stake > 0 ? Math.min(1.2, 1 + (m.stake / 100000) * 0.2) : 1.0;
            const weightedScore = avgScore * stakeFactor;
            const rewardShare = totalScoreSum > 0 ? (avgScore / totalScoreSum) : (1 / Math.max(1, minerList.length));
            const earned = rewardShare * totalPool;
            
            return {
                miner_id: m.miner_id,
                name: m.name,
                avg_score: Math.round(avgScore * 10) / 10,
                stake: m.stake,
                stake_factor: Math.round(stakeFactor * 100) / 100,
                tasks_completed: m.tasks_completed,
                reward_share_pct: Math.round(rewardShare * 10000) / 100, // %
                earned_mdt: Math.round(earned * 100) / 100,
                weighted_score: Math.round(weightedScore * 10) / 10,
            };
        }).sort((a, b) => b.weighted_score - a.weighted_score);
        
        return NextResponse.json({
            rewards,
            pool_total: Math.round(totalPool * 100) / 100,
            completed_tasks: completedTasks.length,
            total_miners: miners.length,
        });
    } catch (error: any) {
        console.error('[Rewards API]', error);
        return NextResponse.json({ rewards: [], error: error.message });
    }
}
