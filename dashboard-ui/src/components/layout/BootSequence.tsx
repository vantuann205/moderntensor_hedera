"use client";

import { useState, useEffect } from "react";

export default function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const messages = [
    "INITIALIZING KERNEL...",
    "LOADING NEURAL WEIGHTS [v2.4.1]...",
    "CONNECTING TO METAGRAPH...",
    "SYNCING SUBNET CONSENSUS...",
    "ESTABLISHING SECURE HANDSHAKE...",
    "SYSTEM ONLINE."
  ];

  useEffect(() => {
    let delay = 0;
    messages.forEach((msg, index) => {
      delay += Math.random() * 400 + 300;
      setTimeout(() => {
        setLines(prev => [...prev, msg]);
        const el = document.getElementById('boot-terminal');
        if (el) el.scrollTop = el.scrollHeight;
        
        if (index === messages.length - 1) {
          setTimeout(onComplete, 800);
        }
      }, delay);
    });
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-bg-dark z-[9999] flex items-center justify-center font-mono text-neon-cyan p-4">
      <div className="w-full max-w-md border border-white/10 rounded-lg p-6 bg-black shadow-[0_0_50px_rgba(0,243,255,0.1)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-cyan to-transparent animate-scan-input"></div>
        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
            <span className="text-xs text-slate-500 uppercase">ModernTensor BIOS v2.0</span>
            <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
        </div>
        <div id="boot-terminal" className="flex flex-col gap-2 h-64 overflow-y-auto no-scrollbar scroll-smooth">
            {lines.map((line, i) => (
            <div key={i} className="text-sm animate-fade-in-up">
                <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                <span className={i === lines.length - 1 ? "text-white font-bold" : "text-neon-cyan"}>{`> ${line}`}</span>
            </div>
            ))}
            <div className="h-4 w-2 bg-neon-cyan animate-pulse mt-1"></div>
        </div>
      </div>
    </div>
  );
}
