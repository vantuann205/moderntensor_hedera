'use client';

import NetworkStats from '@/components/ui-custom/NetworkStats';
import { Activity, Globe, Zap, Shield, Server, Box } from 'lucide-react';

export default function NetworkPage() {
    return (
        <div className="space-y-10 animate-fade-in max-w-6xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                <div>
                    <h1 className="text-5xl font-display font-bold text-white tracking-tighter italic uppercase leading-none">
                        Protocol <span className="text-neon-cyan">Health</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-3 max-w-xl font-medium">
                        Real-time telemetry from the ModernTensor Hedera subnet infrastructure.
                    </p>
                </div>
            </div>

            {/* Core Metrics */}
            <NetworkStats />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="panel p-8 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-white/5 pb-6 flex items-center gap-2">
                        <Server size={14} className="text-neon-cyan" />
                        Subnet Infrastructure
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Global Regions</span>
                            <div className="text-xl font-display font-bold text-white uppercase italic">3 Sectors</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Active Channels</span>
                            <div className="text-xl font-display font-bold text-neon-cyan uppercase italic">851 Channels</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">HCS Topic ID</span>
                            <div className="text-xs font-mono text-slate-400">0.0.5129481</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Protocol Version</span>
                            <div className="text-xs font-mono text-slate-400">Alpha-2.4.0</div>
                        </div>
                    </div>
                </div>

                <div className="panel p-8 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-white/5 pb-6 flex items-center gap-2">
                        <Box size={14} className="text-neon-purple" />
                        Verification Logic
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                            <span className="text-xs text-slate-500 uppercase">Weight Formula</span>
                            <span className="text-[10px] font-mono text-neon-purple font-bold">merit_base(perf^2 * rel)</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                            <span className="text-xs text-slate-500 uppercase">Min Stake</span>
                            <span className="text-xs font-mono text-white font-bold">50,000 ℏ</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-xs text-slate-500 uppercase">Epoch Duration</span>
                            <span className="text-xs font-mono text-white font-bold">1,800 Sec</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
