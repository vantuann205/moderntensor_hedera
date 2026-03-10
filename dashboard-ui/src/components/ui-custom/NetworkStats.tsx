'use client';

import { useNetworkState } from '@/lib/hooks/useProtocolData';
import { Activity, Shield, Users, Zap, Clock, Globe } from 'lucide-react';

export default function NetworkStats() {
    const { data: stats, isLoading } = useNetworkState();

    const metrics = [
        { label: 'Neural Nodes', value: stats?.active_miners ?? '-', icon: Users, color: 'text-neon-cyan' },
        { label: 'Oracle Nexus', value: stats?.active_validators ?? '-', icon: Shield, color: 'text-neon-purple' },
        { label: 'Live Streams', value: stats?.tasks_running ?? '-', icon: Zap, color: 'text-neon-yellow' },
        { label: 'Total Verified', value: stats?.tasks_completed !== undefined ? Number(stats.tasks_completed).toLocaleString() : '-', icon: Activity, color: 'text-emerald-400' },
        { label: 'Network Uptime', value: stats?.network_uptime ?? '-', icon: Clock, color: 'text-slate-400' },
        { label: 'Protocol Emissions', value: stats?.total_emissions !== undefined ? Number(stats.total_emissions).toLocaleString() + ' ℏ' : '-', icon: Globe, color: 'text-blue-400' },
    ];

    return (
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
    );
}
