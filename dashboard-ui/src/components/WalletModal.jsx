import React, { useState } from 'react';
import { X, Wallet, Gem, Sword, FishSymbol, ExternalLink, ArrowRight, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WalletModal({ isOpen, onClose, onConnect }) {
    const [manualAccountId, setManualAccountId] = useState('');
    const [mode, setMode] = useState('wallets'); // 'wallets' | 'manual'

    const wallets = [
        { id: 'hashpack', name: 'HashPack', Icon: Gem, color: 'text-purple-400', desc: 'Leading Hedera wallet' },
        { id: 'blade', name: 'Blade Wallet', Icon: Sword, color: 'text-cyan-400', desc: 'Enterprise grade security' },
        { id: 'metamask', name: 'MetaMask', Icon: FishSymbol, color: 'text-orange-400', desc: 'EVM compatible' },
    ];

    const handleManualConnect = () => {
        const trimmed = manualAccountId.trim();
        if (!trimmed || !/^0\.0\.\d+$/.test(trimmed)) return;
        onConnect({ id: 'manual', name: 'Direct Account', accountId: trimmed });
        setManualAccountId('');
        setMode('wallets');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-primary/20"
                    >
                        {/* Header */}
                        <div className="relative flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                            <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                                    <Wallet size={20} />
                                </div>
                                Connect Wallet
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-3">
                            {mode === 'wallets' ? (
                                <>
                                    {wallets.map((wallet) => (
                                        <button
                                            key={wallet.id}
                                            onClick={() => onConnect(wallet)}
                                            className="group relative w-full flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-primary/30 transition-all duration-300 text-left overflow-hidden"
                                        >
                                            <div className={`w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center ${wallet.color} ring-1 ring-white/10 group-hover:scale-110 transition-transform`}>
                                                <wallet.Icon size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-white group-hover:text-primary transition-colors">{wallet.name}</div>
                                                <div className="text-xs text-gray-400">{wallet.desc}</div>
                                            </div>
                                            <div className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary">
                                                <ArrowRight size={20} />
                                            </div>
                                            <div className="absolute inset-0 rounded-xl ring-2 ring-primary/0 group-hover:ring-primary/20 transition-all" />
                                        </button>
                                    ))}
                                    <div className="pt-2 border-t border-white/5">
                                        <button
                                            onClick={() => setMode('manual')}
                                            className="group w-full flex items-center gap-4 p-4 rounded-xl border border-dashed border-white/10 hover:border-primary/30 hover:bg-white/5 transition-all text-left"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center text-green-400 ring-1 ring-white/10">
                                                <KeyRound size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-white group-hover:text-primary transition-colors">Direct Account ID</div>
                                                <div className="text-xs text-gray-400">Enter your Hedera Account ID (0.0.xxxxx)</div>
                                            </div>
                                            <ArrowRight size={20} className="text-gray-600 group-hover:text-primary transition-colors" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <button onClick={() => setMode('wallets')} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1">
                                        ← Back to wallets
                                    </button>
                                    <div>
                                        <label className="text-sm text-gray-400 mb-2 block">Hedera Account ID</label>
                                        <input
                                            type="text"
                                            value={manualAccountId}
                                            onChange={(e) => setManualAccountId(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleManualConnect()}
                                            placeholder="0.0.7851838"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:bg-white/10 transition-all font-mono"
                                            autoFocus
                                        />
                                        <p className="text-xs text-gray-500 mt-2">Get your Account ID from <a href="https://portal.hedera.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">portal.hedera.com</a></p>
                                    </div>
                                    <button
                                        onClick={handleManualConnect}
                                        disabled={!manualAccountId.trim() || !/^0\.0\.\d+$/.test(manualAccountId.trim())}
                                        className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
                                    >
                                        Connect Account
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-black/40 text-xs text-center text-gray-500 border-t border-white/5">
                            <span className="flex items-center justify-center gap-1">
                                By connecting, you agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a>
                            </span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
