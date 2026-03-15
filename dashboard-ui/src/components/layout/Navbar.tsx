"use client";

import { useState, useRef, useEffect } from "react";
import { ViewState } from "@/types";
import { WalletConnect } from "../wallet-connect";

interface NavbarProps {
  currentView: ViewState;
  onNavClick: (view: ViewState) => void;
}

export default function Navbar({ 
  currentView, 
  onNavClick
}: NavbarProps) {
  const [isCmdKOpen, setIsCmdKOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-bg-dark/80 backdrop-blur-xl border-b border-white/5">
      <div className="w-full px-6 py-3 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent"></div>
        
        <div className="flex items-center gap-8">
          <div 
            className="flex items-center gap-3 text-white group cursor-pointer"
            onClick={() => onNavClick(ViewState.HOME)}
          >
            <div className="size-8 text-neon-cyan group-hover:drop-shadow-[0_0_15px_rgba(0,243,255,0.8)] transition-all duration-300">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <path d="M24 4L6 14V34L24 44L42 34V14L24 4Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                 <path d="M24 14V34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                 <path d="M6 14L24 24L42 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-neon-cyan/80 uppercase">
              ModernTensor Hedera
            </h1>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {[
              { id: ViewState.HOME, label: 'Home' },
              { id: ViewState.EXPLORER, label: 'Explorer' },
              { id: ViewState.SUBNETS, label: 'Subnets' },
              { id: ViewState.MINERS, label: 'Miners' },
              { id: ViewState.VALIDATORS, label: 'Validators' },
              { id: ViewState.TASKS, label: 'Tasks' },
              { id: ViewState.TOKENOMICS, label: 'Tokenomics' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onNavClick(item.id)}
                className={`text-xs font-semibold tracking-wide transition-all px-3 py-1.5 rounded-md border ${
                  currentView === item.id 
                    ? 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30 shadow-[0_0_10px_rgba(0,243,255,0.2)] font-bold tracking-widest'
                    : 'text-text-secondary border-transparent hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div 
              className="hidden lg:flex items-center bg-panel-dark/80 border border-panel-border rounded-md h-9 px-3 w-64 hover:border-neon-cyan/50 hover:shadow-[0_0_10px_rgba(0,243,255,0.1)] transition-all cursor-pointer group"
          >
            <span className="material-symbols-outlined text-text-secondary text-[18px] group-hover:text-neon-cyan transition-colors">search</span>
            <span className="text-xs text-text-secondary ml-2 group-hover:text-white transition-colors">Search...</span>
            <span className="ml-auto text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-slate-500 font-mono">⌘K</span>
          </div>
          <div className="hidden md:block">
            <WalletConnect onOpenAccount={() => onNavClick(ViewState.ACCOUNT)} />
          </div>
          <button 
              className="md:hidden text-white p-2"
              onClick={() => setIsMobileMenuOpen(true)}
          >
              <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
        </div>
      </div>
    </header>
  );
}
