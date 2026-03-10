'use client';

import { ExternalLink, Hash, Shield, Zap, UserPlus } from 'lucide-react';

export default function ProtocolInfrastructure() {
    const topics = [
        {
            name: 'Miner Registry',
            id: process.env.NEXT_PUBLIC_REGISTRATION_TOPIC_ID || '0.0.8146315',
            icon: UserPlus,
            color: 'text-neon-cyan',
            desc: 'Real-time node identities and staking proofs.'
        },
        {
            name: 'Task Flow',
            id: process.env.NEXT_PUBLIC_TASK_TOPIC_ID || '0.0.8146317',
            icon: Zap,
            color: 'text-neon-yellow',
            desc: 'On-chain compute job requests and deadlines.'
        },
        {
            name: 'Audit Stream',
            id: process.env.NEXT_PUBLIC_SCORING_TOPIC_ID || '0.0.8146316',
            icon: Shield,
            color: 'text-neon-purple',
            desc: 'Verified scores and reward distribution logs.'
        }
    ];

    return (
        <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Hash size={14} className="text-neon-cyan" />
                Verifiable Infrastructure
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topics.map((t) => (
                    <div key={t.id} className="panel p-5 space-y-3 group hover:border-white/20 transition-all">
                        <div className="flex items-center justify-between">
                            <div className={`p-2 rounded-lg bg-white/[0.03] border border-white/5 ${t.color}`}>
                                <t.icon size={16} />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-600 group-hover:text-slate-400">
                                {t.id}
                            </span>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-tight italic">
                                {t.name}
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                                {t.desc}
                            </p>
                        </div>
                        <a
                            href={`https://hashscan.io/testnet/topic/${t.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="pt-2 flex items-center gap-2 text-[9px] font-bold text-neon-cyan/60 hover:text-neon-cyan transition-colors uppercase tracking-widest border-t border-white/5"
                        >
                            View on Hashscan <ExternalLink size={10} />
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
}
