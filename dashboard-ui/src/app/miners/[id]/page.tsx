'use client';

import { useMiner } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { ArrowLeft, Cpu, Shield, Award, Activity } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

export default function MinerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: miner, isLoading } = useMiner(decodeURIComponent(id));

    if (isLoading) return (
        <div className="space-y-6 animate-fade-in">
            <Skeleton className="h-8 w-48 bg-white/5" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-32 bg-white/5" />
                <Skeleton className="h-32 bg-white/5" />
                <Skeleton className="h-32 bg-white/5" />
            </div>
            <Skeleton className="h-64 bg-white/5" />
        </div>
    );

    if (!miner) return (
        <div className="animate-fade-in text-center py-24">
            <div className="text-slate-400 text-lg mb-2">Miner not found</div>
            <div className="text-slate-600 text-sm mb-6">ID: {id}</div>
            <Link href="/miners" className="text-neon-cyan hover:underline text-sm">← Back to Miners</Link>
        </div>
    );

    const stats = [
        { label: 'Trust Score', value: miner.reputation?.score !== undefined ? Number(miner.reputation.score).toFixed(4) : (miner.score !== undefined ? Number(miner.score).toFixed(4) : '-'), icon: Shield, color: 'text-neon-purple' },
        { label: 'Tasks Completed', value: miner.reputation?.total_tasks ?? miner.tasks_completed ?? '-', icon: Activity, color: 'text-neon-cyan' },
        { label: 'Stake Amount', value: miner.stake_amount !== undefined ? `${(miner.stake_amount).toLocaleString()} ℏ` : '-', icon: Award, color: 'text-neon-yellow' },
    ];

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl">
            <Link href="/miners" className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-4">
                <ArrowLeft size={14} /> Back to Registry
            </Link>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center shadow-[0_0_20px_rgba(0,243,255,0.1)]">
                        <Cpu size={32} className="text-neon-cyan" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-display font-bold text-white tracking-tighter italic uppercase">
                            Miner <span className="text-neon-cyan">Identity</span>
                        </h1>
                        <p className="text-xs font-mono text-slate-500 mt-1 uppercase tracking-wider">{miner.id || miner.miner_id || miner.account_id || '-'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={miner.status || 'active'} />
                    <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        v{miner.metadata?.version || '-'}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="panel p-6 group hover:border-neon-cyan/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{stat.label}</span>
                            <stat.icon size={18} className="text-slate-600 group-hover:text-neon-cyan transition-colors" />
                        </div>
                        <div className={`text-2xl font-display font-bold ${stat.color} tracking-tight`}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Detailed Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="panel p-6 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-white/5 pb-4">Protocol Metadata</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase">Subnets</span>
                            <div className="flex gap-2">
                                {(miner.subnet_ids || [0]).map((sid: number) => (
                                    <span key={sid} className="px-2 py-0.5 bg-neon-purple/10 border border-neon-purple/20 text-neon-purple text-[9px] font-bold rounded uppercase">
                                        Subnet {sid}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase">Success Rate</span>
                            <span className="text-sm font-mono text-white font-bold">
                                {miner.reputation?.success_rate !== undefined ? `${(miner.reputation.success_rate * 100).toFixed(1)}%` : '-'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase">Account Address</span>
                            <span className="text-xs font-mono text-slate-400">
                                {miner.account_id || miner.id || '-'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase">Last Activity</span>
                            <span className="text-xs text-slate-300">
                                {miner.last_active_at ? new Date(miner.last_active_at * 1000).toLocaleString() : (miner.last_seen ? new Date(miner.last_seen * 1000).toLocaleString() : '-')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="panel p-6 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-white/5 pb-4">Capabilities & Logic</h3>
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {(miner.capabilities || ['-']).map((cap: string) => (
                                <div key={cap} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                    {cap}
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Hardware Profile</h4>
                            <p className="text-xs text-slate-400 font-mono">
                                Type: {miner.metadata?.hardware?.type || '-'}<br />
                                Region: {miner.metadata?.hardware?.region || '-'}<br />
                                Provider: {miner.metadata?.hardware?.provider || '-'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
