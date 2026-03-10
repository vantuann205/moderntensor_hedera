'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useExplorer } from '@/lib/hooks/useProtocolData';
import { Search, Hash, Clock, User, ArrowRight, ExternalLink } from 'lucide-react';

const TOPICS = [
    { id: process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID || '0.0.8146315', name: 'Miner Registry' },
    { id: process.env.NEXT_PUBLIC_TASK_TOPIC_ID || '0.0.8146317', name: 'Task Flow' },
    { id: process.env.NEXT_PUBLIC_SCORING_TOPIC_ID || '0.0.8146316', name: 'Audit Stream' },
];

function ExplorerContent() {
    const searchParams = useSearchParams();
    const [selectedTopic, setSelectedTopic] = useState(TOPICS[0].id);

    useEffect(() => {
        const topicId = searchParams.get('topic');
        if (topicId && TOPICS.some(t => t.id === topicId)) {
            setSelectedTopic(topicId);
        }
    }, [searchParams]);

    const { data: messages, isLoading } = useExplorer(selectedTopic);

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-2 text-neon-cyan text-[10px] font-bold uppercase tracking-[0.3em] mb-2">
                        <Search size={14} />
                        Chain Explorer
                    </div>
                    <h1 className="text-5xl font-display font-bold text-white tracking-tighter italic uppercase leading-none">
                        Protocol <span className="text-neon-cyan">Scanner</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-3 max-w-xl font-medium">
                        Direct inspection of ModernTensor HCS topics on the Hedera Testnet.
                    </p>
                </div>
            </div>

            {/* Topic Selector */}
            <div className="flex flex-wrap gap-2">
                {TOPICS.map((topic) => (
                    <button
                        key={topic.id}
                        onClick={() => setSelectedTopic(topic.id)}
                        className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${selectedTopic === topic.id
                                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 shadow-[0_0_15px_rgba(0,243,255,0.1)]'
                                : 'bg-white/[0.02] text-slate-500 border border-white/5 hover:border-white/10'
                            }`}
                    >
                        {topic.name} ({topic.id})
                    </button>
                ))}
            </div>

            {/* Message List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-600 bg-white/[0.01] rounded-2xl border border-white/5">
                        <div className="animate-spin w-6 h-6 border-2 border-neon-cyan border-t-transparent rounded-full mx-auto mb-4" />
                        Scanning Ledger...
                    </div>
                ) : messages?.length === 0 ? (
                    <div className="p-12 text-center text-slate-600 bg-white/[0.01] rounded-2xl border border-white/5">
                        No messages found in this topic.
                    </div>
                ) : (
                    messages?.map((msg: any) => (
                        <div key={msg.timestamp} className="panel p-6 space-y-4 group">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                                <div className="flex items-center gap-6">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sequence</div>
                                        <div className="text-sm font-mono font-bold text-white">#{msg.sequence}</div>
                                    </div>
                                    <div className="space-y-1 border-l border-white/10 pl-6">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Payer</div>
                                        <div className="text-sm font-mono font-bold text-neon-cyan">{msg.payer}</div>
                                    </div>
                                    <div className="space-y-1 border-l border-white/10 pl-6">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Consensus</div>
                                        <div className="text-xs font-mono text-slate-400">
                                            {new Date(Number(msg.timestamp) * 1000).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <a
                                    href={`https://hashscan.io/testnet/transaction/${msg.timestamp}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:text-white transition-colors uppercase tracking-widest"
                                >
                                    Hashscan <ExternalLink size={12} />
                                </a>
                            </div>

                            <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                                <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto custom-scrollbar">
                                    {JSON.stringify(msg.content, null, 4)}
                                </pre>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default function ExplorerPage() {
    return (
        <Suspense fallback={
            <div className="p-12 text-center text-slate-600">
                Initializing Scanner...
            </div>
        }>
            <ExplorerContent />
        </Suspense>
    );
}
