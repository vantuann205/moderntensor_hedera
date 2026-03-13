"use client";

import { useState } from "react";
import BootSequence from "./BootSequence";
import ParticleBackground from "./ParticleBackground";
import Navbar from "./Navbar";
import { ViewState } from "@/types";
import HomeView from "../dashboard/HomeView";
import ExplorerView from "../dashboard/ExplorerView";
import SubnetsHub from "../dashboard/SubnetsHub";
import MinersView from "../dashboard/MinersView";
import ValidatorsView from "../dashboard/ValidatorsView";
import TasksView from "../dashboard/TasksView";
import TokenomicsView from "../dashboard/TokenomicsView";
import AllBlocksView from "../dashboard/AllBlocksView";
import AllTransactionsView from "../dashboard/AllTransactionsView";
import TransactionDetailsView from "../dashboard/TransactionDetailsView";
import BlockDetailsView from "../dashboard/BlockDetailsView";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const [isBooting, setIsBooting] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [selectedBlockHeight, setSelectedBlockHeight] = useState<string | null>(null);

  const handleSelectTransaction = (id: string) => {
    setSelectedTransactionId(id);
    setCurrentView(ViewState.TRANSACTION_DETAILS);
  };

  const handleSelectBlock = (height: string) => {
    setSelectedBlockHeight(height);
    setCurrentView(ViewState.BLOCK_DETAILS);
  };

  const renderView = () => {
    switch (currentView) {
      case ViewState.HOME:
        return <HomeView />;
      case ViewState.EXPLORER:
        return <ExplorerView 
          onSelectBlock={handleSelectBlock} 
          onSelectTransaction={handleSelectTransaction} 
          onViewAllBlocks={() => setCurrentView(ViewState.ALL_BLOCKS)}
          onViewAllTransactions={() => setCurrentView(ViewState.ALL_TRANSACTIONS)}
          onSelectAccount={(id) => console.log('Selected account:', id)}
        />;
      case ViewState.SUBNETS:
        return <SubnetsHub onSelect={(id) => setCurrentView(ViewState.SUBNET_DETAILS)} />;
      case ViewState.MINERS:
        return <MinersView 
          onBack={() => setCurrentView(ViewState.HOME)} 
          onSelectMiner={(id) => console.log('Selected miner:', id)} 
        />;
      case ViewState.VALIDATORS:
        return <ValidatorsView 
          onBack={() => setCurrentView(ViewState.HOME)} 
          onSelectValidator={(a) => setCurrentView(ViewState.VALIDATOR_DETAILS)} 
        />;
      case ViewState.TASKS:
        return <TasksView 
          onBack={() => setCurrentView(ViewState.HOME)} 
          onSelectTask={(id) => console.log('Selected task:', id)} 
        />;
      case ViewState.TOKENOMICS:
        return <TokenomicsView />;
      case ViewState.ALL_BLOCKS:
        return <AllBlocksView onBack={() => setCurrentView(ViewState.EXPLORER)} onSelectBlock={handleSelectBlock} />;
      case ViewState.ALL_TRANSACTIONS:
        return <AllTransactionsView onBack={() => setCurrentView(ViewState.EXPLORER)} onSelectTransaction={handleSelectTransaction} />;
      case ViewState.TRANSACTION_DETAILS:
        return <TransactionDetailsView 
          transactionId={selectedTransactionId || ''} 
          onBack={() => setCurrentView(ViewState.EXPLORER)} 
          onSelectAccount={(id) => console.log('Selected account:', id)}
          onSelectBlock={handleSelectBlock}
        />;
      case ViewState.BLOCK_DETAILS:
        return <BlockDetailsView 
          blockHeight={selectedBlockHeight || ''} 
          onBack={() => setCurrentView(ViewState.EXPLORER)} 
        />;
      default:
        return <HomeView />;
    }
  };

  return (
    <>
      {isBooting ? (
        <BootSequence onComplete={() => setIsBooting(false)} />
      ) : (
        <div className="bg-bg-dark min-h-screen text-slate-300 font-body selection:bg-neon-cyan selection:text-black flex flex-col overflow-x-hidden animate-fade-in-up">
          <ParticleBackground />
          <div className="flex flex-col min-h-screen relative z-10">
            <Navbar 
              currentView={currentView} 
              onNavClick={setCurrentView}
            />
            <main className="flex-grow relative z-10 w-full max-w-[1920px] mx-auto flex flex-col">
              <div key={currentView} className="animate-fade-in-up w-full">
                {renderView()}
              </div>
            </main>
            <footer className="mt-auto border-t border-white/5 bg-bg-dark/50 backdrop-blur py-6 z-20">
              <div className="w-full px-6 lg:px-10 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-slate-600 text-xs font-mono">© 2024 MODERN TENSOR HEDERA. SYSTEM ONLINE.</p>
                <div className="flex gap-8 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <button className="hover:text-neon-cyan transition-colors">Docs</button>
                  <button className="hover:text-neon-cyan transition-colors">API</button>
                  <button className="hover:text-neon-cyan transition-colors">Privacy</button>
                  <button className="hover:text-neon-cyan transition-colors">Terms</button>
                </div>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
