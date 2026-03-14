'use client';

import { useMiners } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Cpu, Search, Zap, Plus, ExternalLink, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';
import { CountUp } from '@/components/ui-custom/NeuralMetagraph';
import { useWallet } from '@/context/WalletContext';

// ── Registration Modal ──────────────────────────────────────────────────────
const CAPABILITIES = ['text_generation', 'code_review', 'sentiment_analysis', 'image_captioning', 'summarization'];

function RegisterMinerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { accountId, isConnected } = useWallet();
  const [stakeAmount, setStakeAmount] = useState('1000');
  const [capabilities, setCapabilities] = useState<string[]>(['text_generation']);
  const [subnetIds, setSubnetIds] = useState('0');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; sequence?: string; hashscanUrl?: string } | null>(null);

  const toggleCap = (cap: string) =>
    setCapabilities(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]);

  const handleSubmit = async () => {
    if (!isConnected || !accountId) {
      setResult({ error: 'Connect your wallet first' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/hcs/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'miner',
          accountId,
          stakeAmount: Number(stakeAmount),
          capabilities,
          subnetIds: subnetIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
        }),
      });
      const json = await res.json();
      setResult(json);
      if (json.success) setTimeout(onSuccess, 1500);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#050b14]/95 border border-white/10 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter font-display">Register Neural Node</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Publish to Hedera HCS · Topic 0.0.8198583</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-slate-500 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Account ID */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Hedera Account ID</label>
            <div className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white">
              {isConnected ? accountId : <span className="text-slate-500">Connect wallet first</span>}
            </div>
          </div>

          {/* Stake */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
              Stake Amount (MDT) <span className="text-neon-cyan">· min 10 MDT</span>
            </label>
            <Input
              type="number"
              min={10}
              value={stakeAmount}
              onChange={e => setStakeAmount(e.target.value)}
              className="bg-black/40 border-white/10 text-white font-mono focus:border-neon-cyan/40 h-11"
            />
          </div>

          {/* Subnet IDs */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Subnet IDs (comma-separated)</label>
            <Input
              value={subnetIds}
              onChange={e => setSubnetIds(e.target.value)}
              placeholder="0, 1, 2"
              className="bg-black/40 border-white/10 text-white font-mono focus:border-neon-cyan/40 h-11"
            />
          </div>

          {/* Capabilities */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Capabilities</label>
            <div className="flex flex-wrap gap-2">
              {CAPABILITIES.map(cap => (
                <button
                  key={cap}
                  onClick={() => toggleCap(cap)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                    capabilities.includes(cap)
                      ? 'bg-neon-cyan/15 border-neon-cyan/50 text-neon-cyan'
                      : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'
                  }`}
                >
                  {cap.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`p-4 rounded-xl border text-xs font-mono ${result.success ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              {result.success ? (
                <div className="space-y-1">
                  <div>✓ Registered on Hedera HCS</div>
                  <div>Sequence: #{result.sequence}</div>
                  {result.hashscanUrl && (
                    <a href={result.hashscanUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline opacity-80 hover:opacity-100">
                      View on HashScan <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ) : (
                <div>✗ {result.error}</div>
              )}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !isConnected}
            className="w-full py-3 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting to HCS...' : 'Register on Hedera'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function MinersPage() {
    const { data: miners = [], isLoading } = useMiners();
    const [search, setSearch] = useState('');
    const [showRegister, setShowRegister] = useState(false);

    const filtered = (miners as any[]).filter((m: any) => {
        const id = String(m.miner_id || m.id || m.account_id || '').toLowerCase();
        return id.includes(search.toLowerCase());
    });

    const totalStake = (miners as any[]).reduce((acc: number, m: any) => acc + Number(m.stake_amount || 0), 0);

    const formatUTC7 = (ts: any) => {
        if (!ts) return '—';
        const date = new Date(Number(ts) * (String(ts).length > 10 ? 1 : 1000));
        return date.toLocaleString('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour12: false,
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            {showRegister && (
                <RegisterMinerModal
                    onClose={() => setShowRegister(false)}
                    onSuccess={() => { setShowRegister(false); window.location.reload(); }}
                />
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
                        Neural <span className="text-neon-cyan">Nodes</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_#00f3ff]" />
                        AI Compute Mining Participant Registry · HCS Topic 0.0.8198583
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center bg-neon-cyan/5 border border-neon-cyan/20 px-5 py-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Miners</span>
                        <span className="text-xl font-display font-bold text-neon-cyan">{(miners as any[]).length}</span>
                    </div>
                    <div className="flex flex-col items-center bg-white/[0.02] border border-white/5 px-5 py-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Staked</span>
                        <span className="text-xl font-display font-bold text-white">
                            <CountUp end={totalStake} decimals={0} suffix=" MDT" />
                        </span>
                    </div>
                    <button
                        onClick={() => setShowRegister(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                    >
                        <Plus size={14} /> Register Node
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative group max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-neon-cyan transition-colors" />
                <Input
                    placeholder="SCAN NEURAL NODES..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-11 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-neon-cyan/40 h-11 text-xs font-mono tracking-widest uppercase transition-all"
                />
            </div>

            {/* Table */}
            <div className="panel overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-cyan/20 to-transparent" />
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                                <th className="px-6 py-5">Rank</th>
                                <th className="px-6 py-5">Node Identity</th>
                                <th className="px-6 py-5">Subnet(s)</th>
                                <th className="px-6 py-5">Registered</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5 text-right">Stake (MDT)</th>
                                <th className="px-6 py-5 text-right">Trust Score</th>
                                <th className="px-6 py-5 text-right">Tasks</th>
                                <th className="px-6 py-5 text-right">HCS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i}><td colSpan={9} className="px-6 py-4"><Skeleton className="h-10 bg-white/5 rounded-lg" /></td></tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-24">
                                        <div className="flex flex-col items-center gap-4">
                                            <Cpu size={32} className="text-slate-700" />
                                            <span className="text-slate-600 uppercase tracking-widest text-xs font-bold">No Neural Nodes Detected</span>
                                            <button onClick={() => setShowRegister(true)} className="text-neon-cyan text-xs font-bold uppercase tracking-widest hover:underline">
                                                + Register the first node
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map((m: any, idx: number) => {
                                const id = m.miner_id || m.id || m.account_id || `miner-${idx}`;
                                const status = m.status || 'active';
                                const stake = Number(m.stake_amount || 0);
                                // stake_amount from HCS is in smallest unit (8 decimals), convert to MDT
                                const stakeDisplay = stake > 1e6 ? stake / 1e8 : stake;
                                const trustScore = Number(m.trust_score || m.reputation?.score || 0);
                                const tasksCompleted = m.tasks_completed || m.reputation?.successful_tasks || 0;
                                const subnets = m.subnet_ids || [0];
                                const scoreColor = trustScore >= 0.9 ? 'text-neon-green' : trustScore >= 0.7 ? 'text-neon-cyan' : 'text-neon-yellow';
                                return (
                                    <tr key={id} className="group hover:bg-neon-cyan/[0.02] transition-colors">
                                        <td className="px-6 py-5 text-slate-500 text-xs font-bold">#{String(idx + 1).padStart(2, '0')}</td>
                                        <td className="px-6 py-5">
                                            <Link href={`/miners/${encodeURIComponent(id)}`} className="flex flex-col gap-1 group/link">
                                                <span className="text-white font-bold text-sm tracking-tight group-hover/link:text-neon-cyan transition-colors">{id}</span>
                                                <span className="text-[10px] text-white/40 uppercase tracking-widest">
                                                    {(m.capabilities || []).slice(0, 2).join(' · ') || 'Neural_Node'}
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-wrap gap-1.5">
                                                {subnets.map((s: number) => (
                                                    <span key={s} className="text-[10px] font-bold text-neon-cyan border border-neon-cyan/40 bg-neon-cyan/10 px-2.5 py-1 rounded-full">
                                                        S-{s}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs text-white font-bold uppercase whitespace-nowrap">
                                                {formatUTC7(m.registered_at)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5"><StatusBadge status={status} /></td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="text-white font-bold text-sm">
                                                <CountUp end={stakeDisplay} decimals={0} />
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`${scoreColor} font-bold text-sm`}>
                                                    {(trustScore * 100).toFixed(1)}%
                                                </span>
                                                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${scoreColor.replace('text-', 'bg-')}`} style={{ width: `${trustScore * 100}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Zap size={12} className="text-neon-yellow animate-pulse" />
                                                <span className="text-white font-bold text-sm">{tasksCompleted}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {m.hcs_sequence ? (
                                                <a
                                                    href={m.consensusTimestamp
                                                        ? `https://hashscan.io/testnet/transaction/${m.consensusTimestamp}`
                                                        : `https://hashscan.io/testnet/topic/0.0.8198583`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] font-bold text-neon-cyan/60 hover:text-neon-cyan flex items-center justify-end gap-1 transition-colors"
                                                >
                                                    #{m.hcs_sequence} <ExternalLink size={10} />
                                                </a>
                                            ) : (
                                                <span className="text-slate-700 text-[10px]">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
