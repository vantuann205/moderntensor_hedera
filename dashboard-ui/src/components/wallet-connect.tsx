'use client';

import { useState } from 'react';
import { Wallet, LogOut, User, ExternalLink, Zap } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import WalletConnectModal from './ui-custom/WalletConnectModal';

export function WalletConnect() {
  const { accountId, balance, address, isConnected, disconnect, type } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && accountId) {
    return (
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`group flex items-center gap-3 px-4 py-2 bg-[#0a0f1e] text-white rounded-xl border transition-all duration-300 ${showMenu ? 'border-neon-cyan/50 shadow-[0_0_15px_rgba(0,243,254,0.1)]' : 'border-white/5 hover:border-white/20'}`}
        >
          <div className={`w-6 h-6 rounded flex items-center justify-center ${type === 'hashpack' ? 'bg-neon-cyan/10 border-neon-cyan/20' : 'bg-orange-500/10 border-orange-500/20'} border`}>
            <img 
              src={type === 'hashpack' ? "https://cdn.prod.website-files.com/614c99cf4f23700c8aa3752a/6323b696c42eaa1be5f8152a_public.png" : "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQm75vp4StozEiplXmRw_lonYrfxv8rvfUIDw&s"} 
              className={`w-4 h-4 object-contain ${type === 'metamask' ? 'rounded-md' : ''}`} 
              alt="W"
            />
          </div>
          <span className="text-[11px] font-black font-mono tracking-wider">{accountId}</span>
          <span className="text-[10px] font-bold text-slate-500 hidden lg:inline">({type})</span>
        </button>

        <button
          onClick={() => { disconnect(); setShowMenu(false); }}
          className="flex items-center justify-center p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl transition-all"
          title="Disconnect Wallet"
        >
          <LogOut size={16} />
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-3 w-64 bg-[#0a0f1e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 z-50 animate-scale-in">
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">HBAR Balance</div>
                <div className="text-sm font-black text-white font-mono">ℏ {balance || '0.00'}</div>
              </div>
              
              {address && (
                <div className="px-1">
                  <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">EVM Address</div>
                  <div className="text-[10px] font-mono text-slate-400 break-all">{address}</div>
                </div>
              )}

              <div className="h-[1px] bg-white/5 w-full my-1" />
              
              <button
                onClick={() => { disconnect(); setShowMenu(false); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <LogOut size={14} /> Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <WalletConnectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <button
        onClick={() => setIsModalOpen(true)}
        className="group relative flex items-center gap-2.5 bg-[#0a0f1e] text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] border border-white/10 hover:border-neon-cyan/50 transition-all duration-500 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        
        <Zap size={13} className="text-neon-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
        Connect Wallet
        
        <div className="absolute -inset-1 bg-neon-cyan/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </button>
    </>
  );
}
