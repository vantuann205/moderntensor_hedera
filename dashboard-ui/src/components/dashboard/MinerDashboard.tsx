"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useStaking } from '@/lib/hooks/useStaking';
import { CONTRACTS, StakeRole } from '@/lib/contracts';
import { ExternalLink, Zap, Award, TrendingUp, Shield, RefreshCw, ChevronRight, AlertCircle, CheckCircle, Info, Lock, Unlock, Gift } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────
function toUTC7(ts: any): string {
  if (!ts) return '—';
  const secs = typeof ts === 'string' ? parseFloat(ts) : Number(ts);
  if (!secs || isNaN(secs)) return '—';
  return new Date(secs * 1000).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function toMDT(raw: any): number {
  const n = Number(raw ?? 0);
  return n > 1e6 ? n / 1e8 : n;
}

// ── On-Chain Staking Panel ────────────────────────────────────────────────────
function OnChainStakingPanel({ evmAddress, accountId }: { evmAddress: string; accountId: string }) {
  const { stakeInfo, regFee, loading, txHash, error, step, loadStakeInfo, stakeAsMiner, registerInSubnet, claimRewards, requestUnstake } = useStaking();
  const [stakeAmount, setStakeAmount] = useState('10');
  const [subnetId, setSubnetId] = useState('0');

  useEffect(() => {
    if (evmAddress) loadStakeInfo(evmAddress);
  }, [evmAddress, loadStakeInfo]);

  const roleLabel = ['None', 'Miner', 'Validator', 'Holder'];
  const isStaked = stakeInfo?.isActive;
  const isMinerRole = stakeInfo?.role === StakeRole.Miner;

  return (
    <div className="glass-panel rounded-2xl border border-neon-purple/30 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
            <Shield size={14} className="text-neon-purple" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">On-Chain Staking</div>
            <div className="text-[9px] text-slate-500 font-mono">StakingVaultV2 · {CONTRACTS.STAKING_VAULT.slice(0, 10)}...</div>
          </div>
        </div>
        <button onClick={() => loadStakeInfo(evmAddress)} className="text-slate-600 hover:text-neon-cyan transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Current stake status */}
        {stakeInfo && (
          <div className={`p-3 rounded-xl border text-[11px] space-y-1.5 ${isStaked ? 'bg-neon-green/5 border-neon-green/20' : 'bg-white/[0.02] border-white/10'}`}>
            <div className="flex justify-between">
              <span className="text-slate-500 uppercase tracking-widest text-[9px]">Status</span>
              <span className={`font-black ${isStaked ? 'text-neon-green' : 'text-slate-500'}`}>
                {isStaked ? `ACTIVE · ${roleLabel[stakeInfo.role]}` : 'NOT STAKED'}
              </span>
            </div>
            {isStaked && <>
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Staked</span>
                <span className="text-white font-bold">{stakeInfo.amountMDT.toLocaleString()} MDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase tracking-widest text-[9px]">Pending Reward</span>
                <span className="text-neon-green font-bold">{stakeInfo.pendingRewardMDT.toFixed(4)} MDT</span>
              </div>
              {stakeInfo.unstakeRequestedAt > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500 uppercase tracking-widest text-[9px]">Unstake At</span>
                  <span className="text-yellow-400 font-bold text-[9px]">
                    {new Date((stakeInfo.unstakeRequestedAt + 7 * 86400) * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                  </span>
                </div>
              )}
            </>}
          </div>
        )}

        {/* Reg fee info */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-black/20 rounded-lg px-3 py-2">
          <Info size={10} className="text-neon-yellow flex-shrink-0" />
          <span>Reg fee: <span className="text-neon-yellow font-bold">{regFee.toFixed(4)} MDT</span> (burned, dynamic EIP-1559 style) + stake amount (refundable)</span>
        </div>

        {/* Stake form */}
        {!isStaked && (
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5">Stake Amount (MDT) · min 10</label>
              <input type="number" min={10} value={stakeAmount} onChange={e => setStakeAmount(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:border-neon-purple/50 outline-none" />
            </div>
            <button onClick={() => stakeAsMiner(Number(stakeAmount))} disabled={loading}
              className="w-full py-3 bg-neon-purple/10 hover:bg-neon-purple/20 border border-neon-purple/40 text-neon-purple font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              <Lock size={12} />
              {loading ? step || 'Processing...' : `Approve & Stake ${stakeAmount} MDT`}
            </button>
            <p className="text-[9px] text-slate-600 text-center">MetaMask sẽ yêu cầu ký 2 transactions: approve + stake</p>
          </div>
        )}

        {/* Register in subnet */}
        {isStaked && isMinerRole && (
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5">Register in Subnet</label>
              <input type="number" min={0} value={subnetId} onChange={e => setSubnetId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:border-neon-cyan/50 outline-none" />
            </div>
            <button onClick={() => registerInSubnet(Number(subnetId))} disabled={loading}
              className="w-full py-2.5 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40">
              {loading ? step || 'Processing...' : `Register in Subnet ${subnetId}`}
            </button>
          </div>
        )}

        {/* Claim rewards */}
        {isStaked && stakeInfo && stakeInfo.pendingRewardMDT > 0 && (
          <button onClick={claimRewards} disabled={loading}
            className="w-full py-2.5 bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/40 text-neon-green font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            <Gift size={12} />
            Claim {stakeInfo.pendingRewardMDT.toFixed(4)} MDT Rewards
          </button>
        )}

        {/* Unstake */}
        {isStaked && stakeInfo?.unstakeRequestedAt === 0 && (
          <button onClick={requestUnstake} disabled={loading}
            className="w-full py-2 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 text-red-400/60 hover:text-red-400 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            <Unlock size={10} />
            Request Unstake (7-day cooldown)
          </button>
        )}

        {/* Step / error / tx */}
        {step && !error && (
          <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl text-[10px] font-mono text-neon-cyan">{step}</div>
        )}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-mono text-red-400 flex items-start gap-2">
            <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}
        {txHash && (
          <a href={`https://hashscan.io/testnet/transaction/${txHash}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-neon-cyan text-[10px] font-bold hover:underline">
            <ExternalLink size={10} />
            View TX on HashScan
          </a>
        )}
      </div>
    </div>
  );
}

// ── Task Feed Panel ───────────────────────────────────────────────────────────
function TaskFeedPanel({ accountId }: { accountId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/hcs/tasks');
        const json = await res.json();
        if (json.success) setTasks(json.data || []);
      } catch (_) {}
      finally { setLoading(false); }
    }
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
            <Zap size={14} className="text-neon-green" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Available Tasks</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">HCS Topic 0.0.8198585 · Live Feed</div>
          </div>
        </div>
        <span className="text-[9px] font-bold text-neon-green border border-neon-green/30 bg-neon-green/5 px-2 py-1 rounded-full uppercase tracking-widest">
          {tasks.length} tasks
        </span>
      </div>

      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="py-12 text-center text-slate-600 text-xs font-mono">Loading tasks from HCS...</div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center">
            <Zap size={28} className="text-slate-700 mx-auto mb-3" />
            <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No tasks available</div>
            <div className="text-slate-700 text-[10px] mt-1">Tasks will appear here when posted to HCS</div>
          </div>
        ) : tasks.slice(0, 20).map((task, i) => (
          <div key={i} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] font-black text-neon-green border border-neon-green/30 bg-neon-green/5 px-2 py-0.5 rounded uppercase tracking-widest">
                    {task.taskType || 'TASK'}
                  </span>
                  <span className="text-[9px] text-slate-600 font-mono">Subnet {task.subnetId ?? 0}</span>
                  <span className="text-[9px] text-slate-600 font-mono">{toUTC7(task.consensusTimestamp)}</span>
                </div>
                <div className="text-xs text-slate-300 line-clamp-2 leading-relaxed font-mono">
                  {task.prompt || task.taskHash || task.taskId}
                </div>
                <div className="text-[9px] text-slate-600 mt-1 font-mono">ID: {String(task.taskId || '').substring(0, 20)}...</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-neon-green font-black text-sm">+{toMDT(task.rewardAmount).toLocaleString()}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest">MDT</div>
                {task.consensusTimestamp && (
                  <a href={`https://hashscan.io/testnet/transaction/${task.consensusTimestamp}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[9px] text-neon-cyan/50 hover:text-neon-cyan flex items-center justify-end gap-0.5 mt-1 transition-colors">
                    HCS <ExternalLink size={8} />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-3 border-t border-white/5 bg-black/20 text-[10px] text-slate-600 font-mono flex justify-between">
        <span>Submit results via SubnetRegistryV2.submitResult(taskId, resultHash)</span>
        <span>Auto-refresh 15s</span>
      </div>
    </div>
  );
}

// ── Score History Panel ───────────────────────────────────────────────────────
function ScoreHistoryPanel({ accountId }: { accountId: string }) {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/hcs/scores');
        const json = await res.json();
        if (json.success) {
          const mine = (json.data || []).filter((s: any) =>
            s.minerId === accountId || s.miner_id === accountId
          );
          setScores(mine);
        }
      } catch (_) {}
      finally { setLoading(false); }
    }
    load();
  }, [accountId]);

  const avgScore = scores.length > 0
    ? scores.reduce((a, s) => a + Number(s.score ?? 0), 0) / scores.length
    : null;

  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center">
            <TrendingUp size={14} className="text-neon-cyan" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">My Score History</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">HCS Topic 0.0.8198584</div>
          </div>
        </div>
        {avgScore !== null && (
          <div className="text-right">
            <div className="text-neon-cyan font-black text-lg">{(avgScore * 100).toFixed(1)}%</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Avg Trust</div>
          </div>
        )}
      </div>

      <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-slate-600 text-xs font-mono">Loading scores...</div>
        ) : scores.length === 0 ? (
          <div className="py-10 text-center">
            <Award size={24} className="text-slate-700 mx-auto mb-2" />
            <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No scores yet</div>
            <div className="text-slate-700 text-[10px] mt-1">Complete tasks to earn trust scores</div>
          </div>
        ) : scores.map((s, i) => {
          const score = Number(s.score ?? 0);
          const scoreColor = score >= 0.9 ? 'text-neon-green' : score >= 0.7 ? 'text-neon-cyan' : 'text-yellow-400';
          return (
            <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div>
                <div className="text-[10px] font-mono text-white">Task: {String(s.taskId || '').substring(0, 16)}...</div>
                <div className="text-[9px] text-slate-600 mt-0.5">
                  Validator: {s.validatorId || s.validator_id || '—'} · {toUTC7(s.consensusTimestamp)}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-black text-sm ${scoreColor}`}>{(score * 100).toFixed(1)}%</div>
                <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className={`h-full rounded-full ${scoreColor.replace('text-', 'bg-')}`} style={{ width: `${score * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main MinerDashboard ───────────────────────────────────────────────────────
interface MinerDashboardProps {
  onBack: () => void;
}

export default function MinerDashboard({ onBack }: MinerDashboardProps) {
  const { accountId, isConnected, isMiner, address: evmAddress } = useWallet();
  const { stakeInfo, loadStakeInfo } = useStaking();
  const [myRegistration, setMyRegistration] = useState<any>(null);
  const [mdtBalance, setMdtBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load on-chain stake info for the header/flow status
  useEffect(() => {
    if (evmAddress) loadStakeInfo(evmAddress);
  }, [evmAddress, loadStakeInfo]);

  const loadMyData = useCallback(async () => {
    if (!accountId) return;
    try {
      // Load MDT balance
      const balRes = await fetch(`/api/mdt-balance?accountId=${accountId}`);
      const balData = await balRes.json();
      if (balRes.ok) setMdtBalance(balData.mdtBalance);

      // Load my HCS registration (latest)
      const minersRes = await fetch('/api/hcs/miners');
      const minersData = await minersRes.json();
      if (minersData.success) {
        const all: any[] = minersData.data || [];
        const mine = all
          .filter(m => m.miner_id === accountId || m.account_id === accountId)
          .sort((a, b) => (b.hcs_sequence ?? 0) - (a.hcs_sequence ?? 0));
        if (mine.length > 0) setMyRegistration(mine[0]);
      }
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [accountId]);

  useEffect(() => {
    loadMyData();
    const t = setInterval(loadMyData, 30000);
    return () => clearInterval(t);
  }, [loadMyData]);

  const handleRefresh = () => { setRefreshing(true); loadMyData(); };

  if (!isConnected || !accountId) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="text-center space-y-3">
          <Shield size={40} className="text-slate-700 mx-auto" />
          <div className="text-slate-500 font-bold uppercase tracking-widest text-sm">Connect wallet to view miner dashboard</div>
        </div>
      </div>
    );
  }

  const stakeMDT = myRegistration ? toMDT(myRegistration.stake_amount) : 0;
  const regTime = myRegistration?.consensusTimestamp || myRegistration?.registered_at;
  const caps: string[] = myRegistration?.capabilities ?? [];
  const subnets: number[] = myRegistration?.subnet_ids ?? [];

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 w-full animate-fade-in-up">
      <div className="w-full max-w-[1600px] flex flex-col gap-8">

        {/* Breadcrumb */}
        <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-500 uppercase">
          <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
          <ChevronRight size={12} />
          <span className="text-neon-cyan">MINER DASHBOARD</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-6 pb-6 border-b border-white/5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-neon-cyan">dns</span>
              </div>
              <div>
                <h1 className="text-3xl font-black text-white uppercase tracking-tighter font-display">
                  Miner <span className="text-neon-cyan neon-text">Dashboard</span>
                </h1>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{accountId}</div>
              </div>
            </div>
            {isMiner || stakeInfo?.isActive ? (
              <div className="flex items-center gap-2 text-[10px] font-bold text-neon-green">
                <CheckCircle size={12} />
                <span>
                  {stakeInfo?.isActive ? `On-chain staked · ${stakeInfo.amountMDT} MDT` : ''}
                  {isMiner && stakeInfo?.isActive ? ' · ' : ''}
                  {isMiner ? `HCS registered · Seq #${myRegistration?.hcs_sequence}` : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] font-bold text-yellow-400">
                <AlertCircle size={12} />
                <span>Not registered as miner yet</span>
              </div>
            )}
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'MDT Balance',
              val: mdtBalance !== null ? `${mdtBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} MDT` : '—',
              icon: 'account_balance_wallet', color: 'text-neon-cyan',
              sub: 'Available in wallet'
            },
            {
              label: 'Staked (On-Chain)',
              val: stakeInfo?.isActive ? `${stakeInfo.amountMDT.toLocaleString()} MDT` : (stakeMDT > 0 ? `${stakeMDT.toLocaleString()} MDT` : '—'),
              icon: 'lock', color: 'text-neon-purple',
              sub: stakeInfo?.isActive ? `Role: Miner · Active` : 'Not staked on-chain'
            },
            {
              label: 'Registered',
              val: regTime ? toUTC7(regTime) : '—',
              icon: 'schedule', color: 'text-neon-green',
              sub: `UTC+7 · seq #${myRegistration?.hcs_sequence ?? '—'}`
            },
            {
              label: 'Subnets',
              val: subnets.length > 0 ? subnets.map(s => `S-${s}`).join(', ') : '—',
              icon: 'hub', color: 'text-neon-pink',
              sub: caps.slice(0, 2).join(' · ') || 'No capabilities'
            },
          ].map((s, i) => (
            <div key={i} className="glass-panel p-5 rounded-xl border border-white/5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">{s.label}</span>
                <span className={`material-symbols-outlined text-lg opacity-30 ${s.color}`}>{s.icon}</span>
              </div>
              <div className={`font-black font-display text-xl text-white tracking-tight`}>{s.val}</div>
              <div className="text-[9px] text-slate-600 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Left: Tasks (2/3 width) */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            <TaskFeedPanel accountId={accountId} />
            <ScoreHistoryPanel accountId={accountId} />
          </div>

          {/* Right: On-chain staking + Registration (1/3 width) */}
          <div className="flex flex-col gap-6">
            <OnChainStakingPanel evmAddress={evmAddress || ''} accountId={accountId} />

            {/* My Registration Detail */}
            {myRegistration && (
              <div className="glass-panel rounded-2xl p-6 border border-neon-cyan/20 space-y-4">
                <div className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle size={14} className="text-neon-green" />
                  My HCS Registration
                </div>
                <div className="space-y-2 text-[11px] font-mono">
                  {[
                    { k: 'Miner ID', v: myRegistration.miner_id },
                    { k: 'Sequence', v: `#${myRegistration.hcs_sequence}` },
                    { k: 'Registered', v: toUTC7(regTime) },
                    { k: 'Stake (HCS)', v: `${stakeMDT.toLocaleString()} MDT` },
                    { k: 'Capabilities', v: caps.join(', ') || '—' },
                    { k: 'Subnets', v: subnets.map(s => `S-${s}`).join(', ') || '—' },
                  ].map(({ k, v }) => (
                    <div key={k} className="flex justify-between gap-2 py-1.5 border-b border-white/5">
                      <span className="text-slate-500 uppercase tracking-widest text-[9px]">{k}</span>
                      <span className="text-white font-bold text-right truncate max-w-[160px]">{v}</span>
                    </div>
                  ))}
                </div>
                {myRegistration.consensusTimestamp && (
                  <a href={`https://hashscan.io/testnet/transaction/${myRegistration.consensusTimestamp}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-neon-cyan text-[10px] font-bold hover:underline">
                    <ExternalLink size={10} />
                    View on HashScan
                  </a>
                )}
              </div>
            )}

            {/* How it works */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-3">
              <div className="text-sm font-black text-white uppercase tracking-wider">Miner Flow</div>
              {[
                { step: '1', label: 'Stake MDT', desc: 'StakingVaultV2.stake(10+ MDT, Miner)', done: !!stakeInfo?.isActive, color: 'neon-cyan' },
                { step: '2', label: 'Register Subnet', desc: 'SubnetRegistryV2.registerMiner(subnetId)', done: false, color: 'neon-purple' },
                { step: '3', label: 'Receive Tasks', desc: 'Monitor HCS topic 0.0.8198585', done: false, color: 'neon-green' },
                { step: '4', label: 'Submit Results', desc: 'SubnetRegistryV2.submitResult(taskId, hash)', done: false, color: 'neon-pink' },
                { step: '5', label: 'Claim Rewards', desc: 'SubnetRegistryV2.withdrawEarnings()', done: false, color: 'neon-yellow' },
              ].map((s) => (
                <div key={s.step} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  s.done ? 'bg-neon-green/5 border-neon-green/20' : 'bg-white/[0.02] border-white/5'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black ${
                    s.done ? 'bg-neon-green text-black' : `bg-${s.color}/10 text-${s.color} border border-${s.color}/30`}`}>
                    {s.done ? '✓' : s.step}
                  </div>
                  <div>
                    <div className={`text-[11px] font-bold ${s.done ? 'text-neon-green' : 'text-white'}`}>{s.label}</div>
                    <div className="text-[9px] text-slate-600 font-mono mt-0.5">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
