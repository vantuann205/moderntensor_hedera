'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useMiners, useValidators, useTasks } from '@/lib/hooks/useProtocolData';
import dynamic from 'next/dynamic';

// Dynamically import force graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function NeuralMetagraph() {
    const { data: minersData } = useMiners();
    const { data: validatorsData } = useValidators();
    const { data: tasksData } = useTasks();

    const graphData = useMemo(() => {
        if (!minersData || !validatorsData) return { nodes: [], links: [] };

        const nodes: any[] = [];
        const links: any[] = [];
        const seenLinks = new Set();

        // Add Validators
        validatorsData.forEach((v: any) => {
            nodes.push({
                id: v.validator_id || v.id,
                name: v.metadata?.name || `Validator ${v.validator_id}`,
                val: 5,
                color: '#bc13fe', // Purple for validators
                type: 'validator'
            });
        });

        // Add Miners
        minersData.forEach((m: any) => {
            nodes.push({
                id: m.miner_id || m.id,
                name: m.metadata?.name || `Miner ${m.miner_id}`,
                val: 2,
                color: '#00f3ff', // Cyan for miners
                type: 'miner'
            });
        });

        // Add Links based on tasks
        if (tasksData) {
            tasksData.forEach((t: any) => {
                const minerId = t.miner_id || t.assigned_miner;
                const validatorId = t.validator || t.assigned_validator;

                if (minerId && validatorId) {
                    const linkId = `${validatorId}-${minerId}`;
                    if (!seenLinks.has(linkId)) {
                        links.push({
                            source: validatorId,
                            target: minerId
                        });
                        seenLinks.add(linkId);
                    }
                }
            });
        }

        return { nodes, links };
    }, [minersData, validatorsData, tasksData]);

    return (
        <div className="w-full h-full bg-black/40 relative flex items-center justify-center overflow-hidden rounded-xl border border-white/5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,243,255,0.05)_0%,_transparent_70%)]" />

            <div className="w-full h-full z-10">
                <ForceGraph2D
                    graphData={graphData}
                    nodeLabel="name"
                    nodeColor={(node: any) => node.color}
                    nodeRelSize={4}
                    linkColor={() => 'rgba(0, 243, 255, 0.1)'}
                    linkWidth={1}
                    backgroundColor="transparent"
                    width={800} // This will be constrained by container
                    height={400}
                    onNodeClick={(node: any) => {
                        window.location.href = `/${node.type}s/${node.id}`;
                    }}
                    nodeCanvasObject={(node: any, ctx, globalScale) => {
                        const label = node.name;
                        const fontSize = 12 / globalScale;
                        ctx.font = `${fontSize}px Inter`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = node.color;
                        ctx.fillText(label, node.x, node.y + (node.val + 5));

                        // Draw node
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
                        ctx.fillStyle = node.color;
                        ctx.fill();

                        // Add glow
                        ctx.shadowBlur = 10 / globalScale;
                        ctx.shadowColor = node.color;
                    }}
                />
            </div>

            <div className="absolute top-3 left-3 flex flex-col gap-1 border-l-2 border-neon-cyan/50 pl-2 z-20 pointer-events-none">
                <span className="text-[9px] uppercase tracking-tighter text-slate-500 font-bold">Metagraph Sync</span>
                <span className="text-xs font-mono text-neon-cyan drop-shadow-[0_0_5px_#00f3ff]">LIVE_STATE</span>
            </div>

            <div className="absolute bottom-3 right-3 flex gap-4 z-20 pointer-events-none">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#bc13fe]" />
                    <span className="text-[8px] uppercase font-bold text-slate-500">Validator</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#00f3ff]" />
                    <span className="text-[8px] uppercase font-bold text-slate-500">Miner</span>
                </div>
            </div>
        </div>
    );
}

// Smooth Number Animation Utility (exported for use in dashboard)
export const CountUp = ({ end, duration = 1500, prefix = '', suffix = '', decimals = 0 }: { end: number, duration?: number, prefix?: string, suffix?: string, decimals?: number }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const [mounted, setMounted] = useState(false);
    const valRef = useRef(0);

    useEffect(() => {
        setMounted(true);
        let startTime: number | null = null;
        let animationFrame: number;
        const startVal = valRef.current;
        const change = end - startVal;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);

            const ease = 1 - Math.pow(1 - percentage, 3);
            const current = startVal + (change * ease);
            valRef.current = current;
            setDisplayValue(current);

            if (progress < duration) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                valRef.current = end;
                setDisplayValue(end);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [end, duration]);

    if (!mounted) return <span className="font-mono">{prefix}0{suffix}</span>;

    return (
        <span className="font-mono">
            {prefix}{displayValue.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
        </span>
    );
};
