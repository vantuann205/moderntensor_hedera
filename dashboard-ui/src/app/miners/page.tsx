'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import { Cpu, Search, Zap, Plus, ExternalLink, X, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';

// ── Helpers ─────────────────────────────────────────────────────────────────
const CAPABILITIES = ['text_generation', 'code_review', 'sentiment_analysis', 'image_captioning', 'summarization'];

/** Convert consensus_timestamp (unix seconds float string or number) → UTC+7 display */
function toUTC7(ts: any): string {
  if (!ts) return '—';
  // consensusTimestamp: "1773481974.381895000" or registered_at: 1773481974 (seconds)
  const secs = typeof ts === 'string' ? parseFloat(ts) : Number(ts);
  if (!secs || isNaN(secs)) return '—';
  // If already milliseconds (> year 2100 in seconds = 4102444800), treat as ms
  const ms = secs > 4102444800 ? secs : secs * 1000;
  return new Date(ms).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

/** MDT raw (8 decimals) → display */
function toMDT(raw: any): number {
  const n = Number(raw || 0);
  return n > 1e6 ? n / 1e8 : n;
}

// ── Register Modal ───────────────────────────────────────────────────────────
function RegisterMinerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { accountId, isConnected } = useWallet();
  const [stakeAmount, setStakeAmount] = useState('10');
  const [capabilities, setCapabilities] = useState<string[]>(['text_generation']);
  const [subnetIds, setSubnetIds] = useState('0');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const toggleCap = (cap: string) =>
    setCapabilities(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]);

  const handleSubmit = async () => {
    if (!isConnected || !accountId) { setResult({ error: 'Connect your wallet first' }); return; }
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/hcs/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'miner', accountId,
          stakeAmount: Number(stakeAmount),
          capabilities,
          subnetIds: subnetIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
        }),
      });
      const json = await res.json();
      setResult(json);
      if (json.success) setTimeout(onSuccess, 1800);
    } catch (e: any) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#050b14]/98 border border-white/10 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent" />
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter font-display">Register Neural Node</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Publish to Hedera HCS · Topic 0.0.8198583
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-slate-500 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Hedera Account ID</label>
            <div className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white">
              {isConnected ? accountId : <span className="text-slate-500">Connect wallet first</span>}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
              Stake Amount (MDT) <span className="text-neon-cyan">· min 10 MDT · StakingVaultV2</span>
            </label>
            <Input type="number" min={10} value={stakeAmount} onChange={e => setStakeAmount(e.target.value)}
              className="bg-black/40 border-white/10 text-white font-mono focus:border-neon-cyan/40 h-11" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Subnet IDs (comma-separated)</label>
            <Input value={subnetIds} onChange={e => setSubnetIds(e.target.value)} placeholder="0, 1, 2"
              className="bg-black/40 border-white/10 text-white font-mono focus:border-neon-cyan/40 h-11" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Capabilities</label>
            <div className="flex flex-wrap gap-2">
              {CAPABILITIES.map(cap => (
                <button key={cap} onClick={() => toggleCap(cap)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                    capabilities.includes(cap)
                      ? 'bg-neon-cyan/15 border-neon-cyan/50 text-neon-cyan'
                      : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}>
                  {cap.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          {result && (
            <div className={`p-4 rounded-xl border text-xs font-mono ${result.success
              ? 'bg-neon-green/10 border-neon-green/30 text-neon-green'
              : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              {result.success ? (
                <div className="space-y-1.5">
                  <div>✓ Registered on Hedera HCS</div>
                  <div>Sequence: #{result.sequence}</div>
                  <div>Topic: {result.topicId}</div>
                  {result.txUrl && (
                    <a href={result.txUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 underline opacity-80 hover:opacity-100">
                      View Transaction on HashScan <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ) : <div>✗ {result.error}</div>}
            </div>
          )}
          <button onClick={handleSubmit} disabled={loading || !isConnected}
            className="w-full py-3 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Submitting to HCS...' : 'Register on Hedera'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function MinersPage() {
  const [miners, setMiners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  const loadMiners = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/hcs/miners');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMiners(json.data);
      }
    } catch (e) {
      console.error('Failed to load miners:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMiners();
    const t = setInterval(loadMiners, 20000);
    return () => clearInterval(t);
  }, []);

  const filtered = miners.filter(m =>
    String(m.miner_id || m.account_id || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalStakeMDT = miners.reduce((acc, m) => acc + toMDT(m.stake_amount), 0);
  const uniqueMiners = new Set(miners.map(m => m.miner_id)).size;

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {showRegister && (
        <RegisterMinerModal
          onClose={() => setShowRegister(false)}
          onSuccess={() => { setShowRegister(false); loadMiners(); }}
        />
      )}

      {/* Header */}
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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col items-center bg-neon-cyan/5 border border-neon-cyan/20 px-5 py-2.5 rounded-xl">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Unique Miners</span>
            <span className="text-xl font-display font-bold text-neon-cyan">{uniqueMiners}</span>
          </div>
          <div className="flex flex-col items-center bg-white/[0.02] border border-white/5 px-5 py-2.5 rounded-xl">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">HCS Messages</span>
            <span className="text-xl font-display font-bold text-white">{miners.length}</span>
          </div>
          <div className="flex flex-col items-center bg-neon-purple/5 border border-neon-purple/20 px-5 py-2.5 rounded-xl">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Staked</span>
            <span className="text-xl font-display font-bold text-neon-purple">{totalStakeMDT.toLocaleString()} MDT</span>
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
          placeholder="Search by account ID..."
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
                <th className="px-5 py-4">#</th>
                <th className="px-5 py-4">Miner ID</th>
                <th className="px-5 py-4">Capabilities</th>
                <th className="px-5 py-4">Subnet(s)</th>
                <th className="px-5 py-4">
                  <span className="flex items-center gap-1"><Calendar size={10} /> Registered (UTC+7)</span>
                </th>
                <th className="px-5 py-4 text-right">Stake (MDT)</th>
                <th className="px-5 py-4 text-right">Trust Score</th>
                <th className="px-5 py-4 text-right">Tasks</th>
                <th className="px-5 py-4 text-right">HCS Seq</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-5 py-3">
                      <Skeleton className="h-9 bg-white/5 rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-20">
                    <div className="flex flex-col items-center gap-4">
                      <Cpu size={32} className="text-slate-700" />
                      <span className="text-slate-600 uppercase tracking-widest text-xs font-bold">No Neural Nodes Detected</span>
                      <button onClick={() => setShowRegister(true)} className="text-neon-cyan text-xs font-bold uppercase tracking-widest hover:underline">
                        + Register the first node
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((m, idx) => {
                const id = m.miner_id || m.account_id || `miner-${idx}`;
                const stakeMDT = toMDT(m.stake_amount);
                const trust = Number(m.trust_score ?? 0.5);
                const tasks = Number(m.tasks_completed ?? 0);
                const subnets: number[] = m.subnet_ids ?? [0];
                const caps: string[] = m.capabilities ?? [];
                const scoreColor = trust >= 0.9 ? 'text-neon-green' : trust >= 0.7 ? 'text-neon-cyan' : 'text-yellow-400';
                // Use consensusTimestamp for precise time, fallback to registered_at
                const regTime = m.consensusTimestamp || m.registered_at;
                return (
                  <tr key={`${id}-${m.hcs_sequence}`} className="group hover:bg-neon-cyan/[0.02] transition-colors">
                    <td className="px-5 py-4 text-slate-600 font-bold">#{String(idx + 1).padStart(2, '0')}</td>
                    <td className="px-5 py-4">
                      <Link href={`/miners/${encodeURIComponent(id)}`} className="group/link flex flex-col gap-0.5">
                        <span className="text-white font-bold tracking-tight group-hover/link:text-neon-cyan transition-colors">{id}</span>
                        <span className="text-[9px] text-slate-600 uppercase tracking-widest">
                          {m.account_id !== m.miner_id ? m.account_id : 'Hedera Account'}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {caps.slice(0, 2).map(c => (
                          <span key={c} className="text-[9px] font-bold text-slate-400 border border-white/10 bg-white/[0.03] px-2 py-0.5 rounded-full">
                            {c.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {caps.length > 2 && (
                          <span className="text-[9px] text-slate-600">+{caps.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {subnets.map(s => (
                          <span key={s} className="text-[9px] font-bold text-neon-cyan border border-neon-cyan/30 bg-neon-cyan/5 px-2 py-0.5 rounded-full">
                            S-{s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white font-bold whitespace-nowrap">{toUTC7(regTime)}</span>
                        <span className="text-[9px] text-slate-600 font-mono">ts: {String(regTime).substring(0, 13)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-white font-bold">{stakeMDT.toLocaleString()}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`${scoreColor} font-bold`}>{(trust * 100).toFixed(1)}%</span>
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${scoreColor.replace('text-', 'bg-')}`}
                            style={{ width: `${trust * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Zap size={11} className="text-yellow-400 animate-pulse" />
                        <span className="text-white font-bold">{tasks}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {m.hcs_sequence ? (
                        <a
                          href={m.consensusTimestamp
                            ? `https://hashscan.io/testnet/transaction/${m.consensusTimestamp}`
                            : `https://hashscan.io/testnet/topic/0.0.8198583`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-neon-cyan/60 hover:text-neon-cyan flex items-center justify-end gap-1 transition-colors font-bold"
                        >
                          #{m.hcs_sequence} <ExternalLink size={9} />
                        </a>
                      ) : <span className="text-slate-700">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && miners.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-600 font-mono">
            <span>Showing {filtered.length} of {miners.length} registration events · {uniqueMiners} unique miners</span>
            <span className="text-slate-700">Auto-refresh every 20s · HCS Mirror Node</span>
          </div>
        )}
      </div>
    </div>
  );
}
