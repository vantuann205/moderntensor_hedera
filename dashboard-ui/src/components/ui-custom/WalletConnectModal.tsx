'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, WalletCards, ShieldCheck } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';

interface WalletConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
    const { connectHashPack, connectMetaMask } = useWallet();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Background with soft blur and subtle darkness */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-md animate-fade-in" 
                onClick={onClose} 
            />
            
            <div className="relative w-full max-w-md bg-[#050b14]/95 border border-white/10 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden glass-panel animate-scale-in">
                
                {/* Visual Highlights */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
                <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-neon-purple/20 rounded-full blur-3xl" />
                <div className="absolute bottom-[-50px] right-[-50px] w-32 h-32 bg-neon-cyan/20 rounded-full blur-3xl" />

                <div className="flex items-center justify-between p-8 border-b border-white/5 relative z-10">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter font-display">Wallet Gateway</h2>
                        <div className="flex items-center gap-2">
                             <div className="h-1.5 w-1.5 rounded-full bg-neon-cyan animate-pulse" />
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connect to protocol</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 grid gap-5 relative z-10">
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Choose your gateway to the ModernTensor network. Authenticate to manage subnets, claim rewards, and verify validator status.</p>
                    
                    {/* HashPack */}
                    <button 
                        onClick={async () => { await connectHashPack(); onClose(); }}
                        className="group relative flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-panel-dark/40 hover:bg-panel-dark/60 hover:border-neon-cyan/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all duration-300"
                    >
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-xl bg-[#111827] p-2.5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <img src="https://cdn.prod.website-files.com/614c99cf4f23700c8aa3752a/6323b696c42eaa1be5f8152a_public.png" alt="HashPack" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-left flex flex-col">
                                <span className="text-sm font-black text-white uppercase tracking-wider group-hover:text-neon-cyan transition-colors font-display">HashPack Wallet</span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Hedera Native • Testnet</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 text-[8px] font-black text-neon-cyan uppercase tracking-widest">Premium</span>
                            <span className="material-symbols-outlined text-slate-700 group-hover:text-neon-cyan group-hover:translate-x-1 transition-all">chevron_right</span>
                        </div>
                    </button>

                    {/* MetaMask */}
                    <button 
                        onClick={async () => { await connectMetaMask(); onClose(); }}
                        className="group relative flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-panel-dark/40 hover:bg-panel-dark/60 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)] transition-all duration-300"
                    >
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-xl bg-[#111827] p-2.5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT3ymr3UNKopfI0NmUY95Dr-0589vG-91KuAA&s" alt="MetaMask" className="w-full h-full object-contain rounded-md" />
                            </div>
                            <div className="text-left flex flex-col">
                                <span className="text-sm font-black text-white uppercase tracking-wider group-hover:text-orange-500 transition-colors font-display">MetaMask / EVM</span>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Compatible • Hedera RPC</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[8px] font-black text-orange-400 uppercase tracking-widest">Web3</span>
                            <span className="material-symbols-outlined text-slate-700 group-hover:text-orange-500 group-hover:translate-x-1 transition-all">chevron_right</span>
                        </div>
                    </button>

                    <div className="mt-4 p-5 rounded-2xl bg-neon-purple/5 border border-neon-purple/20 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-neon-purple/10 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-4 h-4 text-neon-purple" />
                        </div>
                        <div className="text-[10px] text-slate-400 leading-relaxed font-medium">
                            <span className="text-neon-purple font-black uppercase tracking-widest block mb-0.5">Protocol Verification</span>
                            Authentication is read-only. Your keys remain encrypted within your wallet provider at all times.
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
