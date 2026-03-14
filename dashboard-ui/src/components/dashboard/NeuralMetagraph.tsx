"use client";

import { useEffect, useRef } from "react";

const CountUp: React.FC<{ end: number, duration?: number, prefix?: string, suffix?: string, decimals?: number }> = ({ end, duration = 1500, prefix = '', suffix = '', decimals = 0 }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const valRef = useRef(0);

    useEffect(() => {
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
            if (progress < duration) animationFrame = requestAnimationFrame(animate);
            else { valRef.current = end; setDisplayValue(end); }
        };
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [end, duration]);

    return <>{prefix}{displayValue.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
};

import { useState } from "react";

interface NeuralMetagraphProps {
  activeNodes?: number;
}

export default function NeuralMetagraph({ activeNodes }: NeuralMetagraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = container.clientWidth;
    let height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    class Point {
      x: number; y: number; z: number; size: number; color: string;
      constructor() {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos((Math.random() * 2) - 1);
        const radius = 100;
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
        const fov = 250;
        const scale = fov / (fov + this.z);
        const x2d = (this.x * scale) + (width / 2);
        const y2d = (this.y * scale) + (height / 2);
        if (scale > 0) {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = Math.max(0.1, scale - 0.2);
            ctx.beginPath(); ctx.arc(x2d, y2d, this.size * scale, 0, Math.PI * 2); ctx.fill();
            return { x: x2d, y: y2d, scale };
        }
        return null;
      }
    }

    const points: Point[] = Array.from({ length: 60 }, () => new Point());
    let rotationSpeedX = 0.002, rotationSpeedY = 0.003, mouseX = 0, mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left - width / 2) * 0.0001;
        mouseY = (e.clientY - rect.top - height / 2) * 0.0001;
    };
    container.addEventListener('mousemove', handleMouseMove);

    const render = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        rotationSpeedX = mouseX !== 0 ? mouseY : 0.002;
        rotationSpeedY = mouseY !== 0 ? mouseX : 0.003;
        const projectedPoints: any[] = [];
        points.forEach(p => {
            p.rotate(rotationSpeedX, rotationSpeedY);
            const proj = p.draw();
            if (proj) projectedPoints.push(proj);
        });
        ctx.strokeStyle = '#00f3ff';
        projectedPoints.forEach((p1, i) => {
            for (let j = i + 1; j < projectedPoints.length; j++) {
                const p2 = projectedPoints[j];
                const dx = p1.x - p2.x, dy = p1.y - p2.y, dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 40) {
                    ctx.beginPath(); ctx.lineWidth = 0.5 * Math.min(p1.scale, p2.scale);
                    ctx.globalAlpha = (1 - dist / 40) * 0.3 * Math.min(p1.scale, p2.scale);
                    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                }
            }
        });
        animationFrameId = requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
        if(container && canvas) {
            width = container.clientWidth; height = container.clientHeight;
            canvas.width = width * dpr; canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        container.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden group cursor-crosshair">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,243,255,0.05)_0%,_transparent_60%)]"></div>
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#1f293a 1px, transparent 1px), linear-gradient(90deg, #1f293a 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      <canvas ref={canvasRef} className="relative z-10 w-full h-full block" />
      <div className="absolute top-0 left-0 w-full h-1 bg-neon-cyan/30 shadow-[0_0_15px_#00f3ff] animate-[scan_4s_ease-in-out_infinite] pointer-events-none opacity-50"></div>
      <div className="absolute top-4 left-4 text-xs text-neon-cyan font-mono border-l-2 border-neon-cyan/50 pl-2 bg-black/40 backdrop-blur py-1 pr-2 shadow-lg">
          <p className="text-[10px] text-text-secondary uppercase mb-0.5">Active Nodes</p>
          <p className="font-bold text-sm">
            {activeNodes !== undefined
              ? <CountUp end={activeNodes} />
              : <span className="text-slate-500">—</span>
            }
          </p>
      </div>
      <div className="absolute bottom-4 right-4 text-xs text-neon-purple font-mono border-r-2 border-neon-purple/50 pr-2 bg-black/40 backdrop-blur py-1 pl-2 text-right shadow-lg">
          <p className="text-[10px] text-text-secondary uppercase mb-0.5">Throughput</p>
          <p className="font-bold text-sm"><CountUp end={12402} suffix=" TPS" /></p>
      </div>
      
      <style>{`
        @keyframes scan {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 0.5; }
            90% { opacity: 0.5; }
            100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
