"use client";

import React from 'react';
import { Proposal } from '@/types';

const proposals: Proposal[] = [
  { id: '#082', title: 'Increase Validator Emission Cap for Subnet 12', description: 'This proposal suggests increasing the emission cap for Subnet 12 (Text-to-3D) to incentivize higher quality model contributions.', status: 'active', votes: { yes: 65, no: 25, abstain: 10 }, proposer: '0x7a...9F', endsIn: '2d 14h', totalVotes: '1.4M' },
  { id: '#081', title: 'Register New Subnet: Bioinformatics Alpha', description: 'A proposal to register a new subnet dedicated to protein folding simulations.', status: 'active', votes: { yes: 92, no: 5, abstain: 3 }, proposer: 'BioLab_DAO', endsIn: '5d 08h', totalVotes: '1.2M' },
  { id: '#080', title: 'Reduce Registration Fee to 200 MTN', description: 'Proposal to lower the barrier for entry for new miners by reducing the registration burn fee.', status: 'passed', votes: { yes: 88, no: 12, abstain: 0 }, proposer: '', endedDate: 'Oct 24, 2024', totalVotes: '2M' }
];

export default function GovernanceView({ onSelectProposal, onCreateProposal }: { onSelectProposal?: (id: string) => void; onCreateProposal?: () => void }) {
  return (
    <div className="flex flex-col gap-10 py-10 px-6 lg:px-12 w-full max-w-[1200px] mx-auto animate-fade-in-up">
      <section className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 pb-8 border-b border-white/10 relative">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 uppercase tracking-widest shadow-[0_0_10px_rgba(0,243,255,0.2)]">Senate Chamber</span>
            <span className="text-slate-500 text-xs font-mono">Block #452,102</span>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight font-display neon-text">Governance Portal</h1>
          <p className="text-slate-400 max-w-xl text-lg font-light leading-relaxed">
             Shape the <span className="text-white font-medium">Neural Architecture</span>. Vote on upgrades, subnet allocations, and parameter shifts.
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-6 font-display uppercase tracking-widest">
           <div className="glass-panel px-6 py-4 rounded-lg flex items-center gap-8 border border-white/10 bg-black/40">
              <div><p className="text-slate-500 text-[9px] font-black mb-1">Network Power</p><p className="text-2xl font-black text-white">2.8M <span className="text-neon-cyan">M</span></p></div>
              <div className="h-10 w-px bg-white/10"></div>
              <div><p className="text-slate-500 text-[9px] font-black mb-1">Active Proposals</p><p className="text-2xl font-black text-white">4</p></div>
           </div>
           <button onClick={onCreateProposal} className="px-6 py-3 rounded font-black text-black bg-neon-cyan shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:bg-white transition-all text-xs">CREATE PROPOSAL</button>
        </div>
      </section>

      <div className="space-y-6">
        {proposals.map((p) => (
             <article key={p.id} className={`glass-panel p-6 rounded-2xl border ${p.status === 'active' ? 'border-neon-cyan/50 shadow-[0_0_20px_rgba(0,243,255,0.1)]' : 'border-white/10'} hover:border-white/30 transition-all duration-300 group`}>
                <div className="flex justify-between items-start mb-4">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${p.status === 'active' ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'bg-neon-green/10 text-neon-green border-neon-green/30'}`}>
                        {p.status === 'active' ? 'Active Voting' : 'Proposal Passed'}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">REF: {p.id}</span>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                   <div className="flex-1">
                      <h3 className="text-2xl font-black text-white mb-2 group-hover:text-neon-cyan transition-colors cursor-pointer font-display uppercase tracking-tight" onClick={() => p.status === 'active' && onSelectProposal?.(p.id)}>{p.title}</h3>
                      <p className="text-slate-400 text-sm leading-relaxed mb-6 font-body font-light">{p.description}</p>
                      
                      <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                         <div className="bg-white/5 px-2 py-1 rounded border border-white/10">Proposer: <span className="text-white">{p.proposer}</span></div>
                         <div className="bg-white/5 px-2 py-1 rounded border border-white/10">Time: <span className="text-neon-pink font-bold">{p.status === 'active' ? p.endsIn : p.endedDate}</span></div>
                      </div>
                   </div>

                   <div className="w-full md:w-80 flex flex-col gap-4 font-mono text-[10px] uppercase font-bold">
                        {p.status === 'active' ? (
                            ['Yes', 'No', 'Abstain'].map((opt) => (
                                <div key={opt}>
                                    <div className="flex justify-between mb-1.5"><span className="text-slate-400">{opt}</span><span className="text-white">{p.votes[opt.toLowerCase() as keyof typeof p.votes]}%</span></div>
                                    <div className="h-1 w-full bg-black rounded-full overflow-hidden border border-white/5">
                                        <div className={`h-full bg-neon-cyan transition-all duration-1000`} style={{ width: `${p.votes[opt.toLowerCase() as keyof typeof p.votes]}%` }}></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-2">
                                <span className="text-neon-green text-lg font-black tracking-widest">SUCCESSFUL</span>
                                <div className="h-1 w-full bg-neon-green/20 rounded-full overflow-hidden"><div className="h-full bg-neon-green w-[88%]"></div></div>
                            </div>
                        )}
                   </div>
                </div>
             </article>
        ))}
      </div>
    </div>
  );
}
