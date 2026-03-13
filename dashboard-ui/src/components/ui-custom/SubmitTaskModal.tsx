'use client';

import { useState } from 'react';
import { Send, Terminal, X, Code, Activity, Play, Target } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { useWallet } from '@/context/WalletContext';

interface SubmitTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SubmitTaskModal({ isOpen, onClose }: SubmitTaskModalProps) {
    const queryClient = useQueryClient();
    const { accountId } = useWallet();
    
    const [reward, setReward] = useState('50.0');
    const [requester, setRequester] = useState(accountId || '');
    const [language, setLanguage] = useState('solidity');
    const [code, setCode] = useState('pragma solidity ^0.8.0;\ncontract Foo {\n    function bar() external {\n        // Need review\n    }\n}');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [success, setSuccess] = useState(false);
    const [inferenceData, setInferenceData] = useState<any>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setLogs(['[SYSTEM] Initializing on-chain task submission sequence...']);
        setSuccess(false);

        try {
            const res = await fetch('/api/tasks/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reward, requester, code, language, subnet: 1 })
            });

            const data = await res.json();
            
            if (data.success) {
                // Parse logs from python output if any
                if (data.logs) {
                    const newLogs = data.logs.split('\n').filter((l: string) => l.trim() !== '');
                    setLogs((prev) => [...prev, ...newLogs]);
                }
                setLogs((prev) => [...prev, '[SYSTEM] Task AI Analysis Complete', '[SYSTEM] Result committed to Hedera sequence!']);
                setInferenceData(data.data);
                setSuccess(true);
                // Invalidate query to refresh UI immediately
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                queryClient.invalidateQueries({ queryKey: ['network-stats'] });
            } else {
                setLogs((prev) => [...prev, `[ERROR] ${data.error || 'Failed to submit'}`]);
                if (data.logs) {
                    console.error("Python Logs:", data.logs);
                }
            }
        } catch (err: any) {
            setLogs((prev) => [...prev, `[ERROR] Network error: ${err.message}`]);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0a0e17]/80 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-3xl bg-[#0a0e17] border border-white/10 rounded-xl shadow-2xl overflow-hidden glass-panel">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neon-purple/10 flex items-center justify-center border border-neon-purple/20">
                            <Send className="w-4 h-4 text-neon-purple" />
                        </div>
                        <div>
                            <h2 className="text-lg font-display font-bold text-white uppercase tracking-wider">
                                Deploy Compute Task
                            </h2>
                            <p className="text-xs font-mono text-slate-400">Broadcast workload to Neural Network (HCS)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 grid gap-6 grid-cols-2">
                    {/* Left Form */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Reward (MDT)</label>
                                <input 
                                    type="text" 
                                    value={reward}
                                    onChange={(e) => setReward(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50 font-mono transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Language</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-purple/50 font-mono transition-colors appearance-none"
                                >
                                    <option value="solidity">Solidity</option>
                                    <option value="python">Python</option>
                                    <option value="rust">Rust</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Target Code <Code size={12} className="inline ml-1" /></label>
                            <textarea 
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                rows={6}
                                className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-sm text-neon-cyan focus:outline-none focus:border-neon-purple/50 font-mono transition-colors resize-none"
                            />
                        </div>
                    </div>

                    {/* Console Output or Result */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                            {success ? "AI Prediction & Verify" : "System Trace"}
                        </label>
                        
                        {success && inferenceData ? (
                            <div className="h-[240px] bg-[#020408]/80 rounded-lg border border-neon-cyan/20 p-4 font-mono text-xs overflow-y-auto space-y-4">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <div className="flex items-center gap-2 text-neon-green">
                                        <Activity size={14} /> <span>Code Review Completed</span>
                                    </div>
                                    <div className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-slate-300">
                                        Provider: {inferenceData.result.provider}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded bg-black/40 border border-white/5">
                                        <div className="text-[10px] text-slate-500 uppercase">Overall Quality</div>
                                        <div className="text-lg text-white font-bold">{Math.round(inferenceData.result.overall_score)}<span className="text-slate-500 text-xs">/100</span></div>
                                    </div>
                                    <div className="p-2 rounded bg-black/40 border border-white/5">
                                        <div className="text-[10px] text-slate-500 uppercase">Vulnerabilities</div>
                                        <div className="text-lg text-red-400 font-bold">{inferenceData.result.vulnerabilities.length}</div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-slate-400 text-[10px] uppercase tracking-widest">AI Summary</div>
                                    <div className="text-sm text-slate-300 leading-relaxed font-sans">{inferenceData.result.summary}</div>
                                </div>

                                <div className="pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                                        <Target size={12} className="text-neon-cyan" /> 
                                        <span className="text-[10px] uppercase tracking-widest font-bold">Hedera HCS Proof</span>
                                    </div>
                                    <div className="space-y-1 text-[10px]">
                                        <div className="flex bg-black/50 p-1.5 rounded">
                                            <span className="text-slate-500 w-16">TxHash:</span>
                                            <span className="text-neon-yellow truncate">{inferenceData.hedera.txHash}</span>
                                        </div>
                                        <div className="flex bg-black/50 p-1.5 rounded">
                                            <span className="text-slate-500 w-16">Seq #</span>
                                            <span className="text-slate-300">{inferenceData.hedera.sequence_number}</span>
                                        </div>
                                        <div className="flex bg-black/50 p-1.5 rounded">
                                            <span className="text-slate-500 w-16">Timestamp:</span>
                                            <span className="text-slate-300">{inferenceData.hedera.consensusTimestamp}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[240px] bg-black/80 rounded-lg border border-white/5 p-4 font-mono text-xs overflow-y-auto">
                                <div className="flex items-center gap-2 text-slate-500 mb-2 pb-2 border-b border-white/5">
                                    <Terminal size={12} />
                                    <span>Blockchain Execution Log</span>
                                </div>
                                {logs.length === 0 ? (
                                    <div className="text-slate-700 italic">Ready to deploy...</div>
                                ) : (
                                    <div className="space-y-1">
                                        {logs.map((log, i) => (
                                            <div key={i} className={`${log.includes('ERROR') ? 'text-red-400' : log.includes('SUCCESS') || log.includes('successfully') ? 'text-neon-green' : 'text-slate-300'}`}>
                                                <span className="text-slate-600 mr-2">{'>'}</span>{log}
                                            </div>
                                        ))}
                                        {isSubmitting && (
                                            <div className="text-neon-purple animate-pulse flex items-center gap-2 mt-2">
                                                <Activity size={12} /> Executing smart contract...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
                        {success ? 'Close' : 'Cancel'}
                    </button>
                    {!success ? (
                        <button 
                            onClick={handleSubmit} 
                            disabled={isSubmitting}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${isSubmitting ? 'bg-white/10 text-slate-500 cursor-not-allowed' : 'bg-neon-purple text-white hover:bg-white hover:text-black hover:shadow-[0_0_20px_rgba(188,19,254,0.4)]'}`}
                        >
                            {isSubmitting ? <Activity size={14} className="animate-spin" /> : <Play size={14} />}
                            {isSubmitting ? 'Executing...' : 'Submit Task & View AI'}
                        </button>
                    ) : (
                        <button 
                            onClick={() => {
                                setSuccess(false);
                                setInferenceData(null);
                                setLogs([]);
                            }} 
                            className="bg-white/10 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all border border-white/20"
                        >
                            New Task
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
