'use client';

import { useActivity } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu, Zap, Shield, UserPlus, Coins, Clock } from 'lucide-react';

export default function ActivityFeed() {
    const { data: activity, isLoading } = useActivity();

    if (isLoading) return (
        <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-white/5" />
            ))}
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activity?.length === 0 ? (
                <div className="p-12 text-center text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] italic">
                    Waiting for HCS Broadcasts...
                </div>
            ) : (
                <div className="divide-y divide-white/5">
                    {activity?.map((item: any) => {
                        const isReg = item.type === 'REGISTRATION';
                        const Icon = isReg ? UserPlus : Zap;
                        const color = isReg ? 'text-neon-cyan' : 'text-neon-yellow';

                        return (
                            <div key={item.id} className="p-4 hover:bg-white/[0.02] transition-colors group flex items-start gap-4">
                                <div className={`mt-1 p-2 rounded-lg bg-white/[0.03] border border-white/5 ${color} group-hover:scale-110 transition-transform`}>
                                    <Icon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">
                                            {isReg ? 'New Miner Joined' : 'Task Broadcasted'}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-600">
                                            {new Date(Number(item.timestamp) * 1000).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-mono truncate">
                                        {isReg
                                            ? `Account ${item.content.account_id || '—'} registered in Subnet ${item.content.subnet_id || 0}`
                                            : `Challenge ${item.id.slice(0, 12)}... initialized for sector ${item.content.task_type || 'default'}`
                                        }
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
