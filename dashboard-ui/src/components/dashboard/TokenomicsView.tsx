"use client";

import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Circulating', value: 67, color: '#00f3ff' },
  { name: 'Locked', value: 33, color: '#1f293a' },
];

export default function TokenomicsView() {
  const [stakeAmount, setStakeAmount] = useState<string>('1000');
  const apy = 0.184;
  const price = 423.50;

  const dailyOutput = useMemo(() => (Number(stakeAmount) * apy) / 365, [stakeAmount]);
  const monthlyOutput = useMemo(() => (Number(stakeAmount) * apy) / 12, [stakeAmount]);

  const projectionData = useMemo(() => {
      const data = [];
      let currentStaked = Number(stakeAmount); // Ensure initial value is a number
      const monthlyRate = apy / 12;
      for(let i = 0; i <= 12; i++) {
          data.push({
            month: i,
            staked: currentStaked,
            holding: Number(stakeAmount), // Cast holding to number
            currentValue: Number(stakeAmount),
            projected: Number(stakeAmount) * Math.pow(1 + apy / 12, i)
          });
          currentStaked = currentStaked * (1 + monthlyRate);
      }
      return data;
  }, [stakeAmount]);

  return (
    <div className="flex flex-col gap-10 py-10 px-6 lg:px-12 w-full max-w-[1600px] mx-auto animate-fade-in-up">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-4 border-b border-white/5 relative">
         <div className="absolute bottom-0 left-0 w-32 h-[1px] bg-neon-cyan shadow-[0_0_10px_#00f3ff]"></div>
         <div>
            <h2 className="text-4xl font-display font-bold text-white mb-2 tracking-tight neon-text">Tokenomics & Staking</h2>
            <p className="text-slate-400 max-w-2xl font-light text-lg">Network economy analytics, supply dynamics, and delegation control center.</p>
         </div>
         <div className="flex gap-3">
            <span className="px-4 py-1.5 bg-neon-green/10 text-neon-green text-[12px] font-black border border-neon-green/30 flex items-center gap-2 uppercase tracking-widest rounded">
                <span className="size-2 rounded-full bg-neon-green animate-pulse"></span> Network Active
            </span>
            <span className="px-4 py-1.5 bg-black/50 text-neon-cyan font-mono text-[12px] border border-neon-cyan/30 flex items-center rounded">
               BLOCK: #45,102
            </span>
         </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 glass-panel rounded-xl p-8 relative overflow-hidden group border-t border-l border-neon-cyan/20 bg-panel-dark/40">
            <div className="flex flex-col md:flex-row gap-12 items-center h-full relative z-10">
               <div className="relative size-72 flex-shrink-0 flex items-center justify-center">
                  <div className="absolute inset-[-20px] border border-dashed border-neon-cyan/30 rounded-full animate-spin-slow"></div>
                  <PieChart width={288} height={288}>
                    <Pie data={data} cx="50%" cy="50%" innerRadius={100} outerRadius={125} paddingAngle={5} dataKey="value" stroke="none">
                      {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-slate-500 text-[12px] uppercase tracking-widest mb-1 font-mono">Circulating</span>
                     <span className="text-5xl font-display font-bold text-white neon-text">MTN</span>
                     <span className="text-neon-cyan text-lg font-bold mt-1">67%</span>
                  </div>
               </div>
               
               <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8 font-mono">
                  <div className="relative pl-4 border-l-2 border-neon-cyan">
                     <h4 className="text-slate-500 text-[12px] uppercase tracking-widest mb-1">Circulating Supply</h4>
                     <p className="text-3xl font-display font-bold text-white tracking-tight">14,204,591 <span className="text-sm font-normal text-neon-cyan">MTN</span></p>
                  </div>
                  <div className="relative pl-4 border-l-2 border-white/10">
                     <h4 className="text-slate-500 text-[12px] uppercase tracking-widest mb-1">Locked Supply</h4>
                     <p className="text-3xl font-display font-bold text-white/50 tracking-tight">6,795,409 <span className="text-sm font-normal text-slate-500 font-display">MTN</span></p>
                  </div>
                  <div className="pt-6 border-t border-dashed border-white/10 col-span-1 sm:col-span-2 flex justify-between items-end mt-2 uppercase tracking-widest">
                     <div>
                        <h4 className="text-neon-cyan text-[12px] mb-1">Max Supply Cap</h4>
                        <p className="text-4xl font-display font-bold text-white">21.0M</p>
                     </div>
                     <div className="text-right">
                        <h4 className="text-neon-purple text-[12px] mb-1">Market Cap</h4>
                        <p className="text-2xl font-display font-bold text-white neon-text-purple">$6.2B</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="glass-panel rounded-xl p-0 flex flex-col justify-between border border-neon-cyan/30 relative overflow-hidden bg-black/60 font-mono">
            <div className="bg-neon-cyan/10 p-4 border-b border-neon-cyan/20 flex items-center justify-between">
               <h3 className="text-[12px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                   <span className="size-2 bg-neon-cyan rounded-full animate-pulse"></span>
                   Yield_Console
               </h3>
               <div className="flex gap-1.5 opacity-50"><div className="size-1.5 bg-red-500 rounded-full"></div><div className="size-1.5 bg-yellow-500 rounded-full"></div><div className="size-1.5 bg-green-500 rounded-full"></div></div>
            </div>
            
            <div className="p-6 space-y-6 flex-grow">
               <div>
                  <div className="flex justify-between mb-2">
                     <label className="text-[12px] text-neon-cyan uppercase font-black">Stake Amount</label>
                     <span className="text-neon-cyan text-[12px] opacity-60">∑ MTN</span>
                  </div>
                   <input className="w-full bg-black/40 border border-neon-cyan/30 rounded p-3 text-right text-white font-mono focus:border-neon-cyan outline-none text-lg" 
                     type="number" value={stakeAmount} 
                     onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                     onChange={(e) => {
                       let v = e.target.value;
                       if (v.length > 1 && v[0] === '0' && v[1] !== '.') v = v.substring(1);
                       setStakeAmount(v);
                     }}
                   />
                   <input className="w-full accent-neon-cyan h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-4" 
                     type="range" min="100" max="100000" step="100" 
                     value={stakeAmount}
                     onChange={(e) => {
                       let v = e.target.value;
                       if (v.length > 1 && v[0] === '0' && v[1] !== '.') v = v.substring(1);
                       setStakeAmount(v);
                     }}
                   />
               </div>
               
               <div className="h-24 w-full mt-4 border border-white/5 rounded bg-black/40 p-2">
                   <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={projectionData}>
                           <Line type="monotone" dataKey="staked" stroke="#00ffa3" strokeWidth={2} dot={false} isAnimationActive={false} />
                       </LineChart>
                   </ResponsiveContainer>
               </div>

               <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-black/60 p-3 rounded border border-white/10">
                     <p className="text-[11px] text-slate-500 uppercase font-black mb-1">Daily Output</p>
                     <p className="text-lg font-bold text-neon-green">{dailyOutput.toFixed(2)} M</p>
                  </div>
                  <div className="bg-black/60 p-3 rounded border border-white/10">
                     <p className="text-[11px] text-slate-500 uppercase font-black mb-1">Monthly Output</p>
                     <p className="text-lg font-bold text-neon-green">{monthlyOutput.toFixed(2)} M</p>
                  </div>
               </div>
            </div>
            
            <div className="p-6 border-t border-white/10 bg-black/40">
               <button className="w-full py-4 bg-neon-cyan text-black font-black uppercase tracking-widest text-xs hover:bg-white transition-all shadow-[0_0_20px_rgba(0,243,255,0.4)]">
                   Initialize Staking
               </button>
            </div>
         </div>
      </section>
    </div>
  );
}
