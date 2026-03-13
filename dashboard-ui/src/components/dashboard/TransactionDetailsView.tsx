"use client";

import React from 'react';
import { useTransactionDetails } from '@/hooks/useRealData';

interface TransactionDetailsViewProps {
  transactionId: string;
  onBack: () => void;
  onSelectAccount?: (id: string) => void;
  onSelectBlock?: (height: string) => void;
}

const TransactionDetailsView: React.FC<TransactionDetailsViewProps> = ({ 
  transactionId, 
  onBack, 
  onSelectAccount,
  onSelectBlock
}) => {
  const { data, loading, error } = useTransactionDetails(transactionId);
  
  const tx = data?.transaction;
  const hbarPrice = data?.hbarPrice || 0.09;

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '—';
    const date = new Date(parseFloat(timestamp) * 1000);
    return date.toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZoneName: 'short'
    });
  };

  const formatHbar = (tinybars: number) => {
    return (tinybars / 100000000).toLocaleString(undefined, { minimumFractionDigits: 8 });
  };

  const formatUsd = (tinybars: number) => {
    const hbar = tinybars / 100000000;
    return (hbar * hbarPrice).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 5 });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] animate-pulse">
        <span className="material-symbols-outlined text-neon-pink text-6xl animate-spin mb-4">sync</span>
        <p className="text-slate-500 uppercase tracking-widest font-bold">Fetching Transaction Data...</p>
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px]">
        <span className="material-symbols-outlined text-red-500 text-6xl mb-4">error</span>
        <p className="text-slate-300 font-bold mb-4">{error || 'Transaction not found'}</p>
        <button onClick={onBack} className="px-6 py-2 bg-white/5 border border-white/10 rounded text-neon-cyan uppercase font-bold text-xs tracking-widest hover:bg-white/10 transition-all">Back to Explorer</button>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full animate-fade-in-up font-body">
      <div className="w-full max-w-[1400px] flex flex-col gap-6">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-slate-500 uppercase">
          <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>EXPLORER</button>
          <span className="material-symbols-outlined text-[10px]">chevron_right</span>
          <span className="text-neon-pink">TRANSACTION DETAILS</span>
        </div>

        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex flex-col gap-2">
             <h1 className="text-4xl font-black text-white uppercase tracking-tight font-display">Transaction</h1>
             <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest ${tx.result === 'SUCCESS' ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-red-500 text-white'}`}>
                  {tx.result}
                </span>
                <span className="text-slate-500 font-mono text-xs font-bold uppercase tracking-widest">DEFAULT FORMAT</span>
             </div>
          </div>
          <div className="flex flex-col items-end gap-1">
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">HBAR Price</p>
             <p className="text-xl font-black text-white font-mono tracking-tighter">${hbarPrice.toFixed(4)}</p>
          </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Summary Details */}
          <div className="glass-panel rounded-xl border border-white/5 bg-panel-dark/40 overflow-hidden">
             <div className="p-6 flex flex-col divide-y divide-white/5">
                
                {[
                  { label: 'ID', value: tx.transaction_id, isCopy: true, color: 'text-neon-pink' },
                  { label: 'Type', value: tx.name.replace(/_/g, ' '), isCaps: true },
                  { label: 'Consensus at', value: formatTimestamp(tx.consensus_timestamp) },
                  { label: 'Transaction Hash', value: tx.hash, isCopy: true, isTruncate: true },
                  { label: 'Block', value: tx.block_number || '—', isLink: true, action: () => onSelectBlock?.(tx.block_number?.toString() || '') },
                  { label: 'Node Submitted To', value: tx.node || '—' },
                  { label: 'Memo', value: tx.memo_base64 ? atob(tx.memo_base64) : 'None' },
                  { label: 'Topic ID', value: tx.entity_id || '—', isLink: true },
                  { label: 'Payer Account', value: tx.payer_account_id, isLink: true, action: () => onSelectAccount?.(tx.payer_account_id) },
                ].map((item, i) => (
                  <div key={i} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-2 group">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest md:w-40">{item.label}</span>
                    <div className="flex-grow flex items-center gap-2 overflow-hidden">
                        {item.isLink ? (
                            <button onClick={item.action} className="text-sm font-mono text-neon-cyan hover:underline truncate">
                                {item.value}
                            </button>
                        ) : (
                            <span className={`text-sm font-mono ${item.color || 'text-white'} ${item.isCaps ? 'uppercase' : ''} ${item.isTruncate ? 'truncate max-w-[200px] md:max-w-none' : ''}`}>
                                {item.value}
                            </span>
                        )}
                        {item.isCopy && (
                            <button className="material-symbols-outlined text-xs text-slate-600 hover:text-white transition-colors">content_copy</button>
                        )}
                    </div>
                  </div>
                ))}

                <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest md:w-40">Charged Fee</span>
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-white font-mono">{formatHbar(tx.charged_tx_fee)} ℏ</span>
                        <span className="text-[10px] font-bold text-slate-500 font-mono italic">{formatUsd(tx.charged_tx_fee)}</span>
                    </div>
                </div>

                <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest md:w-40">Max Fee</span>
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-slate-300 font-mono">{formatHbar(tx.max_fee)} ℏ</span>
                        <span className="text-[10px] font-bold text-slate-600 font-mono italic">{formatUsd(tx.max_fee)}</span>
                    </div>
                </div>

                <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest md:w-40">Valid Duration</span>
                    <span className="text-sm font-mono text-white tracking-widest uppercase">{Math.floor(tx.valid_duration_seconds / 60)}min</span>
                </div>

                <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest md:w-40">Transaction Nonce</span>
                    <span className="text-sm font-mono text-white">{tx.transaction_nonce}</span>
                </div>

             </div>
          </div>

          {/* Transfers Table */}
          <div className="flex flex-col gap-6">
            <div className="glass-panel rounded-xl border border-white/5 bg-panel-dark/40 overflow-hidden flex flex-col">
               <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-neon-cyan text-sm">payments</span> Hbar Transfers
                  </h3>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-[#050b14]/80 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                      <tr>
                        <th className="px-6 py-4">Account</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                      </tr>
                   </thead>
                   <tbody className="text-[11px] font-mono tracking-wider divide-y divide-white/5">
                      {tx.transfers?.map((transfer: any, i: number) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4">
                            <button onClick={() => onSelectAccount?.(transfer.account)} className="text-neon-cyan hover:underline">
                              {transfer.account}
                            </button>
                            {transfer.is_approval && <span className="ml-2 text-[8px] bg-neon-cyan/10 text-neon-cyan px-1 border border-neon-cyan/20 rounded">APPROVED</span>}
                          </td>
                          <td className={`px-6 py-4 text-right font-black ${transfer.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {transfer.amount > 0 ? '+' : ''}{formatHbar(transfer.amount)} ℏ
                            <br/>
                            <span className="text-[8px] opacity-60 font-normal italic">{formatUsd(transfer.amount)}</span>
                          </td>
                        </tr>
                      ))}
                      {(!tx.transfers || tx.transfers.length === 0) && (
                        <tr><td colSpan={2} className="px-6 py-10 text-center text-slate-500 italic uppercase">No HBAR transfers</td></tr>
                      )}
                   </tbody>
                 </table>
               </div>
            </div>

            {/* Raw Data Placeholder */}
            <div className="glass-panel rounded-xl border border-white/5 bg-panel-dark/40 overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Raw Data</h3>
                  <span className="material-symbols-outlined text-slate-600 text-sm">code</span>
                </div>
                <div className="bg-black/40 rounded p-4 border border-white/5 overflow-x-auto">
                   <pre className="text-[10px] text-slate-400 font-mono leading-relaxed">
                     {JSON.stringify(tx, null, 2)}
                   </pre>
                </div>
            </div>
          </div>

        </div>

        {/* Footer info/Fee collection */}
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 p-6 glass-panel rounded-xl border border-white/5 bg-panel-dark/60">
            <div className="flex items-center gap-4">
              <div className="size-10 bg-neon-cyan/10 rounded border border-neon-cyan/20 flex items-center justify-center">
                 <span className="material-symbols-outlined text-neon-cyan">account_balance</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fee Collection Account</span>
                <span className="text-sm font-bold text-white font-mono">0.0.98 (Hedera Node 0)</span>
              </div>
            </div>
            <button className="px-8 py-3 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-[10px] font-black uppercase tracking-widest rounded hover:bg-neon-cyan/20 transition-all">
              View on HashScan
            </button>
        </div>

      </div>
    </div>
  );
};

export default TransactionDetailsView;
