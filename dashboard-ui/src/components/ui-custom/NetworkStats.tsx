'use client';

import { useNetworkState } from '@/lib/hooks/useProtocolData';
import { Activity, Shield, Users, Zap, Clock, Globe } from 'lucide-react';

export default function NetworkStats() {
    const { data: stats, isLoading } = useNetworkState();

    const metrics = [
        { label: 'Neural Nodes', value: stats?.active_miners ?? '-', icon: Users, color: 'text-neon-cyan' },
        { label: 'Validator Nexus', value: stats?.active_validators ?? '-', icon: Shield, color: 'text-neon-purple' },
        { label: 'Total Verified', value: stats?.tasks_completed !== undefined ? Number(stats.tasks_completed).toLocaleString() : '-', icon: Activity, color: 'text-emerald-400' },
        { label: 'Network Uptime', value: stats?.network_uptime ?? '-', icon: Clock, color: 'text-slate-400' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Real-time Network State</span>
                </div>
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Mirror Node Connected</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {metrics.map((m) => (
                    <div key={m.label} className="panel p-4 group hover:border-white/20 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <m.icon size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                            {isLoading && <div className="w-1.5 h-1.5 rounded-full bg-white/10 animate-pulse" />}
                        </div>
                        <div className={`text-xl font-display font-bold ${m.color} tracking-tight`}>
                            {isLoading ? '...' : m.value}
                        </div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            {m.label}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
