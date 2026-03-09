'use client';

import { useMiners } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Cpu, Search, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';

export default function MinersPage() {
    const { data: miners = [], isLoading } = useMiners();
    const [search, setSearch] = useState('');

    const filtered = (miners as any[]).filter((m: any) => {
        const id = String(m.id || m.miner_id || m.account_id || '').toLowerCase();
        const addr = String(m.address || m.hedera_id || '').toLowerCase();
        return id.includes(search) || addr.includes(search);
    });

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
                        Metagraph <span className="text-neon-cyan">Miners</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_#00f3ff]" />
                        Network Registry Index v2.4
                    </p>
                </div>
                <div className="flex items-center gap-4 bg-neon-cyan/5 border border-neon-cyan/20 px-4 py-2 rounded-xl">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Total Nodes</span>
                        <span className="text-lg font-display font-bold text-neon-cyan tracking-tight">{miners.length}</span>
                    </div>
                    <Cpu size={24} className="text-neon-cyan/40" />
                </div>
            </div>

            {/* Search & Filter */}
            <div className="relative group max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-neon-cyan transition-colors" />
                <Input
                    placeholder="SCAN REGISTRY (ID / ADDRESS)..."
                    value={search}
                    onChange={e => setSearch(e.target.value.toLowerCase())}
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
                                <th className="px-6 py-5">Miner Identity</th>
                                <th className="px-6 py-5">Address Hash</th>
                                <th className="px-6 py-5">Network Status</th>
                                <th className="px-6 py-5 text-right">Stake (ℏ)</th>
                                <th className="px-6 py-5 text-right">Trust Score</th>
                                <th className="px-6 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                            {isLoading ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i}><td colSpan={7} className="px-6 py-4"><Skeleton className="h-10 bg-white/5 rounded-lg" /></td></tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-24 text-slate-600 uppercase tracking-widest text-xs font-bold">No Neural Nodes Detected in Current Sector</td></tr>
                            ) : filtered.map((m: any, idx: number) => {
                                const id = m.id || m.miner_id || m.account_id || `miner-${idx}`;
                                const address = m.address || m.hedera_id || m.account || '—';
                                const status = m.status || 'active';
                                const stake = m.stake_amount ?? m.stake ?? '—';
                                const score = m.score ?? m.trust_score ?? '—';
                                return (
                                    <tr key={id} className="group hover:bg-neon-cyan/[0.02] transition-colors cursor-pointer data-row">
                                        <td className="px-6 py-5 text-slate-500 text-xs font-bold">#{String(idx + 1).padStart(2, '0')}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-white font-bold text-sm tracking-tight group-hover:text-neon-cyan transition-colors">{String(id).slice(0, 8)}...{String(id).slice(-4)}</span>
                                                <span className="text-[9px] text-slate-600 uppercase tracking-widest">Protocol_ID</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors uppercase">{String(address).substring(0, 16)}...</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <StatusBadge status={status} />
                                        </td>
                                        <td className="px-6 py-5 text-right text-sm text-white font-bold">
                                            {stake !== '—' ? Number(stake).toLocaleString() : '—'}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="text-neon-purple font-bold text-sm drop-shadow-[0_0_5px_rgba(188,19,254,0.3)]">
                                                {score !== '—' ? Number(score).toFixed(4) : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <Link href={`/miners/${id}`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-neon-cyan uppercase tracking-widest transition-all">
                                                View
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
