'use client';

import { useTasks } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Database, Search, ArrowRight, Zap, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';

export default function TasksPage() {
    const { data: tasks = [], isLoading } = useTasks();
    const [search, setSearch] = useState('');

    const filtered = (tasks as any[]).filter((t: any) => {
        const id = String(t.id || t.task_id || '').toLowerCase();
        const type = String(t.type || '').toLowerCase();
        return id.includes(search) || type.includes(search);
    });

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
                        Metagraph <span className="text-neon-cyan">Tasks</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_#00f3ff]" />
                        Neural Job Execution Queue
                    </p>
                </div>
                <div className="flex items-center gap-4 bg-neon-cyan/5 border border-neon-cyan/20 px-4 py-2 rounded-xl">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Active Tasks</span>
                        <span className="text-lg font-display font-bold text-neon-cyan tracking-tight">{tasks.length}</span>
                    </div>
                    <Database size={24} className="text-neon-cyan/40" />
                </div>
            </div>

            {/* Search */}
            <div className="relative group max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-neon-cyan transition-colors" />
                <Input
                    placeholder="SCAN JOB QUEUE..."
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
                                <th className="px-6 py-5">Job ID</th>
                                <th className="px-6 py-5">Task Type</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5">Assigned Miner</th>
                                <th className="px-6 py-5 text-right">Bounty (ℏ)</th>
                                <th className="px-6 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                            {isLoading ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i}><td colSpan={6} className="px-6 py-4"><Skeleton className="h-12 bg-white/5 rounded-lg" /></td></tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-24 text-slate-600 uppercase tracking-widest text-xs font-bold">No AI Jobs in Current Metagraph Cycle</td></tr>
                            ) : filtered.map((t: any, idx: number) => {
                                const id = t.id || t.task_id || `task-${idx}`;
                                const type = t.type || 'Inference';
                                const status = t.status || 'pending';
                                const miner = t.miner_id || t.assigned_to || 'UNASSIGNED';
                                const reward = t.reward || t.bounty || '—';
                                return (
                                    <tr key={id} className="group hover:bg-neon-cyan/[0.02] transition-colors cursor-pointer data-row">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-white font-bold text-sm tracking-tight group-hover:text-neon-cyan transition-colors">#{String(id).slice(0, 8)}</span>
                                                <ArrowUpRight size={14} className="text-slate-600 group-hover:text-neon-cyan group-hover:scale-110 transition-all" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <Zap size={12} className="text-neon-cyan" />
                                                <span className="text-xs uppercase tracking-widest text-slate-300">{type}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <StatusBadge status={status} />
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={miner === 'UNASSIGNED' ? 'text-slate-600 italic text-[10px]' : 'text-xs text-slate-400 font-bold group-hover:text-slate-200 transition-colors'}>
                                                {miner === 'UNASSIGNED' ? miner : `${String(miner).slice(0, 8)}...`}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right text-sm text-neon-green font-bold">
                                            {reward !== '—' ? `${reward}` : '—'}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <Link href={`/tasks/${id}`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-neon-cyan uppercase tracking-widest transition-all">
                                                Details
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
