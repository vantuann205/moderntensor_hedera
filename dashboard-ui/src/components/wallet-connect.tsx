'use client';

import { LogOut } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import WalletConnectModal from './ui-custom/WalletConnectModal';
import { useState } from 'react';

interface Props { onOpenAccount?: () => void; }

export function WalletConnect({ onOpenAccount }: Props) {
  const { accountId, isConnected, disconnect, type } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const walletIcon = type === 'hashpack'
    ? 'https://cdn.prod.website-files.com/614c99cf4f23700c8aa3752a/6323b696c42eaa1be5f8152a_public.png'
    : 'https://www.pngall.com/wp-content/uploads/17/Metamask-Wallet-Logo-Design-PNG.png';

  if (isConnected && accountId) {
    return (
      <div className="flex items-center gap-2">
        {/* Click → Account page */}
        <button
          onClick={onOpenAccount}
          className="flex items-center gap-2.5 px-3.5 py-2 bg-[#0a0f1e] text-white rounded-xl border border-white/10 hover:border-neon-cyan/50 transition-all duration-200"
        >
          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${type === 'hashpack' ? 'bg-neon-cyan/10 border-neon-cyan/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
            <img src={walletIcon} className={`w-3.5 h-3.5 object-contain ${type === 'metamask' ? 'rounded-sm' : ''}`} alt="W" />
          </div>
          <span className="text-[11px] font-black font-mono tracking-wider">{accountId}</span>
        </button>

        {/* Disconnect */}
        <button
          onClick={() => disconnect()}
          className="flex items-center justify-center p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-xl transition-all"
          title="Disconnect"
        >
          <LogOut size={14} />
        </button>
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
        <svg className="w-3.5 h-3.5 text-neon-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5m0 0h-7" />
        </svg>
        Connect Wallet
      </button>
    </>
  );
}