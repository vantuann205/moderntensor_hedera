"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ViewState, Subnet } from '@/types';
import NeuralMetagraph from './NeuralMetagraph';

interface HomeViewProps {
  onViewChange?: (view: ViewState) => void;
  onSelectTransaction?: (hash: string) => void;
  onSelectAccount?: (id: string) => void;
  onSelectBlock?: (height: string) => void;
}

const CountUp: React.FC<{ end: number, duration?: number, prefix?: string, suffix?: string, decimals?: number }> = ({ end, duration = 1500, prefix = '', suffix = '', decimals = 0 }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const valRef = useRef(0);
    useEffect(() => {
        let startTime: number | null = null;
        let animationFrame: number;
        const startVal = valRef.current;
        const change = end - startVal;
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            const ease = 1 - Math.pow(1 - percentage, 3);
            const current = startVal + (change * ease);
            valRef.current = current;
            setDisplayValue(current);
            if (progress < duration) animationFrame = requestAnimationFrame(animate);
            else { valRef.current = end; setDisplayValue(end); }
        };
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [end, duration]);
    return <>{prefix}{displayValue.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
};

const TickerContent = ({ currentPrice }: { currentPrice: number }) => (
    <div className="flex items-center gap-12 whitespace-nowrap px-6">
        <div className="flex items-center gap-3">
            <span className="text-text-secondary uppercase text-[10px] tracking-widest font-bold">HTR Price</span>
            <span className="text-neon-cyan font-bold neon-text text-base">
                $<CountUp end={currentPrice} decimals={2} />
            </span>
            <span className="text-neon-green flex items-center gap-0.5 font-bold">
                <span className="material-symbols-outlined text-sm">arrow_drop_up</span>4.2%
            </span>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-text-secondary uppercase text-[10px] tracking-widest font-bold">Market Cap</span>
            <span className="text-white font-bold text-base">$<CountUp end={2.42} suffix="B" decimals={2} /></span>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-text-secondary uppercase text-[10px] tracking-widest font-bold">24h Vol</span>
            <span className="text-white font-bold text-base">$<CountUp end={145.2} suffix="M" decimals={1} /></span>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-text-secondary uppercase text-[10px] tracking-widest font-bold">Total Staked</span>
            <span className="text-white font-bold text-base"><CountUp end={4.1} suffix="M" decimals={1} /> (72%)</span>
        </div>
    </div>
);

const initialChartData = [
  { time: '00:00', value: 380 }, { time: '04:00', value: 410 }, { time: '08:00', value: 395 },
  { time: '12:00', value: 423.5 }, { time: '16:00', value: 418 }, { time: '20:00', value: 435 }, { time: '24:00', value: 428 },
];

const subnetsData: Subnet[] = [
  { rank: 1, name: 'Hedera Smart Contracts', netUid: 1, emission: 18.42, miners: 1024, staked: '1.2M', daily: '+$24,500', status: 'active' },
  { rank: 2, name: 'HCS Messaging', netUid: 2, emission: 12.15, miners: 892, staked: '840K', daily: '+$18,200', status: 'active' },
  { rank: 3, name: 'Token Service', netUid: 3, emission: 9.80, miners: 2100, staked: '620K', daily: '+$12,400', status: 'active' },
];

export default function HomeView({ onViewChange, onSelectTransaction, onSelectAccount, onSelectBlock }: HomeViewProps) {
  const [chartData, setChartData] = useState(initialChartData);
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData(prevData => {
        const newData = prevData.map(item => ({ ...item }));
        const lastItem = newData[newData.length - 1];
        lastItem.value = Math.max(350, lastItem.value + (Math.random() - 0.5) * 0.8);
        return newData;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentPrice = chartData[chartData.length - 1].value;

  return (
    <div className="flex flex-col gap-8 py-8 px-6 lg:px-8 bg-transparent">
      <div className="w-full border-b border-panel-border bg-panel-dark/50 backdrop-blur overflow-hidden mb-4 relative flex h-12 items-center">
        <div className="absolute left-0 top-0 w-16 h-full bg-gradient-to-r from-bg-dark to-transparent z-10"></div>
        <div className="absolute right-0 top-0 w-16 h-full bg-gradient-to-l from-bg-dark to-transparent z-10"></div>
        <div className="flex animate-marquee text-sm font-mono hover:[animation-play-state:paused] cursor-default">
            <TickerContent currentPrice={currentPrice} />
            <TickerContent currentPrice={currentPrice} />
            <TickerContent currentPrice={currentPrice} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 glass-panel rounded-xl flex flex-col relative overflow-hidden">
           <div className="flex justify-between items-start p-6 z-20 bg-gradient-to-b from-panel-dark/80 to-transparent">
             <div>
               <h2 className="text-neon-cyan text-base font-bold flex items-center gap-2 font-display uppercase tracking-widest drop-shadow-[0_0_5px_rgba(0,243,255,0.8)]">
                 <span className="material-symbols-outlined text-xl animate-pulse">monitoring</span>
                 MTN/USDT Neural Market
               </h2>
               <div className="mt-2 flex items-baseline gap-3">
                 <span className="text-6xl font-display font-bold text-white tracking-tighter">
                    <CountUp end={currentPrice} prefix="$" decimals={2} />
                 </span>
                 <span className="text-neon-green font-mono text-base bg-neon-green/10 px-3 py-1 rounded border border-neon-green/30 shadow-[0_0_10px_rgba(0,255,163,0.2)]">+4.2%</span>
               </div>
             </div>
           </div>
           
           <div className="w-full h-[380px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ backgroundColor: '#0a0e17', border: '1px solid #1f293a', fontSize: '14px' }} itemStyle={{ color: '#00f3ff' }} />
                  <Area type="monotone" dataKey="value" stroke="#00f3ff" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" isAnimationActive={false} />
                  <XAxis dataKey="time" hide /><YAxis domain={['auto', 'auto']} hide />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="xl:col-span-4 grid grid-cols-1 gap-4">
          <div className="bg-panel-dark border border-panel-border p-6 rounded-xl flex flex-col justify-center relative overflow-hidden group shadow-lg transition-all">
            <div className="flex items-center gap-2 mb-3 z-10">
              <span className="material-symbols-outlined text-neon-cyan text-xl">token</span>
              <p className="text-neon-cyan text-sm font-semibold uppercase tracking-widest">Circulating Supply</p>
            </div>
            <p className="text-white text-4xl font-display font-bold z-10"><CountUp end={5842091} /><span className="text-xl text-text-secondary ml-2">MTN</span></p>
            <div className="w-full bg-panel-border h-2 mt-5 rounded-full overflow-hidden z-10">
              <div className="bg-gradient-to-r from-neon-cyan to-blue-600 h-full w-[28%] shadow-[0_0_10px_rgba(0,243,255,0.8)]"></div>
            </div>
          </div>

          <div className="bg-panel-dark border border-panel-border p-6 rounded-xl relative overflow-hidden h-[240px]">
             <NeuralMetagraph />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-panel-dark border border-panel-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-5 border-b border-panel-border flex justify-between items-center bg-panel-dark/40">
            <h3 className="text-white text-sm font-bold flex items-center gap-2 font-display uppercase tracking-widest">
              <span className="material-symbols-outlined text-neon-pink text-xl">database</span>
              Live Blocks
            </h3>
            <button className="text-[10px] font-bold text-neon-pink hover:text-white transition-colors uppercase tracking-widest border border-neon-pink/30 px-2 py-1 rounded bg-neon-pink/5">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-secondary uppercase tracking-wider font-bold bg-white/5">
                <tr><th className="px-5 py-4">Height</th><th className="px-5 py-4">Hash</th><th className="px-5 py-4">TXS</th><th className="px-5 py-4 text-right">Time</th></tr>
              </thead>
              <tbody className="divide-y divide-panel-border">
                {[
                  { height: '42,091,842', hash: '0x8f...2a1b', txs: '142', time: '2s ago' },
                  { height: '42,091,841', hash: '0x3c...9e4f', txs: '86', time: '5s ago' },
                  { height: '42,091,840', hash: '0x1a...7d2c', txs: '215', time: '8s ago' },
                  { height: '42,091,839', hash: '0x9e...0b3a', txs: '64', time: '11s ago' },
                  { height: '42,091,838', hash: '0x6e...4f1d', txs: '128', time: '14s ago' }
                ].map((b, i) => (
                  <tr key={i} className="hover:bg-neon-pink/5 transition-colors cursor-pointer group">
                    <td className="px-5 py-4 font-mono text-neon-pink font-bold">{b.height}</td>
                    <td className="px-5 py-4 font-mono text-slate-400 group-hover:text-white">{b.hash}</td>
                    <td className="px-5 py-4 text-white font-bold">{b.txs}</td>
                    <td className="px-5 py-4 text-right text-text-secondary">{b.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-panel-dark border border-panel-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-5 border-b border-panel-border flex justify-between items-center bg-panel-dark/40">
            <h3 className="text-white text-sm font-bold flex items-center gap-2 font-display uppercase tracking-widest">
              <span className="material-symbols-outlined text-neon-cyan text-xl">swap_horiz</span>
              Latest Transactions
            </h3>
            <button className="text-[10px] font-bold text-neon-cyan hover:text-white transition-colors uppercase tracking-widest border border-neon-cyan/30 px-2 py-1 rounded bg-neon-cyan/5">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-secondary uppercase tracking-wider font-bold bg-white/5">
                <tr><th className="px-5 py-4">Hash</th><th className="px-5 py-4">Method</th><th className="px-5 py-4 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-panel-border">
                {[
                  { hash: '0x4d...f8e2', method: 'Transfer', amount: '1,250 MTN', color: 'text-neon-cyan' },
                  { hash: '0x7b...a1c3', method: 'Stake', amount: '4,000 MTN', color: 'text-neon-purple' },
                  { hash: '0x2e...9d5a', method: 'Approve', amount: '-', color: 'text-slate-500' },
                  { hash: '0x9c...b4f1', method: 'Transfer', amount: '840 MTN', color: 'text-neon-cyan' },
                  { hash: '0x1f...3a2e', method: 'Contract Call', amount: '-', color: 'text-neon-pink' }
                ].map((t, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors cursor-pointer group">
                    <td className="px-5 py-4 font-mono text-slate-400 group-hover:text-neon-cyan transition-colors">{t.hash}</td>
                    <td className="px-5 py-4"><span className={`px-2 py-0.5 rounded-full border border-current bg-current/10 font-bold ${t.color}`}>{t.method}</span></td>
                    <td className="px-5 py-4 text-right font-mono text-white font-bold">{t.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-panel-dark border border-panel-border rounded-xl overflow-hidden mb-12">
        <div className="p-6 border-b border-panel-border flex justify-between items-center">
            <h3 className="text-white text-base font-bold flex items-center gap-2 font-display uppercase tracking-widest">
              <span className="material-symbols-outlined text-neon-cyan text-xl">hub</span>
              Subnet Performance
            </h3>
        </div>
        <table className="w-full text-left">
            <thead className="bg-panel-dark/80 border-b border-panel-border text-xs uppercase tracking-wider text-text-secondary font-semibold">
                <tr><th className="px-6 py-5">Rank</th><th className="px-6 py-5">Subnet Name</th><th className="px-6 py-5 text-right">Emission %</th><th className="px-6 py-5 text-right">Staked MTN</th><th className="px-6 py-5 text-center">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-panel-border text-sm">
                {subnetsData.map((s) => (
                    <tr key={s.netUid} className="hover:bg-neon-cyan/5 transition-colors cursor-pointer">
                        <td className="px-6 py-5 font-mono text-text-secondary font-bold">{String(s.rank).padStart(2, '0')}</td>
                        <td className="px-6 py-5 font-bold text-white">{s.name}</td>
                        <td className="px-6 py-5 text-right font-mono">{s.emission}%</td>
                        <td className="px-6 py-5 text-right font-bold">{s.staked}</td>
                        <td className="px-6 py-5 text-center"><span className={`inline-block size-2.5 rounded-full ${s.status === 'active' ? 'bg-neon-green shadow-[0_0_8px_#00ffa3]' : 'bg-yellow-500'}`}></span></td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
