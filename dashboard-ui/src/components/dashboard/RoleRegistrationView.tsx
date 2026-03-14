"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/context/WalletContext';
import { ViewState } from '@/types';

interface Props {
  onBack: () => void;
  onViewChange: (v: ViewState) => void;
  defaultRole?: 'miner' | 'holder';
  onRegistered?: () => void;
}

const CAPABILITIES = ['text_generation', 'code_review', 'image_analysis', 'data_labeling', 'summarization'];
const MIN_STAKE = { miner: 10, holder: 1, validator: 500 };
type Step = 'idle' | 'checking' | 'need_faucet' | 'faucet_pending' | 'staking' | 'hcs' | 'done' | 'error';

interface BalanceInfo {
  mdtBalance: number;
  hbarBalance: number;
  evmAddress: string;
  hasEnough: boolean;
}

export default function RoleRegistrationView({ onBack, onViewChange, defaultRole = 'miner', onRegistered }: Props) {
  const { accountId, address: walletEvm, isConnected, type: walletType } = useWallet();
  const [role, setRole] = useState<'miner' | 'holder'>(defaultRole);
  const [stake, setStake] = useState(10);
  const [caps, setCaps] = useState<string[]>(['text_generation']);
  const [step, setStep] = useState<Step>('idle');
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [faucetResult, setFaucetResult] = useState<any>(null);
  const [stakeResult, setStakeResult] = useState<any>(null);
  const [hcsResult, setHcsResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => setLogs(prev => [...prev, msg]);
  const minStake = MIN_STAKE[role];

  const handleRoleChange = (r: 'miner' | 'holder') => {
    setRole(r); setStake(MIN_STAKE[r]); setStep('idle');
    setBalance(null); setFaucetResult(null); setStakeResult(null);
    setHcsResult(null); setError(null); setLogs([]);
  };

  const toggleCap = (c: string) =>
    setCaps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  // Step 1: Check MDT balance via Mirror Node
  const checkBalance = useCallback(async () => {
    if (!accountId) return;
    setStep('checking'); setError(null);
    log(`Checking MDT balance for ${accountId}...`);
    try {
      const res = await fetch(`/api/mdt-balance?accountId=${accountId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const info: BalanceInfo = {
        mdtBalance: data.mdtBalance,
        hbarBalance: data.hbarBalance,
        evmAddress: data.evmAddress || walletEvm || '',
        hasEnough: data.mdtBalance >= stake,
      };
      setBalance(info);
      log(`Balance: ${data.mdtBalance.toFixed(2)} MDT · ${data.hbarBalance.toFixed(4)} HBAR`);
      if (info.hasEnough) {
        log(`✓ Sufficient MDT (need ${stake}, have ${data.mdtBalance.toFixed(2)})`);
        setStep('idle');
      } else {
        log(`✗ Need ${stake} MDT, have ${data.mdtBalance.toFixed(2)} — faucet required`);
        setStep('need_faucet');
      }
    } catch (e: any) { setError(e.message); setStep('error'); }
  }, [accountId, stake, walletEvm]);

  // Step 2: Request faucet MDT
  const requestFaucet = async () => {
    if (!accountId) return;
    setStep('faucet_pending'); setError(null);
    const amount = Math.min(Math.max(stake - (balance?.mdtBalance || 0) + 100, 100), 500);
    log(`Requesting ${amount} MDT from faucet (scripts/faucet_drip.py)...`);
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFaucetResult(data);
      log(`✓ Faucet: ${data.amount} MDT · mode: ${data.mode} · tx: ${data.txId}`);
      await checkBalance();
    } catch (e: any) { setError(e.message); setStep('need_faucet'); }
  };

  // Step 3: Full registration — balance check → (stake) → HCS
  const handleRegister = async () => {
    if (!accountId || !isConnected) return;
    if (role === 'miner' && caps.length === 0) { setError('Select at least one capability'); return; }
    if (stake < minStake) { setError(`Minimum stake is ${minStake} MDT`); return; }
    if (!balance) { await checkBalance(); return; }
    if (!balance.hasEnough) { setStep('need_faucet'); return; }

    setError(null);

    // Note on-chain staking: StakingVault requires wallet signature
    // MetaMask/HashPack must call approve + stake directly
    // We record stake intent in HCS message; server enforces balance check
    setStakeResult({ skipped: true, reason: 'wallet_signature_required' });
    log(`ℹ On-chain stake: call StakingVault.stake(${stake * 1e8}, 1) via your wallet`);

    // HCS registration
    setStep('hcs');
    log(`Submitting miner_register to HCS topic 0.0.8198583...`);
    try {
      const res = await fetch('/api/hcs/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role, accountId, stakeAmount: stake,
          capabilities: caps, subnetIds: [0],
          skipOnChainStake: true,
        }),
      });
      const data = await res.json();
      if (res.status === 402 && data.code === 'INSUFFICIENT_MDT') {
        setBalance(prev => prev ? { ...prev, hasEnough: false, mdtBalance: data.balance } : null);
        setStep('need_faucet'); setError(data.message); return;
      }
      if (!res.ok || data.error) throw new Error(data.error || 'HCS registration failed');
      setHcsResult(data);
      log(`✓ HCS sequence #${data.sequence} · topic ${data.topicId}`);
      setStep('done');
      // Navigate to miners view after 1.5s so user sees success state
      setTimeout(() => onRegistered?.(), 1500);
    } catch (e: any) { setError(e.message); setStep('error'); }
  };

  useEffect(() => {
    if (isConnected && accountId && step === 'idle') checkBalance();
  }, [isConnected, accountId]); // eslint-disable-line

  const busy = ['checking', 'faucet_pending', 'staking', 'hcs'].includes(step);

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span> Back
        </button>
        <div>
          <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
            Join the <span className="text-neon-cyan">Network</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${step === 'done' ? 'bg-neon-green' : step === 'need_faucet' ? 'bg-neon-yellow' : 'bg-neon-cyan animate-pulse'}`} />
            {step === 'idle' ? 'Ready' : step === 'checking' ? 'Checking balance...' :
             step === 'need_faucet' ? 'Insufficient MDT — use faucet' :
             step === 'faucet_pending' ? 'Requesting MDT...' :
             step === 'staking' ? 'Staking on-chain...' :
             step === 'hcs' ? 'Submitting to HCS...' :
             step === 'done' ? 'Registered ✓' : 'Error'}
          </p>
        </div>
      </div>

      {/* Role selector */}
      <div className="grid grid-cols-2 gap-4">
        {(['miner', 'holder'] as const).map(r => (
          <button key={r} onClick={() => handleRoleChange(r)}
            className={`p-5 rounded-2xl border text-left transition-all ${role === r
              ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-[0_0_20px_rgba(0,243,255,0.1)]'
              : 'bg-white/[0.02] border-white/5 hover:border-white/20'}`}>
            <span className="material-symbols-outlined text-2xl mb-2 block text-neon-cyan">
              {r === 'miner' ? 'memory' : 'savings'}
            </span>
            <div className="text-sm font-black text-white uppercase tracking-wider">
              {r === 'miner' ? 'AI Miner' : 'MDT Holder'}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {r === 'miner' ? `Run AI inference · min ${MIN_STAKE.miner} MDT` : `Passive yield · min ${MIN_STAKE.holder} MDT`}
            </div>
          </button>
        ))}
      </div>

      {/* Balance card */}
      {balance && (
        <div className={`panel p-4 flex items-center justify-between border ${balance.hasEnough ? 'border-neon-green/20' : 'border-neon-yellow/30'}`}>
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-xl ${balance.hasEnough ? 'text-neon-green' : 'text-neon-yellow'}`}>
              {balance.hasEnough ? 'check_circle' : 'warning'}
            </span>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider">MDT Balance</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {balance.mdtBalance.toFixed(2)} MDT · {balance.hbarBalance.toFixed(4)} HBAR
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-black font-mono ${balance.hasEnough ? 'text-neon-green' : 'text-neon-yellow'}`}>
              {balance.mdtBalance.toFixed(0)} / {stake}
            </div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">MDT required</div>
          </div>
        </div>
      )}

      {/* Faucet panel */}
      {(step === 'need_faucet' || step === 'faucet_pending') && (
        <div className="panel p-5 border border-neon-yellow/30 space-y-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-neon-yellow text-2xl">water_drop</span>
            <div>
              <div className="text-sm font-black text-neon-yellow uppercase tracking-wider">Testnet MDT Faucet</div>
              <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                You need <span className="text-white font-bold">{stake} MDT</span> to register as {role}.
                Request free testnet tokens below.
              </div>
              <div className="text-[10px] text-slate-600 mt-1 font-mono">
                Token: MDT · {process.env.NEXT_PUBLIC_MDT_TOKEN_ID || '0.0.8198586'}
              </div>
            </div>
          </div>
          <button onClick={requestFaucet} disabled={step === 'faucet_pending'}
            className="w-full py-3 bg-neon-yellow/10 hover:bg-neon-yellow/20 border border-neon-yellow/40 text-neon-yellow font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40">
            {step === 'faucet_pending' ? 'Requesting...' : `Request ${Math.min(stake + 100, 500)} MDT from Faucet`}
          </button>
          {faucetResult && (
            <div className="text-[10px] font-mono text-neon-green space-y-1">
              <div>✓ {faucetResult.amount} MDT sent · mode: {faucetResult.mode}</div>
              {faucetResult.txUrl && (
                <a href={faucetResult.txUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-neon-cyan hover:underline">
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                  View transaction on HashScan
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Registration form */}
      {step !== 'done' && (
        <div className="panel p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Registration Details</h3>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
              {[
                { label: 'Balance', done: !!balance?.hasEnough, active: step === 'checking' || step === 'need_faucet' },
                { label: 'Stake', done: !!stakeResult, active: step === 'staking' },
                { label: 'HCS', done: step === 'done', active: step === 'hcs' },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <span className="text-white/10">→</span>}
                  <span className={s.done ? 'text-neon-green' : s.active ? 'text-neon-cyan' : 'text-slate-600'}>
                    {s.done ? '✓' : `${i + 1}.`} {s.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Hedera Account ID</label>
            <div className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white">
              {isConnected ? accountId : <span className="text-slate-500">Connect wallet first</span>}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
              Stake Amount (MDT) <span className="text-neon-cyan">· min {minStake} MDT · StakingVaultV2.sol</span>
            </label>
            <input type="number" min={minStake} value={stake}
              onChange={e => setStake(Number(e.target.value))}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white focus:border-neon-cyan/40 outline-none" />
          </div>

          {role === 'miner' && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Capabilities</label>
              <div className="flex flex-wrap gap-2">
                {CAPABILITIES.map(cap => (
                  <button key={cap} onClick={() => toggleCap(cap)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                      caps.includes(cap) ? 'bg-neon-cyan/15 border-neon-cyan/50 text-neon-cyan' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}>
                    {cap.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-neon-purple/5 border border-neon-purple/20 rounded-xl text-[10px] text-slate-400 leading-relaxed">
            <span className="text-neon-purple font-black uppercase tracking-widest block mb-1">On-Chain Staking (StakingVault.sol)</span>
            After HCS registration, lock MDT on-chain via your wallet:
            <code className="text-neon-cyan block mt-1">StakingVault.stake({stake * 1e8}, 1) // role 1 = Miner</code>
            <code className="text-neon-cyan block">MDT.approve(stakingVault, {stake * 1e8}) // approve first</code>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400">✗ {error}</div>
          )}

          <button onClick={handleRegister} disabled={busy || !isConnected}
            className="w-full py-3 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {step === 'checking' ? 'Checking balance...' :
             step === 'hcs' ? 'Submitting to HCS...' :
             step === 'need_faucet' ? 'Get MDT first ↑' :
             `Register as ${role === 'miner' ? 'AI Miner' : 'MDT Holder'}`}
          </button>
        </div>
      )}

      {/* Success */}
      {step === 'done' && hcsResult && (
        <div className="panel p-6 space-y-4 border-neon-green/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-neon-green text-xl">check_circle</span>
            </div>
            <div>
              <div className="text-sm font-black text-neon-green uppercase tracking-wider">Registered on Hedera</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{hcsResult.message}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
              <div className="text-slate-500 text-[9px] uppercase tracking-widest">HCS</div>
              <div className="text-white">Sequence #{hcsResult.sequence}</div>
              <div className="text-slate-400">Topic {hcsResult.topicId}</div>
            </div>
            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
              <div className="text-slate-500 text-[9px] uppercase tracking-widest">Stake</div>
              <div className="text-white">{hcsResult.stakeAmount} MDT</div>
              <div className="text-slate-400">{hcsResult.onChainStake ? 'On-chain locked' : 'HCS recorded'}</div>
            </div>
          </div>
          <div className="flex gap-3">
            <a href={hcsResult.txUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-neon-cyan text-xs font-bold hover:underline">
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              View Transaction
            </a>
            <a href={hcsResult.topicUrl || `https://hashscan.io/testnet/topic/${hcsResult.topicId}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 text-xs font-bold hover:text-white hover:underline">
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              View Topic
            </a>
          </div>
        </div>
      )}

      {/* Activity log */}
      {logs.length > 0 && (
        <div className="panel p-4 space-y-1">
          <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Activity Log</div>
          {logs.map((l, i) => <div key={i} className="text-[10px] font-mono text-slate-400">{l}</div>)}
        </div>
      )}
    </div>
  );
}
