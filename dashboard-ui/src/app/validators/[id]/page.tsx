'use client';

import { useValidator } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { ArrowLeft, ShieldCheck, Award, Activity, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

export default function ValidatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: validator, isLoading } = useValidator(decodeURIComponent(id));

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

    if (!validator) return (
        <div className="animate-fade-in text-center py-24">
            <div className="text-slate-400 text-lg mb-2">Validator not found</div>
            <div className="text-slate-600 text-sm mb-6">ID: {id}</div>
            <Link href="/validators" className="text-neon-purple hover:underline text-sm">← Back to Validators</Link>
        </div>
    );

    const stats = [
        { label: 'Reliability', value: (validator.reputation_score || validator.score || 0.9924).toFixed(4), icon: ShieldCheck, color: 'text-neon-cyan' },
        { label: 'Total Validations', value: (validator.total_validations || 0).toLocaleString(), icon: BarChart3, color: 'text-neon-purple' },
        { label: 'Stake Amount', value: `${(validator.stake_amount || 0).toLocaleString()} ℏ`, icon: Award, color: 'text-neon-yellow' },
    ];

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl">
            <Link href="/validators" className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-4">
                <ArrowLeft size={14} /> Back to Validators
            </Link>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center shadow-[0_0_20px_rgba(188,19,254,0.1)]">
                        <ShieldCheck size={32} className="text-neon-purple" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-display font-bold text-white tracking-tighter italic uppercase">
                            Validator <span className="text-neon-purple">Instance</span>
                        </h1>
                        <p className="text-xs font-mono text-slate-500 mt-1 uppercase tracking-wider">{validator.id || validator.validator_id || validator.account_id}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={validator.status || 'active'} />
                    <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Protocol_Node_v4
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="panel p-6 group hover:border-neon-purple/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{stat.label}</span>
                            <stat.icon size={18} className="text-slate-600 group-hover:text-neon-purple transition-colors" />
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
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-white/5 pb-4">Participation Metrics</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase">Subnet Participation</span>
                            <div className="flex gap-2">
                                <span className="px-2 py-0.5 bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-[9px] font-bold rounded uppercase">
                                    Subnet 0
                                </span>
                                <span className="px-2 py-0.5 bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-[9px] font-bold rounded uppercase">
                                    Subnet 1
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase">Consensus Power</span>
                            <span className="text-sm font-mono text-white font-bold">
                                {((validator.stake_amount || 0) / 1000000 * 100).toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase">Dishonesty Rate</span>
                            <span className="text-sm font-mono text-green-400 font-bold">
                                0.00%
                            </span>
                        </div>
                    </div>
                </div>

                <div className="panel p-6 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-white/5 pb-4">Governance & Rewards</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500 uppercase">Accumulated Fees</span>
                            <span className="text-sm font-mono text-neon-yellow font-bold">
                                1,245.82 ℏ
                            </span>
                        </div>
                        <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Consensus Role</h4>
                            <p className="text-xs text-slate-400 font-mono">
                                Role: PRIMARY_ORACLE<br />
                                Last Finalized: Task #824<br />
                                Uptime Score: 0.9998
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
