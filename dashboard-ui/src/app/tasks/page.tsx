'use client';

import { useTasks } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, Zap, Target } from 'lucide-react';
import Link from 'next/link';

const columns: ColumnDef<any>[] = [
    {
        accessorKey: 'task_id',
        header: 'Challenge ID',
        cell: ({ row }) => {
            const id = row.original.task_id || row.original.id;
            return (
                <Link href={`/tasks/${id}`} className="text-neon-cyan font-mono text-[10px] font-bold tracking-tight">
                    {String(id).slice(0, 16)}...
                </Link>
            );
        }
    },
    {
        accessorKey: 'task_type',
        header: 'Protocol Sector',
        cell: ({ row }) => (
            <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-bold text-slate-400 uppercase">
                {row.original.task_type || 'code_review'}
            </span>
        )
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status || 'pending'} />
    },
    {
        accessorKey: 'miner_id',
        header: 'Assigned Miner',
        cell: ({ row }) => row.original.miner_id ? (
            <Link href={`/miners/${row.original.miner_id}`} className="text-slate-400 hover:text-white transition-colors">
                {String(row.original.miner_id).slice(-6)}
            </Link>
        ) : '—'
    },
    {
        accessorKey: 'reward_amount',
        header: 'Reward',
        cell: ({ row }) => (
            <span className="text-neon-yellow font-bold">
                {Number(row.original.reward_amount || row.original.reward || 0).toLocaleString()} ℏ
            </span>
        )
    },
    {
        accessorKey: 'created_at',
        header: 'Timestamp',
        cell: ({ row }) => {
            const ts = row.original.created_at || row.original.timestamp;
            return ts ? new Date(Number(ts) * (String(ts).length > 10 ? 1 : 1000)).toLocaleTimeString() : '—';
        }
    },
    {
        id: 'actions',
        cell: ({ row }) => {
            const id = row.original.task_id || row.original.id;
            return (
                <Link href={`/tasks/${id}`} className="text-slate-500 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                </Link>
            );
        }
    }
];

export default function TasksPage() {
    const { data: tasks, isLoading } = useTasks();

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-neon-yellow/10 border border-neon-yellow/20 rounded-xl">
                        <Target size={24} className="text-neon-yellow" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-display font-bold text-white tracking-tighter italic uppercase">
                            Task <span className="text-neon-yellow">Stream</span>
                        </h1>
                        <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">
                            Decentralized Neural Operations
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6 px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Throughput</div>
                        <div className="text-xl font-display font-bold text-white tracking-tight">{tasks?.length || 0} Challenges</div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full bg-white/5" />
                    <Skeleton className="h-96 w-full bg-white/5" />
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={tasks || []}
                    searchKey="task_id"
                    searchPlaceholder="Trace challenge ID..."
                />
            )}
        </div>
    );
}
