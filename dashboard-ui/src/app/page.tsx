'use client';

import { useProtocolData } from '@/lib/hooks/useProtocolData';
import StatCard from '@/components/ui-custom/StatCard';
import { Cpu, Activity, Database, Zap, Globe, Shield, TrendingUp, CpuIcon } from 'lucide-react';
import ActivityFeed from '@/components/ui-custom/ActivityFeed';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import NeuralMetagraph, { CountUp } from '@/components/ui-custom/NeuralMetagraph';
import SubmitTaskForm from '@/components/ui-custom/SubmitTaskForm';
import { useQuery } from '@tanstack/react-query';

const HEDERA_ACCOUNT_ID = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '0.0.8127455';
const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

const TickerContent = ({ price }: { price: number }) => (
  <div className="flex items-center gap-12 whitespace-nowrap px-6">
    <div className="flex items-center gap-3">
      <span className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">HBAR Price</span>
      <span className="text-neon-cyan font-bold font-mono text-sm neon-text">
        $<CountUp end={price} decimals={4} />
      </span>
      <span className="text-neon-green flex items-center gap-0.5 font-bold text-xs">
        <TrendingUp size={12} /> 4.2%
      </span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Market Cap</span>
      <span className="text-white font-bold font-mono text-sm">$2.42B</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Metagraph Nodes</span>
      <span className="text-white font-bold font-mono text-sm"><CountUp end={4096} /></span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Network Load</span>
      <span className="text-neon-purple font-bold font-mono text-sm">72%</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Status</span>
      <span className="text-neon-green font-bold text-[10px] uppercase tracking-widest animate-pulse">System Online</span>
    </div>
  </div>
);

export default function Dashboard() {
  const { miners, tasks, network, isLoading } = useProtocolData();

  // Fetch real HBAR price or simulate
  const { data: priceData } = useQuery({
    queryKey: ['hbar-price'],
    queryFn: async () => {
      // Simple mock or real price API
      return { price: 0.1425 };
    },
    refetchInterval: 30000
  });

  const chartData = [
    { name: '00:00', value: 380 },
    { name: '04:00', value: 410 },
    { name: '08:00', value: 395 },
    { name: '12:00', value: 423 },
    { name: '16:00', value: 418 },
    { name: '20:00', value: 435 },
    { name: '24:00', value: 428 },
  ];

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Infinite Marquee Ticker */}
      <div className="w-full border-b border-white/5 bg-[#0a0e17]/50 backdrop-blur-md overflow-hidden relative flex h-10 items-center -mx-6 px-6 lg:-mx-8 lg:px-8">
        <div className="absolute left-0 top-0 w-24 h-full bg-gradient-to-r from-[#020408] to-transparent z-10"></div>
        <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-[#020408] to-transparent z-10"></div>
        <div className="flex animate-marquee hover:[animation-play-state:paused] cursor-default">
          <TickerContent price={priceData?.price || 0.1425} />
          <TickerContent price={priceData?.price || 0.1425} />
          <TickerContent price={priceData?.price || 0.1425} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main Neural Display */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="panel h-[400px] relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full p-6 z-20 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
              <div>
                <h2 className="text-neon-cyan text-xs font-bold font-display uppercase tracking-[0.3em] flex items-center gap-2 drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">
                  <Activity size={14} className="animate-pulse" />
                  Network Performance
                </h2>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-display font-bold text-white tracking-widest uppercase">
                    <CountUp end={89.4} decimals={1} suffix=" PH/s" />
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 p-1 bg-black/40 backdrop-blur rounded-lg border border-white/10">
                {['1H', '4H', '1D', '1W'].map((t, i) => (
                  <button key={t} className={`px-3 py-1 text-[9px] font-bold rounded uppercase tracking-widest transition-all ${i === 0 ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30' : 'text-slate-500 hover:text-white'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Overlay */}
            <div className="absolute inset-0 z-10 pt-24">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00f3ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#00f3ff"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 3D Metagraph Background Effect */}
            <div className="absolute right-0 bottom-0 w-[400px] h-full pointer-events-none opacity-40">
              <NeuralMetagraph />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
              label="Active Miners"
              value={miners?.length || 0}
              icon={Cpu}
              isLoading={isLoading}
              accent="cyan"
            />
            <StatCard
              label="Network Tasks"
              value={tasks?.length || 0}
              icon={Database}
              isLoading={isLoading}
              accent="purple"
            />
          </div>
        </div>

        {/* Global Metagraph Hub */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <div className="panel h-[500px] flex flex-col">
            <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
              <h3 className="text-white text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 font-display">
                <Globe size={14} className="text-neon-cyan" />
                Global Metagraph Hub
              </h3>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                <span className="text-[9px] font-mono text-neon-green uppercase tracking-widest">Live</span>
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <ActivityFeed />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <SubmitTaskForm />
        </div>
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            label="Total Emissions"
            value={network?.totalEmissions || 0}
            subtext="ℏ HBAR"
            icon={Zap}
            isLoading={isLoading}
            accent="green"
          />
          <StatCard
            label="Staked Weight"
            value={network?.totalStaked || 0}
            subtext="ℏ HBAR"
            icon={Shield}
            isLoading={isLoading}
            accent="amber"
          />
        </div>
      </div>
    </div>
  );
}
