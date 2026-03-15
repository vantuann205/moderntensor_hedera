"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useSort } from '@/lib/hooks/useSort';
import SortTh from '@/components/ui-custom/SortTh';

interface MinersViewProps {
  onBack: () => void;
  onSelectMiner: (minerId: string) => void;
}

/** Unix seconds (float string) → UTC+7 */
function toUTC7(ts: any): string {
  if (!ts) return '—';
  const secs = typeof ts === 'string' ? parseFloat(ts) : Number(ts);
  if (!secs || isNaN(secs)) return '—';
  return new Date(secs * 1000).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

/** Raw MDT (8 decimals) → number */
function toMDT(raw: any): number {
  const n = Number(raw ?? 0);
  return n > 1e6 ? n / 1e8 : n;
}

export default function MinersView({ onBack, onSelectMiner }: MinersViewProps) {
  const [miners, setMiners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState(10000);
  const { accountId: myAccountId, isConnected } = useWallet();
  const { sort, toggle, sortData } = useSort('hcs_sequence', 'desc');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/hcs/miners');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setMiners(json.data);
        } else {
          setError(json.error || 'Failed to load');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  // Deduplicate by miner_id, keep latest registration (highest hcs_sequence)
  const uniqueMiners = React.useMemo(() => {
    const map = new Map<string, any>();
    miners.forEach(m => {
      const id = m.miner_id || m.account_id;
      if (!id) return;
      const existing = map.get(id);
      if (!existing || (m.hcs_sequence ?? 0) > (existing.hcs_sequence ?? 0)) {
        map.set(id, m);
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.hcs_sequence ?? 0) - (a.hcs_sequence ?? 0));
  }, [miners]);

  const totalStaked = uniqueMiners.reduce((s, m) => s + toMDT(m.stake_amount), 0);
  const totalTasks = uniqueMiners.reduce((s, m) => s + Number(m.tasks_completed ?? 0), 0);
  const avgTrust = uniqueMiners.length > 0
    ? uniqueMiners.reduce((s, m) => s + Number(m.trust_score ?? 0.5), 0) / uniqueMiners.length
    : 0;

  const sortedMiners = sortData(uniqueMiners, (m, col) => {
    if (col === 'id') return m.miner_id || m.account_id || '';
    if (col === 'stake') return toMDT(m.stake_amount);
    if (col === 'tasks') return Number(m.tasks_completed ?? 0);
    if (col === 'trust') return Number(m.trust_score ?? 0.5);
    if (col === 'registered') return Number((m.consensusTimestamp || '0').split('.')[0]);
    if (col === 'subnet') return (m.subnet_ids ?? [0]).join(',');
    return m[col];
  });

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full animate-fade-in-up">
      <div className="w-full max-w-[1600px] flex flex-col gap-8">

        {/* Breadcrumb */}
        <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-500 uppercase">
          <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
          <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          <span className="text-neon-cyan">MINERS</span>
        </div>

        {/* Title */}
        <div className="flex flex-wrap justify-between items-end gap-6 pb-6 border-b border-white/5">
          <div>
            <h1 className="text-white text-4xl lg:text-5xl font-black leading-tight tracking-tight uppercase font-display neon-text">
              Network Miners
            </h1>
            <p className="text-slate-400 text-base font-light max-w-2xl mt-2 tracking-wider">
              AI compute providers registered on Hedera HCS
            </p>
          </div>
          <a href="https://hashscan.io/testnet/topic/0.0.8198583" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan text-xs font-bold hover:bg-neon-cyan hover:text-black transition-all uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Verify on HashScan
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Unique Miners', val: uniqueMiners.length, icon: 'dns', color: 'text-neon-cyan' },
            { label: 'Total Staked', val: totalStaked.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' MDT', icon: 'account_balance', color: 'text-neon-pink' },
            { label: 'Tasks Completed', val: totalTasks, icon: 'task_alt', color: 'text-neon-purple' },
            { label: 'Avg Trust Score', val: (avgTrust * 100).toFixed(1) + '%', icon: 'speed', color: 'text-neon-green' },
          ].map((s, i) => (
            <div key={i} className="glass-panel p-5 rounded-xl border border-white/5 relative overflow-hidden">
              <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest mb-1">{s.label}</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-white text-3xl font-black font-display tracking-tighter">{s.val}</p>
                <span className={`material-symbols-outlined ${s.color} text-2xl opacity-40`}>{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-slate-500 font-mono text-sm">
            Loading miners from Hedera HCS Mirror Node...
          </div>
        )}
        {error && (
          <div className="glass-panel rounded-xl p-6 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            Error: {error}
          </div>
        )}
        {!loading && uniqueMiners.length === 0 && (
          <div className="glass-panel rounded-xl p-12 border border-white/10 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-600 block mb-4">search_off</span>
            <div className="text-xl text-slate-400">No miners found</div>
            <div className="text-sm text-slate-500 mt-2">Miners will appear here after HCS registration</div>
          </div>
        )}

        {!loading && uniqueMiners.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

            {/* Table */}
            <div className="xl:col-span-8">
              <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 border-b border-white/10 text-[12px] uppercase tracking-widest text-slate-400 font-bold">
                      <tr>
                        <th className="px-5 py-4 w-12 text-center">#</th>
                        <SortTh col="id" sort={sort} onToggle={toggle} className="px-5 py-4">Miner ID</SortTh>
                        <SortTh col="subnet" sort={sort} onToggle={toggle} className="px-5 py-4">Subnet</SortTh>
                        <th className="px-5 py-4">Capabilities</th>
                        <SortTh col="registered" sort={sort} onToggle={toggle} className="px-5 py-4">Registered (UTC+7)</SortTh>
                        <SortTh col="stake" sort={sort} onToggle={toggle} className="px-5 py-4 text-right">Stake (MDT)</SortTh>
                        <SortTh col="tasks" sort={sort} onToggle={toggle} className="px-5 py-4 text-right">Tasks</SortTh>
                        <SortTh col="trust" sort={sort} onToggle={toggle} className="px-5 py-4 text-right">Trust</SortTh>
                        <th className="px-5 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-white/5 font-mono">
                      {sortedMiners.map((m, idx) => {
                        const id = m.miner_id || m.account_id || `miner-${idx}`;
                        const stake = toMDT(m.stake_amount);
                        const trust = Number(m.trust_score ?? 0.5);
                        const tasks = Number(m.tasks_completed ?? 0);
                        const caps: string[] = m.capabilities ?? [];
                        const subnets: number[] = m.subnet_ids ?? [0];
                        const regTime = m.consensusTimestamp || m.registered_at;
                        const scoreColor = trust >= 0.9 ? 'text-neon-green' : trust >= 0.7 ? 'text-neon-cyan' : 'text-yellow-400';
                        const isMe = isConnected && myAccountId && (id === myAccountId || m.account_id === myAccountId);
                        return (
                          <tr key={`${id}-${m.hcs_sequence}`}
                            className={`group transition-colors cursor-pointer ${isMe
                              ? 'bg-neon-cyan/10 border-l-2 border-neon-cyan hover:bg-neon-cyan/15'
                              : 'hover:bg-neon-cyan/5'}`}
                            onClick={() => onSelectMiner(id)}>
                            <td className="px-5 py-4 text-center text-slate-500 group-hover:text-neon-cyan font-bold">{idx + 1}</td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center flex-shrink-0">
                                  <span className="material-symbols-outlined text-neon-cyan text-sm">dns</span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="font-bold text-white group-hover:text-neon-cyan transition-colors">{id}</div>
                                    {isMe && (
                                      <span className="text-[11px] font-black bg-neon-cyan text-black px-1.5 py-0.5 rounded uppercase tracking-widest">YOU</span>
                                    )}
                                  </div>
                                  <span className="text-[12px] text-slate-500 whitespace-nowrap">
                                    {m.consensusTimestamp ? (
                                      <>Verify on{' '}
                                        <a href={`https://hashscan.io/testnet/transaction/${m.consensusTimestamp}`}
                                          target="_blank" rel="noopener noreferrer"
                                          className="text-neon-cyan hover:underline"
                                          onClick={e => e.stopPropagation()}>
                                          HashScan
                                        </a>
                                      </>
                                    ) : 'Recorded on HCS'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            {/* Subnet */}
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-1">
                                {subnets.map(s => (
                                  <span key={s} className="px-2 py-0.5 rounded text-[11px] bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">{s}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-1">
                                {caps.slice(0, 2).map((c, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded text-[11px] bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
                                    {c.replace(/_/g, ' ')}
                                  </span>
                                ))}
                                {caps.length > 2 && <span className="text-[11px] text-slate-500">+{caps.length - 2}</span>}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-white font-bold whitespace-nowrap">{toUTC7(regTime)}</div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="font-bold text-white">{stake.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </td>
                            <td className="px-5 py-4 text-right font-bold text-neon-green">{tasks}</td>
                            <td className="px-5 py-4 text-right">
                              <div className={`font-bold ${scoreColor}`}>{(trust * 100).toFixed(1)}%</div>
                              <div className="w-14 h-1 bg-white/10 rounded-full overflow-hidden mt-1 ml-auto">
                                <div className={`h-full rounded-full ${scoreColor.replace('text-', 'bg-')}`} style={{ width: `${trust * 100}%` }} />
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                tasks > 0
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                  : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                              }`}>
                                {tasks > 0 ? 'ACTIVE' : 'IDLE'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-white/5 text-[12px] text-slate-600 font-mono flex justify-between">
                  <span>{uniqueMiners.length} unique miners · {miners.length} HCS events (deduped server-side)</span>
                  <span>Auto-refresh 20s · HCS Mirror Node</span>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="xl:col-span-4 flex flex-col gap-6">
              <div className="glass-panel p-6 rounded-xl border-t border-neon-cyan shadow-[0_0_20px_rgba(0,243,255,0.05)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="material-symbols-outlined text-8xl text-neon-cyan">calculate</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-6 font-display uppercase tracking-wider neon-text">
                  Reward Estimator
                </h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-[12px] text-slate-500 uppercase font-bold tracking-widest block mb-2">
                      Stake Amount (MDT)
                    </label>
                    <input type="number" value={stakeAmount}
                      onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()} onChange={e => setStakeAmount(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-neon-cyan outline-none transition-all" />
                    <input type="range" min="1000" max="50000" step="1000" value={stakeAmount}
                      onChange={e => setStakeAmount(Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-neon-cyan mt-3" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Daily', val: (stakeAmount * 0.0012).toFixed(2), color: 'border-neon-cyan text-neon-cyan' },
                      { label: 'Weekly', val: (stakeAmount * 0.0012 * 7).toFixed(2), color: 'border-neon-purple text-neon-purple' },
                      { label: 'Monthly', val: (stakeAmount * 0.0012 * 30).toFixed(2), color: 'border-neon-green text-neon-green' },
                    ].map((r, i) => (
                      <div key={i} className={`bg-white/5 rounded-lg p-3 border-l-2 ${r.color} flex justify-between items-center`}>
                        <span className="text-[12px] text-slate-500 uppercase font-bold tracking-widest">{r.label}</span>
                        <span className={`font-mono font-bold text-lg ${r.color.split(' ')[1]}`}>{r.val} MDT</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[12px] text-slate-600">* Based on 0.12% daily reward rate</p>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-xl border border-neon-cyan/20">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-neon-cyan text-base">link</span>
                  Verify on Hedera
                </h3>
                <a href="https://hashscan.io/testnet/topic/0.0.8198583"
                  target="_blank" rel="noopener noreferrer"
                  className="block w-full px-4 py-3 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-neon-cyan hover:bg-neon-cyan hover:text-black transition-all text-center font-bold text-sm">
                  View Registration Topic
                </a>
                <p className="text-[12px] text-slate-600 mt-3 text-center">All miners registered on Hedera HCS</p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
