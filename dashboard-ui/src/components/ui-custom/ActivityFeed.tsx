'use client';

import { useProtocolData } from '@/lib/hooks/useProtocolData';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Clock, Activity, Zap, Cpu, ShieldAlert } from 'lucide-react';

export default function ActivityFeed() {
    const { activities, isLoading } = useProtocolData();

    const getIcon = (type: string) => {
        switch (type) {
            case 'miner_joined': return <Cpu size={12} className="text-neon-cyan" />;
            case 'task_assigned': return <Activity size={12} className="text-neon-purple" />;
            case 'task_completed': return <Zap size={12} className="text-neon-green" />;
            case 'reward_emitted': return <ShieldAlert size={12} className="text-yellow-500" />;
            default: return <Terminal size={12} className="text-slate-500" />;
        }
    };

    const getLogColor = (type: string) => {
        switch (type) {
            case 'miner_joined': return 'text-neon-cyan';
            case 'task_assigned': return 'text-neon-purple';
            case 'task_completed': return 'text-neon-green';
            case 'reward_emitted': return 'text-yellow-500 font-bold';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a1120] font-mono relative overflow-hidden group">
            {/* Console Overlay FX */}
            <div className="absolute inset-0 pointer-events-none z-10 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

            <div className="flex items-center gap-2 p-3 bg-black/40 border-b border-white/5 z-20">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest ml-2">Metagraph_Console_v2.4</span>
            </div>

            <ScrollArea className="flex-1 p-4 z-20 relative">
                <div className="flex flex-col gap-3">
                    {isLoading ? (
                        <div className="flex items-center gap-2 text-slate-500 animate-pulse italic text-xs">
                            <span className="text-neon-cyan">{`>`}</span>
                            INITIALIZING_DATA_STREAM...
                        </div>
                    ) : (!activities || activities.length === 0) ? (
                        <div className="text-slate-500 italic text-xs">
                            <span className="text-neon-cyan">{`>`}</span>
                            NO_ACTIVE_STREAM_DETECTED...
                        </div>
                    ) : (
                        activities.map((activity: any) => (
                            <div key={activity.id} className="flex flex-col gap-1 animate-fade-in-up">
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                    <Clock size={10} />
                                    <span>[{activity.timestamp}]</span>
                                    <span className="uppercase tracking-tighter">Event_Log</span>
                                </div>
                                <div className="flex items-start gap-2 text-xs leading-relaxed group/item">
                                    <span className="text-neon-cyan mt-1">{`>`}</span>
                                    <div className="flex items-center gap-2">
                                        {getIcon(activity.type)}
                                        <span className={getLogColor(activity.type)}>
                                            {activity.message.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div className="h-4 w-2 bg-neon-cyan animate-pulse mt-1" />
                </div>
            </ScrollArea>

            {/* Bottom Bar */}
            <div className="p-2 border-t border-white/5 bg-black/20 text-[9px] text-slate-600 flex justify-between uppercase tracking-widest z-20">
                <span>Ln 42, Col 8</span>
                <span>UTF-8</span>
            </div>
        </div>
    );
}
