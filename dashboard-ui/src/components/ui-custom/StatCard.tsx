import { LucideIcon } from 'lucide-react';
import { CountUp } from './NeuralMetagraph';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface StatCardProps {
    label: string;
    value: string | number;
    subtext?: string;
    icon: LucideIcon;
    isLoading?: boolean;
    accent?: 'cyan' | 'purple' | 'green' | 'amber' | 'pink';
}

const ACCENT = {
    cyan: { text: 'text-neon-cyan', border: 'border-neon-cyan/30', bg: 'bg-neon-cyan/10', shadow: 'shadow-neon-cyan/20' },
    purple: { text: 'text-neon-purple', border: 'border-neon-purple/30', bg: 'bg-neon-purple/10', shadow: 'shadow-neon-purple/20' },
    green: { text: 'text-neon-green', border: 'border-neon-green/30', bg: 'bg-neon-green/10', shadow: 'shadow-neon-green/20' },
    amber: { text: 'text-yellow-500', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', shadow: 'shadow-yellow-500/20' },
    pink: { text: 'text-neon-pink', border: 'border-neon-pink/30', bg: 'bg-neon-pink/10', shadow: 'shadow-neon-pink/20' },
};

export default function StatCard({ label, value, subtext, icon: Icon, isLoading, accent = 'cyan' }: StatCardProps) {
    const a = ACCENT[accent];
    const isNumber = typeof value === 'number';

    return (
        <div className="panel p-6 flex flex-col justify-center relative overflow-hidden group shadow-lg hover:shadow-[0_0_25px_rgba(0,243,255,0.1)] transition-all duration-500">
            <div className={cn("absolute right-0 top-0 w-32 h-32 blur-3xl rounded-full -mr-12 -mt-12 transition-colors opacity-20 group-hover:opacity-40", a.bg)}></div>

            <div className="flex items-center gap-2 mb-4 relative z-10">
                <Icon size={18} className={cn(a.text, "drop-shadow-[0_0_8px_currentColor]")} />
                <p className={cn("text-[12px] font-bold uppercase tracking-[0.2em]", a.text)}>{label}</p>
            </div>

            <div className="flex items-baseline gap-2 relative z-10">
                <span className="text-3xl font-display font-bold text-white tracking-tighter sm:text-4xl">
                    {isLoading ? (
                        <span className="animate-pulse opacity-50">--</span>
                    ) : isNumber ? (
                        <CountUp end={value as number} decimals={value as number % 1 === 0 ? 0 : 2} />
                    ) : (
                        value
                    )}
                </span>
                {subtext && <span className="text-xs font-mono text-slate-500 ml-1">{subtext}</span>}
            </div>

            <div className="w-full bg-white/5 h-1 mt-6 rounded-full overflow-hidden relative z-10">
                <div className={cn("h-full transition-all duration-1000", a.bg, "shadow-[0_0_10px_currentColor]")} style={{ width: isLoading ? '0%' : '100%' }} />
            </div>
        </div>
    );
}
