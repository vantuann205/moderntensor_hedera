'use client';

import { useState } from 'react';
import { CheckCircle2, X, ShieldCheck, Activity, AlertTriangle, ThumbsUp, ThumbsDown, Target } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/context/WalletContext';

interface ValidatorVerifyModalProps {
    isOpen: boolean;
    onClose: () => void;
    taskId?: string;
    minerId?: string;
}

export default function ValidatorVerifyModal({ isOpen, onClose, taskId, minerId }: ValidatorVerifyModalProps) {
    const queryClient = useQueryClient();
    const { accountId } = useWallet();
    const [validatorId, setValidatorId] = useState(accountId || '');
    const [score, setScore] = useState(80);
    const [confidence, setConfidence] = useState(0.9);
    const [notes, setNotes] = useState('');
    const [taskIdInput, setTaskIdInput] = useState(taskId || '');
    const [minerIdInput, setMinerIdInput] = useState(minerId || '');
    
    const [isVerifying, setIsVerifying] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const verdict = score >= 60 ? 'accepted' : 'rejected';
    const rewardWeight = Math.round(confidence * (score / 100) * 100) / 100;

    const handleVerify = async () => {
        setIsVerifying(true);
        setError('');
        setResult(null);
        
        try {
            const res = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: taskIdInput,
                    miner_id: minerIdInput,
                    validator_id: validatorId,
                    score,
                    confidence,
                    verdict,
                    notes,
                })
            });
            
            const data = await res.json();
            if (data.success) {
                setResult(data.verification);
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                queryClient.invalidateQueries({ queryKey: ['miners'] });
                queryClient.invalidateQueries({ queryKey: ['rewards'] });
            } else {
                setError(data.error || 'Verification failed');
            }
        } catch (e: any) {
            setError(`Network error: ${e.message}`);
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0a0e17]/80 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl bg-[#0a0e17] border border-white/10 rounded-xl shadow-2xl overflow-hidden glass-panel">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neon-purple/10 flex items-center justify-center border border-neon-purple/20">
                            <ShieldCheck className="w-4 h-4 text-neon-purple" />
                        </div>
                        <div>
                            <h2 className="text-lg font-display font-bold text-white uppercase tracking-wider">
                                Validator Verify
                            </h2>
                            <p className="text-xs font-mono text-slate-400">Score miner result → Vote → HCS commit</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                {result ? (
                    /* Success Result View */
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3 text-neon-green">
                            <CheckCircle2 size={24} />
                            <span className="font-bold text-lg uppercase tracking-wider">Verification Committed</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            {[
                                { label: 'Score', value: `${result.score}/100`, color: result.score >= 60 ? 'text-neon-green' : 'text-red-400' },
                                { label: 'Verdict', value: result.verdict.toUpperCase(), color: result.verdict === 'accepted' ? 'text-neon-cyan' : 'text-red-400' },
                                { label: 'Confidence', value: `${Math.round(result.confidence * 100)}%`, color: 'text-neon-yellow' },
                                { label: 'Reward Weight', value: result.reward_weight, color: 'text-neon-purple' },
                            ].map(item => (
                                <div key={item.label} className="bg-black/40 rounded-lg p-3 border border-white/5">
                                    <div className="text-[12px] text-slate-500 uppercase tracking-widest">{item.label}</div>
                                    <div className={`text-xl font-bold font-mono ${item.color}`}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                        <div className="text-xs text-slate-500 bg-black/30 rounded-lg p-3 border border-white/5">
                            <Target size={12} className="inline mr-2 text-neon-cyan" />
                            Vote recorded on Hedera HCS — Miner {result.miner_id} will receive reward proportional to validator weight.
                        </div>
                    </div>
                ) : (
                    <div className="p-6 grid grid-cols-2 gap-4">
                        {/* Left: Form */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Task ID</label>
                                <input value={taskIdInput} onChange={e => setTaskIdInput(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-purple/50 font-mono"
                                    placeholder="task-XXXXXXXX"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Miner ID</label>
                                <input value={minerIdInput} onChange={e => setMinerIdInput(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-purple/50 font-mono"
                                    placeholder="0.0.XXXXXXX"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Validator ID (You)</label>
                                <input value={validatorId} onChange={e => setValidatorId(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-purple/50 font-mono"
                                />
                            </div>
                        </div>

                        {/* Right: Scoring */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Score: <span className={score >= 60 ? 'text-neon-green' : 'text-red-400'}>{score}/100</span>
                                </label>
                                <input type="range" min={0} max={100} value={score} onChange={e => setScore(Number(e.target.value))}
                                    className="w-full h-2 accent-purple-500 cursor-pointer"
                                />
                                <div className="flex justify-between text-[12px] text-slate-600">
                                    <span>0 — Reject</span><span>60 — Accept</span><span>100 — Perfect</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Confidence: {Math.round(confidence * 100)}%
                                </label>
                                <input type="range" min={0.1} max={1} step={0.05} value={confidence} onChange={e => setConfidence(Number(e.target.value))}
                                    className="w-full h-2 accent-yellow-400 cursor-pointer"
                                />
                            </div>

                            {/* Live Verdict Preview */}
                            <div className={`flex items-center gap-2 rounded-lg p-3 border ${verdict === 'accepted' ? 'bg-neon-green/5 border-neon-green/20' : 'bg-red-500/5 border-red-500/20'}`}>
                                {verdict === 'accepted' 
                                    ? <ThumbsUp size={16} className="text-neon-green" />
                                    : <ThumbsDown size={16} className="text-red-400" />
                                }
                                <div>
                                    <div className={`text-xs font-bold uppercase ${verdict === 'accepted' ? 'text-neon-green' : 'text-red-400'}`}>{verdict}</div>
                                    <div className="text-[12px] text-slate-500">Reward weight: {rewardWeight}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notes (optional)</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-neon-purple/50 resize-none"
                                    placeholder="Add comments about this verification..."
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mx-6 mb-4 flex items-center gap-2 text-red-400 text-xs bg-red-400/5 rounded-lg p-3 border border-red-400/20">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                        {result ? 'Done' : 'Cancel'}
                    </button>
                    {!result && (
                        <button onClick={handleVerify} disabled={isVerifying || !taskIdInput || !minerIdInput}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all 
                                ${isVerifying || !taskIdInput || !minerIdInput
                                    ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                                    : 'bg-neon-purple text-white hover:bg-white hover:text-black hover:shadow-[0_0_20px_rgba(188,19,254,0.4)]'}`}
                        >
                            {isVerifying ? <Activity size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                            {isVerifying ? 'Committing Vote...' : 'Submit Verification'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
