"use client";

import React from 'react';
import { useBlockDetails } from '@/hooks/useRealData';

interface BlockDetailsViewProps {
  blockHeight: string;
  onBack: () => void;
}

const BlockDetailsView: React.FC<BlockDetailsViewProps> = ({ 
  blockHeight, 
  onBack 
}) => {
  const { data: block, loading, error } = useBlockDetails(blockHeight);

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '—';
    const date = new Date(parseFloat(timestamp) * 1000);
    return date.toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZoneName: 'short'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] animate-pulse">
        <span className="material-symbols-outlined text-neon-cyan text-6xl animate-spin mb-4">sync</span>
        <p className="text-slate-500 uppercase tracking-widest font-bold">Fetching Block Data...</p>
      </div>
    );
  }

  if (error || !block) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <span className="material-symbols-outlined text-red-500 text-6xl mb-4">error</span>
        <p className="text-slate-300 font-bold mb-4">{error || 'Block not found'}</p>
        <button onClick={onBack} className="px-6 py-2 bg-white/5 border border-white/10 rounded text-neon-cyan uppercase font-bold text-xs tracking-widest hover:bg-white/10 transition-all">Back to Explorer</button>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full animate-fade-in-up font-body">
      <div className="w-full max-w-[1400px] flex flex-col gap-6">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-slate-500 uppercase">
          <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>EXPLORER</button>
          <span className="material-symbols-outlined text-[10px]">chevron_right</span>
          <span className="text-neon-cyan">BLOCK DETAILS</span>
        </div>

        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex flex-col gap-2">
             <h1 className="text-4xl font-black text-white uppercase tracking-tight font-display">Block {block.height}</h1>
             <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-neon-cyan text-black rounded-sm text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                  Consensus
                </span>
                <span className="text-slate-500 font-mono text-xs font-bold uppercase tracking-widest">v1.0.0</span>
             </div>
          </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-1 gap-6">
          
          <div className="glass-panel rounded-xl border border-white/5 bg-panel-dark/40 overflow-hidden">
             <div className="p-6 flex flex-col divide-y divide-white/5">
                
                {[
                  { label: 'Hash', value: block.hash, isCopy: true, subLabel: 'SHA384' },
                  { label: 'No. Transactions', value: block.count },
                  { label: 'From Timestamp', value: formatTimestamp(block.timestamp) },
                  { label: 'To Timestamp', value: formatTimestamp(block.timestamp_to || '') },
                  { label: 'Gas Used', value: block.gas_used.toLocaleString() },
                  { label: 'Record File Name', value: block.name || '—' },
                ].map((item, i) => (
                  <div key={i} className="py-6 flex flex-col md:flex-row md:items-center justify-between gap-2 group">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest md:w-60">{item.label}</span>
                        {item.subLabel && <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{item.subLabel}</span>}
                    </div>
                    <div className="flex-grow flex items-center gap-2 overflow-hidden md:justify-end">
                        <span className={`text-sm font-mono text-white break-all text-right`}>
                            {item.value}
                        </span>
                        {item.isCopy && (
                            <button className="material-symbols-outlined text-xs text-slate-600 hover:text-white transition-colors">content_copy</button>
                        )}
                    </div>
                  </div>
                ))}

             </div>
          </div>

          {/* Visualization Placeholder */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-xl border border-white/5 bg-gradient-to-br from-neon-cyan/5 to-transparent">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Efficiency</p>
                    <h4 className="text-2xl font-black text-white font-mono">100%</h4>
                    <div className="w-full bg-white/5 h-1 mt-4 overflow-hidden rounded-full">
                        <div className="w-full h-full bg-neon-cyan animate-pulse"></div>
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-xl border border-white/5 bg-gradient-to-br from-neon-pink/5 to-transparent">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Block Propagation</p>
                    <h4 className="text-2xl font-black text-white font-mono">182ms</h4>
                    <div className="w-full bg-white/5 h-1 mt-4 overflow-hidden rounded-full">
                        <div className="w-8/12 h-full bg-neon-pink"></div>
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-xl border border-white/5 bg-gradient-to-br from-neon-purple/5 to-transparent">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Average Tx Fee</p>
                    <h4 className="text-2xl font-black text-white font-mono">0.0001ℏ</h4>
                    <div className="w-full bg-white/5 h-1 mt-4 overflow-hidden rounded-full">
                        <div className="w-5/12 h-full bg-neon-purple"></div>
                    </div>
                </div>
          </div>

        </div>

        {/* Footer info/External links */}
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 p-6 glass-panel rounded-xl border border-white/5 bg-panel-dark/60">
            <div className="flex items-center gap-4">
              <div className="size-10 bg-neon-cyan/10 rounded border border-neon-cyan/20 flex items-center justify-center">
                 <span className="material-symbols-outlined text-neon-cyan">inventory_2</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Consensus</span>
                <span className="text-sm font-bold text-white font-mono">Immutable Ledger Entry Verified</span>
              </div>
            </div>
            <a 
              href={`https://hashscan.io/testnet/block/${block.height}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-[10px] font-black uppercase tracking-widest rounded hover:bg-neon-cyan/20 transition-all font-bold"
            >
              View on HashScan
            </a>
        </div>

      </div>
    </div>
  );
};

export default BlockDetailsView;
