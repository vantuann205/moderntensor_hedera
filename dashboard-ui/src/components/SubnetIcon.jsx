import React from 'react';
import {
    Brain, Search, TrendingUp, Palette, Tag,
    Code, FileText, Shield, ScrollText, Coins,
    FileCode, Bot, Monitor, Cpu, Zap,
    Lock, Eye, Layers, Workflow
} from 'lucide-react';

/**
 * Maps icon key strings to professional Lucide SVG components.
 * Used across the dashboard to replace raw emoji characters.
 */
const ICON_MAP = {
    // Subnet Icons
    brain: Brain,
    search: Search,
    'trending-up': TrendingUp,
    palette: Palette,
    tag: Tag,

    // Task Icons
    code: Code,
    'file-text': FileText,
    shield: Shield,

    // Hedera Services
    'scroll-text': ScrollText,
    coins: Coins,
    'file-code': FileCode,
    bot: Bot,

    // Fallbacks
    monitor: Monitor,
    cpu: Cpu,
    zap: Zap,
    lock: Lock,
    eye: Eye,
    layers: Layers,
    workflow: Workflow,
};

const colorMap = {
    brain: 'text-purple-400',
    search: 'text-cyan-400',
    'trending-up': 'text-emerald-400',
    palette: 'text-pink-400',
    tag: 'text-amber-400',
    code: 'text-blue-400',
    'file-text': 'text-gray-300',
    shield: 'text-red-400',
    'scroll-text': 'text-indigo-400',
    coins: 'text-yellow-400',
    'file-code': 'text-green-400',
    bot: 'text-violet-400',
};

const bgMap = {
    brain: 'bg-purple-500/10',
    search: 'bg-cyan-500/10',
    'trending-up': 'bg-emerald-500/10',
    palette: 'bg-pink-500/10',
    tag: 'bg-amber-500/10',
    code: 'bg-blue-500/10',
    'file-text': 'bg-gray-500/10',
    shield: 'bg-red-500/10',
    'scroll-text': 'bg-indigo-500/10',
    coins: 'bg-yellow-500/10',
    'file-code': 'bg-green-500/10',
    bot: 'bg-violet-500/10',
};

/**
 * Renders a professional SVG icon with optional container styling.
 *
 * @param {string} name - Icon key (e.g. 'brain', 'search', 'code')
 * @param {number} size - Icon size in px (default: 18)
 * @param {boolean} withBg - Wrap icon in a colored background circle
 * @param {string} className - Additional CSS classes
 */
export default function SubnetIcon({ name, size = 18, withBg = false, className = '' }) {
    const IconComponent = ICON_MAP[name] || Zap;
    const color = colorMap[name] || 'text-gray-400';
    const bg = bgMap[name] || 'bg-white/10';

    if (withBg) {
        return (
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 ${className}`}>
                <IconComponent size={size} className={color} />
            </div>
        );
    }

    return <IconComponent size={size} className={`${color} ${className}`} />;
}

export { ICON_MAP };
