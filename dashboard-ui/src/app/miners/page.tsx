'use client';

import { useMiners } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Cpu, Search, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';
import { CountUp } from '@/components/ui-custom/NeuralMetagraph';

export default function MinersPage() {
    const { data: miners = [], isLoading } = useMiners();
    const [search, setSearch] = useState('');

    const filtered = (miners as any[]).filter((m: any) => {
        const id = String(m.miner_id || m.id || m.account_id || '').toLowerCase();
        return id.includes(search.toLowerCase());
    });

    const totalStake = (miners as any[]).reduce((acc: number, m: any) => acc + Number(m.stake_amount || 0), 0);
    const avgScore = (miners as any[]).length > 0
        ? (miners as any[]).reduce((acc: number, m: any) => acc + Number(m.trust_score || m.reputation?.score || 0.5), 0) / (miners as any[]).length
        : 0;

    const formatUTC7 = (ts: any) => {
        if (!ts) return '—';
        const date = new Date(Number(ts) * (String(ts).length > 10 ? 1 : 1000));
        return date.toLocaleString('en-GB', { 
            timeZone: 'Asia/Ho_Chi_Minh', 
            hour12: false,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
                        Neural <span className="text-neon-cyan">Nodes</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_#00f3ff]" />
                        AI Compute Mining Participant Registry
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center bg-neon-cyan/5 border border-neon-cyan/20 px-5 py-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Miners</span>
                        <span className="text-xl font-display font-bold text-neon-cyan">{(miners as any[]).length}</span>
                    </div>
                    <div className="flex flex-col items-center bg-white/[0.02] border border-white/5 px-5 py-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Staked</span>
                        <span className="text-xl font-display font-bold text-white">
                            <CountUp end={totalStake} decimals={0} suffix=" MDT" />
                        </span>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative group max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-neon-cyan transition-colors" />
                <Input
                    placeholder="SCAN NEURAL NODES..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-11 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-neon-cyan/40 h-11 text-xs font-mono tracking-widest uppercase transition-all"
                />
            </div>

            {/* Table */}
            <div className="panel overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-cyan/20 to-transparent" />
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                                <th className="px-6 py-5">Rank</th>
                                <th className="px-6 py-5">Node Identity</th>
                                <th className="px-6 py-5">Subnet(s)</th>
                                <th className="px-6 py-5">Registration Date</th>
                                <th className="px-6 py-5">Network Status</th>
                                <th className="px-6 py-5 text-right">Stake (MDT)</th>
                                <th className="px-6 py-5 text-right">Trust Score</th>
                                <th className="px-6 py-5 text-right">Tasks Done</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i}><td colSpan={8} className="px-6 py-4"><Skeleton className="h-10 bg-white/5 rounded-lg" /></td></tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-24 text-slate-600 uppercase tracking-widest text-xs font-bold">NO NEURAL NODES DETECTED</td></tr>
                            ) : filtered.map((m: any, idx: number) => {
                                const id = m.miner_id || m.id || m.account_id || `miner-${idx}`;
                                const status = m.status || 'active';
                                const stake = m.stake_amount || 0;
                                const trustScore = m.trust_score || m.reputation?.score || 0;
                                const tasksCompleted = m.tasks_completed || m.reputation?.successful_tasks || 0;
                                const subnets = m.subnet_ids || [0];
                                const capabilities = m.capabilities || [];
                                const scoreColor = trustScore >= 0.9 ? 'text-neon-green' : trustScore >= 0.7 ? 'text-neon-cyan' : 'text-neon-yellow';
                                return (
                                    <tr key={id} className="group hover:bg-neon-cyan/[0.02] transition-colors data-row">
                                        <td className="px-6 py-5 text-slate-500 text-xs font-bold">#{String(idx + 1).padStart(2, '0')}</td>
                                        <td className="px-6 py-5">
                                            <Link href={`/miners/${encodeURIComponent(id)}`} className="flex flex-col gap-1 group/link">
                                                <span className="text-white font-bold text-base tracking-tight group-hover/link:text-neon-cyan transition-colors">{id}</span>
                                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Neural_Node</span>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-wrap gap-1.5">
                                                {subnets.map((s: number) => (
                                                    <span key={s} className="text-[10px] font-bold text-neon-cyan border border-neon-cyan/40 bg-neon-cyan/10 px-2.5 py-1 rounded-full">
                                                        Subnet-{s}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs text-white font-bold uppercase whitespace-nowrap">
                                                {formatUTC7(m.registered_at)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <StatusBadge status={status} />
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="text-white font-bold text-base">
                                                <CountUp end={Number(stake)} decimals={0} />
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`${scoreColor} font-bold text-base`}>
                                                    {(trustScore * 100).toFixed(1)}%
                                                </span>
                                                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${scoreColor.replace('text-', 'bg-')}`} style={{ width: `${trustScore * 100}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Zap size={12} className="text-neon-yellow animate-pulse" />
                                                <span className="text-white font-bold text-base">{tasksCompleted}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
