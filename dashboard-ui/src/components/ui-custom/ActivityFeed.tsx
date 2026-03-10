'use client';

import { useActivity } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu, Zap, Shield, UserPlus, Coins, Clock, ExternalLink } from 'lucide-react';

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
                        const type = item.content?.type || item.type;
                        let Icon = Zap;
                        let label = 'Protocol Event';
                        let color = 'text-neon-cyan';
                        let description = '';

                        switch (type) {
                            case 'miner_register':
                                Icon = UserPlus;
                                label = 'Miner Registered';
                                color = 'text-neon-cyan';
                                description = `Miner ${item.content.miner_id || '—'} joined the network`;
                                break;
                            case 'validator_register':
                                Icon = Shield;
                                label = 'Validator Joined';
                                color = 'text-neon-purple';
                                description = `Oracle ${item.content.validator_id || '—'} activated`;
                                break;
                            case 'task_create':
                                Icon = Cpu;
                                label = 'Task Created';
                                color = 'text-neon-yellow';
                                description = `New compute task ${item.content.task_id?.slice(0, 8)}... broadcasted`;
                                break;
                            case 'score_submit':
                                Icon = Coins;
                                label = 'Score Verified';
                                color = 'text-emerald-400';
                                description = `Task ${item.content.task_id?.slice(0, 8)}... verified by Oracle`;
                                break;
                        }

                        return (
                            <div key={item.id} className="p-4 hover:bg-white/[0.02] transition-colors group flex items-start gap-4">
                                <div className={`mt-1 p-2 rounded-lg bg-white/[0.03] border border-white/5 ${color} group-hover:scale-110 transition-transform`}>
                                    <Icon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">
                                            {label}
                                        </span>
                                        <a
                                            href={`https://hashscan.io/testnet/topic/${item.topic_id}/message/${item.sequence}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[8px] font-bold text-slate-600 hover:text-neon-cyan transition-colors uppercase tracking-widest flex items-center gap-1"
                                        >
                                            Verify On-Chain <ExternalLink size={8} />
                                        </a>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-mono truncate">
                                        {description || item.content.raw || 'Protocol synchronization event'}
                                    </p>
                                    <div className="mt-1 flex items-center justify-between">
                                        <span className="text-[9px] font-mono text-slate-700">
                                            Seq: #{item.sequence}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-600">
                                            {new Date(Number(item.timestamp) * 1000).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
