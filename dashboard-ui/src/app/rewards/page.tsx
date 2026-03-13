'use client';

import { useQuery } from '@tanstack/react-query';
import { Trophy, Award, Zap, Target, TrendingUp, Users, Shield } from 'lucide-react';
import { useState } from 'react';
import ValidatorVerifyModal from '@/components/ui-custom/ValidatorVerifyModal';

async function fetchRewards() {
    const res = await fetch('/api/rewards');
    return res.json();
}

export default function RewardsPage() {
    const { data, isLoading } = useQuery({ queryKey: ['rewards'], queryFn: fetchRewards, refetchInterval: 10000 });

    const rewards: any[] = data?.rewards ?? [];
    
    const formatUTC7 = (ts: any) => {
        if (!ts) return '—';
        const date = new Date(Number(ts) * (String(ts).length > 10 ? 1 : 1000));
        return date.toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    };

    return (
        <div className="page-content p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold text-white uppercase tracking-wider flex items-center gap-3">
                        <Trophy className="text-neon-yellow" size={24} />
                        Reward Distribution
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Formula: <span className="font-mono text-neon-cyan">reward = (score / total_scores) × pool</span> weighted by stake
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { icon: <Award size={18} className="text-neon-yellow" />, label: 'Total Pool', value: `${data?.pool_total ?? 0} MDT`, color: 'border-neon-yellow/20' },
                    { icon: <Target size={18} className="text-neon-cyan" />, label: 'Completed Tasks', value: data?.completed_tasks ?? 0, color: 'border-neon-cyan/20' },
                    { icon: <Users size={18} className="text-neon-purple" />, label: 'Active Miners', value: data?.total_miners ?? 0, color: 'border-neon-purple/20' },
                ].map(s => (
                    <div key={s.label} className={`glass-panel rounded-xl p-4 border ${s.color}`}>
                        <div className="flex items-center gap-3">
                            {s.icon}
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest">{s.label}</div>
                                <div className="text-xl font-bold font-mono text-white">{s.value}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Reward Leaderboard */}
            <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center gap-2">
                    <TrendingUp size={16} className="text-neon-cyan" />
                    <span className="text-sm font-bold text-white uppercase tracking-wider">Reward Leaderboard</span>
                    <span className="ml-auto text-[10px] text-slate-500 font-mono">Score × Stake Factor → Reward Share</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-widest">
                                <th className="text-left px-4 py-3">#</th>
                                <th className="text-left px-4 py-3">Miner ID</th>
                                <th className="text-right px-4 py-3">Avg Score</th>
                                <th className="text-right px-4 py-3">Stake (MDT)</th>
                                <th className="text-right px-4 py-3">Stake ×</th>
                                <th className="text-right px-4 py-3">Tasks Done</th>
                                <th className="text-right px-4 py-3">Reward Share</th>
                                <th className="text-right px-4 py-3">Earned (MDT)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-white/5 animate-pulse">
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3">
                                                <div className="h-4 bg-white/5 rounded w-16" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rewards.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-600 text-sm">
                                        No reward data yet. Tasks need to be completed and scored.
                                    </td>
                                </tr>
                            ) : rewards.map((r: any, i: number) => (
                                <tr key={r.miner_id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-bold font-mono ${i === 0 ? 'text-neon-yellow' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>
                                            #{i + 1}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.miner_id}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`text-xs font-bold font-mono ${r.avg_score >= 80 ? 'text-neon-green' : r.avg_score >= 60 ? 'text-neon-yellow' : 'text-red-400'}`}>
                                            {r.avg_score}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">{r.stake.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-xs font-mono text-neon-cyan">×{r.stake_factor}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">{r.tasks_completed}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-neon-purple rounded-full" style={{ width: `${r.reward_share_pct}%` }} />
                                            </div>
                                            <span className="text-xs font-mono text-neon-purple">{r.reward_share_pct}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-xs font-bold font-mono text-neon-yellow">{r.earned_mdt}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reward Mechanics Info */}
            <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel rounded-xl border border-neon-cyan/10 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-neon-cyan" />
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Miner Reward Formula</span>
                    </div>
                    <div className="font-mono text-xs text-slate-400 space-y-2">
                        <div className="bg-black/40 rounded p-2 border border-white/5">
                            <span className="text-neon-cyan">reward_share</span> = score / total_scores
                        </div>
                        <div className="bg-black/40 rounded p-2 border border-white/5">
                            <span className="text-neon-yellow">stake_factor</span> = 1 + (stake / 100k) × 0.2
                        </div>
                        <div className="bg-black/40 rounded p-2 border border-white/5">
                            <span className="text-neon-green">earned</span> = reward_share × pool × stake_factor
                        </div>
                    </div>
                </div>
                <div className="glass-panel rounded-xl border border-neon-purple/10 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield size={16} className="text-neon-purple" />
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Validator Reward Formula</span>
                    </div>
                    <div className="font-mono text-xs text-slate-400 space-y-2">
                        <div className="bg-black/40 rounded p-2 border border-white/5">
                            <span className="text-neon-purple">weight</span> = stake × trust_score
                        </div>
                        <div className="bg-black/40 rounded p-2 border border-white/5">
                            <span className="text-neon-cyan">vote_impact</span> = confidence × (score / 100)
                        </div>
                        <div className="bg-black/40 rounded p-2 border border-white/5">
                            <span className="text-neon-green">earned</span> = weight / total_weight × validator_pool
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
