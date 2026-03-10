'use client';

import { useValidators } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const columns: ColumnDef<any>[] = [
    {
        accessorKey: 'validator_id',
        header: 'Validator ID',
        cell: ({ row }) => (
            <Link href={`/validators/${row.original.validator_id}`} className="text-neon-purple hover:underline font-bold">
                {row.original.validator_id}
            </Link>
        ),
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status || 'active'} />,
    },
    {
        accessorKey: 'stake_amount',
        header: 'Validator Stake',
        cell: ({ row }) => `${(row.original.stake_amount || 0).toLocaleString()} ℏ`,
    },
    {
        accessorKey: 'reputation_score',
        header: 'Reliability',
        cell: ({ row }) => (
            <span className="text-neon-cyan font-bold">
                {(row.original.reputation_score || 0.99).toFixed(4)}
            </span>
        ),
    },
    {
        accessorKey: 'total_validations',
        header: 'Val. Count',
        cell: ({ row }) => row.original.total_validations || 0,
    },
    {
        id: 'actions',
        cell: ({ row }) => (
            <Link href={`/validators/${row.original.validator_id}`} className="text-slate-500 hover:text-white transition-colors">
                <ChevronRight size={16} />
            </Link>
        ),
    }
];

export default function ValidatorsPage() {
    const { data: validators, isLoading } = useValidators();

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-neon-purple/10 border border-neon-purple/20 rounded-xl">
                        <ShieldCheck size={24} className="text-neon-purple" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-display font-bold text-white tracking-tighter italic uppercase">
                            Validator <span className="text-neon-purple">Nexus</span>
                        </h1>
                        <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">
                            High-Staked Verification Nodes
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6 px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Active Oracles</div>
                        <div className="text-xl font-display font-bold text-white tracking-tight">{validators?.length || 0} Instances</div>
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
                    data={validators || []}
                    searchKey="validator_id"
                    searchPlaceholder="Probe validator ID..."
                />
            )}
        </div>
    );
}
