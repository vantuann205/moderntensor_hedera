'use client';

import { useSubnets } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Network, Server } from 'lucide-react';

const columns: ColumnDef<any>[] = [
    {
        accessorKey: 'id',
        header: 'Subnet ID',
        cell: ({ row }) => (
            <span className="text-neon-cyan font-bold italic">
                #{row.original.id}
            </span>
        ),
    },
    {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => <span className="font-bold">{row.original.name}</span>,
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status || 'active'} />,
    },
    {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => <span className="text-slate-400">{row.original.description}</span>,
    },
    {
        accessorKey: 'fee_rate',
        header: 'Protocol Fee',
        cell: ({ row }) => `${row.original.fee_rate}%`,
    },
    {
        accessorKey: 'miners_count',
        header: 'Miners',
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Server size={14} className="text-slate-400" />
                <span>{row.original.miners_count}</span>
            </div>
        )
    },
    {
        accessorKey: 'validators_count',
        header: 'Validators',
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Network size={14} className="text-slate-400" />
                <span>{row.original.validators_count}</span>
            </div>
        )
    },
    {
        accessorKey: 'minimum_stake',
        header: 'Min Stake',
        cell: ({ row }) => <span className="text-neon-purple font-mono">{row.original.minimum_stake}</span>,
    }
];

export default function SubnetsPage() {
    const { data: subnets, isLoading } = useSubnets();

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-neon-cyan/10 border border-neon-cyan/20 rounded-xl">
                        <Network size={24} className="text-neon-cyan" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-display font-bold text-white tracking-tighter italic uppercase">
                            Subnet <span className="text-neon-cyan">Networks</span>
                        </h1>
                        <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">
                            Decentralized Compute Pipelines
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6 px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Active Subnets</div>
                        <div className="text-xl font-display font-bold text-white tracking-tight">{subnets?.length || 0} Network(s)</div>
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
                    data={subnets || []}
                    searchKey="name"
                    searchPlaceholder="Filter subnets by name..."
                />
            )}
        </div>
    );
}
