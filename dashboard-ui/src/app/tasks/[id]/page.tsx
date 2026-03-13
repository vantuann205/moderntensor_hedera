'use client';

import { useTask } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { ArrowLeft, ExternalLink, Shield } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { useWallet } from '@/context/WalletContext';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: task, isLoading } = useTask(decodeURIComponent(id));
    const { isConnected, isValidator } = useWallet();

    if (isLoading) return (
        <div className="space-y-6 animate-fade-in">
            <Skeleton className="h-8 w-48 bg-white/5" />
            <Skeleton className="h-96 bg-white/5" />
        </div>
    );

    if (!task) return (
        <div className="animate-fade-in text-center py-24">
            <div className="text-slate-400 text-lg mb-2">Task not detected</div>
            <div className="text-slate-600 text-sm mb-6">ID: {id}</div>
            <Link href="/tasks" className="text-neon-cyan hover:underline text-xs uppercase font-bold tracking-widest">← Back to Tasks</Link>
        </div>
    );

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

    const fields = [
        ['Protocol ID', task.id || task.task_id, 'mono'],
        ['Task Sector', task.type || task.task_type || 'code_review', 'badge'],
        ['Network Status', null, 'status'],
        ['Assigned Miner', task.assigned_miner || task.miner_id, 'link-miner'],
        ['Verified By', task.validator || task.assigned_validator, 'link-validator'],
        ['Protocol Reward', task.reward_amount || task.reward ? `${task.reward_amount || task.reward} MDT` : '—', 'highlight'],
        ['Consensus Score', task.score !== undefined && task.score !== null ? Number(task.score).toFixed(4) : '—', 'score'],
        ['Subnet Sector', task.subnet_id ?? task.subnet ?? '0', 'mono'],
        ['Initialization', formatUTC7(task.created_at), 'text'],
        ['Finalization', formatUTC7(task.completed_at), 'text'],
    ];

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl">
            <Link href="/tasks" className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-4">
                <ArrowLeft size={14} /> Back to Registry
            </Link>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white tracking-tighter italic uppercase">
                        Verification <span className="text-neon-cyan">Challenge</span>
                    </h1>
                    <p className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-2">
                        {task.id || task.task_id}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <StatusBadge status={task.status || 'pending'} />
                    {isConnected && isValidator && (task.status === 'pending' || task.status === 'active') && (
                        <button className="flex items-center gap-2 px-4 py-2 bg-neon-purple text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                             <Shield size={14} /> Verify Solution
                        </button>
                    )}
                    {task.hcs_link && (
                        <a href={task.hcs_link} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/20 px-4 py-2 rounded-lg text-neon-cyan hover:bg-neon-cyan/20 transition-all text-[10px] font-bold uppercase tracking-widest">
                            <ExternalLink size={14} /> View On-Chain Proof
                        </a>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Result Content */}
                    {(task.result || task.output) && (
                        <div className="panel overflow-hidden">
                            <div className="bg-white/[0.02] border-b border-white/5 px-6 py-4 flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Verification Output</h3>
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                            </div>
                            <div className="p-0">
                                <pre className="text-xs font-mono text-slate-300 bg-black/40 p-6 overflow-auto max-h-[400px] whitespace-pre-wrap leading-relaxed">
                                    {typeof (task.result || task.output) === 'string'
                                        ? (task.result || task.output)
                                        : JSON.stringify(task.result || task.output, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Task Input/Prompt */}
                    {(task.prompt || task.payload?.code || task.input) && (
                        <div className="panel overflow-hidden">
                            <div className="bg-white/[0.02] border-b border-white/5 px-6 py-4">
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Input Signature</h3>
                            </div>
                            <div className="p-0">
                                <pre className="text-xs font-mono text-slate-400 bg-black/20 p-6 overflow-auto max-h-48 whitespace-pre-wrap italic">
                                    {task.prompt || task.payload?.code || task.input}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="panel p-6 space-y-1">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4 block">Specification Detail</h3>
                        <div className="space-y-4">
                            {fields.map(([label, value, type]) => (
                                <div key={label as string} className="flex flex-col gap-1 py-1 border-b border-white/[0.03] last:border-0 pb-3">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</span>
                                    <div className="text-xs font-mono break-all">
                                        {type === 'status' ? (
                                            <StatusBadge status={task.status || 'pending'} />
                                        ) : type === 'badge' ? (
                                            <span className="px-2 py-0.5 bg-neon-purple/10 border border-neon-purple/20 text-neon-purple text-[9px] font-bold rounded uppercase">
                                                {value}
                                            </span>
                                        ) : type === 'link-miner' ? (
                                            <Link href={`/miners/${value}`} className="text-neon-cyan hover:underline">{value}</Link>
                                        ) : type === 'link-validator' ? (
                                            <Link href={`/validators/${value}`} className="text-neon-purple hover:underline">{value}</Link>
                                        ) : type === 'score' ? (
                                            <span className="text-green-400 font-bold">{value}</span>
                                        ) : type === 'highlight' ? (
                                            <span className="text-neon-yellow font-bold">{value}</span>
                                        ) : (
                                            <span className="text-slate-300">{value || '—'}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
