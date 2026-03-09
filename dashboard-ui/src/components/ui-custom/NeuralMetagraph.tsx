'use client';

import { useEffect, useRef, useState } from 'react';

// Smooth Number Animation Utility
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

export default function NeuralMetagraph() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = container.clientWidth;
        let height = container.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        class Point {
            x: number; y: number; z: number;
            size: number; color: string;

            constructor() {
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos((Math.random() * 2) - 1);
                const radius = 80;
                this.x = radius * Math.sin(phi) * Math.cos(theta);
                this.y = radius * Math.sin(phi) * Math.sin(theta);
                this.z = radius * Math.cos(phi);
                this.size = Math.random() * 2 + 1;
                this.color = Math.random() > 0.8 ? '#bc13fe' : '#00f3ff';
            }

            rotate(angleX: number, angleY: number) {
                let dy = this.y * Math.cos(angleX) - this.z * Math.sin(angleX);
                let dz = this.y * Math.sin(angleX) + this.z * Math.cos(angleX);
                this.y = dy; this.z = dz;
                let dx = this.x * Math.cos(angleY) - this.z * Math.sin(angleY);
                dz = this.x * Math.sin(angleY) + this.z * Math.cos(angleY);
                this.x = dx; this.z = dz;
            }

            draw() {
                if (!ctx) return null;
                const fov = 200;
                const scale = fov / (fov + this.z);
                const x2d = (this.x * scale) + (width / 2);
                const y2d = (this.y * scale) + (height / 2);

                if (scale > 0) {
                    ctx.fillStyle = this.color;
                    ctx.globalAlpha = Math.max(0.1, scale - 0.2);
                    ctx.beginPath();
                    ctx.arc(x2d, y2d, this.size * scale, 0, Math.PI * 2);
                    ctx.fill();
                    return { x: x2d, y: y2d, scale };
                }
                return null;
            }
        }

        const points: Point[] = Array.from({ length: 60 }, () => new Point());
        let mouseX = 0, mouseY = 0;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = (e.clientX - rect.left - width / 2) * 0.0001;
            mouseY = (e.clientY - rect.top - height / 2) * 0.0001;
        };

        container.addEventListener('mousemove', handleMouseMove);

        const render = () => {
            ctx.clearRect(0, 0, width, height);
            const rotX = mouseX !== 0 ? mouseY : 0.002;
            const rotY = mouseY !== 0 ? mouseX : 0.003;

            const projected: { x: number, y: number, scale: number }[] = [];
            points.forEach(p => {
                p.rotate(rotX, rotY);
                const proj = p.draw();
                if (proj) projected.push(proj);
            });

            ctx.strokeStyle = '#00f3ff';
            projected.forEach((p1, i) => {
                for (let j = i + 1; j < projected.length; j++) {
                    const p2 = projected[j];
                    const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
                    if (dist < 40) {
                        ctx.beginPath();
                        ctx.lineWidth = 0.5 * Math.min(p1.scale, p2.scale);
                        ctx.globalAlpha = (1 - dist / 40) * 0.2 * Math.min(p1.scale, p2.scale);
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            });
            requestAnimationFrame(render);
        };

        render();
        return () => container.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full bg-black/40 relative flex items-center justify-center overflow-hidden rounded-xl border border-white/5 cursor-crosshair">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,243,255,0.05)_0%,_transparent_70%)]" />
            <canvas ref={canvasRef} className="relative z-10 w-full h-full" />

            <div className="absolute top-3 left-3 flex flex-col gap-1 border-l-2 border-neon-cyan/50 pl-2">
                <span className="text-[9px] uppercase tracking-tighter text-slate-500 font-bold">Metagraph Sync</span>
                <span className="text-xs font-mono text-neon-cyan drop-shadow-[0_0_5px_#00f3ff]">v2.4.1_STABLE</span>
            </div>
        </div>
    );
}
