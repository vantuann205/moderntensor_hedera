'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, Search, Menu, X, Cpu, Activity, LayoutDashboard, Database, Zap } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const HEDERA_ACCOUNT_ID = process.env.NEXT_PUBLIC_HEDERA_ACCOUNT_ID || '0.0.8127455';
const MIRROR_BASE = process.env.NEXT_PUBLIC_MIRROR_BASE || 'https://testnet.mirrornode.hedera.com';

export default function Navbar() {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const { data: accountData } = useQuery({
        queryKey: ['hedera-account'],
        queryFn: async () => {
            const res = await fetch(`${MIRROR_BASE}/api/v1/accounts/${HEDERA_ACCOUNT_ID}`);
            if (!res.ok) throw new Error('Failed to fetch account');
            return res.json();
        },
        refetchInterval: 15000,
    });

    const balance = accountData?.balance?.balance ? (accountData.balance.balance / 1e8).toFixed(2) : '--';

    const navLinks = [
        { name: 'Home', href: '/', icon: LayoutDashboard },
        { name: 'Miners', href: '/miners', icon: Cpu },
        { name: 'Validators', href: '/validators', icon: Activity },
        { name: 'Tasks', href: '/tasks', icon: Database },
        { name: 'Emissions', href: '/emissions', icon: Zap },
    ];

    return (
        <nav className="fixed top-0 left-0 w-full z-[100] bg-[#0a0e17]/80 backdrop-blur-xl border-b border-white/10 h-16">
            <div className="max-w-[1400px] mx-auto h-full px-6 flex items-center justify-between gap-8">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center p-1 shadow-[0_0_15px_rgba(0,243,255,0.3)] group-hover:shadow-[0_0_20px_rgba(0,243,255,0.5)] transition-all">
                        <Zap size={18} fill="white" className="text-white" />
                    </div>
                    <span className="font-display font-bold text-lg tracking-tighter text-white uppercase italic group-hover:neon-text transition-all">
                        ModernTensor
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden lg:flex items-center gap-1">
                    {navLinks.map((link) => {
                        const Icon = link.icon;
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${isActive
                                        ? 'text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20 shadow-[0_0_10px_rgba(0,243,255,0.1)]'
                                        : 'text-text-secondary hover:text-white'
                                    }`}
                            >
                                <Icon size={14} />
                                {link.name}
                            </Link>
                        );
                    })}
                </div>

                {/* Search & Wallet */}
                <div className="hidden lg:flex items-center gap-4 flex-1 max-w-xs">
                    <div className="relative w-full">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search Metagraph..."
                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan/40 transition-all font-mono"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end mr-2">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Balance</span>
                        <span className="text-sm font-mono font-bold text-neon-cyan tracking-tight">ℏ {balance}</span>
                    </div>

                    <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-neon-cyan/20 to-neon-blue/20 border border-neon-cyan/30 rounded-lg hover:border-neon-cyan transition-all group">
                        <Wallet size={14} className="text-neon-cyan group-hover:animate-pulse" />
                        <span className="text-xs font-bold text-white uppercase tracking-widest whitespace-nowrap">
                            {HEDERA_ACCOUNT_ID}
                        </span>
                    </button>

                    <button
                        className="lg:hidden p-2 text-slate-400 hover:text-white"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="lg:hidden absolute top-16 left-0 w-full bg-[#0a0e17] border-b border-white/10 p-6 animate-fade-in-up">
                    <div className="flex flex-col gap-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-text-secondary hover:text-white py-2"
                            >
                                <link.icon size={18} />
                                {link.name}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
}
