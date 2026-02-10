import React from 'react';
import { Globe, Plus, Activity, Users, Coins, ArrowRight, Lock } from 'lucide-react';
import SpotlightCard from '../components/SpotlightCard';
import BorderBeam from '../components/BorderBeam';
import DecryptText from '../components/DecryptText';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { containerVariants, itemVariants } from '../utils/animations';

export default function SubnetExplorer() {
    return (
        <motion.div
            className="container py-8"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Header */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-2">
                        <DecryptText text="Subnet Explorer" />
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl">
                        Discover and participate in specialized AI economies running on the ModernTensor protocol.
                    </p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-[0_0_20px_rgba(123,63,228,0.3)] hover:bg-primary/90 transition-all relative overflow-hidden group"
                >
                    <Plus size={18} />
                    <span>Create Subnet</span>
                    <BorderBeam size={100} duration={4} colorFrom="transparent" colorTo="white" />
                </motion.button>
            </motion.div>

            {/* Grid */}
            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                variants={containerVariants}
            >
                {/* Active Subnet: General */}
                <motion.div variants={itemVariants}>
                    <SpotlightCard className="h-full flex flex-col p-6 group relative">
                        <BorderBeam duration={8} /> {/* Active Subnet Effect */}

                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                <Globe size={20} />
                            </div>
                            <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
                                Active
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors relative z-10">
                            General Intelligence
                        </h3>
                        <p className="text-sm text-gray-400 mb-6 flex-1 relative z-10">Text generation, coding, and general purpose AI tasks.</p>

                        <div className="space-y-3 mb-6 relative z-10">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Volume</span>
                                <span className="text-white font-medium">45,000 MDT</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Miners</span>
                                <span className="text-white font-medium">89</span>
                            </div>
                        </div>

                        <Link
                            to="/subnet/0"
                            className="w-full py-3 rounded-lg border border-primary/30 text-primary font-bold hover:bg-primary hover:text-white transition-all text-center flex items-center justify-center gap-2 relative z-10"
                        >
                            Enter Subnet <ArrowRight size={16} />
                        </Link>
                    </SpotlightCard>
                </motion.div>

                {/* Active Subnet: Code Review */}
                <motion.div variants={itemVariants}>
                    <SpotlightCard className="h-full flex flex-col p-6 group relative">
                        <BorderBeam duration={8} colorFrom="#00d4aa" colorTo="#7b3fe4" />

                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center text-secondary">
                                <Lock size={20} />
                            </div>
                            <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
                                Active
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-secondary transition-colors relative z-10">
                            AI Code Review
                        </h3>
                        <p className="text-sm text-gray-400 mb-6 flex-1 relative z-10">Smart contract security auditing and vulnerability detection.</p>

                        <div className="space-y-3 mb-6 relative z-10">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Volume</span>
                                <span className="text-white font-medium">12,500 MDT</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Miners</span>
                                <span className="text-white font-medium">12</span>
                            </div>
                        </div>

                        <Link
                            to="/subnet/1"
                            className="w-full py-3 rounded-lg border border-secondary/30 text-secondary font-bold hover:bg-secondary hover:text-black transition-all text-center flex items-center justify-center gap-2 relative z-10"
                        >
                            Enter Subnet <ArrowRight size={16} />
                        </Link>
                    </SpotlightCard>
                </motion.div>

                {/* Inactive Subnets */}
                {[
                    { title: "DeFi Agents", desc: "Autonomous trading & yield adjustments", fee: "10%" },
                    { title: "Image Generation", desc: "High-fidelity diffusion models", fee: "8%" },
                    { title: "Data Labeling", desc: "RLHF and manual annotation corps", fee: "2%" },
                ].map((s, i) => (
                    <motion.div key={i} variants={itemVariants} className="opacity-60 saturate-0 hover:opacity-100 hover:saturate-100 transition-all duration-500">
                        <SpotlightCard spotColor="rgba(255, 255, 255, 0.05)" className="h-full flex flex-col p-6 border-white/5 bg-white/5 cursor-not-allowed">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-500">
                                    <Activity size={20} />
                                </div>
                                <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                    Coming Soon
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-gray-300 mb-2">{s.title}</h3>
                            <p className="text-sm text-gray-500 mb-6 flex-1">{s.desc}</p>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Fee</span>
                                    <span className="text-gray-400 font-medium">{s.fee}</span>
                                </div>
                            </div>

                            <div className="w-full py-3 rounded-lg border border-white/5 text-gray-500 font-bold text-center text-sm">
                                Launching Q3 2026
                            </div>
                        </SpotlightCard>
                    </motion.div>
                ))}
            </motion.div>
        </motion.div>
    );
}
