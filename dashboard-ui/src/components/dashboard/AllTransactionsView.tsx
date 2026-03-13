"use client";

import React from 'react';

export default function AllTransactionsView({ onBack, onSelectTransaction }: { onBack: () => void; onSelectTransaction?: (h: string) => void }) {
  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full min-h-screen animate-fade-in-up">
      <div className="w-full max-w-[1400px] flex flex-col gap-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-slate-500 uppercase">
             <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
             <span className="material-symbols-outlined text-[10px]">chevron_right</span>
             <span className="text-neon-pink">TRANSACTIONS</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <h1 className="text-4xl font-black text-white uppercase tracking-tight font-display neon-text-pink">Transaction Ledger</h1>
            <div className="px-3 py-1 bg-neon-pink/10 text-neon-pink text-[10px] font-black border border-neon-pink/30 rounded uppercase tracking-widest flex items-center gap-2">
                <span className="size-2 bg-neon-pink rounded-full animate-pulse"></span>
                Inbound Feed Active
            </div>
          </div>

          <div className="w-full glass-panel rounded-xl p-2 flex flex-col md:flex-row items-center justify-between gap-4 border border-white/5 bg-panel-dark/40 font-display">
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              {['All', 'Transfers', 'Staking', 'Governance'].map((t, i) => (
                <button key={t} className={`px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${i === 0 ? 'bg-neon-pink text-black' : 'bg-white/5 text-slate-500 hover:text-white'}`}>{t}</button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <input className="w-full bg-black/40 border border-white/10 rounded px-4 py-2 text-white focus:border-neon-pink outline-none text-[10px] font-mono tracking-wider" placeholder="Search Hash..." type="text"/>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl overflow-hidden border border-white/5 bg-panel-dark/40 font-mono tracking-wider">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#050b14]/80 backdrop-blur">
                <tr className="border-b border-white/10 text-[10px] uppercase font-black text-slate-500">
                  <th className="px-6 py-5">TX_HASH</th>
                  <th className="px-6 py-4">METHOD</th>
                  <th className="px-6 py-4">SENDER</th>
                  <th className="px-6 py-4">RECEIVER</th>
                  <th className="px-6 py-4 text-right">VALUE</th>
                  <th className="px-6 py-4 text-center">ST.</th>
                  <th className="px-6 py-4 text-right">TIME</th>
                </tr>
              </thead>
              <tbody className="text-[11px] divide-y divide-white/5">
                {[...Array(10)].map((_, i) => (
                  <tr key={i} className="group hover:bg-neon-pink/5 transition-all cursor-pointer" onClick={() => onSelectTransaction?.(`0xhash_${i}`)}>
                    <td className="px-6 py-5 text-neon-pink font-bold">0x9a8f...{123+i*7}</td>
                    <td className="px-6 py-4"><span className="bg-white/5 px-2 py-0.5 rounded text-white border border-white/10">TRANSFER</span></td>
                    <td className="px-6 py-4 text-slate-400">5Gj8...9kL</td>
                    <td className="px-6 py-4 text-slate-400">5Hm2...1pQ</td>
                    <td className="px-6 py-4 text-right font-black text-white">{142.5 + i*14} M</td>
                    <td className="px-6 py-4 text-center"><span className="size-2 bg-neon-green rounded-full shadow-[0_0_8px_#00ffa3] inline-block"></span></td>
                    <td className="px-6 py-4 text-right text-slate-500 font-bold">{i * 15}s ago</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
