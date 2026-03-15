import { useQuery } from '@tanstack/react-query';
import { Wallet, ExternalLink, Activity, LogOut, User, Zap } from 'lucide-react';
import { useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import WalletConnectModal from '../ui-custom/WalletConnectModal';

const MIRROR_BASE = 'https://testnet.mirrornode.hedera.com';

export default function Topbar() {
    const [walletOpen, setWalletOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { accountId, balance, address, isConnected, disconnect, type } = useWallet();

    const { data: txData } = useQuery({
        queryKey: ['hedera-txs', accountId],
        queryFn: async () => {
            if (!accountId) return { transactions: [] };
            const res = await fetch(`${MIRROR_BASE}/api/v1/transactions?account.id=${accountId}&limit=5`);
            if (!res.ok) throw new Error('Failed to fetch transactions');
            return res.json();
        },
        enabled: !!accountId,
        refetchInterval: 30000,
    });

    const transactions = txData?.transactions || [];

    return (
        <header className="h-16 bg-[#050b14]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 z-50 sticky top-0">
            <WalletConnectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

            {/* Left: Network Indicator */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-neon-cyan/5 border border-neon-cyan/20 rounded-full">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-cyan" />
                    </span>
                    <span className="text-[10px] font-black text-neon-cyan tracking-widest uppercase">Hedera Testnet</span>
                </div>
            </div>

            {/* Right: Wallet Ecosystem */}
            <div className="flex items-center gap-4">
                {!isConnected ? (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group relative flex items-center gap-3 bg-[#0a0f1e] text-white px-7 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] border border-white/10 hover:border-neon-cyan/50 transition-all duration-500 overflow-hidden"
                    >
                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        
                        <Zap size={14} className="text-neon-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                        Connect Wallet
                        
                        <div className="absolute -inset-1 bg-neon-cyan/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        {/* Account ID Badge */}
                        <a
                            href={`https://hashscan.io/testnet/account/${accountId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl transition-all group"
                        >
                            <User size={14} className="text-slate-500 group-hover:text-white transition-colors" />
                            <span className="text-[11px] font-black text-white font-mono">{accountId}</span>
                            <ExternalLink size={10} className="text-slate-600 group-hover:text-neon-cyan" />
                        </a>

                        {/* Balance Trigger */}
                        <button
                            onClick={() => setWalletOpen(o => !o)}
                            className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all relative border ${walletOpen ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                        >
                            <div className="flex flex-col items-end">
                                <span className="text-[11px] font-black text-white font-display">ℏ {balance || '0.00'}</span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{type}</span>
                            </div>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${type === 'hashpack' ? 'bg-neon-cyan/10 border-neon-cyan/20' : 'bg-orange-500/10 border-orange-500/20'} border`}>
                                <img 
                                    src={type === 'hashpack' ? "https://cdn.prod.website-files.com/614c99cf4f23700c8aa3752a/6323b696c42eaa1be5f8152a_public.png" : "https://www.pngall.com/wp-content/uploads/17/Metamask-Wallet-Logo-Design-PNG.png"} 
                                    className={`w-5 h-5 object-contain ${type === 'metamask' ? 'rounded-md' : ''}`} 
                                    alt="Wallet"
                                />
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* Wallet Dashboard Overlay */}
            {walletOpen && isConnected && (
                <div className="absolute top-20 right-8 z-50 w-96 bg-[#050b14]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 animate-fade-in-up glass-panel">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Account</span>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter font-display mt-1">Wallet Dashboard</h3>
                        </div>
                        <div className="flex h-2 w-2">
                             <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                        </div>
                    </div>

                    <div className="grid gap-4 mb-8">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Available Balance</span>
                            <div className="flex items-end justify-between">
                                <span className="text-2xl font-black text-white font-mono">ℏ {balance}</span>
                                <span className="text-[10px] text-neon-cyan font-bold bg-neon-cyan/10 px-2 py-0.5 rounded border border-neon-cyan/20">TESTNET</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between px-2">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">EVM Address</span>
                                <span className="text-[10px] font-mono text-slate-400 mt-1">{address ? `${address.slice(0, 12)}...${address.slice(-8)}` : '—'}</span>
                            </div>
                            <button className="material-symbols-outlined text-sm text-slate-600 hover:text-white transition-colors">content_copy</button>
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Activity</span>
                            <span className="text-[10px] text-neon-cyan font-bold animate-pulse">SYNCING...</span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {transactions.length === 0 ? (
                                <div className="text-[11px] text-slate-600 text-center py-8 border border-white/5 border-dashed rounded-xl">No recent network activity</div>
                            ) : (
                                transactions.map((tx: any) => (
                                    <a
                                        key={tx.consensus_timestamp}
                                        href={`https://hashscan.io/testnet/transaction/${tx.consensus_timestamp}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/5 transition-all group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-white uppercase tracking-wider">{tx.name.replace(/_/g, ' ')}</span>
                                            <span className="text-[8px] text-slate-500 font-bold font-mono mt-0.5">{new Date(parseFloat(tx.consensus_timestamp) * 1000).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-black ${tx.result === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}`}>{tx.result}</span>
                                            <ExternalLink size={10} className="text-slate-600 group-hover:text-neon-cyan" />
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={disconnect}
                            className="flex-grow flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            <LogOut size={14} /> Disconnect
                        </button>
                        <a 
                            href={`https://hashscan.io/testnet/account/${accountId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                        >
                            <ExternalLink size={16} />
                        </a>
                    </div>
                </div>
            )}
        </header>
    );
}
