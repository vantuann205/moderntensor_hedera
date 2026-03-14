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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0a0e17] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center">
              <Send className="w-4 h-4 text-neon-pink" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white uppercase tracking-wider">Submit AI Task</h2>
              <p className="text-[10px] text-slate-500 font-mono">Hedera HCS · Topic 0.0.8198585</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {!result ? (
            <>
              {/* Task Type + Subnet */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Task Type</label>
                  <select value={taskType} onChange={e => setTaskType(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-neon-pink/40">
                    {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Subnet</label>
                  <select value={subnetId} onChange={e => setSubnetId(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-neon-pink/40">
                    {SUBNETS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Prompt / Task Description</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                  placeholder="Describe the AI task you want miners to complete..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-pink/40 resize-none placeholder:text-slate-600 font-mono" />
              </div>

              {/* Reward + Deadline */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Reward (MDT)</label>
                  <input type="number" min="0.1" step="0.1" value={rewardMDT} onChange={e => setRewardMDT(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-neon-pink/40 font-mono" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Deadline (hours)</label>
                  <input type="number" min="1" max="168" value={deadline} onChange={e => setDeadline(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-neon-pink/40 font-mono" />
                </div>
              </div>

              {/* Requester */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Requester (your account)</label>
                <div className="px-4 py-2.5 bg-black/40 border border-white/5 rounded-xl text-sm font-mono text-slate-400">
                  {isConnected ? accountId : <span className="text-red-400">Connect wallet first</span>}
                </div>
              </div>

              {/* Log */}
              {logs.length > 0 && (
                <div className="bg-black/60 rounded-xl border border-white/5 p-3 space-y-1 max-h-28 overflow-y-auto">
                  {logs.map((l, i) => (
                    <div key={i} className={`text-[10px] font-mono ${l.includes('ERROR') ? 'text-red-400' : l.includes('✓') ? 'text-neon-green' : 'text-slate-400'}`}>{l}</div>
                  ))}
                  {loading && <div className="text-neon-pink text-[10px] font-mono animate-pulse flex items-center gap-1"><Activity size={10} /> Submitting to Hedera...</div>}
                </div>
              )}

              {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400">✗ {error}</div>}
            </>
          ) : (
            /* Success state */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center">
                  <CheckCircle className="text-neon-green" size={20} />
                </div>
                <div>
                  <div className="text-sm font-black text-neon-green uppercase tracking-wider">Task Submitted to Hedera HCS</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">Sequence #{result.sequence} · {result.topicId}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <div className="text-slate-500 text-[9px] uppercase tracking-widest">Task ID</div>
                  <div className="text-white break-all">{result.taskId}</div>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <div className="text-slate-500 text-[9px] uppercase tracking-widest">Reward</div>
                  <div className="text-neon-green font-bold">{rewardMDT} MDT</div>
                  <div className="text-slate-500">Subnet {subnetId}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <a href={result.txUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-neon-cyan text-xs font-bold hover:underline">
                  <span className="material-symbols-outlined text-sm">open_in_new</span>View on HashScan
                </a>
                <a href={result.topicUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-slate-400 text-xs font-bold hover:text-white hover:underline">
                  <span className="material-symbols-outlined text-sm">open_in_new</span>View Topic
                </a>
              </div>
              {logs.map((l, i) => (
                <div key={i} className={`text-[10px] font-mono ${l.includes('✓') ? 'text-neon-green' : 'text-slate-500'}`}>{l}</div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex justify-end gap-3">
          <button onClick={result ? reset : onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
            {result ? 'Submit Another' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={handleSubmit} disabled={loading || !isConnected || !prompt.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all bg-neon-pink/10 border border-neon-pink/40 text-neon-pink hover:bg-neon-pink/20 disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? <Activity size={14} className="animate-spin" /> : <Send size={14} />}
              {loading ? 'Submitting...' : 'Submit Task'}
            </button>
          )}
          {result && (
            <button onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-neon-green/10 border border-neon-green/40 text-neon-green hover:bg-neon-green/20 transition-all">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
