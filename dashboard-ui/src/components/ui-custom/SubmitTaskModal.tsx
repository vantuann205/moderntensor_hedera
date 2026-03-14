'use client';

import { useState } from 'react';
import { X, Send, Activity, CheckCircle } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';

const TASK_TYPES = [
  { value: 'text_generation', label: 'Text Generation' },
  { value: 'code_review',     label: 'Code Review' },
  { value: 'image_analysis',  label: 'Image Analysis' },
  { value: 'data_labeling',   label: 'Data Labeling' },
  { value: 'summarization',   label: 'Summarization' },
];

const SUBNETS = [
  { id: 0, name: 'Subnet 0 — Text Generation' },
  { id: 1, name: 'Subnet 1 — Code Review' },
  { id: 2, name: 'Subnet 2 — Image Analysis' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubmitTaskModal({ isOpen, onClose }: Props) {
  const { accountId, isConnected } = useWallet();

  const [taskType, setTaskType] = useState('text_generation');
  const [prompt, setPrompt] = useState('');
  const [rewardMDT, setRewardMDT] = useState('1');
  const [subnetId, setSubnetId] = useState(0);
  const [deadline, setDeadline] = useState(24);

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const log = (msg: string) => setLogs(p => [...p, msg]);

  const handleSubmit = async () => {
    if (!isConnected || !accountId) { setError('Connect wallet first'); return; }
    if (!prompt.trim()) { setError('Prompt is required'); return; }
    if (Number(rewardMDT) <= 0) { setError('Reward must be > 0'); return; }

    setLoading(true); setError(null); setResult(null); setLogs([]);
    log(`[HCS] Submitting task to topic 0.0.8198585...`);
    log(`[HCS] Type: ${taskType} · Reward: ${rewardMDT} MDT · Subnet: ${subnetId}`);

    try {
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType, prompt, rewardMDT: Number(rewardMDT), subnetId, deadline, requester: accountId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Submission failed');

      log(`[HCS] ✓ Sequence #${data.sequence} · Topic ${data.topicId}`);
      log(`[HCS] Task ID: ${data.taskId}`);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
      log(`[ERROR] ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null); setLogs([]); setError(null); setPrompt('');
  };

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="absolute top-[22%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl bg-[#0a0e17]/95 backdrop-blur-xl border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.8),0_0_40px_rgba(255,0,128,0.1)] rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">

        {/* Glow Effects */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-neon-pink/50 to-transparent" />
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-neon-pink/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-neon-cyan/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between p-6 sm:p-8 border-b border-white/5 shrink-0 bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center shadow-[0_0_15px_rgba(255,0,128,0.2)]">
              <Send className="w-5 h-5 text-neon-pink" />
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-white uppercase tracking-wider">Submit AI Task</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Hedera HCS · Topic <span className="text-neon-cyan">0.0.8198585</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="relative p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
          {!result ? (
            <>
              {/* Task Type + Subnet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 group-focus-within:text-neon-pink transition-colors">Task Type</label>
                  <div className="relative">
                    <select value={taskType} onChange={e => setTaskType(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white font-medium appearance-none outline-none focus:border-neon-pink/50 focus:bg-neon-pink/5 focus:ring-1 focus:ring-neon-pink/50 transition-all cursor-pointer">
                      {TASK_TYPES.map(t => <option key={t.value} value={t.value} className="bg-[#0a0e17]">{t.label}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within:text-neon-pink">expand_more</span>
                  </div>
                </div>
                <div className="group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 group-focus-within:text-neon-cyan transition-colors">Subnet Routing</label>
                  <div className="relative">
                    <select value={subnetId} onChange={e => setSubnetId(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white font-medium appearance-none outline-none focus:border-neon-cyan/50 focus:bg-neon-cyan/5 focus:ring-1 focus:ring-neon-cyan/50 transition-all cursor-pointer">
                      {SUBNETS.map(s => <option key={s.id} value={s.id} className="bg-[#0a0e17]">{s.name}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within:text-neon-cyan">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Prompt */}
              <div className="group">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 group-focus-within:text-white transition-colors">Task Description / Prompt</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                  placeholder="E.g., Analyze this image for anomalies, or generate a detailed report..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-sm text-white outline-none focus:border-white/30 focus:bg-white/5 transition-all resize-none placeholder:text-slate-600 font-mono shadow-inner" />
              </div>

              {/* Reward + Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 group-focus-within:text-neon-green transition-colors">Reward (MDT)</label>
                  <div className="relative">
                    <input type="number" min="0.1" step="0.1" value={rewardMDT} onChange={e => setRewardMDT(e.target.value)}
                      className="no-spinners w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white outline-none focus:border-neon-green/50 focus:bg-neon-green/5 focus:ring-1 focus:ring-neon-green/50 transition-all font-mono font-bold" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">MDT</span>
                  </div>
                </div>
                <div className="group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 group-focus-within:text-neon-purple transition-colors">Delivery Deadline</label>
                  <div className="relative">
                    <input type="number" min="1" max="168" value={deadline} onChange={e => setDeadline(Number(e.target.value))}
                      className="no-spinners w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white outline-none focus:border-neon-purple/50 focus:bg-neon-purple/5 focus:ring-1 focus:ring-neon-purple/50 transition-all font-mono font-bold" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">HOURS</span>
                  </div>
                </div>
              </div>

              {/* Requester Profile */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Requester Account</label>
                <div className="px-4 py-3.5 bg-black/40 border border-white/5 rounded-xl text-sm font-mono text-slate-400 flex items-center justify-between shadow-inner">
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                       <span className="text-white font-bold">{accountId}</span>
                    </div>
                  ) : <span className="text-red-400 flex items-center gap-2"><span className="material-symbols-outlined text-sm">warning</span> Wallet Not Connected</span>}
                </div>
              </div>

              {/* Log Stream */}
              {logs.length > 0 && (
                <div className="bg-black/60 rounded-xl border border-white/5 p-4 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar font-mono shadow-inner relative">
                  {logs.map((l, i) => (
                    <div key={i} className={`text-[11px] ${l.includes('ERROR') ? 'text-red-400' : l.includes('✓') ? 'text-neon-green drop-shadow-[0_0_3px_rgba(0,255,163,0.5)]' : 'text-slate-400'}`}>
                      <span className="opacity-50 mr-2 text-[9px]">{'>'}</span>{l}
                    </div>
                  ))}
                  {loading && (
                    <div className="text-neon-pink text-[11px] flex items-center gap-2 mt-2">
                      <span className="opacity-50 mr-1 text-[9px]">{'>'}</span>
                      <Activity size={12} className="animate-spin" />
                      Broadcasting to Hedera Consensus Service...
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                </div>
              )}

              {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400 flex items-start gap-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                <span className="material-symbols-outlined text-base shrink-0">error</span>
                {error}
              </div>}
            </>
          ) : (
            /* Success State */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-5 p-6 bg-neon-green/5 border border-neon-green/20 rounded-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-neon-green/10 to-transparent pointer-events-none" />
                <div className="w-16 h-16 rounded-full bg-neon-green/20 border-2 border-neon-green/40 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(0,255,163,0.3)]">
                  <span className="material-symbols-outlined text-neon-green text-3xl">task_alt</span>
                </div>
                <div className="relative">
                  <div className="text-lg font-black text-neon-green uppercase tracking-wide drop-shadow-[0_0_5px_rgba(0,255,163,0.5)]">Network Consensus Achieved</div>
                  <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                    Sequence #{result.sequence}
                    <span className="text-slate-600">•</span>
                    Topic {result.topicId}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-1 shadow-inner relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><span className="material-symbols-outlined text-4xl">fingerprint</span></div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Unique Task ID</div>
                  <div className="text-white text-xs font-mono break-all font-medium pt-1">{result.taskId}</div>
                </div>
                <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-1 shadow-inner relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"><span className="material-symbols-outlined text-4xl text-neon-green">payments</span></div>
                  <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Allocated Reward</div>
                  <div className="text-neon-green text-xl font-black font-mono pt-1">{rewardMDT} MDT</div>
                  <div className="text-xs text-slate-400 font-medium">Routed to Subnet {subnetId}</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a href={result.txUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl text-neon-cyan text-xs font-bold uppercase tracking-widest hover:bg-neon-cyan/20 hover:shadow-[0_0_20px_rgba(0,243,255,0.2)] transition-all">
                  <span className="material-symbols-outlined text-lg">public</span>
                  View Transaction
                </a>
                <a href={result.topicUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all">
                  <span className="material-symbols-outlined text-lg opacity-50">forum</span>
                  View Topic Log
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative p-6 sm:p-8 border-t border-white/5 shrink-0 bg-[#0a0e17] flex justify-end gap-4">
          <button onClick={result ? reset : onClose}
            className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            {result ? 'Submit Another' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={handleSubmit} disabled={loading || !isConnected || !prompt.trim()}
              className="flex justify-center items-center gap-2 min-w-[160px] px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,0,128,0.2)] bg-gradient-to-r from-neon-pink/20 to-neon-purple/20 border border-neon-pink/50 text-white hover:border-white hover:shadow-[0_0_30px_rgba(255,0,128,0.4)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-neon-pink/50 disabled:hover:shadow-none">
              {loading ? <Activity size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? 'Processing...' : 'Submit to Network'}
            </button>
          )}
          {result && (
            <button onClick={onClose}
              className="px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-neon-green/20 to-emerald-500/20 border border-neon-green/50 text-white shadow-[0_0_20px_rgba(0,255,163,0.2)] hover:shadow-[0_0_30px_rgba(0,255,163,0.4)] hover:border-white hover:brightness-110 transition-all">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
