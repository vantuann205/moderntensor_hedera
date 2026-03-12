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
                return 'bg-neon-green/15 text-neon-green border-neon-green/40 shadow-[0_0_12px_rgba(0,255,163,0.25)]';
            case 'warning':
            case 'pending':
            case 'in_progress':
                return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]';
            case 'failed':
            case 'offline':
            case 'error':
                return 'bg-neon-red/15 text-neon-red border-neon-red/40 shadow-[0_0_12px_rgba(255,0,85,0.25)]';
            default:
                return 'bg-white/10 text-white border-white/30';
        }
    };

    return (
        <span className={cn(
            "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.15em] border transition-all duration-300",
            getStyles(),
            className
        )}>
            {status}
        </span>
    );
}
