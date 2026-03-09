'use client';

import { useQuery } from '@tanstack/react-query';
import { Wallet, ExternalLink, Activity } from 'lucide-react';
import { useState } from 'react';

const HEDERA_ACCOUNT_ID = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '0.0.8127455';
const EVM_ADDRESS = process.env.NEXT_PUBLIC_EVM_ADDRESS || '0xf75a2924edfbc831f5936b1546ef54421a9f1fea';
const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

function formatHbar(tinybars: number) {
    return (tinybars / 1e8).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Topbar() {
    const [walletOpen, setWalletOpen] = useState(false);

    const { data: accountData } = useQuery({
        queryKey: ['hedera-account'],
        queryFn: async () => {
            const res = await fetch(`${MIRROR_BASE}/api/v1/accounts/${HEDERA_ACCOUNT_ID}`);
            if (!res.ok) throw new Error('Failed to fetch account');
            return res.json();
        },
        refetchInterval: 15000,
        retry: 2,
    });

    const { data: txData } = useQuery({
        queryKey: ['hedera-txs'],
        queryFn: async () => {
            const res = await fetch(`${MIRROR_BASE}/api/v1/transactions?account.id=${HEDERA_ACCOUNT_ID}&limit=5`);
            if (!res.ok) throw new Error('Failed to fetch transactions');
            return res.json();
        },
        refetchInterval: 30000,
    });

    const balance = accountData?.balance?.balance;
    const transactions = txData?.transactions || [];

    return (
        <header className="h-14 bg-[#080f1d]/80 backdrop-blur border-b border-white/5 flex items-center justify-between px-6 z-10">
            {/* Left: Page title via breadcrumb placeholder */}
            <div className="flex items-center gap-2">
                <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                </span>
                <span className="text-xs font-mono text-slate-400 tracking-wider">HEDERA TESTNET</span>
            </div>

            {/* Right: Wallet info */}
            <div className="flex items-center gap-3">
                <a
                    href={`https://hashscan.io/testnet/account/${HEDERA_ACCOUNT_ID}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 hover:border-cyan-400/40 px-3 py-1.5 rounded-lg transition-all group"
                >
                    <Activity size={12} className="text-cyan-400" />
                    <span className="text-xs font-mono text-slate-300">{HEDERA_ACCOUNT_ID}</span>
                    <ExternalLink size={10} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </a>

                <button
                    onClick={() => setWalletOpen(o => !o)}
                    className="relative flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/30 px-3 py-1.5 rounded-lg hover:bg-cyan-400/20 transition-all"
                >
                    <Wallet size={14} className="text-cyan-400" />
                    {balance !== undefined ? (
                        <span className="text-xs font-mono font-semibold text-cyan-400">
                            ℏ {formatHbar(balance)}
                        </span>
                    ) : (
                        <span className="text-xs font-mono text-slate-400">Loading...</span>
                    )}
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-[#080f1d]" />
                </button>
            </div>

            {/* Wallet dropdown */}
            {walletOpen && (
                <div className="absolute top-14 right-4 z-50 w-80 bg-[#0c1527] border border-cyan-400/20 rounded-xl shadow-2xl shadow-black/60 p-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Wallet</span>
                        <span className="text-[10px] bg-green-400/15 text-green-400 px-2 py-0.5 rounded-full border border-green-400/30">CONNECTED</span>
                    </div>

                    <div className="space-y-2 text-xs font-mono mb-4">
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-slate-400">Account ID</span>
                            <span className="text-white">{HEDERA_ACCOUNT_ID}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-slate-400">Balance</span>
                            <span className="text-cyan-400 font-semibold">{balance !== undefined ? `ℏ ${formatHbar(balance)}` : '—'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-slate-400">EVM</span>
                            <span className="text-slate-300 truncate ml-2">{EVM_ADDRESS.slice(0, 14)}...{EVM_ADDRESS.slice(-6)}</span>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Recent Transactions</div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                            {transactions.length === 0 ? (
                                <div className="text-[10px] text-slate-600 text-center py-4 italic">No recent transactions</div>
                            ) : (
                                transactions.map((tx: any) => (
                                    <a
                                        key={tx.transaction_id}
                                        href={`https://hashscan.io/testnet/transaction/${tx.transaction_id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02] px-1 rounded transition-colors group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-300 truncate w-32">{tx.name || 'Transaction'}</span>
                                            <span className="text-[8px] text-slate-500">{new Date(Number(tx.consensus_timestamp) * 1000).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className={`text-[9px] font-bold ${tx.result === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}`}>{tx.result}</span>
                                            <ExternalLink size={8} className="text-slate-600 group-hover:text-cyan-400" />
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </div>

                    <a
                        href={`https://hashscan.io/testnet/account/${HEDERA_ACCOUNT_ID}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 bg-cyan-400/10 text-cyan-400 rounded-lg text-xs font-bold hover:bg-cyan-400/20 transition-all border border-cyan-400/20"
                    >
                        View on Hashscan <ExternalLink size={11} />
                    </a>
                </div>
            )}
        </header>
    );
}
