'use client';

import { useNetworkState } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import { Network, Shield, Zap, Globe, Cpu, Server, Lock, Activity, ArrowRight } from 'lucide-react';
import StatCard from '@/components/ui-custom/StatCard';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { CountUp } from '@/components/ui-custom/NeuralMetagraph';

export default function NetworkPage() {
    const { data: network, isLoading } = useNetworkState();

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
                        Network <span className="text-neon-cyan">Security</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_#00f3ff]" />
                        Metagraph Protocol State v2.4a
                    </p>
                </div>
                <div className="flex items-center gap-4 bg-neon-cyan/5 border border-neon-cyan/20 px-4 py-2 rounded-xl">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Operational Status</span>
                        <span className="text-lg font-display font-bold text-neon-green tracking-tight uppercase">OPTIMIZED</span>
                    </div>
                    <Shield size={24} className="text-neon-green/40" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Network Mode"
                    value={String(network?.network_mode || 'STABLE').toUpperCase()}
                    icon={Lock}
                    isLoading={isLoading}
                    accent="cyan"
                />
                <StatCard
                    label="Total Staked"
                    value={network?.totalStaked || 0}
                    subtext="ℏ HBAR"
                    icon={Shield}
                    isLoading={isLoading}
                    accent="purple"
                />
                <StatCard
                    label="Daily Emissions"
                    value={network?.totalEmissions || 0}
                    subtext="ℏ HBAR"
                    icon={Zap}
                    isLoading={isLoading}
                    accent="green"
                />
                <StatCard
                    label="Sync Progress"
                    value={100}
                    subtext="%"
                    icon={Globe}
                    isLoading={isLoading}
                    accent="amber"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Protocol Parameters */}
                <div className="xl:col-span-8 panel relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-cyan/20 to-transparent" />
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <h3 className="text-white text-xs font-bold uppercase tracking-[0.2em] font-display flex items-center gap-2">
                            <Server size={14} className="text-neon-cyan" />
                            Subnet Configuration Parameters
                        </h3>
                        <span className="text-[9px] font-mono text-slate-500">SCHEMA_ID: MDT-04</span>
                    </div>
                    <div className="p-4">
                        {isLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-10 w-full bg-white/5" />
                                <Skeleton className="h-10 w-full bg-white/5" />
                                <Skeleton className="h-10 w-full bg-white/5" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { label: 'Metagraph Min Nodes', value: network?.min_nodes || 1 },
                                    { label: 'Consensus Threshold', value: network?.consensus_threshold || '67%' },
                                    { label: 'Emission Cycle', value: network?.emission_cycle || '24h' },
                                    { label: 'Governance Version', value: network?.version || '2.4.1-alpha' },
                                    { label: 'Mirror Node Sync', value: 'HEALTHY' },
                                    { label: 'Latency (Avg)', value: '142ms' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl group hover:border-neon-cyan/30 transition-all">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                                        <span className="text-sm font-mono font-bold text-white group-hover:text-neon-cyan transition-colors">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Subnet Health */}
                <div className="xl:col-span-4 panel relative overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-white text-xs font-bold uppercase tracking-[0.2em] font-display flex items-center gap-2">
                            <Activity size={14} className="text-neon-cyan" />
                            Sector Health
                        </h3>
                    </div>
                    <div className="p-6 space-y-8 flex-1 flex flex-col justify-center">
                        {[
                            { label: 'Compute Power', value: 89, color: 'bg-neon-cyan', glow: 'shadow-neon-cyan/40' },
                            { label: 'Memory Allocation', value: 42, color: 'bg-neon-purple', glow: 'shadow-neon-purple/40' },
                            { label: 'Security Entropy', value: 98, color: 'bg-neon-green', glow: 'shadow-neon-green/40' },
                        ].map((stat, i) => (
                            <div key={i} className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                    <span className="font-mono text-sm font-bold text-white">{stat.value}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${stat.color} shadow-[0_0_10px] ${stat.glow}`}
                                        style={{ width: isLoading ? '0%' : `${stat.value}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
