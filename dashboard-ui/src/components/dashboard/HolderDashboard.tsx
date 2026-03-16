"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { AccountId, ContractExecuteTransaction, ContractId } from '@hashgraph/sdk';
import { useWallet } from '@/context/WalletContext';
import { CONTRACTS, STAKING_VAULT_ABI } from '@/lib/contracts';
import { ExternalLink, RefreshCw, TrendingUp, Lock, Unlock, Gift, AlertCircle, CheckCircle } from 'lucide-react';

function hashscanUrl(txId: string): string {
  if (!txId) return '';
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

function unstakeCountdown(unstakeRequestedAt: number): string {
  const COOLDOWN = 7 * 24 * 3600;
  const unlockAt = unstakeRequestedAt + COOLDOWN;
  const now = Math.floor(Date.now() / 1000);
  const remaining = unlockAt - now;
  if (remaining <= 0) return 'Ready to withdraw';
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return `${d}d ${h}h ${m}m remaining`;
}

interface Props { onBack: () => void; }

export default function HolderDashboard({ onBack }: Props) {
  const { accountId, address: evmAddress, isConnected, type: walletType, hashConnect } = useWallet();
  const [stakeInfo, setStakeInfo] = useState<any>(null);
  const [pendingRewards, setPendingRewards] = useState(0);
  const [poolStats, setPoolStats] = useState<any>(null);
  const [mdtBalance, setMdtBalance] = useState<number | null>(null);
  const [hbarBalance, setHbarBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [txStep, setTxStep] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [, tick] = useState(0);

  const loadData = useCallback(async () => {
    if (!evmAddress || !accountId) return;
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, provider);

      const [info, rewards, poolRaw] = await Promise.all([
        vault.getStakeInfo(evmAddress),
        vault.pendingRewards(evmAddress),
        vault.getPoolStats().catch(() => null),
      ]);

      setStakeInfo({
        amount: Number(info.amount) / 1e8,
        role: Number(info.role),
        stakedAt: Number(info.stakedAt),
        unstakeRequestedAt: Number(info.unstakeRequestedAt),
        isActive: info.isActive,
      });
      setPendingRewards(Number(rewards) / 1e8);

      if (poolRaw) {
        setPoolStats({
          totalStaked: Number(poolRaw._totalStaked) / 1e8,
          activeMinerCount: Number(poolRaw._activeMinerCount),
          activeValidatorCount: Number(poolRaw._activeValidatorCount),
          activeHolderCount: Number(poolRaw._activeHolderCount),
          totalRewardsDeposited: Number(poolRaw._totalRewardsDeposited) / 1e8,
          totalRewardsClaimed: Number(poolRaw._totalRewardsClaimed) / 1e8,
        });
      }

      // Fetch MDT + HBAR balance
      const balRes = await fetch(`/api/mdt-balance?accountId=${accountId}`);
      const balData = await balRes.json();
      if (balRes.ok) {
        setMdtBalance(balData.mdtBalance);
        setHbarBalance(balData.hbarBalance);
      }
    } catch (e: any) {
      console.warn('HolderDashboard loadData:', e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, evmAddress]);

  useEffect(() => { loadData(); const t = setInterval(loadData, 30000); return () => clearInterval(t); }, [loadData]);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(t); }, []);

  const claimRewards = async () => {
    setTxStep('Claiming rewards...'); setTxError(null); setTxHash(null);
    try {
      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, signer);
        const tx = await vault.claimRewards({ gasLimit: 200000 });
        const receipt = await tx.wait();
        setTxHash(receipt.hash);
        setTxStep(`✓ Claimed ${pendingRewards.toFixed(4)} MDT`);
        setPendingRewards(0);
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.STAKING_VAULT_ID);
        const receipt = await hashConnect.sendTransaction(hederaId as any,
          new ContractExecuteTransaction().setContractId(contractId).setGas(200000).setFunction('claimRewards') as any);
        setTxHash(String((receipt as any).transactionId || ''));
        setTxStep(`✓ Claimed ${pendingRewards.toFixed(4)} MDT`);
        setPendingRewards(0);
      }
      await loadData();
    } catch (e: any) { setTxError(e.message); setTxStep(null); }
  };

  const requestUnstake = async () => {
    setTxStep('Requesting unstake...'); setTxError(null); setTxHash(null);
    try {
      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, signer);
        const tx = await vault.requestUnstake({ gasLimit: 200000 });
        const receipt = await tx.wait();
        setTxHash(receipt.hash);
        setTxStep('✓ Unstake requested — 7-day cooldown started');
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.STAKING_VAULT_ID);
        const receipt = await hashConnect.sendTransaction(hederaId as any,
          new ContractExecuteTransaction().setContractId(contractId).setGas(200000).setFunction('requestUnstake') as any);
        setTxHash(String((receipt as any).transactionId || ''));
        setTxStep('✓ Unstake requested — 7-day cooldown started');
      }
      await loadData();
    } catch (e: any) { setTxError(e.message); setTxStep(null); }
  };

  const withdraw = async () => {
    setTxStep('Withdrawing stake...'); setTxError(null); setTxHash(null);
    try {
      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, signer);
        const tx = await vault.withdraw({ gasLimit: 200000 });
        const receipt = await tx.wait();
        setTxHash(receipt.hash);
        setTxStep(`✓ Withdrawn ${stakeInfo?.amount?.toFixed(2)} MDT`);
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.STAKING_VAULT_ID);
        const receipt = await hashConnect.sendTransaction(hederaId as any,
          new ContractExecuteTransaction().setContractId(contractId).setGas(200000).setFunction('withdraw') as any);
        setTxHash(String((receipt as any).transactionId || ''));
        setTxStep(`✓ Withdrawn ${stakeInfo?.amount?.toFixed(2)} MDT`);
      }
      await loadData();
    } catch (e: any) { setTxError(e.message); setTxStep(null); }
  };

  const isStaked = stakeInfo?.isActive && stakeInfo?.role === 3;
  const hasUnstakeRequest = stakeInfo && stakeInfo.unstakeRequestedAt > 0;
  const canWithdraw = hasUnstakeRequest &&
    Math.floor(Date.now() / 1000) >= stakeInfo!.unstakeRequestedAt + 7 * 24 * 3600;

  // Pool share %
  const poolShare = poolStats && poolStats.totalStaked > 0 && stakeInfo?.amount
    ? (stakeInfo.amount / poolStats.totalStaked) * 100
    : 0;

  return (
    <div className="flex flex-col gap-6 py-8 px-6 lg:px-8 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span> Back
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
            <span className="text-neon-green">Holder</span> Dashboard
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isStaked ? 'bg-neon-green animate-pulse' : 'bg-slate-600'}`} />
            {loading ? 'Loading...' : isStaked ? 'Staked · Earning Passive Rewards' : 'Not staked as Holder'}
            {walletType && <span className="text-slate-600">· via {walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}</span>}
          </p>
        </div>
        <button onClick={loadData} className="text-slate-500 hover:text-neon-green transition-colors p-2">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Staked Amount',
            value: isStaked ? `${stakeInfo.amount.toFixed(2)} MDT` : '—',
            sub: isStaked ? `Since ${toUTC7(stakeInfo.stakedAt)}` : 'Not staked',
            icon: 'lock',
            color: 'neon-green',
          },
          {
            label: 'Pending Rewards',
            value: `${pendingRewards.toFixed(4)} MDT`,
            sub: pendingRewards > 0 ? 'Ready to claim' : 'No rewards yet',
            icon: 'redeem',
            color: 'neon-cyan',
          },
          {
            label: 'Pool Share',
            value: poolShare > 0 ? `${poolShare.toFixed(4)}%` : '—',
            sub: poolStats ? `of ${poolStats.totalStaked.toFixed(0)} MDT total` : 'Loading...',
            icon: 'pie_chart',
            color: 'neon-purple',
          },
          {
            label: 'Wallet Balance',
            value: mdtBalance !== null ? `${mdtBalance.toFixed(2)} MDT` : '—',
            sub: hbarBalance !== null ? `${hbarBalance.toFixed(4)} HBAR` : accountId || '—',
            icon: 'account_balance_wallet',
            color: 'yellow-400',
          },
        ].map((s, i) => (
          <div key={i} className="glass-panel p-4 border border-white/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-${s.color} text-base`}>{s.icon}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</span>
            </div>
            <div className={`text-lg font-black font-mono text-${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-slate-500 font-mono mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Pool stats */}
      {poolStats && (
        <div className="glass-panel p-5 border border-neon-green/10 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <TrendingUp size={12} className="text-neon-green" /> Network Pool Stats
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            {[
              { label: 'Total Staked', value: `${poolStats.totalStaked.toFixed(0)} MDT` },
              { label: 'Active Holders', value: poolStats.activeHolderCount },
              { label: 'Rewards Deposited', value: `${poolStats.totalRewardsDeposited.toFixed(2)} MDT` },
              { label: 'Rewards Claimed', value: `${poolStats.totalRewardsClaimed.toFixed(2)} MDT` },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{s.label}</div>
                <div className="text-sm font-black text-white font-mono mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stake info + actions */}
      <div className="glass-panel p-6 border border-neon-green/20 rounded-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
            <Lock size={14} className="text-neon-green" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Stake Management</div>
            <div className="text-[11px] text-slate-400 font-mono">StakingVaultV2 · {CONTRACTS.STAKING_VAULT.slice(0, 10)}...</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-6 text-slate-500 text-xs font-mono">Loading on-chain data...</div>
        ) : !isStaked ? (
          <div className="p-4 bg-yellow-400/5 border border-yellow-400/20 rounded-xl text-[11px] text-yellow-400 space-y-1">
            <div className="font-black uppercase tracking-widest text-xs">Not staked as Holder</div>
            <div>Your wallet is connected but no active Holder stake was found on StakingVaultV2.</div>
            <div className="text-slate-500 mt-1">Role detected: {stakeInfo ? `role=${stakeInfo.role}, active=${stakeInfo.isActive}` : 'no stake info'}</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stake details */}
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                <div className="text-slate-500 text-[9px] uppercase tracking-widest">Staked</div>
                <div className="text-neon-green font-black text-base">{stakeInfo.amount.toFixed(2)} MDT</div>
                <div className="text-slate-400 text-[10px]">Role: Holder (3)</div>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                <div className="text-slate-500 text-[9px] uppercase tracking-widest">Staked Since</div>
                <div className="text-white text-[11px]">{toUTC7(stakeInfo.stakedAt)}</div>
                {hasUnstakeRequest && (
                  <div className="text-yellow-400 text-[10px]">{unstakeCountdown(stakeInfo.unstakeRequestedAt)}</div>
                )}
              </div>
            </div>

            {/* Pending rewards */}
            {pendingRewards > 0 && (
              <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Pending Rewards</div>
                  <div className="text-neon-cyan font-black text-lg font-mono">{pendingRewards.toFixed(4)} MDT</div>
                </div>
                <button onClick={claimRewards} disabled={!!txStep}
                  className="px-4 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center gap-2">
                  <Gift size={12} /> Claim
                </button>
              </div>
            )}

            {/* Unstake / Withdraw */}
            <div className="flex gap-3">
              {!hasUnstakeRequest && (
                <button onClick={requestUnstake} disabled={!!txStep}
                  className="flex-1 py-2.5 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  <Unlock size={12} /> Request Unstake
                </button>
              )}
              {canWithdraw && (
                <button onClick={withdraw} disabled={!!txStep}
                  className="flex-1 py-2.5 bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/40 text-neon-green font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  <Unlock size={12} /> Withdraw Stake
                </button>
              )}
              {hasUnstakeRequest && !canWithdraw && (
                <div className="flex-1 p-3 bg-yellow-400/5 border border-yellow-400/20 rounded-xl text-[10px] text-yellow-400 font-mono text-center">
                  {unstakeCountdown(stakeInfo.unstakeRequestedAt)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TX feedback */}
        {txStep && (
          <div className={`p-3 rounded-xl border text-[11px] font-mono flex items-center gap-2 ${txStep.startsWith('✓') ? 'bg-neon-green/5 border-neon-green/20 text-neon-green' : 'bg-neon-cyan/5 border-neon-cyan/20 text-neon-cyan'}`}>
            {txStep.startsWith('✓') ? <CheckCircle size={12} /> : <RefreshCw size={12} className="animate-spin" />}
            {txStep}
            {txHash && (
              <a href={hashscanUrl(txHash)} target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-neon-cyan hover:underline">
                <ExternalLink size={10} /> HashScan
              </a>
            )}
          </div>
        )}
        {txError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-mono text-red-400 flex items-start gap-2">
            <AlertCircle size={10} className="mt-0.5 flex-shrink-0" /> {txError}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="glass-panel p-4 border border-neon-green/10 rounded-2xl text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
        <div className="text-neon-green font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">info</span> Holder Role Info
        </div>
        <div>Holders earn <span className="text-white font-bold">5% of all network task rewards</span> distributed pro-rata by stake weight.</div>
        <div>Rewards are deposited by the protocol owner after each reward cycle and claimable on-chain via <code className="text-neon-cyan">StakingVaultV2.claimRewards()</code>.</div>
        <div>Unstaking requires a <span className="text-yellow-400 font-bold">7-day cooldown</span> before withdrawal.</div>
        <div className="text-slate-600 text-[9px] font-mono pt-1">
          StakingVaultV2: <a href={`https://hashscan.io/testnet/contract/${CONTRACTS.STAKING_VAULT_ID}`} target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">{CONTRACTS.STAKING_VAULT_ID}</a>
        </div>
      </div>
    </div>
  );
}
