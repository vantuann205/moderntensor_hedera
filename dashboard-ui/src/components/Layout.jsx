import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Network, Zap, Trophy, Shield, Menu, X, Wallet, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import { SoundProvider, useSound } from '../context/SoundContext';
import WalletModal from './WalletModal';
import AmbientBackground from './AmbientBackground';
import DecryptText from './DecryptText';
import BorderBeam from './BorderBeam';
import CommandPalette from './CommandPalette';

// Inner Layout component to access SoundContext
const LayoutContent = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [walletAddress, setWalletAddress] = useState(null);
    const { addToast } = useToast();
    const { play } = useSound();
    const location = useLocation();

    const handleConnect = (wallet) => {
        play('click');
        setIsWalletOpen(false);
        // Use the user's real Hedera Account ID from walletInput or .env default
        setTimeout(() => {
            const accountId = wallet.accountId || '0.0.7851838';
            setWalletAddress(accountId);
            addToast(`Connected via ${wallet.name} — ${accountId}`, 'success');
            play('success');
        }, 400);
    };

    const navItems = [
        { path: '/', label: 'Trust Overview', icon: LayoutDashboard },
        { path: '/subnets', label: 'Domain Explorer', icon: Network },
        { path: '/tasks', label: 'Verification Protocol', icon: Zap },
        { path: '/miners', label: 'Agent Trust Scores', icon: Trophy },
        { path: '/subnet/1', label: 'Live Verification', icon: Shield },
    ];

    const toggleMobileMenu = () => {
        play('click');
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <div className="min-h-screen text-gray-100 font-sans selection:bg-primary/30">
            <AmbientBackground />
            <CommandPalette />
            <WalletModal isOpen={isWalletOpen} onClose={() => setIsWalletOpen(false)} onConnect={handleConnect} />

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <span className="font-bold text-white">M</span>
                    </div>
                    <span className="font-bold text-lg tracking-tight">ModernTensor</span>
                </div>
                <button onClick={toggleMobileMenu} className="p-2 text-gray-400 hover:text-white">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            <div className="flex pt-16 lg:pt-0 min-h-screen">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:flex flex-col w-72 fixed h-screen bg-surface/50 backdrop-blur-xl border-r border-white/5 z-40">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20 flex items-center justify-center">
                                <span className="font-bold text-xl text-white">M</span>
                            </div>
                            <div>
                                <h1 className="font-bold text-xl tracking-tight leading-none">
                                    <DecryptText text="ModernTensor" speed={50} />
                                </h1>
                                <span className="text-xs text-primary font-mono tracking-wider">TRUST LAYER</span>
                            </div>
                        </div>

                        <nav className="space-y-1">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => play('click')}
                                        onMouseEnter={() => play('hover')}
                                        className={({ isActive }) =>
                                            `group relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${isMobileMenuOpen ? '' : ''} ${isActive
                                                ? 'bg-white/10 text-white font-medium shadow-inner'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="activeNav"
                                                        className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                    />
                                                )}
                                                <item.icon size={20} className={isActive ? 'text-primary' : 'text-gray-500 group-hover:text-gray-300'} />
                                                <span>{item.label}</span>
                                                {isActive && (
                                                    <div className="absolute inset-0 bg-primary/5 rounded-lg pointer-events-none" />
                                                )}
                                            </>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="mt-auto p-6 border-t border-white/5">
                        <button
                            onClick={() => { play('click'); setIsWalletOpen(true); }}
                            onMouseEnter={() => play('hover')}
                            className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-white/10 p-1 hover:border-primary/50 transition-all duration-300"
                        >
                            <BorderBeam size={100} duration={8} colorFrom="transparent" colorTo="rgba(123, 63, 228, 0.5)" />
                            <div className="relative bg-surface/80 backdrop-blur-sm rounded-[10px] px-4 py-3 flex items-center justify-between z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                        <Wallet size={16} className="text-primary" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs text-gray-400">Wallet</div>
                                        <div className="text-sm font-medium truncate max-w-[100px]">
                                            {walletAddress ? `${walletAddress.slice(0, 6)}...` : 'Connect'}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                            </div>
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 lg:pl-72 relative z-10">
                    <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-12">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="lg:hidden fixed inset-0 z-40 bg-background pt-20 px-6 pb-6"
                    >
                        <nav className="space-y-4">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => { play('click'); setIsMobileMenuOpen(false); }}
                                    className={({ isActive }) =>
                                        `flex items-center gap-4 p-4 rounded-xl text-lg font-medium transition-colors ${isActive
                                            ? 'bg-white/10 text-white border border-white/10'
                                            : 'text-gray-400 hover:text-white'
                                        }`
                                    }
                                >
                                    <item.icon size={24} />
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>
                        <div className="mt-8 pt-8 border-t border-white/10">
                            <button
                                onClick={() => { play('click'); setIsWalletOpen(true); setIsMobileMenuOpen(false); }}
                                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-primary text-white font-bold"
                            >
                                <Wallet />
                                {walletAddress ? 'Wallet Connected' : 'Connect Wallet'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function Layout() {
    return (
        <SoundProvider>
            <LayoutContent />
        </SoundProvider>
    );
}
