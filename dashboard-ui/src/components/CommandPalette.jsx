import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, ArrowRight, LayoutDashboard, Network, Zap, Trophy, Shield, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSound } from '../context/SoundContext';

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();
    const { play } = useSound();

    const commands = [
        { id: 'home', label: 'Go to Overview', icon: LayoutDashboard, action: () => navigate('/') },
        { id: 'subnets', label: 'Subnet Explorer', icon: Network, action: () => navigate('/subnets') },
        { id: 'tasks', label: 'Task Protocol', icon: Zap, action: () => navigate('/tasks') },
        { id: 'miners', label: 'Miner Leaderboard', icon: Trophy, action: () => navigate('/miners') },
        { id: 'code-review', label: 'AI Code Review', icon: Shield, action: () => navigate('/subnet/1') },
        { id: 'wallet', label: 'Connect Wallet', icon: Wallet, action: () => {/* Trigger wallet context in real app */ } },
    ];

    const filteredCommands = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsOpen(prev => {
                    if (!prev) play('on');
                    return !prev;
                });
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [play]);

    // Handle arrow keys navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleNavigation = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
                play('hover');
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                play('hover');
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    play('click');
                    filteredCommands[selectedIndex].action();
                    setIsOpen(false);
                }
            }
        };
        window.addEventListener('keydown', handleNavigation);
        return () => window.removeEventListener('keydown', handleNavigation);
    }, [isOpen, filteredCommands, selectedIndex, play]);


    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/20 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        <div className="flex items-center px-4 py-3 border-b border-white/10">
                            <Search size={20} className="text-gray-400 mr-3" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Type a command or search..."
                                className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 font-medium"
                                value={query}
                                onChange={e => {
                                    setQuery(e.target.value);
                                    setSelectedIndex(0);
                                }}
                            />
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-gray-400">ESC</span>
                            </div>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto py-2">
                            {filteredCommands.length > 0 ? (
                                filteredCommands.map((cmd, index) => (
                                    <button
                                        key={cmd.id}
                                        onClick={() => {
                                            play('click');
                                            cmd.action();
                                            setIsOpen(false);
                                        }}
                                        onMouseEnter={() => {
                                            setSelectedIndex(index);
                                            play('hover');
                                        }}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${index === selectedIndex ? 'bg-primary/20 text-white border-l-2 border-primary' : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <cmd.icon size={18} className={index === selectedIndex ? 'text-primary' : 'text-gray-500'} />
                                            <span className="font-medium">{cmd.label}</span>
                                        </div>
                                        {index === selectedIndex && <ArrowRight size={14} className="text-primary" />}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                    No results found.
                                </div>
                            )}
                        </div>

                        <div className="bg-white/5 px-4 py-2 text-[10px] text-gray-500 flex justify-between">
                            <span>Navigation</span>
                            <div className="flex gap-2">
                                <span>↑↓ to navigate</span>
                                <span>↵ to select</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
