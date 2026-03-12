'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    Zap, 
    LogOut,
    PlusCircle,
    ChevronDown,
    UserCircle,
    Wallet,
    Sun,
    Moon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import RegistrationModal from '@/components/ui-custom/RegistrationModal';
import WalletConnectModal from '@/components/ui-custom/WalletConnectModal';
import { useWallet } from '@/context/WalletContext';

const navLinks = [
    { name: 'Dashboard', href: '/' },
    { name: 'Miners', href: '/miners' },
    { name: 'Validators', href: '/validators' },
    { name: 'Tasks', href: '/tasks' },
    { name: 'Rewards', href: '/rewards' },
    { name: 'Network', href: '/network' },
];

export default function Navbar() {
    const pathname = usePathname();
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    
    const { isConnected, address, accountId, balance, type, disconnect, isMiner, isValidator } = useWallet();

    const truncateAddress = (addr: string) => {
        if (!addr) return '';
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) return (
        <div className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/10" />
    );

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center hover:border-neon-cyan/40 transition-all text-slate-400 hover:text-white"
            aria-label="Toggle Theme"
        >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
}

    return (
        <>
            <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0a0e17]/80 backdrop-blur-md">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan via-neon-purple to-neon-blue p-[1px]">
                            <div className="w-full h-full rounded-xl bg-[#0a0e17] flex items-center justify-center group-hover:bg-transparent transition-colors">
                                <Zap className="text-white group-hover:scale-110 transition-transform" size={20} fill="currentColor" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-display font-black tracking-tighter text-white uppercase italic">ModernTensor Hedera</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-neon-cyan uppercase tracking-widest font-bold">Decentralized AI Network</span>
                            </div>
                        </div>
                    </Link>

                    {/* Nav Links */}
                    <div className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/5">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className={`flex items-center px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                                        isActive 
                                            ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-white/20' 
                                            : 'text-white/70 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {link.name}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        {/* Theme Toggle & Wallet Button Container */}
                        <div className="flex items-center gap-2">
                            {/* Theme Toggle Button */}
                            <ThemeToggle />

                            {isConnected ? (
                                <div className="relative">
                                    <button 
                                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                                        className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-neon-cyan/50 h-11 transition-all group hover:bg-white/5"
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center p-0.5">
                                            <img 
                                                src={type === 'hashpack' ? 'https://www.hashpack.app/img/logo.svg' : 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Mirror.svg'} 
                                                alt="Wallet" 
                                                className="w-full h-full rounded-lg"
                                            />
                                        </div>
                                        <div className="flex flex-col items-start leading-tight">
                                            <span className="text-[10px] font-bold text-white font-mono">{truncateAddress(address || accountId || '')}</span>
                                            <span className="text-[9px] font-bold text-neon-cyan uppercase tracking-tighter">{balance} MDT Available</span>
                                        </div>
                                        <ChevronDown size={12} className={`text-white transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {isProfileOpen && (
                                        <div className="absolute right-0 mt-3 w-64 bg-[#0d121f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel animate-in fade-in slide-in-from-top-2">
                                            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-10 h-10 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center">
                                                        <UserCircle className="text-neon-cyan" size={20} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-white uppercase">{type} Connected</span>
                                                        <span className="text-[10px] text-white font-mono">{accountId}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {isMiner ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 text-[9px] font-bold text-neon-cyan uppercase">✓ Active Miner</span>
                                                    ) : null}
                                                    {isValidator ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-neon-purple/10 border border-neon-purple/20 text-[9px] font-bold text-neon-purple uppercase">✓ Active Validator</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            
                                            <div className="p-2">
                                                {(!isMiner && !isValidator) && (
                                                    <button 
                                                        onClick={() => { setIsRegisterOpen(true); setIsProfileOpen(false); }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white hover:bg-neon-cyan/10 transition-all"
                                                    >
                                                        <PlusCircle size={16} className="text-neon-cyan" /> Register as Node
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => { disconnect(); setIsProfileOpen(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-400/10 transition-all"
                                                >
                                                    <LogOut size={16} /> Disconnect Wallet
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setIsWalletModalOpen(true)}
                                    className="group relative flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-neon-cyan/40 transition-all overflow-hidden h-11 hover:bg-white/5"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <Wallet className="text-neon-cyan group-hover:scale-110 transition-transform" size={16} />
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-200 group-hover:text-white">Connect Wallet</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Modals moved outside nav to avoid stacking context issues with backdrop-blur */}
            <RegistrationModal 
                isOpen={isRegisterOpen} 
                onClose={() => setIsRegisterOpen(false)} 
            />
            
            <WalletConnectModal
                isOpen={isWalletModalOpen}
                onClose={() => setIsWalletModalOpen(false)}
            />
        </>
    );
}
