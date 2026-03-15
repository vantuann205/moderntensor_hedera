import React, { useState } from 'react';
import { ViewState } from '@/types';
import { useLatestBlocks, useLatestTransactions } from '@/hooks/useRealData';

interface ExplorerViewProps {
  onSelectTransaction?: (hash: string) => void;
  onSelectAccount?: (id: string) => void;
  onSelectBlock?: (height: string) => void;
  onViewAllTransactions?: () => void;
  onViewAllBlocks?: () => void;
}

const ExplorerView: React.FC<ExplorerViewProps> = ({ 
  onSelectTransaction, 
  onSelectAccount, 
  onSelectBlock, 
  onViewAllTransactions, 
  onViewAllBlocks 
}) => {
  const { data: blocks, loading: blocksLoading } = useLatestBlocks(8);
  const { data: transactions, loading: txLoading } = useLatestTransactions(8);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    // Pattern based routing
    if (/^\d+\.\d+\.\d+$/.test(searchQuery)) {
      onSelectAccount?.(searchQuery);
    } else if (searchQuery.includes('@') || searchQuery.includes('-') || searchQuery.length > 40) {
      // It's a transaction ID or a hash
      onSelectTransaction?.(searchQuery);
    } else if (/^\d+$/.test(searchQuery)) {
      onSelectBlock?.(searchQuery);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'Just now';
    const date = new Date(parseFloat(timestamp) * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full animate-fade-in-up">
      <div className="w-full max-w-[1400px] flex flex-col gap-10">
        
        {/* Header & Search */}
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight font-display neon-text">
            Network Explorer
          </h1>
          <p className="text-slate-400 max-w-2xl text-lg font-light">
            Real-time data synchronization with Hedera Testnet Mirror Node. Inspect blocks and transactions live.
          </p>
          
          <form onSubmit={handleSearch} className="relative w-full max-w-3xl mx-auto rounded-full group overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-neon-cyan/5 -skew-x-12 animate-pulse"></div>
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none z-10">
              <span className="material-symbols-outlined text-slate-400 group-focus-within:text-neon-cyan transition-colors">search</span>
            </div>
            <input 
              className="w-full bg-panel-dark/80 border border-white/10 rounded-full pl-14 pr-32 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-neon-cyan focus:shadow-[0_0_20px_rgba(0,243,255,0.2)] text-base font-mono backdrop-blur-md transition-all" 
              placeholder="Search Account (0.0.x) / Transaction ID / Block / Hash..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
            />
            <button type="submit" className="absolute inset-y-0 right-2 flex items-center pr-4">
              <span className="px-3 py-1.5 text-[12px] font-bold bg-neon-cyan/20 rounded-full text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/40 transition-colors uppercase tracking-widest">Search</span>
            </button>
          </form>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
                { label: 'Network', val: 'Testnet', sub: 'HCS Enabled', icon: 'hub', color: 'text-neon-cyan', border: 'border-neon-cyan' },
                { label: 'Sync Status', val: 'Live', sub: '100% Synced', icon: 'sync', color: 'text-neon-pink', border: 'border-neon-pink' },
                { label: 'Mirror Node', val: 'Global', sub: 'v1 API', icon: 'cloud', color: 'text-neon-blue', border: 'border-neon-blue' },
                { label: 'Consensus', val: 'AOBFT', sub: 'Sub-second', icon: 'verified', color: 'text-neon-purple', border: 'border-neon-purple' }
            ].map((stat, i) => (
                <div key={i} className={`glass-panel p-6 rounded-xl relative overflow-hidden group glass-card-hover`}>
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                        <span className={`material-symbols-outlined ${stat.color} text-2xl opacity-80`}>{stat.icon}</span>
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-3xl font-bold text-white font-display tracking-tight">
                            {stat.val}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="relative flex h-2 w-2 mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                            <p className="text-xs font-mono font-bold text-slate-400">{stat.sub}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Latest Blocks */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-white font-bold text-lg uppercase tracking-wider flex items-center gap-2 font-display">
                <span className="material-symbols-outlined text-neon-cyan">view_in_ar</span> Latest Blocks
              </h3>
              <button onClick={onViewAllBlocks} className="text-[12px] font-bold text-neon-cyan hover:text-white uppercase tracking-widest transition-colors border border-neon-cyan/30 px-3 py-1 rounded hover:bg-neon-cyan/10">View All</button>
            </div>
            
            <div className="bg-panel-dark/60 rounded-xl overflow-hidden border border-white/5 flex flex-col relative min-h-[400px]">
               <div className="overflow-x-auto relative z-10 font-body">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#050b14]/80 backdrop-blur">
                    <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-400 font-bold">
                      <th className="px-6 py-4">Height</th>
                      <th className="px-6 py-4">Transactions</th>
                      <th className="px-6 py-4 text-right">Age</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-mono divide-y divide-white/5 tracking-wider">
                    {blocksLoading ? (
                      <tr><td colSpan={3} className="px-6 py-20 text-center animate-pulse text-slate-400 uppercase tracking-widest">Fetching blocks...</td></tr>
                    ) : blocks.map((block, i) => (
                      <tr key={i} className="group hover:bg-white/[0.04] transition-all duration-200">
                        <td className="px-6 py-4">
                          <span 
                            className="text-neon-cyan font-bold hover:underline cursor-pointer flex items-center gap-2" 
                            onClick={() => onSelectBlock?.(block.height.toString())}
                          >
                            {block.height}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2 py-0.5 rounded bg-white/5 border border-white/5 text-xs text-white">
                            {block.count} txns
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 text-xs">
                          {formatTimestamp(block.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Latest Transactions */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-white font-bold text-lg uppercase tracking-wider flex items-center gap-2 font-display">
                <span className="material-symbols-outlined text-neon-pink">swap_horiz</span> Transactions
              </h3>
              <button onClick={onViewAllTransactions} className="text-[12px] font-bold text-neon-pink hover:text-white uppercase tracking-widest transition-colors border border-neon-pink/30 px-3 py-1 rounded hover:bg-neon-pink/10">View All</button>
            </div>
            
            <div className="bg-panel-dark/60 rounded-xl overflow-hidden border border-white/5 flex flex-col relative min-h-[400px]">
              <div className="overflow-x-auto relative z-10 font-body">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#050b14]/80 backdrop-blur">
                    <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-400 font-bold">
                      <th className="px-6 py-4">ID / Type</th>
                      <th className="px-6 py-4">Result</th>
                      <th className="px-6 py-4 text-right">Age</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-mono divide-y divide-white/5 tracking-wider">
                    {txLoading ? (
                      <tr><td colSpan={3} className="px-6 py-20 text-center animate-pulse text-slate-400 uppercase tracking-widest">Fetching transactions...</td></tr>
                    ) : transactions.map((tx, i) => (
                      <tr key={i} className="group hover:bg-white/[0.04] transition-all duration-200 cursor-pointer" onClick={() => onSelectTransaction?.(tx.transaction_id)}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-neon-pink font-bold hover:underline transition-colors w-32 truncate block" title={tx.transaction_id}>
                              {tx.transaction_id}
                            </span>
                            <span className="text-[12px] text-slate-400 font-bold uppercase tracking-tighter opacity-70">
                              {tx.name.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[12px] font-bold px-2 py-0.5 rounded border ${tx.result === 'SUCCESS' ? 'text-green-400 border-green-400/20 bg-green-400/5' : 'text-red-400 border-red-400/20 bg-red-400/5'}`}>
                            {tx.result}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 text-xs">
                          {formatTimestamp(tx.consensus_timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorerView;
