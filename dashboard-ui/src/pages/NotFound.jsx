import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AmbientBackground from '../components/AmbientBackground';

export default function NotFound() {
    return (
        <div className="relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center overflow-hidden">
            <AmbientBackground />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 p-8"
            >
                <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-primary/30 blur-[60px] rounded-full" />
                    <div className="relative w-32 h-32 rounded-3xl bg-surface border border-white/10 shadow-2xl flex items-center justify-center transform rotate-12 hover:rotate-0 transition-transform duration-500">
                        <AlertTriangle size={64} className="text-primary drop-shadow-[0_0_15px_rgba(123,63,228,0.5)]" />
                    </div>
                </div>

                <h1 className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-400 to-gray-800 mb-2 tracking-tighter">
                    404
                </h1>
                <h2 className="text-2xl font-bold text-white mb-4">Subnet Not Found</h2>
                <p className="text-gray-400 max-w-md mx-auto mb-10 text-lg leading-relaxed">
                    The protocol endpoint you are trying to access does not exist or has been deprecated by the network.
                </p>

                <Link
                    to="/"
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-primary text-white font-bold text-lg shadow-[0_0_30px_rgba(123,63,228,0.3)] hover:bg-primary/90 hover:shadow-[0_0_50px_rgba(123,63,228,0.5)] hover:-translate-y-1 transition-all group"
                >
                    <Home size={20} />
                    <span>Return to Dashboard</span>
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
            </motion.div>
        </div>
    );
}
