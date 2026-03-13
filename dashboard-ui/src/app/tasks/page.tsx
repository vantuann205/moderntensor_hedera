'use client';

import { useTasks } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, Zap, Target, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import SubmitTaskModal from '@/components/ui-custom/SubmitTaskModal';

const columns: ColumnDef<any>[] = [
    {
        accessorKey: 'task_id',
        header: 'Challenge ID',
        cell: ({ row }) => {
            const id = row.original.task_id || row.original.id;
            return (
                <Link href={`/tasks/${id}`} className="text-white font-mono text-xs font-bold tracking-tight hover:text-neon-cyan transition-colors">
                    {String(id).slice(0, 16)}...
                </Link>
            );
        }
    },
    {
        accessorKey: 'task_type',
        header: 'Protocol Sector',
        cell: ({ row }) => (
            <span className="px-2 py-1 bg-white/10 border border-white/20 rounded text-[10px] font-bold text-white uppercase">
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
            <Link href={`/miners/${row.original.miner_id}`} className="text-white hover:text-neon-cyan transition-colors font-mono text-xs">
                {String(row.original.miner_id).slice(-8)}
            </Link>
        ) : <span className="text-white/40 text-xs">—</span>
    },
    {
        accessorKey: 'reward_amount',
        header: 'Reward (MDT)',
        cell: ({ row }) => (
            <span className="text-neon-yellow font-bold text-sm">
                {Number(row.original.reward_amount || 0).toLocaleString()} MDT
            </span>
        )
    },
    {
        accessorKey: 'hcs_link',
        header: 'On-Chain Proof',
        cell: ({ row }) => {
            const consensusTs = row.original.consensus_timestamp;
            const hcsSeq = row.original.hcs_sequence;
            
            if (!consensusTs) return <span className="text-white/40 text-xs">—</span>;
            
            // Link to transaction on HashScan using consensus timestamp
            const link = `https://hashscan.io/testnet/transaction/${consensusTs}`;
            
            return (
                <a 
                    href={link} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 hover:border-neon-cyan/50 transition-all uppercase tracking-widest px-3 py-1.5 rounded-lg group"
                    title={`View transaction on HashScan - Seq #${hcsSeq}`}
                >
                    <span className="group-hover:text-neon-cyan transition-colors">HashScan</span>
                    <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                </a>
            );
        }
    },
    {
        accessorKey: 'created_at',
        header: 'Timestamp',
        cell: ({ row }) => {
            const ts = row.original.created_at || row.original.timestamp;
            if (!ts) return <span className="text-white/40 text-xs">—</span>;
            const date = new Date(Number(ts) * (String(ts).length > 10 ? 1 : 1000));
            return (
                <span className="text-white text-xs font-mono">
                    {date.toLocaleString('en-GB', { 
                        timeZone: 'Asia/Ho_Chi_Minh', 
                        hour12: false,
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </span>
            );
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
    const [isModalOpen, setIsModalOpen] = useState(false);

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
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-neon-purple/10 border border-neon-purple/30 rounded-xl text-neon-purple hover:bg-neon-purple hover:text-white transition-all shadow-[0_0_15px_rgba(188,19,254,0.15)] hover:shadow-[0_0_20px_rgba(188,19,254,0.4)]"
                    >
                        <Send size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">Deploy Task</span>
                    </button>
                    <div className="flex items-center gap-6 px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="text-center">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Throughput</div>
                            <div className="text-xl font-display font-bold text-white tracking-tight">{tasks?.length || 0} Challenges</div>
                        </div>
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
            
            <SubmitTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
