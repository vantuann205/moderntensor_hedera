'use client';

import { useEmissions } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { Zap, History, MousePointer2 } from 'lucide-react';
import { CountUp } from '@/components/ui-custom/NeuralMetagraph';

export default function EmissionsPage() {
    const { data: emissionsData, isLoading } = useEmissions();
    const emissions = Array.isArray(emissionsData) ? emissionsData : [];

    const COLORS = ['#00f3ff', '#bc13fe', '#00ffa3', '#ff00ff', '#135bec', '#ff0055'];

    const chartData = emissions.map((e: any) => ({
        name: e.subnet || e.name || 'Other',
        value: Number(e.amount || e.emission || 0)
    }));

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
                        Emission <span className="text-neon-cyan">Analytics</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_#00f3ff]" />
                        Network Reward Distribution Ledger v2.4
                    </p>
                </div>
                <div className="flex items-center gap-4 bg-neon-cyan/5 border border-neon-cyan/20 px-4 py-2 rounded-xl">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Total Distribution</span>
                        <span className="text-lg font-display font-bold text-white tracking-tight">
                            <CountUp end={emissions.reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0)} decimals={2} suffix=" ℏ" />
                        </span>
                    </div>
                    <Zap size={24} className="text-neon-cyan/40" />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Distribution Chart */}
                <div className="panel p-8 flex flex-col relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <MousePointer2 size={60} className="text-neon-cyan rotate-12" />
                    </div>
                    <h3 className="text-white text-xs font-bold uppercase tracking-[0.2em] mb-8 font-display border-l-2 border-neon-cyan/50 pl-3">
                        Subnet Alpha Allocation
                    </h3>
                    <div className="h-[350px] w-full mt-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Skeleton className="h-48 w-48 rounded-full bg-white/5" />
                            </div>
                        ) : chartData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-500 font-mono text-xs uppercase tracking-widest">
                                NO_DATA_AVAILABLE
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COLORS[index % COLORS.length]}
                                                className="hover:opacity-80 transition-opacity cursor-pointer drop-shadow-[0_0_8px_rgba(0,243,255,0.3)]"
                                            />
                                        ))}
                                    </Pie>
                                    <ChartTooltip
                                        contentStyle={{ backgroundColor: '#0a0e17', border: '1px solid #1f293a', fontSize: '12px', color: '#fff', borderRadius: '8px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8">
                        {chartData.slice(0, 4).map((d, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-lg">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight truncate w-24">{d.name}</span>
                                    <span className="text-xs font-mono text-white font-bold">{d.value.toFixed(2)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Events */}
                <div className="panel flex flex-col relative overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <h3 className="text-white text-xs font-bold uppercase tracking-[0.2em] font-display flex items-center gap-2">
                            <History size={14} className="text-neon-cyan" />
                            Emission Log
                        </h3>
                        <span className="text-[9px] font-mono text-slate-500">REALTIME_SYNC</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-white/5 font-mono text-xs">
                                {isLoading ? (
                                    [...Array(8)].map((_, i) => (
                                        <tr key={i}><td className="px-6 py-4"><Skeleton className="h-6 bg-white/5 rounded" /></td></tr>
                                    ))
                                ) : (emissions.length === 0) ? (
                                    <tr><td className="px-6 py-12 text-center text-slate-500 italic uppercase tracking-widest">No Recent Emissions</td></tr>
                                ) : (
                                    emissions.map((e: any, i: number) => (
                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="text-slate-600 font-bold">#{String(i + 1).padStart(2, '0')}</div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-white font-bold group-hover:text-neon-cyan transition-colors">{e.subnet || 'Metagraph Node'}</span>
                                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">{e.timestamp || 'Just Now'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-neon-green font-bold">+ {e.amount || e.emission} ℏ</span>
                                                    <span className="text-[9px] text-slate-600 uppercase">Distributed</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
