'use client';

import { useState, Suspense } from 'react';
import { useMiners, useValidators, useTasks, useEmissions } from '@/lib/hooks/useProtocolData';
import { Search, Cpu, Shield, Database, Zap, Hash, Clock, ExternalLink, ChevronRight, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import Link from 'next/link';

type ScanMode = 'all' | 'miners' | 'validators' | 'tasks' | 'emissions';

function ExplorerContent() {
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<ScanMode>('all');
    const [selected, setSelected] = useState<any>(null);

    const { data: miners = [] } = useMiners();
    const { data: validators = [] } = useValidators();
    const { data: tasks = [] } = useTasks();
    const { data: emissions = [] } = useEmissions();

    const q = query.toLowerCase();

    const filteredMiners = (miners as any[]).filter((m: any) =>
        !q || (m.miner_id || m.id || '').toLowerCase().includes(q)
    );
    const filteredValidators = (validators as any[]).filter((v: any) =>
        !q || (v.validator_id || v.id || '').toLowerCase().includes(q)
    );
    const filteredTasks = (tasks as any[]).filter((t: any) =>
        !q || (t.task_id || t.id || '').toLowerCase().includes(q) || (t.requester_id || '').toLowerCase().includes(q)
    );
    const filteredEmissions = (emissions as any[]).filter((e: any) =>
        !q || (e.name || e.id || '').toLowerCase().includes(q)
    );

    const totalResults = filteredMiners.length + filteredValidators.length + filteredTasks.length + filteredEmissions.length;

    const MODES: { id: ScanMode; label: string; Icon: any; count: number; color: string }[] = [
        { id: 'all', label: 'All', Icon: Hash, count: totalResults, color: 'text-white' },
        { id: 'miners', label: 'Miners', Icon: Cpu, count: filteredMiners.length, color: 'text-neon-cyan' },
        { id: 'validators', label: 'Validators', Icon: Shield, count: filteredValidators.length, color: 'text-neon-purple' },
        { id: 'tasks', label: 'Tasks', Icon: Database, count: filteredTasks.length, color: 'text-neon-yellow' },
        { id: 'emissions', label: 'Emissions', Icon: Zap, count: filteredEmissions.length, color: 'text-neon-green' },
    ];

    return (
        <div className="flex flex-col gap-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="border-b border-white/5 pb-6">
                <h1 className="text-4xl font-display font-bold text-white uppercase tracking-tighter italic">
                    Protocol <span className="text-neon-cyan">Explorer</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_#00f3ff]" />
                    Scan Miners · Validators · Tasks · Rewards
                </p>
            </div>

            {/* Search Bar */}
            <div className="relative group">
                <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-neon-cyan transition-colors" />
                <Input
                    placeholder="SCAN BY ACCOUNT ID, TASK ID, OR MINER ADDRESS..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="pl-12 pr-12 bg-black/60 border-white/10 text-white placeholder:text-slate-600 focus:border-neon-cyan/40 h-14 text-sm font-mono tracking-widest transition-all shadow-[0_0_0px_rgba(0,243,255,0)] focus:shadow-[0_0_30px_rgba(0,243,255,0.08)]"
                />
                {query && (
                    <button onClick={() => setQuery('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Mode Tabs */}
            <div className="flex flex-wrap gap-2">
                {MODES.map(({ id, label, Icon, count, color }) => (
                    <button
                        key={id}
                        onClick={() => setMode(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                            mode === id
                                ? 'bg-white/[0.05] border-white/20 text-white'
                                : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10'
                        }`}
                    >
                        <Icon size={12} className={mode === id ? color : ''} />
                        {label}
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono ${mode === id ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-600'}`}>
                            {count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Results */}
            <div className="space-y-6">
                {/* Miners */}
                {(mode === 'all' || mode === 'miners') && filteredMiners.length > 0 && (
                    <div className="panel overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-neon-cyan/[0.02]">
                            <Cpu size={14} className="text-neon-cyan" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Miners <span className="text-neon-cyan">{filteredMiners.length}</span></span>
                        </div>
                        {filteredMiners.map((m: any) => {
                            const id = m.miner_id || m.id;
                            const trust = m.trust_score || m.reputation?.score || 0;
                            return (
                                <div key={id} onClick={() => setSelected({ type: 'miner', data: m })} className="flex items-center justify-between px-6 py-4 border-b border-white/5 last:border-0 hover:bg-neon-cyan/[0.02] cursor-pointer group transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg"><Cpu size={14} className="text-neon-cyan" /></div>
                                        <div>
                                            <p className="text-white font-bold font-mono text-sm group-hover:text-neon-cyan transition-colors">{id}</p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Stake: {m.stake_amount || 0} ℏ · Trust: {(trust * 100).toFixed(1)}%</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <StatusBadge status={m.status || 'active'} />
                                        <ChevronRight size={14} className="text-slate-600 group-hover:text-neon-cyan transition-colors" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Validators */}
                {(mode === 'all' || mode === 'validators') && filteredValidators.length > 0 && (
                    <div className="panel overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-neon-purple/[0.02]">
                            <Shield size={14} className="text-neon-purple" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Validators <span className="text-neon-purple">{filteredValidators.length}</span></span>
                        </div>
                        {filteredValidators.map((v: any) => {
                            const id = v.validator_id || v.id;
                            const emissions_total = v.total_emissions || 0;
                            return (
                                <div key={id} onClick={() => setSelected({ type: 'validator', data: v })} className="flex items-center justify-between px-6 py-4 border-b border-white/5 last:border-0 hover:bg-neon-purple/[0.02] cursor-pointer group transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-neon-purple/5 border border-neon-purple/20 rounded-lg"><Shield size={14} className="text-neon-purple" /></div>
                                        <div>
                                            <p className="text-white font-bold font-mono text-sm group-hover:text-neon-purple transition-colors">{id}</p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Emissions: {Number(emissions_total).toFixed(2)} MDT · Subnet: {(v.subnet_ids || [1]).join(',')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <StatusBadge status={v.status || 'active'} />
                                        <ChevronRight size={14} className="text-slate-600 group-hover:text-neon-purple transition-colors" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Tasks */}
                {(mode === 'all' || mode === 'tasks') && filteredTasks.length > 0 && (
                    <div className="panel overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-yellow-500/[0.02]">
                            <Database size={14} className="text-neon-yellow" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Tasks <span className="text-neon-yellow">{filteredTasks.length}</span></span>
                        </div>
                        {filteredTasks.map((t: any) => {
                            const id = t.task_id || t.id;
                            return (
                                <div key={id} onClick={() => setSelected({ type: 'task', data: t })} className="flex items-center justify-between px-6 py-4 border-b border-white/5 last:border-0 hover:bg-yellow-500/[0.02] cursor-pointer group transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg"><Database size={14} className="text-neon-yellow" /></div>
                                        <div>
                                            <p className="text-white font-bold font-mono text-sm group-hover:text-neon-yellow transition-colors">{id.slice(0, 18)}...</p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Type: {t.task_type} · Reward: {t.reward} ℏ · Assigned: {t.miner_id || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <StatusBadge status={t.status || 'pending'} />
                                        <ChevronRight size={14} className="text-slate-600 group-hover:text-neon-yellow transition-colors" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Emissions */}
                {(mode === 'all' || mode === 'emissions') && filteredEmissions.length > 0 && (
                    <div className="panel overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-neon-green/[0.02]">
                            <Zap size={14} className="text-neon-green" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Reward Ledger <span className="text-neon-green">{filteredEmissions.length}</span></span>
                        </div>
                        {filteredEmissions.map((e: any) => (
                            <div key={e.id} className="flex items-center justify-between px-6 py-4 border-b border-white/5 last:border-0 hover:bg-neon-green/[0.02] transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-neon-green/5 border border-neon-green/20 rounded-lg"><Zap size={14} className="text-neon-green" /></div>
                                    <div>
                                        <p className="text-white font-bold font-mono text-sm">{e.name}</p>
                                        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">{e.subnet} · {e.timestamp}</p>
                                    </div>
                                </div>
                                <div className="text-neon-green font-bold font-mono text-sm">+{e.amount} MDT</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {totalResults === 0 && (
                    <div className="panel p-16 text-center text-slate-600 uppercase tracking-widest text-xs font-bold">
                        NO_RESULTS_FOUND — Try a different search term
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={() => setSelected(null)}>
                    <div className="bg-[#0a0e17] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h3 className="font-display font-bold text-white uppercase tracking-tight italic text-lg">
                                {selected.type.charAt(0).toUpperCase() + selected.type.slice(1)} Details
                            </h3>
                            <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap break-all">
                                {JSON.stringify(selected.data, null, 2)}
                            </pre>
                        </div>
                        <div className="p-4 border-t border-white/5 flex justify-end gap-3">
                            {selected.type === 'miner' && (
                                <Link href={`/miners/${encodeURIComponent(selected.data.miner_id || selected.data.id)}`}
                                    className="text-[10px] font-bold text-neon-cyan border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-2 rounded-lg hover:bg-neon-cyan/10 transition-all uppercase tracking-widest flex items-center gap-1.5">
                                    View Profile <ChevronRight size={12} />
                                </Link>
                            )}
                            <a href={`https://hashscan.io/testnet/account/${selected.data.account_id || selected.data.id}`} target="_blank" rel="noreferrer"
                                className="text-[10px] font-bold text-slate-400 border border-white/10 px-4 py-2 rounded-lg hover:text-white transition-all uppercase tracking-widest flex items-center gap-1.5">
                                Hashscan <ExternalLink size={12} />
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ExplorerPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-slate-600 text-xs font-mono uppercase tracking-widest">Initializing Scanner...</div>}>
            <ExplorerContent />
        </Suspense>
    );
}
