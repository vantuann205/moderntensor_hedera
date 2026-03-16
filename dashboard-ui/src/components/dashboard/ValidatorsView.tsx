"use client";

import React, { useState } from 'react';
import { useScores } from '@/hooks/useRealData';
import { useSort } from '@/lib/hooks/useSort';
import SortTh from '@/components/ui-custom/SortTh';

interface ValidatorsViewProps {
  onBack: () => void;
  onSelectValidator: (address: string) => void;
}

export default function ValidatorsView({ onBack, onSelectValidator }: ValidatorsViewProps) {
  const { data: scores, loading, error } = useScores();
  const [stakeAmount, setStakeAmount] = useState<string>('1000');
  const [searchTerm, setSearchTerm] = useState('');
  const { sort, toggle, sortData } = useSort('totalValidations', 'desc');

  // Extract unique validators from scores
  const validators = React.useMemo(() => {
    if (!scores || scores.length === 0) return [];

    const validatorMap = new Map();
    
    scores.forEach((score: any) => {
      const validatorId = score.validatorId;
      if (!validatorMap.has(validatorId)) {
        validatorMap.set(validatorId, {
          id: validatorId,
          totalValidations: 0,
          totalScore: 0,
          totalConfidence: 0,
          totalRelevance: 0,
          totalQuality: 0,
          totalCompleteness: 0,
          totalCreativity: 0,
          consensusTimestamp: score.consensusTimestamp,
        });
      }
      const v = validatorMap.get(validatorId);
      v.totalValidations++;
      v.totalScore      += score.score ?? 0;
      v.totalConfidence += score.confidence ?? 0;
      v.totalRelevance  += score.metrics?.relevance ?? 0;
      v.totalQuality    += score.metrics?.quality ?? 0;
      v.totalCompleteness += score.metrics?.completeness ?? 0;
      v.totalCreativity += score.metrics?.creativity ?? 0;
    });

    const mapped = Array.from(validatorMap.values()).map(v => ({
      ...v,
      avgScore:       v.totalScore / v.totalValidations,
      avgConfidence:  v.totalConfidence / v.totalValidations,
      avgRelevance:   v.totalRelevance / v.totalValidations,
      avgQuality:     v.totalQuality / v.totalValidations,
      avgCompleteness: v.totalCompleteness / v.totalValidations,
      avgCreativity:  v.totalCreativity / v.totalValidations,
    }));

    return mapped;
  }, [scores]);

  // Apply search filter for table only
  const filteredValidators = React.useMemo(() => {
    if (!searchTerm.trim()) return validators;
    const term = searchTerm.toLowerCase();
    return validators.filter(v => (v.id || '').toLowerCase().includes(term));
  }, [validators, searchTerm]);

  const sortedValidators = sortData(filteredValidators, (v, col) => {
    if (col === 'id') return v.id;
    if (col === 'validations') return v.totalValidations;
    if (col === 'avgScore') return v.avgScore;
    if (col === 'confidence') return v.avgConfidence;
    return (v as any)[col];
  });

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full animate-fade-in-up">
        <div className="w-full max-w-[1600px] flex flex-col gap-8">
            <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-500 uppercase">
                <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                <span className="text-neon-cyan">VALIDATORS</span>
            </div>

            <div className="flex flex-wrap justify-between items-end gap-6 pb-6 border-b border-white/5 relative">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                        <h1 className="text-white text-4xl lg:text-5xl font-black leading-tight tracking-tight uppercase font-display neon-text">Network Validators</h1>
                    </div>
                    <p className="text-slate-400 text-lg font-light max-w-2xl font-body tracking-wider">
                        AI validators scoring miner submissions on Hedera HCS
                    </p>
                </div>

                {/* Search bar */}
                <div className="relative w-full lg:w-96 group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-neon-cyan transition-colors">search</span>
                    <input 
                        type="text" 
                        placeholder="Search by Validator ID..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:border-neon-cyan/50 focus:bg-white/10 outline-none transition-all font-mono text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Validators', val: validators.length, icon: 'groups', color: 'text-neon-cyan', border: 'neon-border-cyan' },
                  { label: 'Total Scores', val: scores?.length || 0, icon: 'verified', color: 'text-neon-pink', border: 'neon-border-pink' },
                  { label: 'Avg Score', val: validators.length > 0 ? (validators.reduce((sum, v) => sum + v.avgScore, 0) / validators.length).toFixed(1) : '0', icon: 'ssid_chart', color: 'text-neon-purple', border: 'border-l-2 border-neon-purple' },
                  { label: 'Avg Confidence', val: validators.length > 0 ? ((validators.reduce((sum, v) => sum + v.avgConfidence, 0) / validators.length) * 100).toFixed(0) + '%' : '0%', icon: 'verified_user', color: 'text-green-400', border: 'border-l-2 border-green-500' }
                ].map((stat, i) => (
                  <div key={i} className={`glass-panel p-5 rounded-xl ${stat.border} relative overflow-hidden group`}>
                      <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                      <div className="flex items-end justify-between mt-1 z-10">
                          <p className="text-white text-3xl font-black font-display tracking-tighter">{stat.val}</p>
                          <span className={`material-symbols-outlined ${stat.color} text-2xl opacity-50`}>{stat.icon}</span>
                      </div>
                  </div>
                ))}
            </div>

            {loading && (
              <div className="text-center py-12 text-text-secondary">
                Loading validators from Hedera HCS...
              </div>
            )}

            {error && (
              <div className="glass-panel rounded-xl p-6 border border-red-500/30 bg-red-500/10">
                <div className="text-red-400">Error: {error}</div>
              </div>
            )}

            {!loading && !error && validators.length === 0 && (
              <div className="glass-panel rounded-xl p-12 border border-white/10 text-center">
                <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">search_off</span>
                <div className="text-xl text-slate-400">No validators found</div>
                <div className="text-sm text-slate-500 mt-2">Validators will appear here after scoring submissions</div>
              </div>
            )}

            {!loading && validators.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  <div className="xl:col-span-8 flex flex-col gap-6">
                      <div className="glass-panel rounded-xl overflow-hidden border border-white/5 font-body">
                          <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                  <thead className="bg-white/5 border-b border-white/10 text-[12px] uppercase tracking-widest text-slate-400 font-bold">
                                      <tr>
                                          <th className="px-6 py-5 w-16 text-center">Rank</th>
                                          <SortTh col="id" sort={sort} onToggle={toggle} className="px-6 py-5">Validator ID</SortTh>
                                          <SortTh col="validations" sort={sort} onToggle={toggle} className="px-6 py-5 text-right">Validations</SortTh>
                                          <SortTh col="avgScore" sort={sort} onToggle={toggle} className="px-6 py-5 text-right">Avg Score</SortTh>
                                          <SortTh col="confidence" sort={sort} onToggle={toggle} className="px-6 py-5 text-right">Confidence</SortTh>
                                          <th className="px-6 py-5 text-center">Status</th>
                                      </tr>
                                  </thead>
                                  <tbody className="text-sm divide-y divide-white/5 font-mono tracking-widest">
                                      {sortedValidators.map((val, idx) => (
                                          <tr key={val.id} className="group hover:bg-neon-cyan/5 transition-colors cursor-pointer" onClick={() => onSelectValidator(val.id)}>
                                              <td className="px-6 py-5 text-center text-slate-500 group-hover:text-neon-cyan font-bold">{idx + 1}</td>
                                              <td className="px-6 py-5">
                                                  <div className="flex items-center gap-4">
                                                      <div className="size-10 rounded-lg bg-purple-500/20 p-[1px] shadow-[0_0_10px_rgba(0,0,0,0.4)]">
                                                          <div className="w-full h-full bg-slate-900 rounded-[7px] flex items-center justify-center">
                                                              <span className="material-symbols-outlined text-purple-400 text-sm">verified</span>
                                                          </div>
                                                      </div>
                                                      <div className="flex flex-col">
                                                          <span className="font-bold text-white group-hover:text-neon-cyan transition-colors">{val.id}</span>
                                                          <span className="text-[12px] text-slate-500 whitespace-nowrap">
                                                            {val.consensusTimestamp ? (
                                                              <>
                                                                Verify on{' '}
                                                                <a 
                                                                  href={`https://hashscan.io/testnet/transaction/${val.consensusTimestamp}`}
                                                                  target="_blank"
                                                                  rel="noopener noreferrer"
                                                                  className="text-neon-cyan hover:underline"
                                                                  onClick={(e) => e.stopPropagation()}
                                                                >
                                                                  HashScan
                                                                </a>
                                                              </>
                                                            ) : (
                                                              'Recorded on HCS'
                                                            )}
                                                          </span>
                                                      </div>
                                                  </div>
                                              </td>
                                              <td className="px-6 py-5 text-right">
                                                  <div className="font-bold text-white">{val.totalValidations}</div>
                                              </td>
                                              <td className="px-6 py-5 text-right text-neon-green font-bold">
                                                {val.avgScore.toFixed(1)}
                                              </td>
                                              <td className="px-6 py-5 text-right">
                                                <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[12px] text-slate-300">
                                                  {(val.avgConfidence * 100).toFixed(0)}%
                                                </span>
                                              </td>
                                              <td className="px-6 py-5 text-center">
                                                  <span className="px-3 py-1 rounded text-[12px] font-bold bg-green-500/10 text-green-400 border border-green-500/40">
                                                    ACTIVE
                                                  </span>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>

                      {/* Recent Validations */}
                      <div className="glass-panel rounded-xl p-6 border border-white/10">
                        <h3 className="text-xl font-display font-bold text-white mb-4">Recent Validations</h3>
                        <div className="space-y-3">
                          {scores?.slice(-10).reverse().map((score: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-panel-dark/50 rounded-lg border border-white/5 hover:border-neon-cyan/30 transition-colors group">
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                  <span className="material-symbols-outlined text-purple-400 text-sm">verified</span>
                                </div>
                                <div>
                                  <div className="text-sm text-white">
                                    <span className="text-purple-400">{score.validatorId}</span>
                                    {' → '}
                                    <span className="text-neon-cyan">{score.minerId}</span>
                                  </div>
                                  <div className="text-xs text-text-secondary">
                                    Task: {score.taskId}
                                    {score.consensusTimestamp && (
                                      <>
                                        {' • '}
                                        <a 
                                          href={`https://hashscan.io/testnet/transaction/${score.consensusTimestamp}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-neon-cyan hover:underline"
                                        >
                                          View on HashScan
                                        </a>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-neon-green">
                                  {score.score.toFixed(1)}
                                </div>
                                <div className="text-xs text-text-secondary">
                                  {(score.confidence * 100).toFixed(0)}% conf
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                  </div>

                  <div className="xl:col-span-4 flex flex-col gap-6">
                      <div className="glass-panel p-6 rounded-xl border-t border-neon-pink shadow-[0_0_20px_rgba(255,0,255,0.05)] relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <span className="material-symbols-outlined text-8xl text-neon-pink">calculate</span>
                          </div>
                          <h3 className="text-white font-bold text-lg mb-6 font-display uppercase tracking-wider neon-text-pink">
                            Validator Rewards
                          </h3>
                          <div className="flex flex-col gap-6">
                              <div className="flex flex-col gap-2">
                                  <label className="text-[12px] text-slate-500 uppercase font-bold tracking-widest">
                                    Validations per Day
                                  </label>
                                  <div className="relative">
                                      <input 
                                        type="number" 
                                        value={stakeAmount} 
                                        onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                                        onChange={(e) => {
                                          let v = e.target.value;
                                          if (v.length > 1 && v[0] === '0' && v[1] !== '.') v = v.substring(1);
                                          setStakeAmount(v);
                                        }} 
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-neon-pink focus:ring-1 focus:ring-neon-pink outline-none transition-all"
                                      />
                                  </div>
                                  <input 
                                    type="range" 
                                    min="10" 
                                    max="1000" 
                                    step="10" 
                                    value={stakeAmount} 
                                    onChange={(e) => {
                                          let v = e.target.value;
                                          if (v.length > 1 && v[0] === '0' && v[1] !== '.') v = v.substring(1);
                                          setStakeAmount(v);
                                        }} 
                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-neon-pink mt-4"
                                  />
                              </div>
                              <div className="flex flex-col gap-2">
                                  {[
                                    { label: 'Daily Earnings', val: (Number(stakeAmount) * 0.15).toFixed(2), color: 'border-neon-pink text-neon-pink' },
                                    { label: 'Weekly Earnings', val: (Number(stakeAmount) * 0.15 * 7).toFixed(2), color: 'border-neon-purple text-neon-purple' },
                                    { label: 'Monthly Earnings', val: (Number(stakeAmount) * 0.15 * 30).toFixed(2), color: 'border-neon-green text-neon-green' }
                                  ].map((r, i) => (
                                    <div key={i} className={`bg-white/5 rounded-lg p-3 border-l-2 ${r.color} flex justify-between items-center`}>
                                        <span className="text-[12px] text-slate-500 uppercase font-bold tracking-widest">{r.label}</span>
                                        <span className="font-mono font-bold text-lg">{r.val} MDT</span>
                                    </div>
                                  ))}
                              </div>
                              <div className="text-xs text-slate-500 mt-2">
                                * Based on 15% validator reward rate
                              </div>
                          </div>
                      </div>

                      {/* Verification Link */}
                      <div className="glass-panel p-6 rounded-xl border border-neon-cyan/30">
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-neon-cyan">link</span>
                          Verify on Hedera
                        </h3>
                        <a
                          href="https://hashscan.io/testnet/topic/0.0.8198584"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full px-4 py-3 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-neon-cyan hover:bg-neon-cyan hover:text-black transition-all text-center font-bold text-sm"
                        >
                          View Scoring Topic on HashScan
                        </a>
                        <div className="text-xs text-slate-500 mt-3 text-center">
                          All validations are recorded on Hedera HCS
                        </div>
                      </div>
                  </div>
              </div>
            )}
        </div>
    </div>
  );
}
