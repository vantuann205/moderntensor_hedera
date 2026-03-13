"use client";

import React from 'react';
import { ViewState } from '@/types';

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
  
  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full animate-fade-in-up">
      <div className="w-full max-w-[1400px] flex flex-col gap-10">
        
        {/* Header & Search */}
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight font-display neon-text">
            Network Explorer
          </h1>
          <p className="text-slate-400 max-w-2xl text-lg font-light">
            Navigate the immutable ledger. Inspect blocks, extrinsics, events, and account states in real-time.
          </p>
          
          <div className="relative w-full max-w-3xl mx-auto rounded-full group overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-neon-cyan/5 -skew-x-12 animate-pulse"></div>
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none z-10">
              <span className="material-symbols-outlined text-slate-500 group-focus-within:text-neon-cyan transition-colors">search</span>
            </div>
            <input 
              className="w-full bg-panel-dark/80 border border-white/10 rounded-full pl-14 pr-32 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-neon-cyan focus:shadow-[0_0_20px_rgba(0,243,255,0.2)] text-base font-mono backdrop-blur-md transition-all" 
              placeholder="Search Block / Hash / Account / Subnet..." 
              type="text"
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
              <span className="px-3 py-1.5 text-[10px] font-bold bg-white/5 rounded-full text-slate-400 border border-white/10">CMD + K</span>
            </div>
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
                { label: 'Block Height', val: '#2,481,920', sub: '2s ago', icon: 'layers', color: 'text-neon-cyan', border: 'border-neon-cyan' },
                { label: 'Network TPS', val: '142.5', sub: '+12% peak', icon: 'speed', color: 'text-neon-pink', border: 'border-neon-pink' },
                { label: 'Avg Gas', val: '0.004', unit: 'M', sub: '12 Gwei Base', icon: 'local_gas_station', color: 'text-neon-blue', border: 'border-neon-blue' },
                { label: 'Active Accounts', val: '84,201', sub: '+24 this hour', icon: 'groups', color: 'text-neon-purple', border: 'border-neon-purple' }
            ].map((stat, i) => (
                <div key={i} className={`glass-panel p-6 rounded-xl relative overflow-hidden group glass-card-hover`}>
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                        <span className={`material-symbols-outlined ${stat.color} text-2xl opacity-80`}>{stat.icon}</span>
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-3xl font-bold text-white font-display tracking-tight">
                            {stat.val} <span className="text-lg text-slate-500 font-normal">{stat.unit}</span>
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                            {i === 0 && <span className="relative flex h-2 w-2 mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
                            <p className={`text-xs font-mono font-bold ${i === 1 ? 'text-green-400' : 'text-slate-500'}`}>{stat.sub}</p>
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
              <button onClick={onViewAllBlocks} className="text-[10px] font-bold text-neon-cyan hover:text-white uppercase tracking-widest transition-colors border border-neon-cyan/30 px-3 py-1 rounded hover:bg-neon-cyan/10">View All</button>
            </div>
            
            <div className="bg-panel-dark/60 rounded-xl overflow-hidden border border-white/5 flex flex-col relative">
               <div className="overflow-x-auto relative z-10 font-body">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#050b14]/80 backdrop-blur">
                    <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-400 font-bold">
                      <th className="px-6 py-4">Height</th>
                      <th className="px-6 py-4">Validator</th>
                      <th className="px-6 py-4 text-center">Extrinsics</th>
                      <th className="px-6 py-4 text-right">Age</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-mono divide-y divide-white/5 tracking-wider">
                    {[
                      { height: '2,481,920', validator: 'Core_Valid...', color: 'bg-neon-purple', tx: 42, time: '2s' },
                      { height: '2,481,919', validator: 'TensorStats', color: 'bg-neon-cyan', tx: 18, time: '14s' },
                      { height: '2,481,918', validator: 'Foundry', color: 'bg-green-500', tx: 156, time: '26s' },
                      { height: '2,481,917', validator: 'ModernTens...', color: 'bg-neon-red', tx: 89, time: '38s' },
                      { height: '2,481,916', validator: 'RoundTable', color: 'bg-indigo-500', tx: 23, time: '50s' },
                    ].map((block, i) => (
                      <tr key={i} className="group hover:bg-white/[0.04] transition-all duration-200">
                        <td className="px-6 py-4">
                          <span 
                            className="text-neon-cyan font-bold hover:underline cursor-pointer flex items-center gap-2" 
                            onClick={() => onSelectBlock && onSelectBlock(block.height)}
                          >
                            {block.height}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-sm ${block.color} shadow-[0_0_5px_currentColor]`}></div>
                            <span className="text-slate-300 truncate w-24 block opacity-80 group-hover:opacity-100">{block.validator}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block w-8 text-center rounded bg-white/5 border border-white/5 text-xs text-white">{block.tx}</span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 text-xs">{block.time}</td>
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
              <button onClick={onViewAllTransactions} className="text-[10px] font-bold text-neon-pink hover:text-white uppercase tracking-widest transition-colors border border-neon-pink/30 px-3 py-1 rounded hover:bg-neon-pink/10">View All</button>
            </div>
            
            <div className="bg-panel-dark/60 rounded-xl overflow-hidden border border-white/5 flex flex-col relative">
              <div className="overflow-x-auto relative z-10 font-body">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#050b14]/80 backdrop-blur">
                    <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-400 font-bold">
                      <th className="px-6 py-4">Hash</th>
                      <th className="px-6 py-4">From / To</th>
                      <th className="px-6 py-4 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-mono divide-y divide-white/5 tracking-wider">
                    {[
                      { hash: '0x9a8f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01', from: '5Gj8...9kL', to: '5Hm2...1pQ', val: '142.50', time: '10s' },
                      { hash: '0x2b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c', from: '5Kp9...3mN', to: 'Subnet 4 Pool', val: '0.05', time: '15s', toClass: 'text-slate-500 italic' },
                      { hash: '0x1d7e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e', from: '5Xr1...7tY', to: '5Ab2...8cZ', val: '1,200.00', time: '22s' },
                      { hash: '0x5g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l', from: '5Lm3...2kP', to: '5Qn6...4rS', val: '45.00', time: '35s' },
                      { hash: '0x3f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a', from: '5Pt4...9uV', to: '5Wy2...3xR', val: '890.15', time: '42s' },
                    ].map((tx, i) => (
                      <tr key={i} className="group hover:bg-white/[0.04] transition-all duration-200 cursor-pointer" onClick={() => onSelectTransaction && onSelectTransaction(tx.hash)}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-neon-pink font-bold hover:underline transition-colors w-28 truncate block" title={tx.hash}>
                                {tx.hash.substring(0, 10)}...{tx.hash.substring(tx.hash.length - 6)}
                            </span>
                            <span className="text-[10px] text-slate-500 underline decoration-white/10 decoration-dotted">{tx.time} ago</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-500 w-8">From</span>
                              <span className="text-white hover:text-neon-cyan transition-colors truncate w-24 block" onClick={(e) => { e.stopPropagation(); onSelectAccount && onSelectAccount(tx.from); }}>{tx.from}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-500 w-8">To</span>
                              <span className={`truncate w-24 block ${tx.toClass ? tx.toClass : 'text-white hover:text-neon-cyan transition-colors'}`} onClick={(e) => { e.stopPropagation(); !tx.toClass && onSelectAccount && onSelectAccount(tx.to); }}>{tx.to}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-bold text-white bg-white/5 px-2 py-1 rounded border border-white/10">{tx.val} M</span>
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
