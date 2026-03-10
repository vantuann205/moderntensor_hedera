'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Hash, Clock, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const ACCOUNT_ID = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '0.0.8127455';
const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

export function useRecentTransactions() {
    return useQuery({
        queryKey: ['recent-transactions', ACCOUNT_ID],
        queryFn: async () => {
            const res = await fetch(`${MIRROR_BASE}/api/v1/accounts/${ACCOUNT_ID}/transactions?limit=10`);
            if (!res.ok) throw new Error('Failed to fetch transactions');
            const data = await res.json();
            return data.transactions || [];
        },
        refetchInterval: 10000,
        refetchOnWindowFocus: false,
    });
}

export default function TransactionList() {
    const { data: transactions, isLoading } = useRecentTransactions();

    if (isLoading) return (
        <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full bg-white/5 rounded-xl" />
            ))}
        </div>
    );

    return (
        <div className="space-y-3">
            {transactions?.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-xs font-bold uppercase tracking-widest bg-white/[0.01] rounded-2xl border border-white/5">
                    No recent transactions detected
                </div>
            ) : (
                transactions?.map((tx: any) => {
                    const isSuccess = tx.result === 'SUCCESS';
                    const amount = tx.transfers?.find((tf: any) => tf.account === ACCOUNT_ID)?.amount || 0;
                    const isIncoming = amount > 0;

                    return (
                        <div key={tx.transaction_id} className="panel p-4 group hover:border-white/20 transition-all flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIncoming ? 'bg-emerald-500/10 text-emerald-500' : 'bg-neon-cyan/10 text-neon-cyan'} border border-white/5`}>
                                    {isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono font-bold text-white tracking-tight">
                                            {tx.transaction_id.split('@')[0]}...
                                        </span>
                                        {isSuccess ?
                                            <CheckCircle2 size={12} className="text-emerald-500" /> :
                                            <XCircle size={12} className="text-red-500" />
                                        }
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                        <Clock size={10} />
                                        {new Date(tx.consensus_timestamp * 1000).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right space-y-1">
                                <div className={`text-sm font-display font-bold ${isIncoming ? 'text-emerald-400' : 'text-slate-200'}`}>
                                    {isIncoming ? '+' : ''}{(amount / 100000000).toLocaleString()} ℏ
                                </div>
                                <a
                                    href={`https://hashscan.io/testnet/transaction/${tx.consensus_timestamp}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-end gap-1 text-[9px] font-bold text-slate-600 hover:text-neon-cyan transition-colors uppercase tracking-widest"
                                >
                                    Hashscan <ExternalLink size={10} />
                                </a>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
