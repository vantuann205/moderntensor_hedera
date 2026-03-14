"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ViewState } from '@/types';
import NeuralMetagraph from './NeuralMetagraph';
import { useWallet } from '@/context/WalletContext';
import { useProtocolStats } from '@/hooks/useRealData';

interface HomeViewProps {
  onViewChange?: (view: ViewState) => void;
}

// ── CountUp animation ──
const CountUp: React.FC<{ end: number; duration?: number; prefix?: string; suffix?: string; decimals?: number }> = ({
  end, duration = 1500, prefix = '', suffix = '', decimals = 0,
}) => {
  const [val, setVal] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    let start: number | null = null;
    let raf: number;
    const from = ref.current;
    const diff = end - from;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      ref.current = from + diff * ease;
      setVal(ref.current);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { ref.current = end; setVal(end); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, duration]);
  return <>{prefix}{val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
};

// ── Ticker bar ──
const TickerContent = ({ price }: { price: number }) => (
  <div className="flex items-center gap-12 whitespace-nowrap px-6">
    {[
      { label: 'HTR Price', value: `$${price.toFixed(2)}`, extra: <span className="text-neon-green flex items-center gap-0.5 font-bold text-xs"><span className="material-symbols-outlined text-sm">arrow_drop_up</span>4.2%</span> },
      { label: 'Market Cap', value: '$2.42B' },
      { label: '24h Vol', value: '$145.2M' },
      { label: 'Total Staked', value: '4.1M (72%)' },
    ].map((item, i) => (
      <div key={i} className="flex items-center gap-3">
        <span className="text-text-secondary uppercase text-[10px] tracking-widest font-bold">{item.label}</span>
        <span className="text-neon-cyan font-bold text-base">{item.value}</span>
        {item.extra}
      </div>
    ))}
  </div>
);

const initialChart = [
  { time: '00:00', value: 380 }, { time: '04:00', value: 410 }, { time: '08:00', value: 395 },
  { time: '12:00', value: 423.5 }, { time: '16:00', value: 418 }, { time: '20:00', value: 435 }, { time: '24:00', value: 428 },
];

// ── Role cards config ──
const ROLES = [
  {
    id: 'miner',
    view: ViewState.MINERS,
    icon: 'dns',
    color: 'neon-cyan',
    borderClass: 'border-neon-cyan/40 hover:border-neon-cyan',
    glowClass: 'shadow-[0_0_30px_rgba(0,243,255,0.15)] hover:shadow-[0_0_40px_rgba(0,243,255,0.3)]',
    title: 'Miner',
    subtitle: 'AI Compute Provider',
    desc: 'Process AI tasks and earn MDT rewards. Stake minimum 10 MDT to join the network.',
    minStake: '10 MDT',
    earn: '85% of task reward',
    action: 'Register as Miner',
    registerView: ViewState.REGISTER_ROLE,
    registerRole: 'miner',
  },
  {
    id: 'validator',
    view: ViewState.VALIDATORS,
    icon: 'verified',
    color: 'neon-purple',
    borderClass: 'border-purple-500/40 hover:border-purple-400',
    glowClass: 'shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:shadow-[0_0_40px_rgba(168,85,247,0.3)]',
    title: 'Validator',
    subtitle: 'Score & Verify Results',
    desc: 'Score miner submissions and maintain network quality. Requires subnet owner approval.',
    minStake: '500 MDT',
    earn: '8% of task reward',
    action: 'View Validators',
    registerView: ViewState.VALIDATORS,
    registerRole: null,
  },
  {
    id: 'holder',
    view: ViewState.TOKENOMICS,
    icon: 'savings',
    color: 'neon-green',
    borderClass: 'border-green-500/40 hover:border-green-400',
    glowClass: 'shadow-[0_0_30px_rgba(0,255,163,0.15)] hover:shadow-[0_0_40px_rgba(0,255,163,0.3)]',
    title: 'Holder',
    subtitle: 'Passive Staker',
    desc: 'Stake MDT and earn passive income from 5% of all network task rewards. No active work needed.',
    minStake: '1 MDT',
    earn: 'Pro-rata from reward pool',
    action: 'Stake as Holder',
    registerView: ViewState.REGISTER_ROLE,
    registerRole: 'holder',
  },
  {
    id: 'requester',
    view: ViewState.TASKS,
    icon: 'send',
    color: 'neon-pink',
    borderClass: 'border-pink-500/40 hover:border-pink-400',
    glowClass: 'shadow-[0_0_30px_rgba(255,0,128,0.15)] hover:shadow-[0_0_40px_rgba(255,0,128,0.3)]',
    title: 'Requester',
    subtitle: 'Submit AI Tasks',
    desc: 'Submit AI tasks to the marketplace. No staking required — just pay the task reward in MDT.',
    minStake: '0 MDT',
    earn: 'AI results delivered',
    action: 'Submit a Task',
    registerView: ViewState.TASKS,
    registerRole: null,
  },
];

export default function HomeView({ onViewChange }: HomeViewProps) {
  const { isConnected, accountId, isMiner, isValidator } = useWallet();
  const { data: stats } = useProtocolStats();
  const [chart, setChart] = useState(initialChart);
  const [mdtSupply, setMdtSupply] = useState<number | null>(null);
  const [mdtMaxSupply, setMdtMaxSupply] = useState<number | null>(null);
  const [activeNodes, setActiveNodes] = useState<number>(0);

  // Animate chart
  useEffect(() => {
    const iv = setInterval(() => {
      setChart(prev => {
        const next = prev.map(d => ({ ...d }));
        next[next.length - 1].value = Math.max(350, next[next.length - 1].value + (Math.random() - 0.5) * 0.8);
        return next;
      });
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  // Fetch real MDT supply
  useEffect(() => {
    fetch('/api/token-info')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setMdtSupply(d.data.circulatingSupply);
          setMdtMaxSupply(d.data.maxSupply || d.data.totalSupply);
        }
      })
      .catch(() => {});
  }, []);

  // Active nodes = miners + validators from real HCS data
  useEffect(() => {
    if (stats) setActiveNodes(stats.totalMiners + stats.totalValidators);
  }, [stats]);

  const price = chart[chart.length - 1].value;

  const handleRoleAction = (role: typeof ROLES[0]) => {
    if (!onViewChange) return;
    onViewChange(role.registerView);
  };

  return (
    <div className="flex flex-col gap-8 py-8 px-6 lg:px-8 bg-transparent">

      {/* ── Ticker Bar ── */}
      <div className="w-full border-b border-panel-border bg-panel-dark/50 backdrop-blur overflow-hidden mb-4 relative flex h-12 items-center">
        <div className="absolute left-0 top-0 w-16 h-full bg-gradient-to-r from-bg-dark to-transparent z-10" />
        <div className="absolute right-0 top-0 w-16 h-full bg-gradient-to-l from-bg-dark to-transparent z-10" />
        <div className="flex animate-marquee text-sm font-mono hover:[animation-play-state:paused] cursor-default">
          <TickerContent price={price} />
          <TickerContent price={price} />
          <TickerContent price={price} />
        </div>
      </div>

      {/* ── Role Selection (only when wallet connected) ── */}
      {isConnected && (
        <div className="w-full">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-neon-cyan text-2xl">account_circle</span>
            <div>
              <h2 className="text-white font-display font-bold text-xl uppercase tracking-wider">
                Welcome, <span className="text-neon-cyan">{accountId}</span>
              </h2>
              <p className="text-slate-400 text-sm">Choose your role in the ModernTensor network</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            {ROLES.map(role => {
              const isActive =
                (role.id === 'miner' && isMiner) ||
                (role.id === 'validator' && isValidator);
              const dashboardView =
                role.id === 'miner' ? ViewState.MINER_DASHBOARD :
                role.id === 'validator' ? ViewState.VALIDATORS : null;
              const handleClick = () => {
                if (!onViewChange) return;
                if (isActive && dashboardView) onViewChange(dashboardView);
                else handleRoleAction(role);
              };
              return (
                <div
                  key={role.id}
                  className={`glass-panel rounded-2xl p-6 border transition-all duration-300 cursor-pointer group flex flex-col gap-4 ${
                    isActive
                      ? 'border-neon-green/60 shadow-[0_0_30px_rgba(0,255,163,0.2)]'
                      : `${role.borderClass} ${role.glowClass}`
                  }`}
                  onClick={handleClick}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl bg-${role.color}/10 border border-${role.color}/30 flex items-center justify-center relative`}>
                      <span className={`material-symbols-outlined text-${role.color} text-2xl`}>{role.icon}</span>
                      {isActive && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-neon-green border-2 border-bg-dark flex items-center justify-center">
                          <span className="material-symbols-outlined text-bg-dark" style={{ fontSize: 10 }}>check</span>
                        </span>
                      )}
                    </div>
                    {isActive ? (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border border-neon-green/50 text-neon-green bg-neon-green/10 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse inline-block" />
                        Active
                      </span>
                    ) : (
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border border-${role.color}/30 text-${role.color} bg-${role.color}/5`}>
                        {role.minStake === '0 MDT' ? 'FREE' : `Min ${role.minStake}`}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-display font-bold text-lg">{role.title}</h3>
                    <p className={`text-${role.color} text-xs font-semibold mb-2`}>{role.subtitle}</p>
                    {isActive ? (
                      <p className="text-neon-green text-xs leading-relaxed font-semibold">
                        ✓ Registered &amp; staked — you are active on the network.
                      </p>
                    ) : (
                      <p className="text-slate-400 text-xs leading-relaxed">{role.desc}</p>
                    )}
                  </div>
                  <div className="mt-auto pt-3 border-t border-white/5">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">Earn</span>
                      <span className="text-xs font-bold text-white">{role.earn}</span>
                    </div>
                    {isActive ? (
                      <button className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-neon-green/50 text-neon-green bg-neon-green/10 group-hover:bg-neon-green/20 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">dashboard</span>
                        {role.id === 'miner' ? 'Miner Dashboard' : 'Validator Dashboard'}
                      </button>
                    ) : (
                      <button className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-${role.color}/40 text-${role.color} bg-${role.color}/5 group-hover:bg-${role.color}/20`}>
                        {role.action}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Chart + Stats ── */}
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
                  <CountUp end={price} prefix="$" decimals={2} />
                </span>
                <span className="text-neon-green font-mono text-base bg-neon-green/10 px-3 py-1 rounded border border-neon-green/30">+4.2%</span>
              </div>
            </div>
          </div>
          <div className="w-full h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ backgroundColor: '#0a0e17', border: '1px solid #1f293a', fontSize: '14px' }} itemStyle={{ color: '#00f3ff' }} />
                <Area type="monotone" dataKey="value" stroke="#00f3ff" strokeWidth={3} fillOpacity={1} fill="url(#cg)" isAnimationActive={false} />
                <XAxis dataKey="time" hide /><YAxis domain={['auto', 'auto']} hide />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-4 grid grid-cols-1 gap-4">
          {/* MDT Circulating Supply — REAL */}
          <div className="bg-panel-dark border border-panel-border p-6 rounded-xl flex flex-col justify-center relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-neon-cyan text-xl">token</span>
              <p className="text-neon-cyan text-sm font-semibold uppercase tracking-widest">Circulating Supply</p>
            </div>
            <p className="text-white text-4xl font-display font-bold">
              {mdtSupply !== null
                ? <CountUp end={mdtSupply} />
                : <span className="text-slate-500 text-2xl">Loading...</span>
              }
              <span className="text-xl text-text-secondary ml-2">MDT</span>
            </p>
            <div className="w-full bg-panel-border h-2 mt-4 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-neon-cyan to-blue-600 h-full shadow-[0_0_10px_rgba(0,243,255,0.8)] transition-all duration-1000"
                style={{ width: mdtSupply !== null && mdtMaxSupply ? `${Math.min((mdtSupply / mdtMaxSupply) * 100, 100).toFixed(1)}%` : '0%' }} />
            </div>
            <p className="text-[10px] text-slate-500 mt-2 flex justify-between">
              <a href="https://hashscan.io/testnet/token/0.0.8198586" target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">0.0.8198586</a>
              {mdtSupply !== null && mdtMaxSupply ? (
                <span>{((mdtSupply / mdtMaxSupply) * 100).toFixed(1)}% of {mdtMaxSupply.toLocaleString()} max</span>
              ) : null}
            </p>
          </div>

          {/* Active Nodes — REAL from HCS */}
          <div className="bg-panel-dark border border-panel-border p-6 rounded-xl flex flex-col justify-center relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-neon-green text-xl">hub</span>
              <p className="text-neon-green text-sm font-semibold uppercase tracking-widest">Active Nodes</p>
            </div>
            <p className="text-white text-4xl font-display font-bold">
              <CountUp end={activeNodes} />
            </p>
          </div>

          <div className="bg-panel-dark border border-panel-border p-6 rounded-xl relative overflow-hidden h-[160px]">
            <NeuralMetagraph activeNodes={activeNodes} />
          </div>
        </div>
      </div>

      {/* ── Subnet Performance — REAL ── */}
      <div className="bg-panel-dark border border-panel-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-panel-border flex justify-between items-center">
          <h3 className="text-white text-base font-bold flex items-center gap-2 font-display uppercase tracking-widest">
            <span className="material-symbols-outlined text-neon-cyan text-xl">hub</span>
            Subnet Performance
          </h3>
          <a href="https://hashscan.io/testnet/topic/0.0.8198583" target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-bold text-neon-cyan hover:text-white transition-colors uppercase tracking-widest border border-neon-cyan/30 px-2 py-1 rounded bg-neon-cyan/5">
            Verify on HashScan
          </a>
        </div>
        <table className="w-full text-left">
          <thead className="bg-panel-dark/80 border-b border-panel-border text-xs uppercase tracking-wider text-text-secondary font-semibold">
            <tr>
              <th className="px-6 py-4">Subnet</th>
              <th className="px-6 py-4 text-right">Miners</th>
              <th className="px-6 py-4 text-right">Validators</th>
              <th className="px-6 py-4 text-right">Tasks</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border text-sm">
            {[
              { id: 0, name: 'Text Generation', color: 'neon-cyan' },
              { id: 1, name: 'Code Review',     color: 'neon-purple' },
              { id: 2, name: 'Image Analysis',  color: 'neon-green' },
            ].map(subnet => {
              const miners    = stats?.minersPerSubnet?.[subnet.id]    ?? 0;
              const validators = stats?.validatorsPerSubnet?.[subnet.id] ?? 0;
              const tasks     = stats?.tasksPerSubnet?.[subnet.id]     ?? 0;
              const isLoading = !stats;
              return (
                <tr key={subnet.id} className="hover:bg-neon-cyan/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full bg-${subnet.color} shadow-[0_0_6px_currentColor]`} />
                      <div>
                        <div className="font-bold text-white text-sm">Subnet {subnet.id}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest">{subnet.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-neon-cyan">
                    {isLoading ? <span className="text-slate-600">—</span> : miners}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-purple-400">
                    {isLoading ? <span className="text-slate-600">—</span> : validators}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-neon-green">
                    {isLoading ? <span className="text-slate-600">—</span> : tasks}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block size-2.5 rounded-full bg-neon-green shadow-[0_0_8px_#00ffa3]" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Connect Wallet CTA (only when NOT connected) ── */}
      {!isConnected && (
        <div className="glass-panel rounded-2xl p-8 border border-neon-cyan/20 text-center relative overflow-hidden mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-purple/5" />
          <span className="material-symbols-outlined text-5xl text-neon-cyan mb-4 block">account_balance_wallet</span>
          <h3 className="text-white text-2xl font-display font-bold mb-2">Connect Your Wallet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Connect your Hedera wallet to choose a role and participate in the ModernTensor AI marketplace.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {ROLES.map(r => (
              <div key={r.id} className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-${r.color}/30 bg-${r.color}/5 text-${r.color} text-xs font-bold`}>
                <span className="material-symbols-outlined text-sm">{r.icon}</span>
                {r.title}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
