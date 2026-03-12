'use client';

import Link from 'next/link';
import NetworkStats from '@/components/ui-custom/NetworkStats';
import ActivityFeed from '@/components/ui-custom/ActivityFeed';
import ProtocolInfrastructure from '@/components/ui-custom/ProtocolInfrastructure';
import AgentVerificationLive from '@/components/ui-custom/AgentVerificationLive';
import { Activity, Shield, Database, LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-2 text-neon-cyan text-[10px] font-bold uppercase tracking-[0.3em] mb-2">
            <LayoutDashboard size={14} />
            Protocol Overview
          </div>
          <h1 className="text-5xl font-display font-bold text-white tracking-tighter italic uppercase leading-none">
            Network <span className="text-neon-cyan">Intelligence</span>
          </h1>
          <p className="text-slate-500 text-sm mt-3 max-w-xl font-medium">
            Real-time verification metrics and neural node distribution for the ModernTensor Hedera subnet.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mainnet-Alpha Online</span>
          </div>
        </div>
      </div>

      {/* Protocol Infrastructure */}
      <ProtocolInfrastructure />

      {/* Network Health Panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <Activity size={14} className="text-neon-cyan" />
            Neural Health Metrics
          </h2>
        </div>
        <NetworkStats />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Protocol Activity */}
        <div className="lg:col-span-2 space-y-10">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Activity size={14} className="text-neon-cyan" />
                Real-time Protocol Stream
              </h2>
            </div>
            <div className="panel h-[400px] flex flex-col overflow-hidden">
              <ActivityFeed />
            </div>
          </div>
        </div>

        {/* Subnet Shortcuts & Live Verification */}
        <div className="space-y-6">
          <AgentVerificationLive />

          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 pt-4">
            <Database size={14} className="text-neon-purple" />
            Sector Navigation
          </h2>

          <div className="space-y-4">
            <Link href="/miners" className="panel p-5 group flex items-start gap-4 hover:border-neon-cyan/30 transition-all block text-left">
              <div className="p-3 bg-neon-cyan/10 border border-neon-cyan/20 rounded-xl group-hover:bg-neon-cyan/20 transition-all">
                <Database size={18} className="text-neon-cyan" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white group-hover:text-neon-cyan transition-colors italic uppercase">Miner Registry</h4>
                <p className="text-xs text-slate-600 mt-1">Manage and track neural node performance and reputation.</p>
              </div>
            </Link>

            <Link href="/validators" className="panel p-5 group flex items-start gap-4 hover:border-neon-purple/30 transition-all block text-left">
              <div className="p-3 bg-neon-purple/10 border border-neon-purple/20 rounded-xl group-hover:bg-neon-purple/20 transition-all">
                <Shield size={18} className="text-neon-purple" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white group-hover:text-neon-purple transition-colors italic uppercase">Validator Nexus</h4>
                <p className="text-xs text-slate-600 mt-1">Audit oracle integrity and consensus distribution.</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
