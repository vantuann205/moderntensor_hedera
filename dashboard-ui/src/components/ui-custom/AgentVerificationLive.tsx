'use client';

import { useEffect, useState } from 'react';
import { Shield, ExternalLink, Activity, CheckCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function AgentVerificationLive() {
    const [log, setLog] = useState<any>(null);

    useEffect(() => {
        const fetchLog = async () => {
            try {
                // Add timestamp to prevent caching
                const res = await fetch(`/verification_logs.json?t=${new Date().getTime()}`);
                if (res.ok) {
                    const data = await res.json();
                    setLog(data);
                }
            } catch (e) {
                console.error("Failed to fetch verification logs", e);
            }
        };

        fetchLog();
        const interval = setInterval(fetchLog, 2000);
        return () => clearInterval(interval);
    }, []);

    if (!log) {
        return (
            <div className="panel p-6 border-neon-cyan/20 bg-gradient-to-br from-neon-cyan/5 to-transparent h-[160px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-neon-cyan/50">
                    <RefreshCw className="animate-spin" size={24} />
                    <span className="text-xs font-bold uppercase tracking-widest">Awaiting Trust Protocol...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="panel p-6 border-neon-cyan/30 bg-gradient-to-br from-[#0a0e17] to-neon-cyan/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/10 blur-[50px] rounded-full group-hover:bg-neon-cyan/20 transition-all pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-neon-cyan/20 border border-neon-cyan/30 rounded-lg">
                        <Shield className="text-neon-cyan" size={16} />
                    </div>
                    <h3 className="text-sm font-display font-bold text-white italic uppercase tracking-widest">
                        Agent Trust Verification
                    </h3>
                </div>
                {log.status === 'success' ? (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[12px] font-bold uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle size={10} /> Verified
                    </span>
                ) : (
                    <span className="px-2 py-1 bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/30 rounded text-[12px] font-bold uppercase tracking-widest flex items-center gap-1">
                        <Activity size={10} className="animate-pulse" /> {log.step ? `Step ${log.step}/5` : 'Processing'}
                    </span>
                )}
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-end border-b border-white/5 pb-3">
                    <div>
                        <div className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-1">Current State</div>
                        <div className="text-sm font-mono text-white max-w-[200px] sm:max-w-md truncate">{log.message}</div>
                    </div>
                    {log.score !== undefined && (
                        <div className="text-right">
                            <div className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-1">Trust Score</div>
                            <div className="text-lg font-bold text-neon-cyan">{log.score.toFixed(4)}</div>
                        </div>
                    )}
                </div>

                {log.tx_id && (
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-mono text-slate-400 truncate max-w-[200px]">TX: {log.tx_id}</span>
                        <Link
                            href="/explorer"
                            className="text-[12px] font-bold text-neon-cyan hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors"
                        >
                            View on ledger <ExternalLink size={10} />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
