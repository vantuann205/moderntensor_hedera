'use client';

import React from 'react';
import { X, WalletCards, ShieldCheck } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';

interface WalletConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
    const { connectHashPack, connectMetaMask, isConnected } = useWallet();

    if (!isOpen) return null;

    const handleConnectHashPack = async () => {
        await connectHashPack();
        onClose();
    };

    const handleConnectMetaMask = async () => {
        await connectMetaMask();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-md bg-[#0a0e17] border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel">
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neon-purple/10 flex items-center justify-center border border-neon-purple/20">
                            <WalletCards className="w-4 h-4 text-neon-purple" />
                        </div>
                        <h2 className="text-lg font-display font-bold text-white uppercase tracking-wider">Connect Protocol Wallet</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 grid gap-4">
                    <p className="text-xs text-slate-400 font-mono mb-2">Select a supported wallet to access decentralized compute rewards and verify your node status.</p>
                    
                    {/* HashPack */}
                    <button 
                        onClick={handleConnectHashPack}
                        className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-black/40 p-2 border border-white/10 flex items-center justify-center group-hover:border-neon-cyan/50 transition-colors">
                                <img src="https://www.hashpack.app/img/logo.svg" alt="HashPack" className="w-full h-full" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white group-hover:text-neon-cyan transition-colors">HashPack Wallet</div>
                                <div className="text-[10px] text-slate-500">Official Hedera Native Extension</div>
                            </div>
                        </div>
                        <div className="px-2 py-0.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 text-[9px] font-bold text-neon-cyan uppercase">Native</div>
                    </button>

                    {/* MetaMask */}
                    <button 
                        onClick={handleConnectMetaMask}
                        className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-black/40 p-2 border border-white/10 flex items-center justify-center group-hover:border-orange-500/50 transition-colors">
                                <img src="https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg" alt="MetaMask" className="w-full h-full" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white group-hover:text-orange-500 transition-colors">MetaMask / EVM</div>
                                <div className="text-[10px] text-white/50">Connect via Hedera JSON-RPC</div>
                            </div>
                        </div>
                        <div className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[9px] font-bold text-white/70 uppercase">Web3</div>
                    </button>

                    <div className="mt-4 p-4 rounded-xl bg-neon-purple/5 border border-neon-purple/20 flex items-start gap-3">
                        <ShieldCheck className="w-4 h-4 text-neon-purple shrink-0 mt-0.5" />
                        <div className="text-[10px] text-slate-400 leading-relaxed">
                            <span className="text-neon-purple font-bold">Security Notice:</span> Connection is purely for read/sign purposes. Your private keys are never shared with the ModernTensor dashboard.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
