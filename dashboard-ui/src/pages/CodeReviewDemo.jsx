import React, { useState, memo } from 'react';
import { Shield, CheckCircle, AlertTriangle, Bug, Code, ArrowRight, ExternalLink, Zap, Info, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SpotlightCard from '../components/SpotlightCard';
import { containerVariants, itemVariants } from '../utils/animations';
import { Radar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Filler,
    Tooltip,
    Legend
} from 'chart.js';
import { submitCodeReview, CODE_REVIEW_DIMENSIONS } from '../services/hederaService';
import { useMutation } from '../hooks/useProtocolData';
import { useToast } from '../context/ToastContext';

ChartJS.register(RadialLinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend);

const DEFAULT_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableBank {
    mapping(address => uint) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() public {
        uint bal = balances[msg.sender];
        require(bal > 0);

        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Failed to send Ether");

        balances[msg.sender] = 0;
    }
}`;

const LANGUAGES = [
    { value: 'solidity', label: 'Solidity', ext: '.sol' },
    { value: 'python', label: 'Python', ext: '.py' },
    { value: 'javascript', label: 'JavaScript', ext: '.js' },
    { value: 'rust', label: 'Rust', ext: '.rs' },
];

// ─── Chart Colors & Config ────────────────────────────────────────────────
const chartOptions = {
    radar: {
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(10, 10, 10, 0.95)',
                titleColor: '#fff',
                bodyColor: '#ccc',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}/100` }
            }
        },
        scales: {
            r: {
                angleLines: { color: 'rgba(255,255,255,0.1)' },
                grid: { color: 'rgba(255,255,255,0.05)' },
                pointLabels: { color: '#a3a3a3', font: { size: 11, family: 'Inter' } },
                ticks: { display: false, backdropColor: 'transparent' },
                min: 0,
                max: 100,
            }
        },
    }
};

// ─── Memoized Charts ──────────────────────────────────────────────────────
const RadarChart = memo(({ dimensions }) => {
    const values = CODE_REVIEW_DIMENSIONS.map(d => dimensions[d] || 0);
    const data = {
        labels: CODE_REVIEW_DIMENSIONS,
        datasets: [{
            label: 'Score',
            data: values,
            backgroundColor: 'rgba(0, 212, 170, 0.2)',
            borderColor: '#00d4aa',
            borderWidth: 2,
            pointBackgroundColor: '#00d4aa',
            pointBorderColor: '#000',
            pointRadius: 4,
            pointHoverRadius: 6,
        }]
    };
    return <Radar data={data} options={chartOptions.radar} />;
});

const SeverityBreakdown = memo(({ summary }) => {
    if (!summary || summary.total === 0) return null;
    const data = {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
            data: [summary.critical, summary.high, summary.medium, summary.low],
            backgroundColor: ['#ff2e63', '#fb923c', '#fbbf24', '#38bdf8'],
            borderWidth: 0,
            hoverOffset: 4,
        }]
    };
    return (
        <div className="flex items-center gap-6">
            <div className="w-24 h-24 relative">
                <Doughnut data={data} options={{ cutout: '70%', plugins: { legend: { display: false } } }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-white">{summary.total}</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {[
                    { label: 'Critical', val: summary.critical, color: 'bg-[#ff2e63]' },
                    { label: 'High', val: summary.high, color: 'bg-orange-400' },
                    { label: 'Medium', val: summary.medium, color: 'bg-yellow-400' },
                    { label: 'Low', val: summary.low, color: 'bg-sky-400' },
                ].map(item => item.val > 0 && (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-gray-300">{item.val} {item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default function CodeReviewDemo() {
    const [code, setCode] = useState(DEFAULT_CODE);
    const [language, setLanguage] = useState('solidity');
    const { addToast } = useToast();
    const { mutate: analyze, loading: analyzing, data: result, reset } = useMutation(submitCodeReview);

    const handleAnalyze = async () => {
        const res = await analyze(code, language);
        if (res?.error) addToast(res.error, 'error');
        else if (res.data) addToast(`Audit complete! Score: ${res.data.score}/100`, 'success');
    };

    return (
        <motion.div className="space-y-8" variants={containerVariants} initial="hidden" animate="show">
            {/* Header */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-2">
                        AI Code Review
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Decentralized consensus-based smart contract auditing.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white/5 rounded-full px-4 py-2 border border-white/10">
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-surface border border-black" />)}
                    </div>
                    <span className="text-xs text-gray-400 font-mono">12 Nodes Online</span>
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse ml-2" />
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                {/* Editor Column */}
                <motion.div variants={itemVariants} className="h-full">
                    <SpotlightCard className="h-full min-h-[600px] flex flex-col p-0 overflow-hidden border-primary/20">
                        <div className="bg-white/5 px-4 py-3 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                                </div>
                                <span className="text-xs font-mono text-gray-400 flex items-center gap-2">
                                    <Code size={12} /> filename{LANGUAGES.find(l => l.value === language)?.ext}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="bg-black/50 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 focus:border-primary focus:outline-none"
                                >
                                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleAnalyze}
                                    disabled={analyzing || !code.trim()}
                                    className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(123,63,228,0.4)] disabled:opacity-50"
                                >
                                    {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} fill="currentColor" />}
                                    RUN AUDIT
                                </motion.button>
                            </div>
                        </div>
                        <div className="relative flex-1 bg-[#050505]">
                            <textarea
                                className="absolute inset-0 w-full h-full bg-transparent text-gray-300 font-mono text-sm p-6 resize-none focus:outline-none leading-relaxed custom-scrollbar"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="// Paste smart contract code..."
                                spellCheck={false}
                            />
                        </div>
                    </SpotlightCard>
                </motion.div>

                {/* Results Column */}
                <motion.div variants={itemVariants}>
                    <AnimatePresence mode="wait">
                        {!result && !analyzing ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50"
                            >
                                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                    <Shield size={48} className="text-gray-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-300 mb-2">Awaiting Code Input</h3>
                                <p className="text-gray-500 max-w-sm">
                                    Paste your smart contract code and select the language to initiate the decentralized audit protocol.
                                </p>
                            </motion.div>
                        ) : analyzing ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full flex flex-col items-center justify-center p-8"
                            >
                                <div className="relative w-32 h-32 mb-8">
                                    <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                                    <motion.div
                                        className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Code size={32} className="text-primary animate-pulse" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Analysing Contract</h3>
                                <div className="flex flex-col gap-2 items-center text-sm text-gray-500 font-mono">
                                    <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
                                        &gt; Parsing syntax tree...
                                    </motion.span>
                                    <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, delay: 0.5, repeat: Infinity }}>
                                        &gt; Checking CVE database...
                                    </motion.span>
                                    <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, delay: 1, repeat: Infinity }}>
                                        &gt; Verifying logic patterns...
                                    </motion.span>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                {/* Score Report */}
                                <SpotlightCard className="p-6 overflow-visible">
                                    <div className="flex flex-col sm:flex-row items-center gap-8">
                                        <div className="text-center sm:text-left">
                                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Security Score</div>
                                            <div className="text-6xl font-bold text-white tracking-tighter mb-4">
                                                {result.score}
                                                <span className="text-2xl text-gray-600 align-top">/100</span>
                                            </div>
                                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${result.score >= 80 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                    result.score >= 50 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                        'bg-red-500/10 text-red-400 border-red-500/20'
                                                }`}>
                                                {result.score >= 80 ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                                                {result.score >= 90 ? 'Excellent' : result.score >= 70 ? 'Good' : result.score >= 50 ? 'Medium Risk' : 'Critical Risk'}
                                            </div>
                                        </div>
                                        <div className="flex-1 w-full max-w-[240px]">
                                            <RadarChart dimensions={result.dimensions} />
                                        </div>
                                    </div>
                                </SpotlightCard>

                                {/* Issues */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <Bug className="text-primary" size={18} />
                                            Detected Issues
                                        </h3>
                                        <button onClick={reset} className="text-xs text-gray-500 hover:text-white transition-colors">Clear Results</button>
                                    </div>

                                    {result.issues.length === 0 ? (
                                        <SpotlightCard className="p-8 text-center border-green-500/20 bg-green-500/5">
                                            <CheckCircle size={32} className="text-green-400 mx-auto mb-3" />
                                            <h4 className="font-bold text-green-400 mb-1">No Issues Found</h4>
                                            <p className="text-sm text-green-500/70">The code passed all security checks.</p>
                                        </SpotlightCard>
                                    ) : (
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {result.issues.map((issue, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.1 }}
                                                >
                                                    <SpotlightCard className={`p-4 ${issue.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                                                            issue.severity === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                                                                'border-white/10'
                                                        }`}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-bold text-gray-200 text-sm">{issue.title}</h4>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${issue.severity === 'critical' ? 'bg-red-500 text-black' :
                                                                    issue.severity === 'high' ? 'bg-orange-500 text-black' :
                                                                        'bg-blue-500 text-black'
                                                                }`}>
                                                                {issue.severity}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-400 text-xs mb-3 leading-relaxed">{issue.description}</p>
                                                        {issue.recommendation && (
                                                            <div className="bg-black/30 rounded p-2 text-xs text-gray-300 border border-white/5 flex gap-2">
                                                                <Info size={14} className="text-primary flex-shrink-0 mt-0.5" />
                                                                {issue.recommendation}
                                                            </div>
                                                        )}
                                                    </SpotlightCard>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </motion.div>
    );
}
