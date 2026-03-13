'use client';

import { useRef, useEffect, useCallback } from 'react';

interface GraphNode { id: string; type: 'validator' | 'miner'; }
interface GraphLink { source: string; target: string; }

interface Props {
    nodes: GraphNode[];
    links: GraphLink[];
}

// Canvas-based network graph (no external library dependency issues)
export default function NetworkGraph({ nodes, links }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const nodesRef = useRef<any[]>([]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const simNodes = nodesRef.current;
        if (!simNodes.length) {
            ctx.fillStyle = 'rgba(100,116,139,0.4)';
            ctx.font = '13px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No network nodes detected', W / 2, H / 2);
            return;
        }

        // Draw links
        links.forEach(link => {
            const src = simNodes.find(n => n.id === link.source || n.id === (link.source as any)?.id);
            const tgt = simNodes.find(n => n.id === link.target || n.id === (link.target as any)?.id);
            if (!src || !tgt) return;
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(tgt.x, tgt.y);
            ctx.strokeStyle = 'rgba(0,243,255,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw nodes
        simNodes.forEach(node => {
            const isValidator = node.type === 'validator';
            const r = isValidator ? 10 : 6;
            const color = isValidator ? '#00f3ff' : '#7b3fe4';
            const glow = isValidator ? 'rgba(0,243,255,0.4)' : 'rgba(123,63,228,0.4)';

            // Glow
            const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2.5);
            grad.addColorStop(0, glow);
            grad.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Node
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fillStyle = color + '22';
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();

            // Label
            ctx.fillStyle = 'rgba(226,232,240,0.7)';
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(String(node.id).slice(0, 12), node.x, node.y + r + 12);
        });

        // Simple physics
        simNodes.forEach(n => {
            n.vx = (n.vx || 0) * 0.9;
            n.vy = (n.vy || 0) * 0.9;

            simNodes.forEach((m: any) => {
                if (n === m) return;
                const dx = n.x - m.x, dy = n.y - m.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                if (dist < 80) {
                    n.vx += dx / dist * 2;
                    n.vy += dy / dist * 2;
                }
            });

            // Keep inside canvas
            n.vx += (W / 2 - n.x) * 0.0005;
            n.vy += (H / 2 - n.y) * 0.0005;

            n.x += n.vx;
            n.y += n.vy;
        });

        animRef.current = requestAnimationFrame(draw);
    }, [links]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Initialize node positions
        nodesRef.current = nodes.map((n, i) => ({
            ...n,
            x: canvas.width / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * 150,
            y: canvas.height / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * 150,
            vx: 0, vy: 0,
        }));

        animRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animRef.current);
    }, [nodes, draw]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full rounded-xl"
            style={{ background: 'transparent' }}
        />
    );
}
