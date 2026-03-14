"use client";

import React, { useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { ViewState } from '@/types';

interface Props {
  onBack: () => void;
  onViewChange: (v: ViewState) => void;
  defaultRole?: 'miner' | 'holder';
}

const CAPABILITIES = [
  'text_generation',
  'code_review',
  'image_analysis',
  'data_labeling',
  'summarization',
];

// Miner duties per protocol flow (from source code)
const MINER_DUTIES = [
  {
    icon: 'inbox',
    color: 'neon-cyan',
    title: 'Receive Tasks via Dendrite',
    desc: 'Listen on your miner port for incoming AI tasks from validators. Tasks arrive as JSON payloads with prompt, task_type, and reward_amount.',
    code: 'python -m sdk.miner.server --port 8091',
  },
  {
    icon: 'psychology',
    color: 'neon-purple',
    title: 'Process AI Inference',
    desc: 'Run the AI model matching your registered capabilities (text_generation, code_review, etc.) and produce a result within the deadline.',
    code: 'sdk/miner/agent.py → process_task(task_id, prompt)',
  },
  {
    icon: 'upload',
    color: 'neon-green',
    title: 'Submit Results',
    desc: 'Return your result to the validator. The validator scores your output (0–100) and submits the score to HCS scoring topic.',
    code: 'POST /api/result → { task_id, result, miner_id }',
  },
  {
    icon: 'favorite',
    color: 'neon-pink',
    title: 'Send Heartbeat',
    desc: 'Periodically submit a miner_heartbeat message to HCS registration topic to signal you are online and available.',
    code: 'hcs.send_heartbeat(miner_id, account_id)  # every 60s',
  },
  {
    icon: 'payments',
    color: 'neon-green',
    title: 'Earn MDT Rewards',
    desc: 'Earn 85% of each task reward based on your score. Higher scores = more rewards. Rewards distributed via PaymentEscrow contract.',
    code: 'PaymentEscrow.releasePayment(task_id, miner_id)',
  },
];

const HOLDER_DUTIES = [
  {
    icon: 'savings',
    color: 'neon-green',
    title: 'Passive Staking',
    desc: 'Your MDT stake earns 5% of all network task rewards, distributed pro-rata based on your share of total staked MDT.',
    code: 'StakingVault.stake(amount)  // via smart contract',
  },
  {
    icon: 'trending_up',
    color: 'neon-cyan',
    title: 'Earn Yield',
    desc: 'Rewards accumulate automatically. Claim anytime via the StakingVault contract. No active work required.',
    code: 'StakingVault.claimRewards()  // claim anytime',
  },
];

interface RegistrationResult {
  success: boolean;
  message: string;
  hashscanUrl?: string;
  txUrl?: string;
  sequence?: string;
  topicId?: string;
}

export default function RoleRegistrationView({ onBack, onViewChange, defaultRole = 'miner' }: Props) {
  const { accountId, isConnected } = useWallet();
  const [role, setRole] = useState<'miner' | 'holder'>(defaultRole);
  const [stake, setStake] = useState(role === 'miner' ? 100 : 10);
  const [caps, setCaps] = useState<string[]>(['text_generation']);
  const [subnetIds] = useState([0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minStake = role === 'miner' ? 10 : 1;

  const toggleCap = (c: string) => {
    setCaps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handleRoleChange = (r: 'miner' | 'holder') => {
    setRole(r);
    setStake(r === 'miner' ? 100 : 10);
    setError(null);
    setResult(null);
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
      setResult({
        success: true,
        message: data.message,
        hashscanUrl: data.hashscanUrl,
        txUrl: data.txUrl,
        sequence: data.sequence,
        topicId: data.topicId,
      });
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

  // ── Post-registration: show duties ──
  if (result?.success) {
    const duties = role === 'miner' ? MINER_DUTIES : HOLDER_DUTIES;
    return (
      <div className="flex justify-center py-8 px-4 lg:px-12 w-full animate-fade-in-up">
        <div className="w-full max-w-3xl flex flex-col gap-6">

          {/* Breadcrumb */}
          <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-500 uppercase">
            <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-neon-cyan">REGISTERED</span>
          </div>

          {/* Success banner */}
          <div className="glass-panel rounded-2xl p-6 border border-green-500/40 bg-green-500/5">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-green-400 text-4xl mt-1">check_circle</span>
              <div className="flex-1">
                <h2 className="text-green-400 font-display font-bold text-xl uppercase tracking-wider mb-1">
                  {role === 'miner' ? 'Miner' : 'Holder'} Registered On-Chain
                </h2>
                <p className="text-slate-300 text-sm mb-3">{result.message}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="bg-black/30 rounded-lg p-3 border border-white/10">
                    <p className="text-slate-500 uppercase tracking-widest mb-1">Account</p>
                    <p className="text-neon-cyan font-bold">{accountId}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 border border-white/10">
                    <p className="text-slate-500 uppercase tracking-widest mb-1">Topic</p>
                    <p className="text-white font-bold">{result.topicId}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 border border-white/10">
                    <p className="text-slate-500 uppercase tracking-widest mb-1">Sequence #</p>
                    <p className="text-neon-green font-bold">{result.sequence}</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  {result.txUrl && (
                    <a href={result.txUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan rounded-lg text-xs font-bold hover:bg-neon-cyan/20 transition-all">
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      View Message on HashScan
                    </a>
                  )}
                  {result.hashscanUrl && (
                    <a href={result.hashscanUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-xs font-bold hover:border-white/30 transition-all">
                      <span className="material-symbols-outlined text-sm">topic</span>
                      View Topic
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Duties */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h3 className="text-white font-display font-bold text-lg uppercase tracking-wider mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-neon-cyan">assignment</span>
              {role === 'miner' ? 'Your Miner Duties' : 'Your Holder Benefits'}
            </h3>
            <p className="text-slate-400 text-xs mb-6">
              {role === 'miner'
                ? 'As a registered miner, here is what you need to do to earn MDT rewards:'
                : 'As a holder, your MDT earns passive rewards automatically:'}
            </p>

            <div className="flex flex-col gap-4">
              {duties.map((duty, i) => (
                <div key={i} className={`flex gap-4 p-4 rounded-xl border border-${duty.color}/20 bg-${duty.color}/5`}>
                  <div className={`w-10 h-10 rounded-xl bg-${duty.color}/10 border border-${duty.color}/30 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <span className={`material-symbols-outlined text-${duty.color} text-xl`}>{duty.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold text-${duty.color} bg-${duty.color}/10 px-2 py-0.5 rounded border border-${duty.color}/20`}>
                        STEP {i + 1}
                      </span>
                      <h4 className="text-white font-bold text-sm">{duty.title}</h4>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed mb-2">{duty.desc}</p>
                    <code className="block text-[10px] font-mono text-neon-cyan bg-black/40 border border-white/10 rounded px-3 py-1.5 overflow-x-auto">
                      {duty.code}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => onViewChange(role === 'miner' ? ViewState.MINERS : ViewState.TOKENOMICS)}
              className="flex-1 py-3 rounded-xl border border-neon-cyan/30 text-neon-cyan text-sm font-bold hover:bg-neon-cyan/10 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">
                {role === 'miner' ? 'dns' : 'token'}
              </span>
              View {role === 'miner' ? 'All Miners' : 'Tokenomics'}
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-bold hover:border-white/30 transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form ──
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
          <p className="text-slate-400 text-sm mb-6">
            Register on Hedera HCS — verifiable on{' '}
            <a href={`https://hashscan.io/testnet/topic/0.0.8198583`} target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">
              HashScan
            </a>
          </p>

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
                  onClick={() => handleRoleChange(r)}
                  className={`p-4 rounded-xl border text-left transition-all ${role === r
                    ? r === 'miner' ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan' : 'border-green-400 bg-green-500/10 text-green-400'
                    : 'border-white/10 text-slate-400 hover:border-white/30'}`}
                >
                  <span className="material-symbols-outlined text-2xl block mb-1">{r === 'miner' ? 'dns' : 'savings'}</span>
                  <span className="font-bold text-sm uppercase tracking-wider">{r === 'miner' ? 'Miner' : 'Holder'}</span>
                  <span className="block text-[10px] mt-0.5 opacity-70">
                    {r === 'miner' ? 'Min 10 MDT · Earn 85% of task reward' : 'Min 1 MDT · 5% passive yield'}
                  </span>
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
            <input
              type="range"
              min={minStake}
              max={role === 'miner' ? 10000 : 1000}
              step={role === 'miner' ? 10 : 1}
              value={stake}
              onChange={e => setStake(Number(e.target.value))}
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
                    {c.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message preview */}
          <div className="mb-6 p-4 bg-black/30 border border-white/10 rounded-xl">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">HCS Message Preview</p>
            <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
{JSON.stringify({
  type: 'miner_register',
  miner_id: accountId,
  account_id: accountId,
  capabilities: role === 'miner' ? caps : ['passive_holder'],
  stake_amount: Math.floor(stake * 1e8),
  subnet_ids: [0],
  timestamp: '<utc_now>',
}, null, 2)}
            </pre>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-neon-cyan text-black hover:bg-neon-cyan/90 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><span className="material-symbols-outlined animate-spin text-lg">refresh</span> Submitting to Hedera HCS...</>
            ) : (
              <><span className="material-symbols-outlined text-lg">send</span> Register as {role === 'miner' ? 'Miner' : 'Holder'}</>
            )}
          </button>

          <p className="text-[10px] text-slate-500 text-center mt-3">
            Submits a real transaction to HCS topic{' '}
            <a href="https://hashscan.io/testnet/topic/0.0.8198583" target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">
              0.0.8198583
            </a>
            {' '}· Verifiable on HashScan
          </p>
        </div>
      </div>
    </div>
  );
}
