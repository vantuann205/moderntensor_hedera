import React, { useState, useEffect } from 'react';
import { Send, UploadCloud, Clock, Coins, Zap, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import SubnetIcon from '../components/SubnetIcon';
import SpotlightCard from '../components/SpotlightCard';
import { motion, AnimatePresence } from 'framer-motion';
import { containerVariants, itemVariants } from '../utils/animations';
import { submitTask, getTaskFeed, getSubnets } from '../services/hederaService';
import { useMutation } from '../hooks/useProtocolData';
import { useToast } from '../context/ToastContext';

const statusConfig = {
    validated: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
    in_progress: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
    pending: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
};

export default function TaskProtocol() {
    const [taskType, setTaskType] = useState('code_review');
    const [subnet, setSubnet] = useState('1');
    const [description, setDescription] = useState('');
    const [reward, setReward] = useState(10);
    const [deadline, setDeadline] = useState('3600');
    const [lastTx, setLastTx] = useState(null);
    const { addToast } = useToast();

    // Async data loading from Mirror Node
    const [subnets, setSubnets] = useState([]);
    const [tasks, setTasks] = useState([]);

    useEffect(() => {
        (async () => {
            const [subnetsRes, tasksRes] = await Promise.allSettled([getSubnets(), getTaskFeed()]);
            if (subnetsRes.status === 'fulfilled' && subnetsRes.value.data) setSubnets(subnetsRes.value.data);
            if (tasksRes.status === 'fulfilled' && tasksRes.value.data) setTasks(tasksRes.value.data);
        })();
    }, []);

    const activeSubnet = subnets.find(s => s.id === subnet);
    const subnetFee = activeSubnet ? (reward * activeSubnet.fee) / 100 : 0;
    const protocolFee = reward * 0.05;
    const totalCost = (reward + subnetFee + protocolFee).toFixed(2);

    // Mutation
    const { mutate: submit, loading: submitting } = useMutation(submitTask);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!description.trim()) {
            addToast('Please enter a task description', 'error');
            return;
        }
        const res = await submit({
            subnetId: subnet,
            taskType,
            description: description.trim(),
            reward: parseFloat(reward),
        });
        if (res?.error) {
            addToast(res.error, 'error');
        } else if (res?.data) {
            setLastTx(res.data);
            addToast(`Task submitted to ${res.data.subnetName}!`, 'success');
            setDescription('');
        }
    };

    const timeAgo = (ts) => {
        const diff = Date.now() - ts;
        if (diff < 60000) return 'just now';
        return `${Math.floor(diff / 60000)}m ago`;
    };

    return (
        <motion.div
            className="container max-w-6xl mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            <motion.div variants={itemVariants} className="mb-12">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-2">Request Agent Verification</h1>
                <p className="text-gray-400 text-lg">Submit a challenge to verify autonomous agent capabilities on-chain.</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Task Form */}
                <motion.div variants={itemVariants} className="lg:col-span-2 space-y-8">
                    <SpotlightCard spotColor="rgba(123, 63, 228, 0.15)">
                        <form onSubmit={handleSubmit} className="p-8 space-y-8">
                            {/* Subnet + Task TypeSelector */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-300">Agent Domain</label>
                                    <div className="relative">
                                        <select
                                            value={subnet}
                                            onChange={(e) => setSubnet(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all appearance-none"
                                        >
                                            {subnets.map(s => (
                                                <option key={s.id} value={s.id} disabled={s.status !== 'active'}>
                                                    #{s.id} {s.name} ({s.fee}% fee)
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-300">Verification Type</label>
                                    <div className="relative">
                                        <select
                                            value={taskType}
                                            onChange={(e) => setTaskType(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all appearance-none"
                                        >
                                            <option value="text">Text Generation</option>
                                            <option value="code">Code Generation</option>
                                            <option value="code_review">Code Review / Audit</option>
                                            <option value="image">Image Analysis</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-300">Challenge Payload</label>
                                <textarea
                                    className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all resize-none font-mono text-sm leading-relaxed"
                                    placeholder="// Paste code or describe task requirements..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>

                            {/* Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-300">Bounty (MDT)</label>
                                    <div className="relative group">
                                        <input
                                            type="number"
                                            value={reward}
                                            onChange={(e) => setReward(Number(e.target.value) || 0)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white focus:border-primary focus:outline-none transition-all font-mono"
                                        />
                                        <Coins className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-300">Deadline</label>
                                    <div className="relative group">
                                        <select
                                            value={deadline}
                                            onChange={(e) => setDeadline(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white focus:border-primary focus:outline-none transition-all appearance-none"
                                        >
                                            <option value="3600">1 Hour</option>
                                            <option value="86400">24 Hours</option>
                                        </select>
                                        <Clock className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-gray-300">Attachment</label>
                                    <button
                                        type="button"
                                        className="w-full border border-dashed border-white/20 hover:border-primary/50 hover:bg-primary/5 rounded-xl py-3.5 flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all"
                                    >
                                        <UploadCloud size={18} />
                                        <span>Upload</span>
                                    </button>
                                </div>
                            </div>

                            {/* Summary Footer */}
                            <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex gap-6 text-sm text-gray-500 font-mono">
                                    <span>Protocol Fee: 1%</span>
                                    <span>Subnet Fee: {activeSubnet?.fee || 0}%</span>
                                </div>
                                <div className="flex items-center gap-6 w-full sm:w-auto">
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500 uppercase tracking-widest">Total Cost</div>
                                        <div className="text-xl font-bold text-primary font-mono">{totalCost} MDT</div>
                                    </div>
                                    <motion.button
                                        type="submit"
                                        disabled={submitting || !description.trim()}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="flex-1 sm:flex-none btn bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(123,63,228,0.3)] hover:shadow-[0_0_30px_rgba(123,63,228,0.5)] transition-all disabled:opacity-50 disabled:shadow-none"
                                    >
                                        {submitting ? 'Verifying...' : 'Broadcast Challenge'}
                                    </motion.button>
                                </div>
                            </div>
                        </form>
                    </SpotlightCard>

                    {/* Receipt */}
                    <AnimatePresence>
                        {lastTx && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                            >
                                <SpotlightCard className="p-6 bg-green-500/5 border-green-500/20">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-green-500/20 rounded-full text-green-400">
                                            <CheckCircle size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-green-400">Translation Broadcasted</h3>
                                            <p className="text-sm text-green-500/70">Consensus reached on block {lastTx.txHash.split('.')[1]}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm font-mono text-gray-400 bg-black/40 p-4 rounded-lg">
                                        <div>TX Hash: {lastTx.txHash.slice(0, 16)}...</div>
                                        <div>Topic ID: {lastTx.topicId}</div>
                                    </div>
                                </SpotlightCard>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Sidebar Feed */}
                <motion.div variants={itemVariants}>
                    <SpotlightCard className="h-full flex flex-col p-6">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <Zap size={18} className="text-primary" /> Live Activity
                        </h3>
                        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[600px]">
                            {tasks.map((task, idx) => (
                                <div key={task.id} className="relative pl-4 border-l border-white/10 pb-4 last:pb-0">
                                    <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-surface border border-white/20" />
                                    <div className="flex items-start justify-between mb-1">
                                        <SubnetIcon name={task.icon} size={14} className="text-gray-400" />
                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusConfig[task.status].bg} ${statusConfig[task.status].text} ${statusConfig[task.status].border}`}>
                                            {task.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-300 line-clamp-2 mb-2">{task.description}</p>
                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                        <span>{timeAgo(task.timestamp)}</span>
                                        <span className="font-mono text-primary">+{task.reward} MDT</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SpotlightCard>
                </motion.div>
            </div>
        </motion.div>
    );
}
