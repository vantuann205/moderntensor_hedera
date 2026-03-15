"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { AccountId, ContractExecuteTransaction, ContractId, ContractFunctionParameters, Long } from '@hashgraph/sdk';
import { useWallet } from '@/context/WalletContext';
import { useStaking } from '@/lib/hooks/useStaking';
import { CONTRACTS, StakeRole, SUBNET_REGISTRY_ABI } from '@/lib/contracts';
import { ExternalLink, Zap, Award, TrendingUp, Shield, RefreshCw, ChevronRight, AlertCircle, CheckCircle, Info, Lock, Unlock, Gift, Send, UserPlus, BarChart2 } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a HashScan URL for any transaction identifier:
 * - EVM hash (0x...): /transaction/0x...
 * - Hedera txId (0.0.X@secs.nanos): /transaction/0.0.X-secs-nanos
 * - consensus_timestamp (1234567890.000000000): /transaction/1234567890.000000000
 */
// transaction/TX_ID or topic/TOPIC_ID/message/SEQUENCE
function hashscanUrl(txId: string, isSequence?: boolean, topicId?: string): string {
  if (!txId || txId === 'submitted' || txId === 'hcs-only' || txId === 'finalized') return '';
  
  if (isSequence && topicId) {
    return `https://hashscan.io/testnet/topic/${topicId}/message/${txId}`;
  }

  const base = 'https://hashscan.io/testnet/transaction/';
  if (txId.includes('@')) {
    const [acc, time] = txId.split('@');
    return base + `${acc}-${time.replace('.', '-')}`;
  }
  return base + txId;
}

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

// ── Countdown helper ─────────────────────────────────────────────────────────
function unstakeCountdown(unstakeRequestedAt: number): string {
  const COOLDOWN = 7 * 24 * 3600; // 7 days in seconds
  const unlockAt = unstakeRequestedAt + COOLDOWN;
  const now = Math.floor(Date.now() / 1000);
  const remaining = unlockAt - now;
  if (remaining <= 0) return 'Ready to withdraw';
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return `${d}d ${h}h ${m}m remaining`;
}

// ── On-Chain Staking Panel ────────────────────────────────────────────────────
function OnChainStakingPanel({ evmAddress, accountId }: { evmAddress: string; accountId: string }) {
  const { stakeInfo, regFee, loading, txHash, txHashTransfer, txHashContract, error, step, loadStakeInfo, stakeAsMiner, claimRewards, requestUnstake } = useStaking();
  const { type: walletType } = useWallet();
  const [stakeAmount, setStakeAmount] = useState('10');
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (evmAddress) loadStakeInfo(evmAddress);
  }, [evmAddress, loadStakeInfo]);

  // Tick every minute to update countdown
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const isStaked = stakeInfo?.isActive;
  const hasUnstakeRequest = stakeInfo && stakeInfo.unstakeRequestedAt > 0;
  const canWithdraw = hasUnstakeRequest &&
    Math.floor(Date.now() / 1000) >= stakeInfo!.unstakeRequestedAt + 7 * 24 * 3600;

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
        {/* ── Stake status card ── */}
        <div className={`p-4 rounded-xl border space-y-2 ${isStaked ? 'bg-neon-green/5 border-neon-green/20' : hasUnstakeRequest ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-white/[0.02] border-white/10'}`}>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Status</span>
            <span className={`text-xs font-black ${isStaked ? 'text-neon-green' : hasUnstakeRequest ? 'text-yellow-400' : 'text-slate-500'}`}>
              {isStaked ? 'ACTIVE · MINER' : hasUnstakeRequest ? 'UNSTAKING' : 'NOT STAKED'}
            </span>
          </div>
          {stakeInfo && stakeInfo.amount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Staked Amount</span>
              <span className="text-white font-black text-sm">{stakeInfo.amountMDT.toLocaleString()} MDT</span>
            </div>
          )}
          {isStaked && stakeInfo && stakeInfo.stakedAt > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Staked Since</span>
              <span className="text-slate-300 text-[10px] font-mono">{toUTC7(stakeInfo.stakedAt)}</span>
            </div>
          )}
          {isStaked && stakeInfo && stakeInfo.pendingRewardMDT > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Pending Reward</span>
              <span className="text-neon-green font-bold text-[11px]">{stakeInfo.pendingRewardMDT.toFixed(4)} MDT</span>
            </div>
          )}
          {/* Unstake countdown */}
          {hasUnstakeRequest && stakeInfo && (
            <div className="mt-2 p-2 bg-yellow-400/10 rounded-lg border border-yellow-400/20">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-yellow-400 uppercase tracking-widest font-bold">Unlock In</span>
                <span className={`text-[10px] font-black ${canWithdraw ? 'text-neon-green' : 'text-yellow-400'}`}>
                  {unstakeCountdown(stakeInfo.unstakeRequestedAt)}
                </span>
              </div>
              <div className="text-[9px] text-slate-500 mt-1 font-mono">
                Requested: {toUTC7(stakeInfo.unstakeRequestedAt)}
              </div>
              {/* Progress bar */}
              {!canWithdraw && (() => {
                const COOLDOWN = 7 * 24 * 3600;
                const elapsed = Math.floor(Date.now() / 1000) - stakeInfo.unstakeRequestedAt;
                const pct = Math.min(100, Math.max(0, (elapsed / COOLDOWN) * 100));
                return (
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Reg fee info */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-black/20 rounded-lg px-3 py-2">
          <Info size={10} className="text-neon-yellow flex-shrink-0" />
          <span>Reg fee: <span className="text-neon-yellow font-bold">{regFee.toFixed(4)} MDT</span> (burned) + stake (refundable after 7d cooldown)</span>
        </div>

        {/* ── Add stake form (shown when active OR not staked) ── */}
        {!hasUnstakeRequest && (
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5">
                {isStaked ? 'Add More Stake (MDT)' : 'Stake Amount (MDT) · min 10'}
              </label>
              <input type="number" min={isStaked ? 1 : 10} value={stakeAmount}
                onChange={e => setStakeAmount(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:border-neon-purple/50 outline-none" />
            </div>
            <button onClick={() => stakeAsMiner(Number(stakeAmount))} disabled={loading}
              className="w-full py-3 bg-neon-purple/10 hover:bg-neon-purple/20 border border-neon-purple/40 text-neon-purple font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              <Lock size={12} />
              {loading ? (step || 'Processing...') : isStaked
                ? `Add ${stakeAmount} MDT via ${walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}`
                : `Stake ${stakeAmount} MDT via ${walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}`}
            </button>
            <p className="text-[9px] text-slate-600 text-center">
              {walletType === 'hashpack'
                ? 'HashPack: 3 signatures — transfer MDT + recordDeposit + stake'
                : 'MetaMask: 2 signatures — transfer + stake'}
            </p>
          </div>
        )}

        {/* ── Claim rewards ── */}
        {isStaked && stakeInfo && stakeInfo.pendingRewardMDT > 0 && (
          <button onClick={claimRewards} disabled={loading}
            className="w-full py-2.5 bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/40 text-neon-green font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            <Gift size={12} />
            Claim {stakeInfo.pendingRewardMDT.toFixed(4)} MDT Rewards
          </button>
        )}

        {/* ── Request unstake ── */}
        {isStaked && !hasUnstakeRequest && (
          <button onClick={requestUnstake} disabled={loading}
            className="w-full py-2 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 text-red-400/60 hover:text-red-400 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            <Unlock size={10} />
            Request Unstake (7-day cooldown)
          </button>
        )}

        {/* ── Step / error ── */}
        {step && !error && (
          <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl text-[10px] font-mono text-neon-cyan break-all">{step}</div>
        )}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-mono text-red-400 flex items-start gap-2">
            <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── TX Links ── */}
        {(txHash || txHashTransfer || txHashContract) && (
          <div className="space-y-1.5 pt-1 border-t border-white/5">
            <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">Last Transaction</div>
            {txHashTransfer && (
              <a href={hashscanUrl(txHashTransfer)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-neon-cyan text-[10px] font-bold hover:underline">
                <ExternalLink size={10} />
                MDT Transfer TX
              </a>
            )}
            {txHashContract && (
              <a href={hashscanUrl(txHashContract)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-neon-green text-[10px] font-bold hover:underline">
                <ExternalLink size={10} />
                Contract Stake TX
              </a>
            )}
            {txHash && !txHashTransfer && !txHashContract && (
              <a href={hashscanUrl(txHash)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-neon-cyan text-[10px] font-bold hover:underline">
                <ExternalLink size={10} />
                View TX on HashScan
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stake History Panel ───────────────────────────────────────────────────────
function StakeHistoryPanel({ accountId, evmAddress }: { accountId: string; evmAddress: string }) {
  const { stakeInfo } = useStaking();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetch(`/api/stake-history?accountId=${accountId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setHistory(d.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accountId]);

  // Tick every minute for countdown
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const COOLDOWN = 7 * 24 * 3600;
  const hasUnstake = stakeInfo && stakeInfo.unstakeRequestedAt > 0;
  const canWithdraw = hasUnstake &&
    Math.floor(Date.now() / 1000) >= stakeInfo!.unstakeRequestedAt + COOLDOWN;

  return (
    <div className="glass-panel rounded-2xl border border-neon-purple/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
            <Lock size={14} className="text-neon-purple" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Stake History</div>
            <div className="text-[9px] text-slate-500 font-mono">StakingVaultV2 · {CONTRACTS.STAKING_VAULT.slice(0, 10)}... · real on-chain data</div>
          </div>
        </div>
        <span className="text-[9px] font-bold text-neon-purple border border-neon-purple/30 bg-neon-purple/5 px-2 py-1 rounded-full uppercase tracking-widest">
          {history.length} event{history.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Current stake status */}
      {stakeInfo && stakeInfo.isActive && (
        <div className="mx-5 mt-4 p-4 rounded-xl bg-neon-green/5 border border-neon-green/20 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-neon-green uppercase tracking-widest font-black">Active Stake</span>
            <span className="text-white font-black">{stakeInfo.amountMDT.toLocaleString()} MDT</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div>
              <div className="text-slate-500 text-[9px] uppercase tracking-widest mb-0.5">Staked Since</div>
              <div className="text-white">{toUTC7(stakeInfo.stakedAt)}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[9px] uppercase tracking-widest mb-0.5">Pending Reward</div>
              <div className="text-neon-green font-bold">{stakeInfo.pendingRewardMDT.toFixed(4)} MDT</div>
            </div>
          </div>

          {/* Unstake countdown */}
          {hasUnstake && stakeInfo && (
            <div className="mt-1 p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-yellow-400 uppercase tracking-widest font-bold">Unstake Cooldown</span>
                <span className={`text-[10px] font-black ${canWithdraw ? 'text-neon-green' : 'text-yellow-400'}`}>
                  {unstakeCountdown(stakeInfo.unstakeRequestedAt)}
                </span>
              </div>
              <div className="text-[9px] text-slate-500 font-mono">
                Requested: {toUTC7(stakeInfo.unstakeRequestedAt)}
              </div>
              <div className="text-[9px] text-slate-500 font-mono">
                Unlocks at: {toUTC7(stakeInfo.unstakeRequestedAt + COOLDOWN)}
              </div>
              {!canWithdraw && (() => {
                const elapsed = Math.floor(Date.now() / 1000) - stakeInfo.unstakeRequestedAt;
                const pct = Math.min(100, Math.max(0, (elapsed / COOLDOWN) * 100));
                return (
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[9px] text-slate-600 text-right">{pct.toFixed(1)}% of 7 days</div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Transaction history */}
      <div className="divide-y divide-white/5 mt-4">
        {loading ? (
          <div className="py-8 text-center text-slate-600 text-xs font-mono">Loading from mirror node...</div>
        ) : history.length === 0 ? (
          <div className="py-10 text-center">
            <Lock size={24} className="text-slate-700 mx-auto mb-2" />
            <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No stake transactions found</div>
            <div className="text-slate-700 text-[10px] mt-1">Stake MDT to see history here</div>
          </div>
        ) : (
          history.map((ev, i) => (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-neon-purple uppercase tracking-widest px-2 py-0.5 bg-neon-purple/10 border border-neon-purple/20 rounded">
                  STAKE #{history.length - i}
                </span>
                <div className="text-right">
                  {ev.mdtAmount != null && (
                    <div className="text-white font-black text-sm">{ev.mdtAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} MDT</div>
                  )}
                  <div className="text-[9px] text-slate-500 font-mono">{toUTC7(ev.timestamp)}</div>
                </div>
              </div>

              {/* 2 HashScan links */}
              <div className="space-y-1 pl-1">
                {ev.transferTs && (
                  <a href={hashscanUrl(ev.transferTs)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-neon-cyan text-[10px] font-bold hover:underline">
                    <ExternalLink size={10} />
                    MDT Transfer TX
                    <span className="text-slate-600 font-normal">{ev.transferTs}</span>
                  </a>
                )}
                <a href={hashscanUrl(ev.contractTs)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-neon-green text-[10px] font-bold hover:underline">
                  <ExternalLink size={10} />
                  Contract Stake TX
                  <span className="text-slate-600 font-normal">{ev.contractTs}</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-5 py-3 border-t border-white/5 bg-black/20 text-[10px] text-slate-600 font-mono flex justify-between">
        <a href={`https://hashscan.io/testnet/account/${accountId}/operations`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-slate-500 hover:text-neon-cyan transition-colors">
          <ExternalLink size={9} /> All account operations
        </a>
        <span>Mirror Node · real-time</span>
      </div>
    </div>
  );
}

// ── Withdraw Earnings Panel ───────────────────────────────────────────────────
function WithdrawEarningsPanel({ evmAddress, accountId }: { evmAddress: string; accountId: string }) {
  const { type: walletType, hashConnect } = useWallet();
  const [pending, setPending] = useState<number | null>(null);
  const [loadingPending, setLoadingPending] = useState(true);
  const [txStep, setTxStep] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    if (!evmAddress) return;
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, provider);
      const raw = await registry.pendingWithdrawals(evmAddress);
      setPending(Number(raw) / 1e8);
    } catch (_) { setPending(0); }
    finally { setLoadingPending(false); }
  }, [evmAddress]);

  useEffect(() => { loadPending(); }, [loadPending]);

  const withdraw = async () => {
    setTxStep('Withdrawing earnings...'); setTxError(null); setTxHash(null);
    try {
      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, signer);
        const tx = await registry.withdrawEarnings({ gasLimit: 200000 });
        const receipt = await tx.wait();
        setTxHash(receipt.hash); setTxStep(`✓ Withdrawn ${pending?.toFixed(4)} MDT`); setPending(0);
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.SUBNET_REGISTRY_ID);
        const receipt = await hashConnect.sendTransaction(hederaId,
          new ContractExecuteTransaction().setContractId(contractId).setGas(200000).setFunction('withdrawEarnings'));
        setTxHash(String(receipt.transactionId || '')); setTxStep(`✓ Withdrawn ${pending?.toFixed(4)} MDT`); setPending(0);
      }
    } catch (e: any) { setTxError(e.message); setTxStep(null); }
  };

  return (
    <div className="glass-panel rounded-2xl border border-neon-green/30 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center"><Gift size={14} className="text-neon-green" /></div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Claim Rewards</div>
            <div className="text-[9px] text-slate-500 font-mono">SubnetRegistryV2.withdrawEarnings()</div>
          </div>
        </div>
        <button onClick={loadPending} className="text-slate-600 hover:text-neon-cyan transition-colors"><RefreshCw size={12} /></button>
      </div>
      <div className="p-5 space-y-4">
        <div className={`p-4 rounded-xl border ${pending && pending > 0 ? 'bg-neon-green/5 border-neon-green/20' : 'bg-white/[0.02] border-white/10'}`}>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Pending Withdrawal</div>
          <div className={`text-2xl font-black font-mono ${pending && pending > 0 ? 'text-neon-green' : 'text-slate-600'}`}>
            {loadingPending ? '...' : `${(pending ?? 0).toFixed(4)} MDT`}
          </div>
          <div className="text-[9px] text-slate-600 mt-1">85% of finalized task rewards</div>
        </div>
        {pending !== null && pending > 0 && (
          <button onClick={withdraw} disabled={!!txStep && !txStep.startsWith('✓')}
            className="w-full py-3 bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/40 text-neon-green font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            <Gift size={12} /> Withdraw {pending.toFixed(4)} MDT
          </button>
        )}
        {txStep && <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl text-[10px] font-mono text-neon-cyan">{txStep}</div>}
        {txError && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-mono text-red-400">✗ {txError}</div>}
        {txHash && <a href={hashscanUrl(txHash)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-neon-cyan text-[10px] font-bold hover:underline"><ExternalLink size={10} /> View TX on HashScan</a>}
      </div>
    </div>
  );
}

// ── Register Miner Panel ──────────────────────────────────────────────────────
function RegisterMinerPanel({ accountId, evmAddress }: { accountId: string; evmAddress: string }) {
  const { type: walletType, hashConnect } = useWallet();
  const [subnetId, setSubnetId] = useState(0);
  const [checking, setChecking] = useState(false);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [registering, setRegistering] = useState(false);
  const [txStep, setTxStep] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const checkRegistration = useCallback(async () => {
    if (!evmAddress) return;
    setChecking(true);
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, provider);
      const result = await registry.isMiner(subnetId, evmAddress);
      setIsRegistered(result);
    } catch (_) { setIsRegistered(false); }
    finally { setChecking(false); }
  }, [evmAddress, subnetId]);

  useEffect(() => { checkRegistration(); }, [checkRegistration]);

  const registerMiner = async () => {
    setRegistering(true); setTxStep('Registering in subnet...'); setTxError(null); setTxHash(null);
    try {
      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, signer);
        const tx = await registry.registerMiner(subnetId, { gasLimit: 300000 });
        const receipt = await tx.wait();
        setTxHash(receipt.hash);
        setTxStep(`✓ Registered in Subnet ${subnetId}`);
        setIsRegistered(true);
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.SUBNET_REGISTRY_ID);
        const params = new ContractFunctionParameters().addUint256(Long.fromNumber(subnetId));
        const receipt = await hashConnect.sendTransaction(hederaId,
          new ContractExecuteTransaction().setContractId(contractId).setGas(300000).setFunction('registerMiner', params));
        setTxHash(String(receipt.transactionId || ''));
        setTxStep(`✓ Registered in Subnet ${subnetId}`);
        setIsRegistered(true);
      }
    } catch (e: any) {
      setTxError(e.reason || e.message || 'Registration failed');
      setTxStep(null);
    } finally { setRegistering(false); }
  };

  return (
    <div className="glass-panel rounded-2xl border border-neon-yellow/30 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-yellow/10 border border-neon-yellow/20 flex items-center justify-center">
            <UserPlus size={14} className="text-neon-yellow" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Register in Subnet</div>
            <div className="text-[9px] text-slate-500 font-mono">SubnetRegistryV2.registerMiner(subnetId)</div>
          </div>
        </div>
        <button onClick={checkRegistration} disabled={checking} className="text-slate-600 hover:text-neon-cyan transition-colors">
          <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1.5">Subnet ID</label>
            <input type="number" min={0} value={subnetId}
              onChange={e => setSubnetId(Number(e.target.value))}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:border-neon-yellow/50 outline-none" />
          </div>
          <div className="pt-5">
            {checking ? (
              <div className="text-[10px] text-slate-500 font-mono">Checking...</div>
            ) : isRegistered === true ? (
              <div className="flex items-center gap-1.5 text-neon-green text-[10px] font-bold"><CheckCircle size={12} /> Registered</div>
            ) : isRegistered === false ? (
              <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold"><AlertCircle size={12} /> Not registered</div>
            ) : null}
          </div>
        </div>

        {isRegistered === false && (
          <button onClick={registerMiner} disabled={registering}
            className="w-full py-3 bg-neon-yellow/10 hover:bg-neon-yellow/20 border border-neon-yellow/40 text-neon-yellow font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            <UserPlus size={12} />
            {registering ? 'Registering...' : `Register in Subnet ${subnetId} via ${walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}`}
          </button>
        )}

        {txStep && (
          <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl text-[10px] font-mono text-neon-cyan">{txStep}</div>
        )}
        {txError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-mono text-red-400 flex items-start gap-2">
            <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
            {txError}
          </div>
        )}
        {txHash && (
          <a href={hashscanUrl(txHash)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-neon-cyan text-[10px] font-bold hover:underline">
            <ExternalLink size={10} /> View TX on HashScan
          </a>
        )}

        <div className="text-[9px] text-slate-600 font-mono">
          Must be staked as Miner in StakingVaultV2 before registering in subnet
        </div>
      </div>
    </div>
  );
}

// ── Submit Result Panel ───────────────────────────────────────────────────────
function SubmitResultPanel({ accountId, evmAddress, subnetIds }: { accountId: string; evmAddress: string; subnetIds: number[] | null }) {
  const { type: walletType, hashConnect } = useWallet();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [resultHash, setResultHash] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadTasks = useCallback(async () => {
    if (subnetIds === null) return;
    setLoadingTasks(true);
    try {
      const res = await fetch('/api/hcs/tasks');
      const d = await res.json();
      if (!d.success) return;
      const all: any[] = d.data || [];
      const filtered = subnetIds.length > 0
        ? all.filter(t => subnetIds.includes(Number(t.subnetId ?? t.subnet_id ?? 0)))
        : all;

      // For on-chain tasks: check if this miner already submitted
      // Filter out tasks where miner already submitted (on-chain hasMinerSubmitted)
      if (evmAddress) {
        const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, provider);

        const withStatus = await Promise.all(filtered.slice(0, 15).map(async (t) => {
          const onChainId = t.onChainTaskId ?? t.on_chain_task_id ?? null;
          if (!onChainId) return t; // HCS-only: always show
          try {
            // Check task status — if Completed/Cancelled/Expired, hide
            const task = await registry.getTask(onChainId);
            const status = Number(task.status);
            if (status >= 3) return null; // Completed/Cancelled/Expired — hide

            // Check if this miner already submitted
            const subs = await registry.getSubmissions(onChainId);
            const alreadySubmitted = subs.some(
              (s: any) => s.miner?.toLowerCase() === evmAddress.toLowerCase()
            );
            if (alreadySubmitted) return null; // Already submitted — hide
            return t;
          } catch (_) { return t; }
        }));

        setTasks(withStatus.filter(Boolean) as any[]);
      } else {
        setTasks(filtered.slice(0, 10));
      }
    } catch (_) {}
    finally { setLoadingTasks(false); }
  }, [subnetIds?.join(','), evmAddress]); // eslint-disable-line

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const submitResult = async (task: any) => {
    const taskId = String(task.taskId || task.task_id || '');
    const hash = resultHash[taskId]?.trim();
    if (!hash) { setErrors(e => ({ ...e, [taskId]: 'Enter a result hash (IPFS CID or hash string)' })); return; }
    setSubmitting(s => ({ ...s, [taskId]: true })); setErrors(e => ({ ...e, [taskId]: '' }));
    try {
      const onChainTaskId = task.onChainTaskId ?? task.on_chain_task_id ?? null;

      // HCS-only task (HashPack requester flow) — skip on-chain call, submit via HCS
      if (!onChainTaskId) {
        const res = await fetch('/api/hcs/results/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, minerId: accountId, resultHash: hash }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'HCS submit failed');
        setSubmitted(s => ({ ...s, [taskId]: `hcs-seq-${data.sequence ?? 'ok'}` }));
        return;
      }

      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, signer);
        const tx = await registry.submitResult(onChainTaskId, hash, { gasLimit: 300000 });
        const receipt = await tx.wait();
        setSubmitted(s => ({ ...s, [taskId]: receipt.hash }));
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.SUBNET_REGISTRY_ID);
        const params = new ContractFunctionParameters()
          .addUint256(Long.fromString(String(onChainTaskId)))
          .addString(hash);
        const receipt = await hashConnect.sendTransaction(hederaId,
          new ContractExecuteTransaction().setContractId(contractId).setGas(300000).setFunction('submitResult', params));
        setSubmitted(s => ({ ...s, [taskId]: String(receipt.transactionId || 'submitted') }));
      }

      // After on-chain submit — write result_submit to HCS so task disappears from feed
      await fetch('/api/hcs/results/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, minerId: accountId, resultHash: hash }),
      }).catch(() => {}); // non-blocking — don't fail if HCS write fails

    } catch (e: any) { setErrors(er => ({ ...er, [taskId]: e.reason || e.message || 'Submit failed' })); }
    finally {
      setSubmitting(s => ({ ...s, [taskId]: false }));
      setTimeout(() => loadTasks(), 3000);
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-neon-pink/20 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-pink/10 border border-neon-pink/20 flex items-center justify-center"><Send size={14} className="text-neon-pink" /></div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Submit Results</div>
            <div className="text-[9px] text-slate-500 font-mono">SubnetRegistryV2.submitResult(taskId, resultHash)</div>
          </div>
        </div>
        <span className="text-[9px] font-bold text-neon-pink border border-neon-pink/30 bg-neon-pink/5 px-2 py-1 rounded-full uppercase tracking-widest">{tasks.length} tasks</span>
      </div>
      <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
        {loadingTasks || subnetIds === null ? (
          <div className="py-8 text-center text-slate-600 text-xs font-mono">{subnetIds === null ? 'Loading your subnets...' : 'Loading tasks...'}</div>
        ) : tasks.length === 0 ? (
          <div className="py-10 text-center"><Send size={24} className="text-slate-700 mx-auto mb-2" /><div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No tasks to submit</div></div>
        ) : tasks.map((task, i) => {
          const taskId = String(task.taskId || task.task_id || i);
          const isDone = !!submitted[taskId];
          const isHcsOnly = !task.onChainTaskId && !task.on_chain_task_id;
          return (
            <div key={i} className="px-5 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black text-neon-pink border border-neon-pink/30 bg-neon-pink/5 px-2 py-0.5 rounded uppercase tracking-widest">{task.taskType || 'TASK'}</span>
                    <span className="text-[9px] text-slate-600 font-mono">Subnet {task.subnetId ?? 0}</span>
                    {isHcsOnly
                      ? <span className="text-[9px] text-yellow-400/70 font-mono border border-yellow-400/20 px-1.5 py-0.5 rounded">HCS-only</span>
                      : <span className="text-[9px] text-neon-purple/70 font-mono">On-chain #{task.onChainTaskId}</span>
                    }
                  </div>
                  <div className="text-xs text-slate-300 line-clamp-2 font-mono leading-relaxed">{task.prompt || task.taskHash || taskId}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-neon-green font-black text-sm">+{Number(task.rewardAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                  <div className="text-[9px] text-slate-500">MDT</div>
                </div>
              </div>
              {isDone ? (
                <div className="flex items-center gap-2 text-neon-green text-[10px] font-bold">
                  <CheckCircle size={12} /> Submitted
                  {hashscanUrl(submitted[taskId]) && (
                    <a href={hashscanUrl(submitted[taskId])} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-neon-cyan hover:underline ml-1">
                      <ExternalLink size={9} /> HashScan
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" placeholder="Result hash (IPFS CID or hash)" value={resultHash[taskId] || ''}
                    onChange={e => setResultHash(r => ({ ...r, [taskId]: e.target.value }))}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-neon-pink/40 outline-none" />
                  <button onClick={() => submitResult(task)} disabled={submitting[taskId]}
                    className="px-4 py-2 bg-neon-pink/10 hover:bg-neon-pink/20 border border-neon-pink/40 text-neon-pink font-black text-[10px] uppercase tracking-widest rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
                    <Send size={10} /> {submitting[taskId] ? 'Submitting...' : isHcsOnly ? 'Submit (HCS)' : 'Submit'}
                  </button>
                </div>
              )}
              {errors[taskId] && <div className="text-[10px] text-red-400 font-mono">✗ {errors[taskId]}</div>}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-white/5 bg-black/20 text-[10px] text-slate-600 font-mono">resultHash = IPFS CID or any hash of your AI result</div>
    </div>
  );
}

function TaskFeedPanel({ accountId, subnetIds }: { accountId: string; subnetIds: number[] | null }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const subnetKey = subnetIds === null ? '__loading__' : subnetIds.join(',');

  useEffect(() => {
    // Don't fetch until we know which subnets this miner belongs to
    if (subnetIds === null) return;
    const mySubnets = subnetIds; // narrowed — not null inside closure

    setLoading(true);
    setTasks([]);

    async function load() {
      try {
        const res = await fetch('/api/hcs/tasks');
        const json = await res.json();
        if (json.success) {
          const all: any[] = json.data || [];
          // API already filters completed/scored tasks — just filter by subnet
          const filtered = mySubnets.length > 0
            ? all.filter(t => mySubnets.includes(Number(t.subnetId ?? t.subnet_id ?? 0)))
            : all;
          setTasks(filtered);
        }
      } catch (_) {}
      finally { setLoading(false); }
    }

    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [subnetKey]);

  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
            <Zap size={14} className="text-neon-green" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Available Tasks</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">
              HCS Topic 0.0.8198585
              {subnetIds === null
                ? ' · Loading subnets...'
                : subnetIds.length > 0
                ? ` · Subnet${subnetIds.length > 1 ? 's' : ''} ${subnetIds.join(', ')}`
                : ' · All Subnets'}
            </div>
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
            <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No tasks for your subnets</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">
              {subnetIds === null
                ? 'Loading your subnets...'
                : subnetIds.length > 0
                ? `Watching subnet${subnetIds.length > 1 ? 's' : ''} ${subnetIds.join(', ')}`
                : 'Tasks will appear here when posted to HCS'}
            </div>
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
                <div className="text-neon-green font-black text-sm">+{Number(task.rewardAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest">MDT</div>
                {task.consensusTimestamp && (
                  <a href={hashscanUrl(task.consensusTimestamp)}
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

// ── Miner Results Panel — on-chain task outcomes ──────────────────────────────
function MinerResultsPanel({ evmAddress, accountId }: { evmAddress: string; accountId: string }) {
  const [results, setResults] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, provider);
      const earned = await registry.minerEarnings(evmAddress);
      setTotalEarned(Number(earned) / 1e8);

      const [taskRes, scoreRes] = await Promise.all([
        fetch('/api/hcs/tasks').then(r => r.json()),
        fetch('/api/hcs/scores').then(r => r.json()),
      ]);
      const allTasks: any[] = taskRes.success ? (taskRes.data || []) : [];
      const allScores: any[] = scoreRes.success ? (scoreRes.data || []) : [];

      // Build map: taskId → latest HCS score message
      const scoreMap: Record<string, any> = {};
      for (const sc of allScores) {
        const tid = String(sc.taskId || sc.task_id || '');
        if (!tid) continue;
        if (!scoreMap[tid] || (sc.sequenceNumber ?? 0) > (scoreMap[tid].sequenceNumber ?? 0)) {
          scoreMap[tid] = sc;
        }
      }

      const withId = allTasks.filter(t => t.onChainTaskId != null && t.onChainTaskId !== '');
      const enriched = await Promise.all(withId.slice(0, 15).map(async (t) => {
        try {
          const task = await registry.getTask(t.onChainTaskId);
          const status = Number(task.status);
          const winningMiner = task.winningMiner?.toLowerCase();
          const isWinner = winningMiner === evmAddress.toLowerCase();
          const hcsScore = scoreMap[String(t.taskId || t.onChainTaskId)];
          return {
            ...t, status,
            winningMiner: task.winningMiner,
            winningScore: Number(task.winningScore),
            rewardAmount: Number(task.rewardAmount) / 1e8,
            isWinner,
            hcsScoreTs: hcsScore?.consensusTimestamp || null,
            hcsScore: hcsScore ? (() => { const r = Number(hcsScore.score ?? 0); return r > 1 ? r : r * 100; })() : null,
            hcsMetrics: hcsScore?.metrics ?? null,
          };
        } catch (_) { return { ...t, status: 0 }; }
      }));

      setResults(enriched.filter(t => t.status === 3 || t.status === 2));
    } catch (_) {}
    finally { setLoading(false); }
  }, [evmAddress]);

  useEffect(() => { load(); }, [load]);

  const STATUS_LABELS = ['Created', 'In Progress', 'Pending Review', 'Completed', 'Cancelled', 'Expired'];

  return (
    <div className="glass-panel rounded-2xl border border-neon-cyan/20 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center">
            <Award size={14} className="text-neon-cyan" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Task Results</div>
            <div className="text-[9px] text-slate-500 font-mono">On-chain scores · winner status · earnings</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalEarned !== null && totalEarned > 0 && (
            <span className="text-[9px] font-bold text-neon-green border border-neon-green/30 bg-neon-green/5 px-2 py-1 rounded-full">
              {totalEarned.toFixed(4)} MDT earned
            </span>
          )}
          <button onClick={load} className="text-slate-600 hover:text-neon-cyan transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-slate-600 text-xs font-mono">Loading task results...</div>
        ) : results.length === 0 ? (
          <div className="py-10 text-center">
            <Award size={24} className="text-slate-700 mx-auto mb-2" />
            <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No completed tasks yet</div>
            <div className="text-slate-700 text-[10px] mt-1">Submit results to tasks to appear here</div>
          </div>
        ) : results.map((t, i) => {
          const isCompleted = t.status === 3;
          const scorePct = isCompleted && t.winningScore ? (t.winningScore / 100).toFixed(0) : null;
          return (
            <div key={i} className={`px-5 py-4 space-y-2 ${t.isWinner ? 'bg-neon-green/[0.03]' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isCompleted ? (t.isWinner ? 'text-neon-green border-neon-green/30 bg-neon-green/5' : 'text-slate-400 border-white/10') : 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5'}`}>
                      {t.isWinner ? '🏆 WON' : STATUS_LABELS[t.status ?? 0]}
                    </span>
                    <span className="text-[9px] text-neon-purple font-mono">#{t.onChainTaskId}</span>
                  </div>
                  <div className="text-xs text-slate-300 line-clamp-1 font-mono">{t.prompt || t.taskHash || t.taskId}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-black text-sm ${t.isWinner ? 'text-neon-green' : 'text-slate-400'}`}>
                    {t.isWinner ? `+${(t.rewardAmount ?? 0).toLocaleString()}` : (t.rewardAmount ?? 0).toLocaleString()} MDT
                  </div>
                  {scorePct && <div className="text-[9px] text-neon-cyan font-mono">Score: {scorePct}%</div>}
                </div>
              </div>
              {isCompleted && scorePct && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${t.isWinner ? 'bg-neon-green' : 'bg-slate-600'}`}
                      style={{ width: `${scorePct}%` }} />
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono">{scorePct}% consensus</span>
                </div>
              )}
              {/* HCS score message link + metrics breakdown */}
              {t.hcsScoreTs && (
                <div className="space-y-1 pt-1 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <a href={`https://hashscan.io/testnet/transaction/${t.hcsScoreTs}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-neon-purple text-[10px] font-bold hover:underline">
                      <ExternalLink size={9} /> HCS Score Message
                    </a>
                    {t.hcsScore !== null && (
                      <span className="text-[9px] text-slate-400 font-mono">· {t.hcsScore.toFixed(1)}%</span>
                    )}
                  </div>
                  {t.hcsMetrics && Object.keys(t.hcsMetrics).length > 0 && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-3">
                      {Object.entries(t.hcsMetrics).map(([k, v]) => {
                        const vp = Number(v ?? 0); const vPct = vp > 1 ? vp : vp * 100;
                        return (
                          <div key={k} className="flex items-center justify-between">
                            <span className="text-[9px] text-slate-600 capitalize">{k}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{vPct.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-white/5 bg-black/20 text-[9px] text-slate-600 font-mono">
        Score = median of validator scores · 85% of reward goes to winning miner
      </div>
    </div>
  );
}

// ── Score History Panel ───────────────────────────────────────────────────────
// Shows scores that validators gave to THIS miner's submissions
// Cross-references: HCS scores topic (by taskId) + on-chain submissions (by miner EVM address)
function ScoreHistoryPanel({ accountId, evmAddress }: { accountId: string; evmAddress: string }) {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: get all HCS scores
      const scRes = await fetch('/api/hcs/scores');
      const scData = await scRes.json();
      if (!scData.success) return;
      const allScores: any[] = scData.data || [];

      // Step 2: get all HCS tasks to find taskIds that belong to this miner
      // A task "belongs" to this miner if they submitted a result for it
      // We match by: miner_id (Hedera account) OR evmAddress in on-chain submissions
      const taskRes = await fetch('/api/hcs/tasks');
      const taskData = await taskRes.json();
      const allTasks: any[] = taskData.success ? (taskData.data || []) : [];

      // Collect taskIds where this miner submitted (on-chain check for tasks with onChainTaskId)
      const myTaskIds = new Set<string>();

      // Check on-chain submissions for tasks with onChainTaskId
      if (evmAddress) {
        const { ethers } = await import('ethers');
        const { CONTRACTS, SUBNET_REGISTRY_ABI } = await import('@/lib/contracts');
        const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, provider);

        await Promise.all(
          allTasks
            .filter(t => t.onChainTaskId != null && t.onChainTaskId !== '')
            .slice(0, 20)
            .map(async (t) => {
              try {
                const subs = await registry.getSubmissions(t.onChainTaskId);
                const mySubmission = subs.find(
                  (s: any) => s.miner?.toLowerCase() === evmAddress.toLowerCase()
                );
                if (mySubmission) myTaskIds.add(String(t.taskId || t.onChainTaskId));
              } catch (_) {}
            })
        );
      }

      // Also match HCS-only scores by miner_id field (legacy/HCS-only tasks)
      // miner_id in score message can be accountId OR a custom miner ID
      const myScores = allScores.filter(s => {
        const mid = s.minerId || s.miner_id || '';
        // Direct match by accountId
        if (mid === accountId) return true;
        // Match by taskId cross-reference (on-chain submissions)
        const tid = String(s.taskId || s.task_id || '');
        if (tid && myTaskIds.has(tid)) return true;
        return false;
      });

      // Normalize score to 0-100 scale
      const normalized = myScores.map(s => {
        const raw = Number(s.score ?? 0);
        // HCS scores can be 0-100 (Python SDK) or 0-1 (normalized)
        const score100 = raw > 1 ? raw : raw * 100;
        return { ...s, score100 };
      });

      setScores(normalized.sort((a, b) => (b.sequenceNumber ?? 0) - (a.sequenceNumber ?? 0)));
    } catch (_) {}
    finally { setLoading(false); }
  }, [accountId, evmAddress]);

  useEffect(() => { load(); }, [load]);

  const avgScore = scores.length > 0
    ? scores.reduce((a, s) => a + (s.score100 ?? 0), 0) / scores.length
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
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">HCS Topic 0.0.8198584 · validator scores for your submissions</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {avgScore !== null && (
            <div className="text-right">
              <div className={`text-neon-cyan font-black text-lg ${avgScore >= 80 ? 'text-neon-green' : avgScore >= 60 ? 'text-neon-cyan' : 'text-yellow-400'}`}>
                {avgScore.toFixed(1)}%
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-widest">Avg Score</div>
            </div>
          )}
          <button onClick={load} className="text-slate-600 hover:text-neon-cyan transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-slate-600 text-xs font-mono">Loading scores from HCS...</div>
        ) : scores.length === 0 ? (
          <div className="py-10 text-center">
            <Award size={24} className="text-slate-700 mx-auto mb-2" />
            <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No scores yet</div>
            <div className="text-slate-700 text-[10px] mt-1">Submit task results — validators will score them</div>
          </div>
        ) : scores.map((s, i) => {
          const score = s.score100 ?? 0;
          const scoreColor = score >= 80 ? 'text-neon-green' : score >= 60 ? 'text-neon-cyan' : 'text-yellow-400';
          const barColor = score >= 80 ? 'bg-neon-green' : score >= 60 ? 'bg-neon-cyan' : 'bg-yellow-400';
          const metrics = s.metrics ?? {};
          const hasMetrics = Object.keys(metrics).length > 0;
          const scColor = score >= 80 ? 'text-neon-green' : score >= 60 ? 'text-neon-cyan' : 'text-yellow-400';
          return (
            <div key={i} className="px-6 py-4 hover:bg-white/[0.02] transition-colors space-y-2">
              <div className="flex items-center justify-between gap-3 overflow-hidden">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono text-white truncate">Task: {s.taskId || s.task_id}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5 font-mono">
                    Validator: <span className="text-slate-300">{s.validatorId || s.validator_id || '—'}</span>
                    {s.confidence != null && <span className="ml-2 text-slate-600">· conf {(Number(s.confidence) * 100).toFixed(0)}%</span>}
                    {s.consensusTimestamp && <span className="ml-2 text-slate-600">· {toUTC7(s.consensusTimestamp)}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-black text-xl ${scoreColor}`}>{score.toFixed(1)}%</div>
                  <div className="flex items-center gap-1.5 justify-end mt-0.5">
                    {s.consensusTimestamp && (
                      <a href={hashscanUrl(s.consensusTimestamp)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-neon-cyan/60 hover:text-neon-cyan text-[8px] font-bold">
                        <ExternalLink size={7} /> HCS
                      </a>
                    )}
                    {s.hcs_sequence && (
                      <a href={hashscanUrl(s.hcs_sequence, true, '0.0.8198584')} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-neon-purple/60 hover:text-neon-purple text-[8px] font-bold">
                        <Shield size={7} /> Verify
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
              </div>

              {/* Metrics breakdown */}
              {hasMetrics && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                  {Object.entries(metrics).map(([key, val]) => {
                    const v = Number(val ?? 0);
                    const vPct = v > 1 ? v : v * 100;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 capitalize">{key}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-0.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-neon-cyan/60 rounded-full" style={{ width: `${vPct}%` }} />
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono w-8 text-right">{vPct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-white/5 bg-black/20 text-[9px] text-slate-600 font-mono">
        Scores written to HCS by validators · immutable on Hedera blockchain
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

  // Gate: must have confirmed on-chain stake to access dashboard
  // stakeInfo is loaded via useEffect above — show loading then block if not staked
  if (!loading && stakeInfo !== null && !stakeInfo.isActive) {
    return (
      <div className="flex justify-center items-center py-24 px-4">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center mx-auto">
            <Lock size={28} className="text-yellow-400" />
          </div>
          <div>
            <div className="text-white font-black text-lg uppercase tracking-wider">Stake Required</div>
            <div className="text-slate-400 text-sm mt-2 leading-relaxed">
              You need to stake MDT on-chain to access the Miner Dashboard.
            </div>
          </div>
          <div className="p-4 bg-black/40 border border-white/10 rounded-xl text-[11px] font-mono text-slate-400 space-y-1 text-left">
            <div className="text-slate-500 uppercase tracking-widest text-[9px] mb-2">Requirements</div>
            <div>· Minimum <span className="text-neon-cyan font-bold">10 MDT</span> staked on StakingVaultV2</div>
            <div>· Role: <span className="text-neon-cyan font-bold">Miner (role=1)</span></div>
            <div>· Contract: <span className="text-slate-300">0x99968cF6...718f</span></div>
          </div>
          <button onClick={onBack}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-neon-cyan/10 border border-neon-cyan/40 text-neon-cyan font-black text-xs uppercase tracking-widest rounded-xl hover:bg-neon-cyan/20 transition-all">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Go Register as Miner
          </button>
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
            <TaskFeedPanel accountId={accountId} subnetIds={loading ? null : subnets} />
            <SubmitResultPanel accountId={accountId} evmAddress={evmAddress || ''} subnetIds={loading ? null : subnets} />
            <MinerResultsPanel evmAddress={evmAddress || ''} accountId={accountId} />
            <WithdrawEarningsPanel evmAddress={evmAddress || ''} accountId={accountId} />
            <ScoreHistoryPanel accountId={accountId} evmAddress={evmAddress || ''} />
            <StakeHistoryPanel accountId={accountId} evmAddress={evmAddress || ''} />
          </div>

          {/* Right: On-chain staking + Registration (1/3 width) */}
          <div className="flex flex-col gap-6">
            <OnChainStakingPanel evmAddress={evmAddress || ''} accountId={accountId} />
            <RegisterMinerPanel evmAddress={evmAddress || ''} accountId={accountId} />

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
                  <a href={hashscanUrl(myRegistration.consensusTimestamp)}
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
                { step: '1', label: 'Stake MDT', desc: 'StakingVaultV2.stake(10+ MDT, Miner)', color: 'neon-cyan' },
                { step: '2', label: 'Register Subnet', desc: 'SubnetRegistryV2.registerMiner(subnetId)', color: 'neon-purple' },
                { step: '3', label: 'Receive Tasks', desc: 'Monitor HCS topic 0.0.8198585', color: 'neon-green' },
                { step: '4', label: 'Submit Results', desc: 'SubnetRegistryV2.submitResult(taskId, hash)', color: 'neon-pink' },
                { step: '5', label: 'Claim Rewards', desc: 'SubnetRegistryV2.withdrawEarnings()', color: 'neon-yellow' },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3 p-3 rounded-xl border bg-white/[0.02] border-white/5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black bg-${s.color}/10 text-${s.color} border border-${s.color}/30`}>
                    {s.step}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white">{s.label}</div>
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
