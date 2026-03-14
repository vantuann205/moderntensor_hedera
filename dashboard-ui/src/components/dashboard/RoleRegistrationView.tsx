"use client";

import React, { useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { ViewState } from '@/types';

interface Props {
  onBack: () => void;
  onViewChange: (v: ViewState) => void;
  defaultRole?: 'miner' | 'holder';
}

const CAPABILITIES = ['text_generation', 'code_review', 'image_analysis', 'data_labeling', 'summarization'];

export default function RoleRegistrationView({ onBack, onViewChange, defaultRole = 'miner' }: Props) {
  const { accountId, isConnected } = useWallet();
  const [role, setRole] = useState<'miner' | 'holder'>(defaultRole);
  const [stake, setStake] = useState(role === 'miner' ? 100 : 10);
  const [caps, setCaps] = useState<string[]>(['text_generation']);
  const [subnetIds] = useState([0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; hashscanUrl?: string; sequence?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minStake = role === 'miner' ? 10 : 1;

  const toggleCap = (c: string) => {
    setCaps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handleRegister = async () => {
    if (!accountId) return;
    if (stake < minStake) { setError(`Minimum stake for ${role} is ${minStake} MDT`); return; }
    if (role === 'miner' && caps.length === 0) { setError('Select at least one capability'); return; }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/hcs/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, accountId, stakeAmount: stake, capabilities: caps, subnetIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Registration failed');
      setResult({ success: true, message: data.message, hashscanUrl: data.hashscanUrl, sequence: data.sequence });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex justify-center py-20 px-4">
        <div className="glass-panel rounded-2xl p-12 text-center border border-neon-cyan/20 max-w-md">
          <span className="material-symbols-outlined text-5xl text-neon-cyan mb-4 block">account_balance_wallet</span>
          <h2 className="text-white text-xl font-bold mb-2">Wallet Required</h2>
          <p className="text-slate-400 text-sm">Connect your Hedera wallet first to register.</p>
          <button onClick={onBack} className="mt-6 px-6 py-2 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan rounded-lg text-sm font-bold hover:bg-neon-cyan/20 transition-all">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 w-full animate-fade-in-up">
      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Breadcrumb */}
        <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-500 uppercase">
          <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
          <span className="material-symbols-outlined text-[10px]">chevron_right</span>
          <span className="text-neon-cyan">REGISTER ROLE</span>
        </div>

        <div className="glass-panel rounded-2xl p-8 border border-white/10">
          <h1 className="text-white text-3xl font-display font-black uppercase tracking-tight mb-1">Join the Network</h1>
          <p className="text-slate-400 text-sm mb-6">Register on Hedera HCS — verifiable on-chain</p>

          {/* Account */}
          <div className="mb-6 p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Connected Account</p>
            <p className="text-neon-cyan font-mono font-bold">{accountId}</p>
          </div>

          {/* Role selector */}
          <div className="mb-6">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Select Role</p>
            <div className="grid grid-cols-2 gap-3">
              {(['miner', 'holder'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { setRole(r); setStake(r === 'miner' ? 100 : 10); setError(null); setResult(null); }}
                  className={`p-4 rounded-xl border text-left transition-all ${role === r
                    ? r === 'miner' ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan' : 'border-green-400 bg-green-500/10 text-green-400'
                    : 'border-white/10 text-slate-400 hover:border-white/30'}`}
                >
                  <span className={`material-symbols-outlined text-2xl block mb-1`}>{r === 'miner' ? 'dns' : 'savings'}</span>
                  <span className="font-bold text-sm uppercase tracking-wider">{r === 'miner' ? 'Miner' : 'Holder'}</span>
                  <span className="block text-[10px] mt-0.5 opacity-70">{r === 'miner' ? 'Min 10 MDT · Earn 85%' : 'Min 1 MDT · Passive income'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stake amount */}
          <div className="mb-6">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">
              Stake Amount (MDT) — minimum {minStake} MDT
            </label>
            <input
              type="number"
              min={minStake}
              value={stake}
              onChange={e => setStake(Number(e.target.value))}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan outline-none transition-all"
            />
            <input type="range" min={minStake} max={role === 'miner' ? 10000 : 1000} step={role === 'miner' ? 10 : 1}
              value={stake} onChange={e => setStake(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-neon-cyan mt-3"
            />
          </div>

          {/* Capabilities (miner only) */}
          {role === 'miner' && (
            <div className="mb-6">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Capabilities</p>
              <div className="flex flex-wrap gap-2">
                {CAPABILITIES.map(c => (
                  <button key={c} onClick={() => toggleCap(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${caps.includes(c)
                      ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                      : 'border-white/10 text-slate-400 hover:border-white/30'}`}>
                    {c.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {result?.success && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-green-400 font-bold text-sm mb-1">✓ {result.message}</p>
              {result.sequence && <p className="text-slate-400 text-xs">Sequence #{result.sequence}</p>}
              {result.hashscanUrl && (
                <a href={result.hashscanUrl} target="_blank" rel="noopener noreferrer"
                  className="text-neon-cyan text-xs hover:underline mt-1 block">
                  View on HashScan →
                </a>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleRegister}
            disabled={loading || !!result?.success}
            className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-neon-cyan text-black hover:bg-neon-cyan/90 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><span className="material-symbols-outlined animate-spin text-lg">refresh</span> Submitting to Hedera HCS...</>
            ) : result?.success ? (
              <><span className="material-symbols-outlined text-lg">check_circle</span> Registered on-chain</>
            ) : (
              <><span className="material-symbols-outlined text-lg">send</span> Register as {role === 'miner' ? 'Miner' : 'Holder'}</>
            )}
          </button>

          <p className="text-[10px] text-slate-500 text-center mt-3">
            This submits a real transaction to Hedera HCS topic{' '}
            <a href="https://hashscan.io/testnet/topic/0.0.8198583" target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">
              0.0.8198583
            </a>
          </p>
        </div>

        {/* After success: navigate */}
        {result?.success && (
          <div className="flex gap-3">
            <button onClick={() => onViewChange(role === 'miner' ? ViewState.MINERS : ViewState.TOKENOMICS)}
              className="flex-1 py-3 rounded-xl border border-neon-cyan/30 text-neon-cyan text-sm font-bold hover:bg-neon-cyan/10 transition-all">
              View {role === 'miner' ? 'Miners' : 'Tokenomics'} →
            </button>
            <button onClick={onBack}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-bold hover:border-white/30 transition-all">
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
