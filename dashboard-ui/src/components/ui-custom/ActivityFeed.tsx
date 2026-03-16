'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Cpu, Zap, Shield, UserPlus, CheckCircle2, Clock } from 'lucide-react';

// Mock useActivity hook since it doesn't exist
function useActivity() {
  return { data: [], loading: false, error: null };
}

function getEventStyle(type: string) {
    switch (type) {
        case 'miner_joined':
            return { Icon: UserPlus, color: 'text-neon-cyan', borderColor: 'border-neon-cyan/30', bg: 'bg-neon-cyan/5', label: 'MINER_JOIN' };
        case 'task_completed':
            return { Icon: CheckCircle2, color: 'text-neon-green', borderColor: 'border-neon-green/30', bg: 'bg-neon-green/5', label: 'TASK_DONE' };
        case 'task_assigned':
            return { Icon: Cpu, color: 'text-neon-yellow', borderColor: 'border-yellow-500/30', bg: 'bg-yellow-500/5', label: 'TASK_QUEUE' };
        case 'reward_emitted':
            return { Icon: Zap, color: 'text-neon-purple', borderColor: 'border-neon-purple/30', bg: 'bg-neon-purple/5', label: 'REWARD_TX' };
        default:
            return { Icon: Shield, color: 'text-slate-400', borderColor: 'border-white/10', bg: 'bg-white/[0.02]', label: 'PROTOCOL' };
    }
}

export default function ActivityFeed() {
    const { data: activityData, loading } = useActivity();
    const activities = Array.isArray(activityData) ? activityData : [];

    const formatUTC7 = (ts: any) => {
        if (!ts) return '';
        // If it's already a relative string like '2m ago', return as is
        if (typeof ts === 'string' && (ts.includes('ago') || ts.includes(':'))) return ts;
        
        const date = new Date(Number(ts) * (String(ts).length > 10 ? 1 : 1000));
        return date.toLocaleTimeString('en-GB', { 
            timeZone: 'Asia/Ho_Chi_Minh', 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="flex flex-col h-full font-mono text-xs text-secondary">
            {/* Terminal header */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-panel-border bg-black/10 dark:bg-black/40">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="w-2 h-2 rounded-full bg-neon-green" />
                <span className="ml-2 text-[11px] text-slate-500 uppercase tracking-widest">METAGRAPH_CONSOLE_V2.4</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 bg-white/5 dark:bg-transparent">
                {loading ? (
                    [...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full bg-white/5 rounded" />
                    ))
                ) : (!activities || activities.length === 0) ? (
                    <div className="text-slate-500 italic text-xs">
                        <span className="text-neon-cyan">{`>`}</span>
                        NO_ACTIVE_STREAM_DETECTED...
                    </div>
                ) : (
                    activities.map((activity: any) => {
                        const { Icon, color, borderColor, bg, label } = getEventStyle(activity.type);
                        return (
                            <div key={activity.id} className={`flex items-start gap-2 px-2 py-2 rounded-lg border ${borderColor} ${bg} animate-fade-in-up`}>
                                <Icon size={11} className={`${color} mt-0.5 flex-shrink-0`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <span className={`text-[11px] font-bold uppercase tracking-widest ${color}`}>{label}</span>
                                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                            <Clock size={8} />
                                            {formatUTC7(activity.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-[12px] text-primary truncate opacity-80">{activity.message}</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="px-3 py-1.5 border-t border-white/5 text-[11px] text-slate-600 flex justify-between">
                <span>LN {activities.length}, COL 0</span>
                <span>UTF-8</span>
            </div>
        </div>
    );
}
