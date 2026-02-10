import React, { useState } from 'react';
import { Trophy, Medal, Search, Filter, TrendingUp, Users, Sparkles, Coins, ExternalLink, Hammer, Activity } from 'lucide-react';
import SpotlightCard from '../components/SpotlightCard';
import SubnetIcon from '../components/SubnetIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants } from '../utils/animations';
import { getMinerLeaderboard, getSubnets, registerMiner } from '../services/hederaService';
import { useMutation } from '../hooks/useProtocolData';
import { useToast } from '../context/ToastContext';

const medalColors = [
    'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]',
    'text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.3)]',
    'text-amber-700 drop-shadow-[0_0_8px_rgba(180,83,9,0.3)]'
];

export default function MinerLeaderboard() {
    const [subnetFilter, setSubnetFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showRegister, setShowRegister] = useState(false);
    const [registerForm, setRegisterForm] = useState({ address: '', subnet: '0', stake: 100 });
    const { addToast } = useToast();

    const subnets = getSubnets().data;
    const allMiners = getMinerLeaderboard({ subnet: subnetFilter }).data;

    const miners = allMiners.filter(m =>
        searchQuery === '' ||
        m.address.includes(searchQuery) ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.specialization.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const { mutate: registerMinerMutation, loading: registering } = useMutation(registerMiner);

    const handleRegister = async (e) => {
        e.preventDefault();
        const res = await registerMinerMutation(registerForm);
        if (res?.error) {
            addToast(res.error, 'error');
        } else if (res?.data) {
            addToast(`Registered successfully!`, 'success');
            setShowRegister(false);
            setRegisterForm({ address: '', subnet: '0', stake: 100 });
        }
    };

    return (
        <motion.div
            className="space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Header */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Agent Trust Scoreboard</h1>
                    <p className="text-gray-400 flex items-center gap-2">
                        <Activity size={16} className="text-primary" />
                        Top performing autonomous agents ranked by cryptographic trust
                    </p>
                </div>
                <div className="flex gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowRegister(!showRegister)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${showRegister
                            ? 'bg-white/10 text-white border border-white/20'
                            : 'bg-primary text-white shadow-[0_0_20px_rgba(123,63,228,0.3)] hover:bg-primary/90'
                            }`}
                    >
                        {showRegister ? 'Cancel Registration' : <><Sparkles size={18} /> Register Agent</>}
                    </motion.button>
                </div>
            </motion.div>

            {/* Registration Panel */}
            <AnimatePresence>
                {showRegister && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <SpotlightCard spotColor="rgba(0, 212, 170, 0.2)" className="mb-8 border-secondary/30">
                            <form onSubmit={handleRegister} className="p-8">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                                    <Sparkles className="text-secondary" /> Agent Registration
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Account ID</label>
                                        <input
                                            type="text"
                                            placeholder="0.0.XXXXXX"
                                            value={registerForm.address}
                                            onChange={e => setRegisterForm({ ...registerForm, address: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-secondary focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Target Domain</label>
                                        <select
                                            value={registerForm.subnet}
                                            onChange={e => setRegisterForm({ ...registerForm, subnet: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-secondary focus:outline-none"
                                        >
                                            {subnets.filter(s => s.status === 'active').map(s => (
                                                <option key={s.id} value={s.id}>#{s.id} {s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-end gap-4">
                                        <div className="space-y-2 flex-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Stake</label>
                                            <input
                                                type="number"
                                                value={registerForm.stake}
                                                onChange={e => setRegisterForm({ ...registerForm, stake: Number(e.target.value) })}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-secondary focus:outline-none"
                                            />
                                        </div>
                                        <button disabled={registering} className="btn bg-secondary text-black px-6 py-3 rounded-xl font-bold hover:bg-secondary/90 transition-colors h-[50px]">
                                            {registering ? '...' : 'Stake'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </SpotlightCard>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats & Filters */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search agent ID or name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-white focus:border-primary focus:bg-white/10 focus:outline-none transition-all placeholder:text-gray-600"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <select
                        value={subnetFilter}
                        onChange={(e) => setSubnetFilter(e.target.value)}
                        className="w-full h-14 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-white focus:border-primary focus:outline-none transition-all appearance-none cursor-pointer hover:bg-white/10"
                    >
                        <option value="all">All Domains</option>
                        {subnets.filter(s => s.status === 'active').map(s => (
                            <option key={s.id} value={s.id}>#{s.id} {s.name}</option>
                        ))}
                    </select>
                </div>
            </motion.div>

            {/* Table */}
            <motion.div variants={itemVariants}>
                <SpotlightCard className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    <th className="px-6 py-4 text-left">Rank</th>
                                    <th className="px-6 py-4 text-left">Agent Node</th>
                                    <th className="px-6 py-4 text-center">Trust Score</th>
                                    <th className="px-6 py-4 text-center">Verifications</th>
                                    <th className="px-6 py-4 text-left">Earnings</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {miners.map((miner, index) => (
                                    <motion.tr
                                        key={miner.address}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="hover:bg-white/5 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            {miner.rank <= 3 ? (
                                                <Medal size={24} className={medalColors[miner.rank - 1]} />
                                            ) : (
                                                <span className="text-gray-500 font-mono text-lg ml-1">#{miner.rank}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white group-hover:text-primary transition-colors text-base">{miner.name}</div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <span className="font-mono">{miner.address}</span>
                                                <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-block relative">
                                                <svg className="w-12 h-12 transform -rotate-90">
                                                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/10" />
                                                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className={miner.score >= 95 ? "text-green-500" : "text-yellow-500"} strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * miner.score) / 100} />
                                                </svg>
                                                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
                                                    {miner.score}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-mono text-gray-300 bg-white/5 px-2 py-1 rounded">{miner.tasks.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-primary font-bold">
                                                <Coins size={16} />
                                                {miner.earnings}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`w-2 h-2 rounded-full ${miner.uptime > 99 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                    <span className="text-sm text-white">{miner.uptime}% Uptime</span>
                                                </div>
                                                <div className="text-xs text-gray-500">{miner.specialization}</div>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SpotlightCard>
            </motion.div>
        </motion.div>
    );
}
