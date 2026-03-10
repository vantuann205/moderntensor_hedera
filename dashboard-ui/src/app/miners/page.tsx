'use client';

import { useMiners } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, Database } from 'lucide-react';
import Link from 'next/link';

const columns: ColumnDef<any>[] = [
    {
        accessorKey: 'miner_id',
        header: 'Miner ID',
        cell: ({ row }) => {
            const id = row.original.miner_id || row.original.id;
            return (
                <Link href={`/miners/${id}`} className="text-neon-cyan hover:underline font-bold">
                    {id}
                </Link>
            );
        },
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status || 'active'} />,
    },
    {
        accessorKey: 'stake_amount',
        header: 'Stake',
        cell: ({ row }) => `${(row.original.stake_amount || 0).toLocaleString()} ℏ`,
    },
    {
        accessorKey: 'score',
        header: 'Trust Score',
        cell: ({ row }) => (
            <span className="text-neon-purple font-bold">
                {(row.original.reputation?.score || row.original.score || 0).toFixed(4)}
            </span>
        ),
    },
    {
        accessorKey: 'tasks_completed',
        header: 'Tasks',
        cell: ({ row }) => row.original.reputation?.total_tasks || row.original.tasks_completed || 0,
    },
    {
        accessorKey: 'last_active_at',
        header: 'Last Active',
        cell: ({ row }) => row.original.last_active_at ? new Date(row.original.last_active_at * 1000).toLocaleTimeString() : 'Recent',
    },
    {
        id: 'actions',
        cell: ({ row }) => {
            const id = row.original.miner_id || row.original.id;
            return (
                <Link href={`/miners/${id}`} className="text-slate-500 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                </Link>
            );
        },
    }
];

export default function MinersPage() {
    const { data: miners, isLoading } = useMiners();

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-neon-cyan/10 border border-neon-cyan/20 rounded-xl">
                        <Database size={24} className="text-neon-cyan" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-display font-bold text-white tracking-tighter italic uppercase">
                            Miner <span className="text-neon-cyan">Registry</span>
                        </h1>
                        <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">
                            Protocol Participant Index
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6 px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Capacity</div>
                        <div className="text-xl font-display font-bold text-white tracking-tight">{miners?.length || 0} Nodes</div>
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
                    data={miners || []}
                    searchKey="miner_id"
                    searchPlaceholder="Filter neural nodes..."
                />
            )}
        </div>
    );
}
