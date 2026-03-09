import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface StatusBadgeProps {
    status: string;
    className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
    const s = status.toLowerCase();

    const getStyles = () => {
        switch (s) {
            case 'active':
            case 'online':
            case 'completed':
            case 'success':
                return 'bg-neon-green/10 text-neon-green border-neon-green/30 shadow-[0_0_10px_rgba(0,255,163,0.2)]';
            case 'warning':
            case 'pending':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
            case 'failed':
            case 'offline':
            case 'error':
                return 'bg-neon-red/10 text-neon-red border-neon-red/30 shadow-[0_0_10px_rgba(255,0,85,0.2)]';
            default:
                return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
        }
    };

    return (
        <span className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border transition-all duration-300",
            getStyles(),
            className
        )}>
            {status}
        </span>
    );
}
