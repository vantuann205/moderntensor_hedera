import React, { useState } from 'react';
import { useLatestBlocks } from '@/hooks/useRealData';

export default function AllBlocksView({ onBack, onSelectBlock }: { onBack: () => void; onSelectBlock?: (h: string) => void }) {
  const { data: blocks, loading } = useLatestBlocks(20);
  const [searchQuery, setSearchQuery] = useState('');

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'Just now';
    const date = new Date(parseFloat(timestamp) * 1000);
    return date.toLocaleTimeString();
  };

  const filteredBlocks = blocks.filter(block => 
    block.height.toString().includes(searchQuery) ||
    block.hash.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full min-h-screen animate-fade-in-up">
      <div className="w-full max-w-[1400px] flex flex-col gap-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-[12px] font-mono tracking-widest text-slate-500 uppercase">
             <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
             <span className="material-symbols-outlined text-[12px]">chevron_right</span>
             <span className="text-neon-cyan">BLOCKS</span>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="relative w-full max-w-3xl">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
            <input 
              className="w-full bg-[#0a1120]/80 border border-white/10 rounded-full pl-12 pr-4 py-4 text-white focus:outline-none focus:border-neon-cyan text-xs font-mono backdrop-blur-md" 
              placeholder="Search by Block Height / Hash..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
            />
          </form>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Blockchain', val: 'Hedera', icon: 'hub', color: 'text-neon-cyan', border: 'neon-border-cyan' },
              { label: 'Protocol', val: 'v1 API', icon: 'timelapse', color: 'text-neon-pink', border: 'neon-border-pink' },
              { label: 'Consensus', val: 'Gossip', icon: 'verified_user', color: 'text-neon-blue', border: 'border-l-2 border-neon-blue' }
            ].map((stat, i) => (
              <div key={i} className={`glass-panel p-6 rounded-xl ${stat.border} relative overflow-hidden group`}>
                <p className="text-slate-500 text-[12px] font-black uppercase tracking-widest mb-1">{stat.label}</p>
                <h3 className="text-3xl font-black text-white font-mono tracking-tighter">{stat.val}</h3>
                <span className={`material-symbols-outlined ${stat.color} absolute right-6 top-1/2 -translate-y-1/2 text-3xl opacity-20`}>{stat.icon}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col gap-4 font-body">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2 font-display">
              <span className="material-symbols-outlined text-neon-cyan text-lg">view_module</span> Ledger_Feed
            </h3>
          </div>
          <div className="glass-panel rounded-xl overflow-hidden border border-white/5 flex flex-col bg-panel-dark/40 font-mono tracking-wider">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-[12px] uppercase font-black text-slate-500">
                    <th className="px-6 py-5">Block Height</th>
                    <th className="px-6 py-4">Txs (Count)</th>
                    <th className="px-6 py-4">Gas Used</th>
                    <th className="px-6 py-4">Hash</th>
                    <th className="px-6 py-4 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-20 text-center animate-pulse text-slate-500 uppercase tracking-widest">Scanning Chain...</td></tr>
                  ) : filteredBlocks.map((block, i) => (
                    <tr key={i} className="group hover:bg-neon-cyan/5 transition-all cursor-pointer" onClick={() => onSelectBlock?.(block.height.toString())}>
                      <td className="px-6 py-5 text-neon-cyan font-black">#{block.height}</td>
                      <td className="px-6 py-4 text-center"><span className="bg-white/5 px-2 py-0.5 rounded text-xs text-white">{block.count}</span></td>
                      <td className="px-6 py-4 text-slate-300 font-bold">{block.gas_used.toLocaleString()}</td>
                      <td className="px-6 py-4 font-mono text-slate-500 text-[12px] truncate max-w-[150px]" title={block.hash}>{block.hash}</td>
                      <td className="px-6 py-4 text-right text-slate-500 text-[12px]">{formatTimestamp(block.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

