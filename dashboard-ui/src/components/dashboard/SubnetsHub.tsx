"use client";

import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useProtocolStats } from '@/hooks/useRealData';

// Premium CountUp Component for that professional feel
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

interface SubnetDetailProps {
  subnet: any;
  onBack: () => void;
}

const SubnetDetail: React.FC<SubnetDetailProps> = ({ subnet, onBack }) => {
  const [miners, setMiners] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubnetData() {
      try {
        const [minersRes, tasksRes, scoresRes] = await Promise.all([
          fetch('/api/hcs/miners'),
          fetch('/api/hcs/tasks'),
          fetch('/api/hcs/scores')
        ]);

        const [minersData, tasksData, scoresData] = await Promise.all([
          minersRes.json(),
          tasksRes.json(),
          scoresRes.json()
        ]);

        const subnetMiners = minersData.data?.filter((m: any) => 
          m.subnetIds?.includes(subnet.id)
        ) || [];
        
        const subnetTasks = tasksData.data?.filter((t: any) =>
          (t.subnetId || 0) === subnet.id
        ) || [];

        // Filter scores relevant precisely to this subnet's tasks
        const subnetTaskIds = new Set(subnetTasks.map((t: any) => t.taskId));
        const subnetScores = (scoresData.data || []).filter((s: any) => subnetTaskIds.has(s.taskId));

        setMiners(subnetMiners);
        setTasks(subnetTasks);
        setScores(subnetScores);
      } catch (error) {
        console.error('Error fetching subnet data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSubnetData();
  }, [subnet.id]);

  // Extract active validators for this subnet by viewing the scores
  const uniqueValidators = Array.from(new Set(scores.map(s => s.validatorId))).filter(Boolean);
  const totalStaked = miners.reduce((sum, m) => sum + (m.stakeAmount || 0), 0);

  const REWARD_DATA = [
    { name: 'Miner Reward', value: 80, color: '#00f3ff' }, // neon-cyan
    { name: 'Validator Reward', value: 15, color: '#ff00ff' }, // neon-pink
    { name: 'Delegator / Pool (Fee)', value: 5, color: '#bc13fe' } // neon-purple
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neon-cyan hover:text-white transition-all hover:gap-3 px-4 py-2 bg-neon-cyan/5 rounded-xl border border-neon-cyan/20"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="font-display uppercase tracking-widest text-sm font-bold">Back to Subnets</span>
        </button>
      </div>

      {/* Subnet Header */}
      <div className="glass-panel rounded-3xl p-10 border border-neon-cyan/30 relative overflow-hidden group shadow-[0_0_40px_rgba(0,243,255,0.05)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-neon-cyan/10 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
        <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="p-2 bg-neon-cyan/10 rounded-xl border border-neon-cyan/20">
                <span className="material-symbols-outlined text-neon-cyan group-hover:animate-pulse">hub</span>
              </span>
              <span className="text-neon-cyan text-sm font-bold font-display uppercase tracking-[0.2em] neon-text">Subnet {subnet.id}</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-black text-white mb-4 tracking-tighter drop-shadow-lg">
              {subnet.name}
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl leading-relaxed">{subnet.description}</p>
          </div>
          
          <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col items-end min-w-[200px]">
            <div className="text-[10px] text-text-secondary uppercase tracking-[0.2em] font-bold mb-2 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-neon-pink animate-pulse"></span> Emission Rate
            </div>
            <div className="text-5xl font-display font-black text-white neon-text">{subnet.emission}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12 pt-8 border-t border-white/10">
          {[
            { label: 'Network Miners', val: miners.length, icon: 'memory', color: 'text-neon-cyan', suffix: '', decimals: 0 },
            { label: 'Active Validators', val: uniqueValidators.length, icon: 'shield_person', color: 'text-neon-pink', suffix: '', decimals: 0 },
            { label: 'Tasks Completed', val: tasks.length, icon: 'task', color: 'text-neon-green', suffix: '', decimals: 0 },
            { label: 'Subnet Stake', val: totalStaked / 100000000, suffix: ' MDT', icon: 'account_balance_wallet', color: 'text-neon-purple', decimals: 0 }
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-text-secondary">
                <span className={`material-symbols-outlined text-sm ${stat.color}`}>{stat.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">{stat.label}</span>
              </div>
              <div className="text-3xl font-display font-bold text-white tracking-tight">
                <CountUp end={stat.val} suffix={stat.suffix} decimals={stat.decimals || 0} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Miners */}
        <div className="glass-panel rounded-3xl p-8 border border-white/10 flex flex-col h-[550px] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-cyan to-transparent"></div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20">
                <span className="material-symbols-outlined text-neon-cyan">memory</span>
              </div>
              Miners
            </h2>
            <span className="bg-neon-cyan/10 text-neon-cyan px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-neon-cyan/20">
              {miners.length} Online
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-4">
                <div className="w-10 h-10 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin"></div>
                <span className="text-xs font-display uppercase tracking-widest">Scanning Network...</span>
              </div>
            ) : miners.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">No miners registered yet</div>
            ) : (
              miners.map((miner, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-neon-cyan/30 transition-all hover:bg-white/[0.04]">
                  <div className="flex items-center gap-4 hidden overflow-hidden sm:flex">
                     <div className="w-2 h-2 rounded-full bg-neon-cyan"></div>
                     <div>
                        <div className="font-mono text-xs text-white font-bold truncate max-w-[120px]">{miner.minerId}</div>
                     </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-neon-cyan">
                      <CountUp end={miner.stakeAmount / 100000000} suffix=" MDT" />
                    </div>
                    <div className="text-[10px] text-text-secondary uppercase tracking-widest">Staked</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Middle Column: Validators & Chart */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel rounded-3xl p-8 border border-white/10 relative overflow-hidden h-[260px] flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-purple to-transparent"></div>
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-3 mb-6">
               <span className="material-symbols-outlined text-neon-purple">donut_large</span>
               Reward Distribution
            </h2>
            <div className="flex-1 flex items-center justify-center relative -mt-4">
               {/* Fixed missing return around PieChart element by explicitly returning the node */}
               <ResponsiveContainer width="100%" height={200}>
                 <PieChart>
                   <Pie
                     data={REWARD_DATA}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                     stroke="none"
                   >
                     {REWARD_DATA.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                   </Pie>
                   <Tooltip 
                     contentStyle={{ backgroundColor: '#0a0f1e', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                     itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                     formatter={(value: any) => [`${value}%`, 'Share']}
                   />
                   <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Smart Contract</div>
               </div>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-8 border border-white/10 flex-1 relative overflow-hidden flex flex-col max-h-[266px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-pink to-transparent"></div>
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-display font-bold text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-neon-pink">shield_person</span>
                  Validators
               </h2>
               <span className="bg-neon-pink/10 text-neon-pink px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-neon-pink/20">
                  {uniqueValidators.length} Active
               </span>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
               {uniqueValidators.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary text-sm">No validators recorded yet</div>
               ) : (
                  uniqueValidators.map((vid, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <div className="w-8 h-8 rounded-lg bg-neon-pink/10 flex items-center justify-center border border-neon-pink/20">
                           <span className="material-symbols-outlined text-neon-pink text-sm">security</span>
                        </div>
                        <div className="font-mono text-xs text-white font-bold truncate">{vid as string}</div>
                    </div>
                  ))
               )}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Tasks */}
        <div className="glass-panel rounded-3xl p-8 border border-white/10 flex flex-col h-[550px] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-green to-transparent"></div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center border border-neon-green/20">
                 <span className="material-symbols-outlined text-neon-green">rocket_launch</span>
              </div>
              Transmissions
            </h2>
            <span className="bg-neon-green/10 text-neon-green px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-neon-green/20">
              Live Feed
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-4">
                <div className="w-10 h-10 border-2 border-neon-green/30 border-t-neon-green rounded-full animate-spin"></div>
                <span className="text-xs font-display uppercase tracking-widest">Intercepting Data...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">No recorded transmissions</div>
            ) : (
              tasks.slice(-15).reverse().map((task, idx) => (
                <div key={idx} className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:border-neon-green/30 transition-all hover:bg-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-mono text-[10px] text-neon-green uppercase tracking-widest font-bold px-2 py-1 bg-neon-green/10 rounded-lg">{task.taskType}</div>
                    <div className="text-white font-display font-black text-sm">
                      +<CountUp end={task.rewardAmount / 100000000} suffix=" MDT" />
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed mb-3">"{task.prompt}"</p>
                  <div className="flex items-center justify-between text-[10px] pt-3 border-t border-white/5">
                    <span className="text-white/40 font-mono italic">ID: {task.taskId?.substring(0, 12)}...</span>
                    {task.consensusTimestamp && (
                      <a 
                        href={`https://hashscan.io/testnet/transaction/${task.consensusTimestamp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neon-cyan hover:text-white uppercase tracking-widest font-bold flex items-center gap-1"
                      >
                        Verify TX <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SubnetsHubProps {
  onSelect?: (id: number) => void;
}

export default function SubnetsHub({ onSelect }: SubnetsHubProps) {
  const { data: stats, loading, error } = useProtocolStats();
  const [selectedSubnet, setSelectedSubnet] = useState<any>(null);

  // Define Subnets with premium gradients and visuals
  const subnets = [
    {
      id: 0,
      name: 'General Intelligence',
      description: 'Text generation, code review, and general AI tasks',
      emission: '45%',
      miners: stats?.minersPerSubnet?.[0] || 0,
      validators: stats?.validatorsPerSubnet?.[0] || 0,
      tasks: stats?.tasksPerSubnet?.[0] || 0,
      color: 'neon-cyan',
      gradient: 'from-neon-cyan/20 to-transparent',
      glow: 'shadow-[0_0_20px_rgba(0,243,255,0.1)]',
      icon: 'psychology'
    },
    {
      id: 1,
      name: 'Image Generation',
      description: 'Image generation, style transfer, and visual AI',
      emission: '30%',
      miners: stats?.minersPerSubnet?.[1] || 0,
      validators: stats?.validatorsPerSubnet?.[1] || 0,
      tasks: stats?.tasksPerSubnet?.[1] || 0,
      color: 'neon-pink',
      gradient: 'from-neon-pink/20 to-transparent',
      glow: 'shadow-[0_0_20px_rgba(255,0,255,0.1)]',
      icon: 'image'
    },
    {
      id: 2,
      name: 'Code Analysis',
      description: 'Code review, bug detection, and optimization',
      emission: '25%',
      miners: stats?.minersPerSubnet?.[2] || 0,
      validators: stats?.validatorsPerSubnet?.[2] || 0,
      tasks: stats?.tasksPerSubnet?.[2] || 0,
      color: 'neon-purple',
      gradient: 'from-neon-purple/20 to-transparent',
      glow: 'shadow-[0_0_20px_rgba(188,19,254,0.1)]',
      icon: 'code'
    }
  ];

  if (selectedSubnet) {
    return <SubnetDetail subnet={selectedSubnet} onBack={() => setSelectedSubnet(null)} />;
  }

  return (
    <div className="p-6 space-y-8 animate-fade-in-up">
      {/* Hero Section - NOW AT THE VERY TOP */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-6xl font-display font-bold text-white tracking-tighter mb-2">
            Subnets <span className="text-neon-cyan neon-text">Hub</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-xl font-light">
            Access specialized AI compute networks. Modular, scalable, and fully decentralized on Hedera.
          </p>
        </div>
        <div className="glass-panel px-6 py-4 rounded-2xl border border-neon-cyan/20 flex flex-col items-center min-w-[160px]">
          <span className="text-[10px] font-bold text-neon-cyan uppercase tracking-[0.2em] mb-1">Total Protocols</span>
          <span className="text-4xl font-display font-bold text-white leading-none">
            <CountUp end={subnets.length} />
          </span>
        </div>
      </div>

      {/* Network Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-white/5">
          {[
            { label: 'Total Miners', val: stats.totalMiners, icon: 'memory', color: 'text-neon-cyan', bg: 'bg-neon-cyan/5' },
            { label: 'Validators', val: stats.totalValidators, icon: 'verified', color: 'text-neon-pink', bg: 'bg-neon-pink/5' },
            { label: 'Tasks Processed', val: stats.totalTasks, icon: 'terminal', color: 'text-neon-green', bg: 'bg-neon-green/5' },
            { label: 'Total Staked', val: stats.totalStaked / 100000000, suffix: ' MDT', icon: 'account_balance_wallet', color: 'text-neon-purple', bg: 'bg-neon-purple/5' }
          ].map((stat, i) => (
            <div key={i} className={`glass-panel rounded-2xl p-6 border border-white/10 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300`}>
              <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} blur-2xl rounded-full -mr-8 -mt-8 px-8 transition-transform group-hover:scale-150`}></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center border border-white/5`}>
                    <span className={`material-symbols-outlined ${stat.color}`}>{stat.icon}</span>
                  </div>
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-[0.15em] font-display">
                    {stat.label}
                  </span>
                </div>
                <div className="text-4xl font-display font-bold text-white tracking-tighter">
                  <CountUp end={stat.val} suffix={stat.suffix} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && !stats && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 animate-pulse">
          <div className="w-12 h-12 border-4 border-neon-cyan/20 border-t-neon-cyan rounded-full animate-spin"></div>
          <p className="text-neon-cyan font-display uppercase tracking-widest text-sm font-bold">Synchronizing with Hedera HCS Mirror Node...</p>
        </div>
      )}

      {error && !stats && (
        <div className="glass-panel rounded-2xl p-8 border border-red-500/30 bg-red-500/5 flex items-center gap-4">
          <span className="material-symbols-outlined text-red-500 text-4xl">error</span>
          <div>
            <h3 className="text-white font-bold text-lg">Network Error</h3>
            <p className="text-red-400/80 text-sm">Experimental HCS sync failed: {error}</p>
          </div>
        </div>
      )}

      {/* Subnet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subnets.map((subnet) => (
          <div
            key={subnet.id}
            onClick={() => setSelectedSubnet(subnet)}
            className={`glass-panel rounded-2xl p-8 border border-white/10 hover:border-${subnet.color}/50 transition-all duration-500 cursor-pointer group bg-gradient-to-br ${subnet.gradient} relative overflow-hidden ${subnet.glow}`}
          >
            <div className="flex items-start justify-between mb-8 relative z-10">
              <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-${subnet.color}/30 transition-colors`}>
                <span className={`material-symbols-outlined ${subnet.color} text-2xl`}>{subnet.icon}</span>
              </div>
              <div className={`text-3xl font-display font-bold text-white group-hover:${subnet.color} transition-colors neon-text`}>
                {subnet.emission}
              </div>
            </div>

            <div className="relative z-10">
              <h3 className="text-2xl font-display font-bold text-white mb-2 transition-all">
                {subnet.name}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-8 h-10 overflow-hidden line-clamp-2">
                {subnet.description}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5 relative z-10">
              <div>
                <div className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1 italic">Miners</div>
                <div className="text-2xl font-display font-bold text-white">
                  <CountUp end={subnet.miners} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1 italic">Validators</div>
                <div className="text-2xl font-display font-bold text-white">
                  <CountUp end={subnet.validators} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1 italic">Tasks</div>
                <div className="text-2xl font-display font-bold text-white">
                  <CountUp end={subnet.tasks} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text-secondary group-hover:text-white transition-colors relative z-10">
              <span className="w-8 h-[1px] bg-white/10 group-hover:w-12 group-hover:bg-white/30 transition-all"></span>
              Inspect Subnet
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_right_alt</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


