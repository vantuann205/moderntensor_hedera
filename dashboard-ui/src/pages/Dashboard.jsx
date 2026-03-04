import React, { memo, useState, useEffect } from 'react';
import { Globe, Server, Hash, Wallet, Zap, ExternalLink, Link2, Activity, Cpu } from 'lucide-react';
import SpotlightCard from '../components/SpotlightCard';
import SubnetIcon from '../components/SubnetIcon';
import DecryptText from '../components/DecryptText';
import { Line } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from '../utils/animations';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { getProtocolStats, getSubnets, getTaskFeed, getChartData, getHederaServices } from '../services/hederaService';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(20, 20, 20, 0.9)',
            titleColor: '#fff',
            bodyColor: '#aaa',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
        }
    },
    scales: {
        x: {
            grid: { display: false, drawBorder: false },
            ticks: { color: '#666', font: { family: 'Inter', size: 11 } }
        },
        y: {
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            ticks: { color: '#666', font: { family: 'Inter', size: 11 } }
        }
    },
    interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
    }
};

const charts = { taskVolume: { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], data: [0,0,0,0,0,0,0] } };
let chartDataLoaded = false;

// Load chart data async on first render
const loadChartData = async () => {
    if (chartDataLoaded) return;
    chartDataLoaded = true;
    try {
        const result = await getChartData();
        Object.assign(charts, result);
    } catch { /* use defaults */ }
};
loadChartData();

const chartData = {
    labels: charts.taskVolume.labels,
    datasets: [{
        fill: true,
        label: 'Verification Volume',
        data: charts.taskVolume.data,
        borderColor: '#7b3fe4',
        backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(123, 63, 228, 0.4)');
            gradient.addColorStop(1, 'rgba(123, 63, 228, 0.0)');
            return gradient;
        },
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#7b3fe4',
        borderWidth: 3,
    }]
};

// Memoized Chart Component
const ActivityChart = memo(() => (
    <div className="h-[320px] w-full">
        <Line options={chartOptions} data={chartData} />
    </div>
));

// Stat Card Component (Internal)
const StatItem = ({ icon: Icon, label, value, subtext, highlight }) => (
    <SpotlightCard className="p-6 h-full flex flex-col justify-between group">
        <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg ${highlight ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400 group-hover:text-white transition-colors'}`}>
                <Icon size={24} />
            </div>
            {highlight && <div className="animate-pulse w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#7b3fe4]" />}
        </div>
        <div>
            <h3 className="text-3xl font-bold text-white tracking-tight mb-1">
                <DecryptText text={value} speed={50} animateOnHover />
            </h3>
            <p className="text-sm text-gray-400 font-medium">{label}</p>
            {subtext && <p className={`text-xs mt-2 ${highlight ? 'text-primary' : 'text-green-400'}`}>{subtext}</p>}
        </div>
    </SpotlightCard>
);

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalSubnets: 5, activeSubnets: 2, totalTasks: 0,
        activeMinerCount: 0, protocolRevenue: '0 MDT', protocolFee: 5, totalVolume: '0 MDT',
    });
    const [subnets, setSubnets] = useState([]);
    const [tasks, setTasks] = useState([]);
    const hederaServices = getHederaServices();
    const [verificationLog, setVerificationLog] = useState(null);

    // Load real data from Mirror Node
    useEffect(() => {
        (async () => {
            const [statsRes, subnetsRes, tasksRes] = await Promise.allSettled([
                getProtocolStats(),
                getSubnets(),
                getTaskFeed(),
            ]);
            if (statsRes.status === 'fulfilled' && statsRes.value.data) setStats(statsRes.value.data);
            if (subnetsRes.status === 'fulfilled' && subnetsRes.value.data) setSubnets(subnetsRes.value.data);
            if (tasksRes.status === 'fulfilled' && tasksRes.value.data) setTasks(tasksRes.value.data);
        })();
    }, []);

    // Poll for live verification logs
    useEffect(() => {
        const interval = setInterval(() => {
            fetch('/verification_logs.json')
                .then(res => {
                    if (res.ok) return res.json();
                    return null;
                })
                .then(data => {
                    if (data) setVerificationLog(data);
                })
                .catch(err => {
                    // Ignore errors
                });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const timeAgo = (ts) => {
        const diff = Date.now() - ts;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        return `${Math.floor(diff / 3600000)}h ago`;
    };

    return (
        <motion.div
            className="space-y-12"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* Live Verification Banner */}
            {verificationLog && (
                <motion.div variants={itemVariants} className="bg-primary/10 border border-primary/30 p-4 rounded-lg flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/20 rounded-full animate-pulse">
                            <Activity size={20} className="text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Active Verification Protocol</h3>
                            <div className="text-primary text-xs font-mono">
                                <DecryptText text={verificationLog.message} speed={30} />
                            </div>
                        </div>
                    </div>
                    {verificationLog.status === "success" && (
                        <div className="bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded text-xs font-bold font-mono">
                            VERIFIED ON HEDERA
                        </div>
                    )}
                    {verificationLog.score && (
                        <div className="text-right">
                            <div className="text-xs text-gray-400">TRUST SCORE</div>
                            <div className="text-xl font-bold text-white">{Number(verificationLog.score).toFixed(4)}</div>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Header */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
                        <DecryptText text="Trust Overview" />
                    </h1>
                    <p className="text-gray-400">Real-time trust metrics from the ModernTensor verification layer.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-sm font-mono text-green-400">
                        <DecryptText text="SYSTEM OPERATIONAL" speed={20} />
                    </span>
                </div>
            </motion.div>

            {/* Hero Stats */}
            <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatItem icon={Globe} label="Trust Domains" value={String(stats.totalSubnets)} subtext={`${stats.activeSubnets} Active`} />
                <StatItem icon={Cpu} label="Verifications" value={stats.totalTasks.toLocaleString()} subtext="↗ +12% growth" />
                <StatItem icon={Server} label="Verified Agents" value={String(stats.activeMinerCount)} subtext="↗ +5% online" />
                <StatItem icon={Wallet} label="Protocol Revenue" value={stats.protocolRevenue} subtext={`${stats.protocolFee}% Protocol Fee`} highlight />
            </motion.section>

            {/* Charts + Activity */}
            <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <SpotlightCard className="lg:col-span-2 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Activity size={18} className="text-primary" /> Verification Volume
                            </h3>
                            <p className="text-sm text-gray-400">Challenge submission frequency (7d)</p>
                        </div>
                        <div className="flex gap-2">
                            {['24h', '7d', '30d'].map(p => (
                                <button key={p} className={`px - 3 py - 1 rounded - md text - xs font - medium transition - colors ${p === '7d' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400 hover:text-white'} `}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 min-h-[300px]">
                        <ActivityChart />
                    </div>
                </SpotlightCard>

                <SpotlightCard className="p-6">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Zap size={18} className="text-primary" />
                        Live Feed
                        <div className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
                    </h3>
                    <div className="space-y-1">
                        {tasks.slice(0, 6).map((task) => (
                            <div key={task.id} className="group relative flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                                <SubnetIcon name={task.icon} size={16} withBg className="mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-200 group-hover:text-primary transition-colors truncate">
                                        {task.description}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-500">Domain #{task.subnetId}</span>
                                        <span className="text-gray-700 text-[10px]">•</span>
                                        <span className="text-xs text-gray-500">{timeAgo(task.timestamp)}</span>
                                    </div>
                                </div>
                                <div className="text-primary font-mono text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                    +{task.reward} MDT
                                </div>
                            </div>
                        ))}
                    </div>
                </SpotlightCard>
            </motion.section>

            {/* Hedera Services */}
            <motion.section variants={itemVariants} className="pb-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Link2 className="text-primary" /> Hedera Services
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {hederaServices.map((service, idx) => (
                        <a
                            key={idx}
                            href={service.link}
                            target="_blank"
                            rel="noreferrer"
                            className="group"
                        >
                            <SpotlightCard className="p-4 hover:border-primary/40 transition-colors h-full">
                                <div className="flex items-center gap-3 mb-3">
                                    <SubnetIcon name={service.icon} size={20} className="text-primary" />
                                    <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors">{service.title}</h4>
                                </div>
                                <div className="text-xs font-mono text-gray-500 bg-black/40 px-2 py-1.5 rounded border border-white/5 flex justify-between items-center">
                                    <span className="truncate max-w-[120px]">{service.code}</span>
                                    <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </SpotlightCard>
                        </a>
                    ))}
                </div>
            </motion.section>
        </motion.div>
    );
}
