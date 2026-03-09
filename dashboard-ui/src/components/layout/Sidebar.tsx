'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Cpu, Shield, ListChecks,
    TrendingUp, Network, ChevronLeft, Zap
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const NAV_ITEMS = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/miners', label: 'Miners', icon: Cpu },
    { href: '/validators', label: 'Validators', icon: Shield },
    { href: '/tasks', label: 'Tasks', icon: ListChecks },
    { href: '/emissions', label: 'Emissions', icon: TrendingUp },
    { href: '/network', label: 'Network', icon: Network },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside className={clsx(
            'relative flex flex-col h-full bg-[#080f1d] border-r border-white/5 transition-all duration-300 z-20',
            collapsed ? 'w-16' : 'w-56'
        )}>
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
                <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center">
                        <Zap size={16} className="text-cyan-400" />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-[#080f1d]" />
                </div>
                {!collapsed && (
                    <div>
                        <div className="text-xs font-bold tracking-widest uppercase text-cyan-400 font-display">ModernTensor</div>
                        <div className="text-[10px] text-slate-500">Hedera AI Network</div>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-4 space-y-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
                    return (
                        <Link key={href} href={href}
                            className={clsx(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                                isActive
                                    ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 shadow-[0_0_12px_rgba(0,243,255,0.08)]'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            )}
                        >
                            <Icon size={16} className={clsx('flex-shrink-0', isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300')} />
                            {!collapsed && <span>{label}</span>}
                            {isActive && !collapsed && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,243,255,0.8)]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Collapse button */}
            <button
                onClick={() => setCollapsed(c => !c)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#080f1d] border border-white/10 rounded-full flex items-center justify-center hover:border-cyan-400/50 transition-colors"
            >
                <ChevronLeft size={12} className={clsx('text-slate-400 transition-transform', collapsed && 'rotate-180')} />
            </button>

            {/* Network indicator */}
            <div className="px-4 py-4 border-t border-white/5">
                {!collapsed ? (
                    <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        HEDERA TESTNET
                    </div>
                ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mx-auto" />
                )}
            </div>
        </aside>
    );
}
