"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ViewState } from '@/types';
import NeuralMetagraph from './NeuralMetagraph';
import { useWallet } from '@/context/WalletContext';
import { useProtocolStats } from '@/hooks/useRealData';
import SubmitTaskModal from '@/components/ui-custom/SubmitTaskModal';

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

const MorphingText = () => {
  const words = ["AI Intelligence", "Neural Consensus", "Proof of Trust", "On-Chain Veracity"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 4000); // Changed from 5s to 4s
    return () => clearInterval(timer);
  }, [words.length]);

  return (
    <span className="relative inline-block min-w-[300px]">
      <span key={index} className="animate-morph animate-gradient-flow inline-block neon-text" style={{ animationDuration: '4s, 8s' }}>
        {words[index]}
      </span>
    </span>
  );
};

// ── Ticker bar ──
const TickerContent = ({ price }: { price: number }) => {
  const diff = ((price - 11) / 11) * 100;
  const isUp = diff >= 0;
  return (
    <div className="flex items-center gap-12 whitespace-nowrap px-6">
      {[
        { 
          label: 'MDT Price', 
          value: <span className="flex items-center text-neon-cyan"><span className="text-neon-cyan text-sm mr-0.5">$</span><CountUp end={price} duration={500} decimals={2} /></span>, 
          extra: (
            <span className={`${isUp ? 'text-neon-green' : 'text-red-400'} flex items-center gap-0.5 font-bold text-xs`}>
              <span className="material-symbols-outlined text-sm">{isUp ? 'arrow_drop_up' : 'arrow_drop_down'}</span>
              {isUp ? '+' : ''}{diff.toFixed(1)}%
            </span>
          ) 
        },
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
};

const initialChart = [
  { time: '00:00', value: 10.2 }, { time: '04:00', value: 10.8 }, { time: '08:00', value: 10.5 },
  { time: '12:00', value: 11.3 }, { time: '16:00', value: 11.1 }, { time: '20:00', value: 11.7 }, { time: '24:00', value: 11.5 },
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
    action: 'Register as Validator',
    registerView: ViewState.REGISTER_VALIDATOR,
    registerRole: 'validator',
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
  const [showSubmitTask, setShowSubmitTask] = useState(false);
  const [activeNodes, setActiveNodes] = useState<number>(0);

  // Animate chart
  useEffect(() => {
    const iv = setInterval(() => {
      setChart(prev => {
        const next = prev.map(d => ({ ...d }));
        next[next.length - 1].value = Math.max(10, Math.min(12, next[next.length - 1].value + (Math.random() - 0.5) * 0.2));
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
    if (role.id === 'requester') { setShowSubmitTask(true); return; }
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

      {/* ── Hero Section (only when NOT connected) ── */}
      {!isConnected && (
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/5 mb-2">
          {/* Background glow blobs */}
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-neon-cyan/5 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-neon-purple/5 blur-[120px] pointer-events-none" />

          <div className="relative z-10 px-8 py-14 lg:px-16 lg:py-20 flex flex-col lg:flex-row items-center gap-12">
            {/* Left: text */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse inline-block" />
                  Live on Hedera Testnet
                </span>
              </div>

              <h1 className="text-white text-5xl lg:text-6xl font-black font-display leading-tight tracking-tight uppercase">
                Verifiable<br />
                <MorphingText /><br />
                <span className="text-slate-400 text-3xl lg:text-4xl font-light normal-case tracking-normal">on Hedera</span>
              </h1>

              <p className="text-slate-400 text-base leading-relaxed max-w-xl">
                ModernTensor is the decentralized protocol for verifiable AI computation. 
                Every task submission, neural score, and network reward is cryptographically logged on 
                <span className="text-neon-cyan font-semibold"> Hedera HCS</span> — establishing a permanent Proof of Trust for the Agentic AI economy.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-3">
                {[
                  { icon: 'verified', label: 'Proof of Intelligence', color: 'text-neon-cyan' },
                  { icon: 'history', label: 'Immutable HCS Logs', color: 'text-neon-purple' },
                  { icon: 'payments', label: 'Agent Micro-payments', color: 'text-neon-green' },
                  { icon: 'token', label: 'MDT Staking Ready', color: 'text-neon-pink' },
                ].map((f, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 ${f.color} text-xs font-semibold`}>
                    <span className="material-symbols-outlined text-sm">{f.icon}</span>
                    {f.label}
                  </div>
                ))}
              </div>

              <p className="text-slate-500 text-sm">
                Connect your wallet to get started — choose a role and join the network.
              </p>
            </div>

            {/* Right: role preview cards */}
            <div className="flex-shrink-0 grid grid-cols-2 gap-4 w-full max-w-sm">
              {ROLES.map(role => (
                <div key={role.id}
                  className={`glass-panel rounded-2xl p-5 border ${role.borderClass} ${role.glowClass} flex flex-col gap-3 group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden`}>
                  <div className="absolute -top-6 -right-6 w-12 h-12 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-colors" />
                  
                  <div className={`w-11 h-11 rounded-xl bg-${role.color}/10 border border-${role.color}/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.02)] group-hover:border-${role.color} transition-all`}>
                    <span className={`material-symbols-outlined text-${role.color} text-xl`}>{role.icon}</span>
                  </div>
                  <div>
                    <div className="text-white font-black text-base font-display tracking-tight uppercase group-hover:text-neon-cyan transition-colors">{role.title}</div>
                    <div className={`text-${role.color} text-[10px] font-extrabold uppercase tracking-widest bg-${role.color}/5 px-1.5 py-0.5 rounded border border-${role.color}/20 inline-block mt-1`}>
                      {role.subtitle}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug font-medium line-clamp-3 italic opacity-90">{role.desc}</div>
                  <div className="mt-auto pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Yield</span>
                    <span className={`text-[10px] font-black uppercase text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`}>
                      {role.earn.replace('of task reward', '').replace('pool', '')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom stats bar */}
          <div className="relative z-10 border-t border-white/5 grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/5 bg-white/[0.02]">
            {[
              { label: 'Consensus Layer', value: 'Hedera HCS', icon: 'hub', color: 'text-neon-cyan' },
              { label: 'Token', value: 'MDT · 0.0.8198586', icon: 'token', color: 'text-neon-purple' },
              { label: 'Subnets', value: '3 Active', icon: 'account_tree', color: 'text-neon-green' },
              { label: 'Network', value: 'Testnet', icon: 'wifi_tethering', color: 'text-neon-blue' },
            ].map((s, i) => (
              <div key={i} className="px-6 py-5 flex items-center gap-4 group hover:bg-white/[0.02] transition-colors">
                <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${s.color} opacity-80 group-hover:opacity-100 group-hover:border-current transition-all shrink-0`}>
                   <span className="material-symbols-outlined text-xl">{s.icon}</span>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">{s.label}</div>
                  <div className={`text-white text-sm font-black tracking-wide font-display group-hover:${s.color} transition-colors uppercase`}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                role.id === 'validator' ? ViewState.VALIDATOR_DASHBOARD : null;
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
                MDT/USDT Neural Market
              </h2>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-6xl font-display font-bold text-white tracking-tighter">
                  <CountUp end={price} prefix="$" decimals={2} duration={500} />
                </span>
                <span className={`${(price >= 11) ? 'text-neon-green bg-neon-green/10 border-neon-green/30' : 'text-red-400 bg-red-400/10 border-red-400/30'} font-mono text-base px-3 py-1 rounded border`}>
                  {price >= 11 ? '+' : ''}{(((price - 11) / 11) * 100).toFixed(1)}%
                </span>
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
              <p className="text-neon-cyan text-sm font-semibold uppercase tracking-widest">Total Supply</p>
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

      <SubmitTaskModal isOpen={showSubmitTask} onClose={() => setShowSubmitTask(false)} />

    </div>
  );
}
