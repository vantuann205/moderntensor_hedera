'use client';

import { useTask } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: task, isLoading } = useTask(decodeURIComponent(id));

    if (isLoading) return (
        <div className="space-y-4 animate-fade-in">
            <Skeleton className="h-8 w-48 bg-white/5" />
            <Skeleton className="h-64 bg-white/5" />
        </div>
    );

    if (!task) return (
        <div className="animate-fade-in text-center py-24">
            <div className="text-slate-400 text-lg mb-2">Task not found</div>
            <div className="text-slate-600 text-sm mb-6">ID: {id}</div>
            <Link href="/tasks" className="text-cyan-400 hover:underline text-sm">← Back to Tasks</Link>
        </div>
    );

    const fields = [
        ['Task ID', task.id || task.task_id],
        ['Type', task.type || task.task_type],
        ['Status', null],
        ['Assigned Miner', task.assigned_miner || task.miner_id],
        ['Validator', task.validator || task.assigned_validator],
        ['Reward', task.reward ? `${task.reward} MDT` : '—'],
        ['Score', task.score !== undefined ? Number(task.score).toFixed(4) : '—'],
        ['Subnet', task.subnet_id ?? task.subnet ?? '—'],
        ['Created', task.timestamp || task.created_at ? new Date(task.timestamp || task.created_at).toLocaleString() : '—'],
        ['Completed', task.completed_at ? new Date(task.completed_at).toLocaleString() : '—'],
    ];

    return (
        <div className="space-y-6 animate-fade-in max-w-3xl">
            <Link href="/tasks" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
                <ArrowLeft size={14} /> Back to Tasks
            </Link>

            <div>
                <h1 className="text-xl font-bold text-white">Task Detail</h1>
                <p className="text-xs font-mono text-slate-500 mt-1">{task.id || task.task_id}</p>
            </div>

            <div className="panel p-5 space-y-3">
                {fields.map(([label, value]) => (
                    <div key={label as string} className="flex items-start justify-between py-2 border-b border-white/[0.04] last:border-0">
                        <span className="text-xs text-slate-400 w-32 flex-shrink-0">{label}</span>
                        <span className="text-sm text-right font-mono text-slate-200">
                            {label === 'Status' ? <StatusBadge status={task.status || 'pending'} /> : (String(value || '—'))}
                        </span>
                    </div>
                ))}
            </div>

            {/* Prompt/Input */}
            {(task.prompt || task.input || task.description) && (
                <div className="panel p-5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Task Input</h3>
                    <pre className="text-xs font-mono text-slate-300 bg-black/40 rounded-lg p-4 overflow-auto max-h-48 whitespace-pre-wrap">
                        {task.prompt || task.input || task.description}
                    </pre>
                </div>
            )}

            {/* Result */}
            {(task.result || task.output) && (
                <div className="panel p-5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3">Result</h3>
                    <pre className="text-xs font-mono text-slate-300 bg-black/40 rounded-lg p-4 overflow-auto max-h-48 whitespace-pre-wrap">
                        {JSON.stringify(task.result || task.output, null, 2)}
                    </pre>
                </div>
            )}

            {/* Hashscan link */}
            {task.tx_hash && (
                <a href={`https://hashscan.io/testnet/tx/${task.tx_hash}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-cyan-400 text-sm hover:underline">
                    View on Hashscan <ExternalLink size={12} />
                </a>
            )}
        </div>
    );
}
