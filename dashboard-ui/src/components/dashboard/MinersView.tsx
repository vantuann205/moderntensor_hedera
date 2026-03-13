"use client";

import React, { useState } from 'react';
import { useMiners, useScores } from '@/hooks/useRealData';

interface MinersViewProps {
  onBack: () => void;
  onSelectMiner: (minerId: string) => void;
}

export default function MinersView({ onBack, onSelectMiner }: MinersViewProps) {
  const { data: miners, loading, error } = useMiners();
  const { data: scores } = useScores();
  const [stakeAmount, setStakeAmount] = useState<number>(10000);

  // Calculate miner stats from scores
  const minersWithStats = React.useMemo(() => {
    if (!miners || miners.length === 0) return [];

    return miners.map((miner: any) => {
      const minerScores = scores?.filter((s: any) => s.minerId === miner.minerId) || [];
      const totalTasks = minerScores.length;
      const avgScore = totalTasks > 0 
        ? minerScores.reduce((sum: number, s: any) => sum + s.score, 0) / totalTasks 
        : 0;
      
      return {
        ...miner,
        totalTasks,
        avgScore,
        status: totalTasks > 0 ? 'active' : 'idle'
      };
    }).sort((a: any, b: any) => b.totalTasks - a.totalTasks);
  }, [miners, scores]);

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full animate-fade-in-up">
        <div className="w-full max-w-[1600px] flex flex-col gap-8">
            <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-500 uppercase">
                <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                <span className="text-neon-cyan">MINERS</span>
            </div>

            <div className="flex flex-wrap justify-between items-end gap-6 pb-6 border-b border-white/5 relative">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                        <h1 className="text-white text-4xl lg:text-5xl font-black leading-tight tracking-tight uppercase font-display neon-text">Network Miners</h1>
                        <span className="px-3 py-1 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/40 uppercase tracking-widest flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            {minersWithStats.length} Active
                        </span>
                    </div>
                    <p className="text-slate-400 text-lg font-light max-w-2xl font-body tracking-wider">
                        AI compute providers registered on Hedera HCS
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Miners', val: minersWithStats.length, icon: 'dns', color: 'text-neon-cyan', border: 'neon-border-cyan' },
                  { label: 'Total Staked', val: (minersWithStats.reduce((sum: number, m: any) => sum + (m.stakeAmount || 0), 0) / 1e10).toFixed(1) + 'K', icon: 'account_balance', color: 'text-neon-pink', border: 'neon-border-pink' },
                  { label: 'Tasks Completed', val: minersWithStats.reduce((sum: number, m: any) => sum + m.totalTasks, 0), icon: 'task_alt', color: 'text-neon-purple', border: 'border-l-2 border-neon-purple' },
                  { label: 'Avg Performance', val: minersWithStats.length > 0 ? (minersWithStats.reduce((sum: number, m: any) => sum + m.avgScore, 0) / minersWithStats.length).toFixed(1) : '0', icon: 'speed', color: 'text-green-400', border: 'border-l-2 border-green-500' }
                ].map((stat, i) => (
                  <div key={i} className={`glass-panel p-5 rounded-xl ${stat.border} relative overflow-hidden group`}>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                      <div className="flex items-end justify-between mt-1 z-10">
                          <p className="text-white text-3xl font-black font-display tracking-tighter">{stat.val}</p>
                          <span className={`material-symbols-outlined ${stat.color} text-2xl opacity-50`}>{stat.icon}</span>
                      </div>
                  </div>
                ))}
            </div>

            {loading && (
              <div className="text-center py-12 text-text-secondary">
                Loading miners from Hedera HCS...
              </div>
            )}

            {error && (
              <div className="glass-panel rounded-xl p-6 border border-red-500/30 bg-red-500/10">
                <div className="text-red-400">Error: {error}</div>
              </div>
            )}

            {!loading && !error && minersWithStats.length === 0 && (
              <div className="glass-panel rounded-xl p-12 border border-white/10 text-center">
                <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">search_off</span>
                <div className="text-xl text-slate-400">No miners found</div>
                <div className="text-sm text-slate-500 mt-2">Miners will appear here after registration</div>
              </div>
            )}

            {!loading && minersWithStats.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  <div className="xl:col-span-8 flex flex-col gap-6">
                      <div className="glass-panel rounded-xl overflow-hidden border border-white/5 font-body">
                          <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                  <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                                      <tr>
                                          <th className="px-6 py-5 w-16 text-center">Rank</th>
                                          <th className="px-6 py-5">Miner ID</th>
                                          <th className="px-6 py-5">Capabilities</th>
                                          <th className="px-6 py-5 text-right">Stake</th>
                                          <th className="px-6 py-5 text-right">Tasks</th>
                                          <th className="px-6 py-5 text-right">Avg Score</th>
                                          <th className="px-6 py-5 text-center">Status</th>
                                      </tr>
                                  </thead>
                                  <tbody className="text-sm divide-y divide-white/5 font-mono tracking-widest">
                                      {minersWithStats.map((miner: any, idx: number) => (
                                          <tr key={miner.minerId} className="group hover:bg-neon-cyan/5 transition-colors cursor-pointer" onClick={() => onSelectMiner(miner.minerId)}>
                                              <td className="px-6 py-5 text-center text-slate-500 group-hover:text-neon-cyan font-bold">{idx + 1}</td>
                                              <td className="px-6 py-5">
                                                  <div className="flex items-center gap-4">
                                                      <div className="size-10 rounded-lg bg-neon-cyan/20 p-[1px] shadow-[0_0_10px_rgba(0,0,0,0.4)]">
                                                          <div className="w-full h-full bg-slate-900 rounded-[7px] flex items-center justify-center">
                                                              <span className="material-symbols-outlined text-neon-cyan text-sm">dns</span>
                                                          </div>
                                                      </div>
                                                      <div className="flex flex-col">
                                                          <span className="font-bold text-white group-hover:text-neon-cyan transition-colors">{miner.minerId}</span>
                                                          <span className="text-[10px] text-slate-500">
                                                            {miner.consensusTimestamp ? (
                                                              <>
                                                                Verify on{' '}
                                                                <a 
                                                                  href={`https://hashscan.io/testnet/transaction/${miner.consensusTimestamp}`}
                                                                  target="_blank"
                                                                  rel="noopener noreferrer"
                                                                  className="text-neon-cyan hover:underline"
                                                                  onClick={(e) => e.stopPropagation()}
                                                                >
                                                                  HashScan
                                                                </a>
                                                              </>
                                                            ) : (
                                                              'Registered on HCS'
                                                            )}
                                                          </span>
                                                      </div>
                                                  </div>
                                              </td>
                                              <td className="px-6 py-5">
                                                <div className="flex flex-wrap gap-1">
                                                  {miner.capabilities?.slice(0, 2).map((cap: string, i: number) => (
                                                    <span key={i} className="px-2 py-0.5 rounded text-[9px] bg-neon-purple/10 text-neon-purple border border-neon-purple/30">
                                                      {cap.replace('_', ' ')}
                                                    </span>
                                                  ))}
                                                  {miner.capabilities?.length > 2 && (
                                                    <span className="px-2 py-0.5 rounded text-[9px] bg-white/5 text-slate-400">
                                                      +{miner.capabilities.length - 2}
                                                    </span>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="px-6 py-5 text-right">
                                                  <div className="font-bold text-white">{(miner.stakeAmount / 1e10).toFixed(1)}K</div>
                                                  <div className="text-[10px] text-slate-500">MDT</div>
                                              </td>
                                              <td className="px-6 py-5 text-right text-neon-green font-bold">
                                                {miner.totalTasks}
                                              </td>
                                              <td className="px-6 py-5 text-right">
                                                <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] text-slate-300">
                                                  {miner.avgScore > 0 ? miner.avgScore.toFixed(1) : 'N/A'}
                                                </span>
                                              </td>
                                              <td className="px-6 py-5 text-center">
                                                  <span className={`px-3 py-1 rounded text-[10px] font-bold ${
                                                    miner.status === 'active' 
                                                      ? 'bg-green-500/10 text-green-400 border border-green-500/40'
                                                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/40'
                                                  }`}>
                                                    {miner.status.toUpperCase()}
                                                  </span>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>

                  <div className="xl:col-span-4 flex flex-col gap-6">
                      <div className="glass-panel p-6 rounded-xl border-t border-neon-cyan shadow-[0_0_20px_rgba(0,243,255,0.05)] relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <span className="material-symbols-outlined text-8xl text-neon-cyan">calculate</span>
                          </div>
                          <h3 className="text-white font-bold text-lg mb-6 font-display uppercase tracking-wider neon-text">
                            Miner Rewards
                          </h3>
                          <div className="flex flex-col gap-6">
                              <div className="flex flex-col gap-2">
                                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                                    Stake Amount (MDT)
                                  </label>
                                  <div className="relative">
                                      <input 
                                        type="number" 
                                        value={stakeAmount} 
                                        onChange={(e) => setStakeAmount(Number(e.target.value))} 
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan outline-none transition-all"
                                      />
                                  </div>
                                  <input 
                                    type="range" 
                                    min="1000" 
                                    max="50000" 
                                    step="1000" 
                                    value={stakeAmount} 
                                    onChange={(e) => setStakeAmount(Number(e.target.value))} 
                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-neon-cyan mt-4"
                                  />
                              </div>
                              <div className="flex flex-col gap-2">
                                  {[
                                    { label: 'Daily Earnings', val: (stakeAmount * 0.0012).toFixed(2), color: 'border-neon-cyan text-neon-cyan' },
                                    { label: 'Weekly Earnings', val: (stakeAmount * 0.0012 * 7).toFixed(2), color: 'border-neon-purple text-neon-purple' },
                                    { label: 'Monthly Earnings', val: (stakeAmount * 0.0012 * 30).toFixed(2), color: 'border-neon-green text-neon-green' }
                                  ].map((r, i) => (
                                    <div key={i} className={`bg-white/5 rounded-lg p-3 border-l-2 ${r.color} flex justify-between items-center`}>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{r.label}</span>
                                        <span className="font-mono font-bold text-lg">{r.val} MDT</span>
                                    </div>
                                  ))}
                              </div>
                              <div className="text-xs text-slate-500 mt-2">
                                * Based on 0.12% daily reward rate
                              </div>
                          </div>
                      </div>

                      <div className="glass-panel p-6 rounded-xl border border-neon-cyan/30">
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-neon-cyan">link</span>
                          Verify on Hedera
                        </h3>
                        <a
                          href="https://hashscan.io/testnet/topic/0.0.8198583"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full px-4 py-3 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-neon-cyan hover:bg-neon-cyan hover:text-black transition-all text-center font-bold text-sm"
                        >
                          View Registration Topic on HashScan
                        </a>
                        <div className="text-xs text-slate-500 mt-3 text-center">
                          All miners are registered on Hedera HCS
                        </div>
                      </div>
                  </div>
              </div>
            )}
        </div>
    </div>
  );
}
