'use client';

import { useValidators } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Shield, Search, ArrowRight, Activity } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';

export default function ValidatorsPage() {
    const { data: validators = [], isLoading } = useValidators();
    const [search, setSearch] = useState('');

    const filtered = (validators as any[]).filter((v: any) => {
        const id = String(v.id || v.validator_id || v.account_id || '').toLowerCase();
        return id.includes(search);
    });

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
                        Metagraph <span className="text-neon-purple">Validators</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neon-purple animate-pulse shadow-[0_0_8px_#bc13fe]" />
                        Consensus Layer Verification Index
                    </p>
                </div>
                <div className="flex items-center gap-4 bg-neon-purple/5 border border-neon-purple/20 px-4 py-2 rounded-xl">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Active Validators</span>
                        <span className="text-lg font-display font-bold text-neon-purple tracking-tight">{validators.length}</span>
                    </div>
                    <Shield size={24} className="text-neon-purple/40" />
                </div>
            </div>

            {/* Search */}
            <div className="relative group max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-neon-purple transition-colors" />
                <Input
                    placeholder="SCAN VALIDATORS..."
                    value={search}
                    onChange={e => setSearch(e.target.value.toLowerCase())}
                    className="pl-11 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-neon-purple/40 h-11 text-xs font-mono tracking-widest uppercase transition-all"
                />
            </div>

            {/* Table */}
            <div className="panel overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-purple/20 to-transparent" />
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                                <th className="px-6 py-5">Rank</th>
                                <th className="px-6 py-5">Validator Identity</th>
                                <th className="px-6 py-5">Network Status</th>
                                <th className="px-6 py-5 text-right">Stake Control</th>
                                <th className="px-6 py-5 text-right">Reputation</th>
                                <th className="px-6 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}><td colSpan={6} className="px-6 py-4"><Skeleton className="h-10 bg-white/5 rounded-lg" /></td></tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-24 text-slate-600 uppercase tracking-widest text-xs font-bold">No Consensus Nodes Found</td></tr>
                            ) : filtered.map((v: any, idx: number) => {
                                const id = v.id || v.validator_id || v.account_id || `val-${idx}`;
                                const status = v.status || 'active';
                                const stake = v.stake_amount ?? v.stake ?? '—';
                                const score = v.score ?? v.trust_score ?? '—';
                                return (
                                    <tr key={id} className="group hover:bg-neon-purple/[0.02] transition-colors cursor-pointer data-row">
                                        <td className="px-6 py-5 text-slate-500 text-xs font-bold">#{String(idx + 1).padStart(2, '0')}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-white font-bold text-sm tracking-tight group-hover:text-neon-purple transition-colors">{String(id).slice(0, 12)}...</span>
                                                <span className="text-[9px] text-slate-600 uppercase tracking-widest">Authority_Token</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <StatusBadge status={status} />
                                        </td>
                                        <td className="px-6 py-5 text-right text-sm text-white font-bold">
                                            {stake !== '—' ? Number(stake).toLocaleString() : '—'}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Activity size={10} className="text-neon-purple animate-pulse" />
                                                <span className="text-neon-purple font-bold text-sm">
                                                    {score !== '—' ? Number(score).toFixed(4) : '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <Link href={`/validators/${id}`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-neon-purple uppercase tracking-widest transition-all">
                                                Inspect
                                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                            </Link>
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
