'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Copy, ExternalLink, CheckCircle, RefreshCw, LogOut, ChevronRight, Shield, Zap, Award } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { CONTRACTS, STAKING_VAULT_ABI } from '@/lib/contracts';

const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';
const MDT_TOKEN_ID = '0.0.8198586';

interface Props { onBack: () => void; }

export default function AccountView({ onBack }: Props) {
  const { accountId, address, isConnected, disconnect, type, isMiner, isValidator, isHolder } = useWallet();
  const [copied, setCopied] = useState<string | null>(null);
  const [assets, setAssets] = useState<{ hbar: string; tokens: { id: string; symbol: string; balance: string; decimals: number }[] } | null>(null);
  const [stakeInfo, setStakeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [hbarRes, tokenRes] = await Promise.all([
        fetch(`${MIRROR}/accounts/${accountId}`, { cache: 'no-store' }),
        fetch(`${MIRROR}/accounts/${accountId}/tokens?limit=20`, { cache: 'no-store' }),
      ]);
      const hbarData = await hbarRes.json();
      const tokenData = await tokenRes.json();
      const hbar = hbarData.balance?.balance != null ? (hbarData.balance.balance / 1e8).toFixed(4) : '0.0000';
      const tokens: any[] = [];
      for (const t of tokenData.tokens || []) {
        try {
          const infoRes = await fetch(`${MIRROR}/tokens/${t.token_id}`, { cache: 'no-store' });
          const info = await infoRes.json();
          const dec = Number(info.decimals ?? 0);
          tokens.push({ id: t.token_id, symbol: info.symbol || t.token_id, balance: (Number(t.balance) / Math.pow(10, dec)).toLocaleString(undefined, { maximumFractionDigits: 4 }), decimals: dec });
        } catch (_) { tokens.push({ id: t.token_id, symbol: t.token_id, balance: String(t.balance), decimals: 0 }); }
      }
      setAssets({ hbar, tokens });
    } catch (_) {}

    if (address) {
      try {
        const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
        const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, provider);
        const info = await vault.getStakeInfo(address);
        setStakeInfo({ amount: Number(info.amount) / 1e8, role: Number(info.role), isActive: info.isActive, stakedAt: Number(info.stakedAt), pendingReward: Number(info.pendingReward) / 1e8 });
      } catch (_) {}
    }
    setLoading(false);
  }, [accountId, address]);

  useEffect(() => { load(); }, [load]);

  const ROLE_LABELS = ['None', 'Miner', 'Validator', 'Holder'];
  const ROLE_COLORS = ['text-slate-400', 'text-neon-cyan', 'text-neon-purple', 'text-neon-green'];
  const walletIcon = type === 'hashpack'
    ? 'https://cdn.prod.website-files.com/614c99cf4f23700c8aa3752a/6323b696c42eaa1be5f8152a_public.png'
    : 'https://www.pngall.com/wp-content/uploads/17/Metamask-Wallet-Logo-Design-PNG.png';

  const roleLabel = isMiner ? 'Miner' : isValidator ? 'Validator' : isHolder ? 'Holder' : 'Unregistered';
  const roleColor = isMiner ? 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5' : isValidator ? 'text-neon-purple border-neon-purple/30 bg-neon-purple/5' : isHolder ? 'text-neon-green border-neon-green/30 bg-neon-green/5' : 'text-slate-400 border-white/10 bg-white/[0.02]';

  if (!isConnected || !accountId) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="text-center space-y-3">
          <Shield size={40} className="text-slate-600 mx-auto" />
          <div className="text-slate-400 font-bold uppercase tracking-widest text-sm">Connect wallet to view account</div>
          <button onClick={onBack} className="text-neon-cyan text-xs font-bold hover:underline">← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 w-full animate-fade-in-up">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-400 uppercase">
          <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
          <ChevronRight size={12} />
          <span className="text-neon-cyan">ACCOUNT</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <img src={walletIcon} className="w-8 h-8 object-contain" alt="wallet" />
            </div>
            <div>
              <div className="text-2xl font-black text-white font-display uppercase tracking-tight">My Account</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${roleColor}`}>{roleLabel}</span>
                <span className="text-[11px] text-slate-500">{type === 'hashpack' ? 'HashPack' : 'MetaMask'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-slate-500 hover:text-neon-cyan transition-colors" title="Refresh">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => { disconnect(); onBack(); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all">
              <LogOut size={12} /> Disconnect
            </button>
          </div>
        </div>

        {/* Addresses */}
        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Wallet Addresses</div>
          <div className="p-5 space-y-4">
            {/* Hedera ID */}
            <div className="space-y-1">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hedera Account ID</div>
              <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                <span className="text-sm font-black font-mono text-white">{accountId}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => copy(accountId, 'hid')} className="text-slate-500 hover:text-neon-cyan transition-colors">
                    {copied === 'hid' ? <CheckCircle size={14} className="text-neon-green" /> : <Copy size={14} />}
                  </button>
                  <a href={`https://hashscan.io/testnet/account/${accountId}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-neon-cyan transition-colors">
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
            {/* EVM */}
            {address && (
              <div className="space-y-1">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">EVM Address</div>
                <div className="flex items-center justify-between gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                  <span className="text-[12px] font-mono text-slate-300 break-all">{address}</span>
                  <button onClick={() => copy(address, 'evm')} className="text-slate-500 hover:text-neon-cyan transition-colors shrink-0">
                    {copied === 'evm' ? <CheckCircle size={14} className="text-neon-green" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Assets */}
        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
            <span>Assets</span>
            {loading && <RefreshCw size={11} className="animate-spin text-slate-500" />}
          </div>
          <div className="p-5 space-y-2">
            {/* HBAR */}
            <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center text-neon-cyan font-black text-sm">ℏ</div>
                <div>
                  <div className="text-sm font-black text-white">HBAR</div>
                  <div className="text-[10px] text-slate-500 font-mono">Hedera native</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-white font-mono">{assets?.hbar ?? '—'}</div>
                <div className="text-[10px] text-slate-500">HBAR</div>
              </div>
            </div>
            {/* Tokens */}
            {(assets?.tokens ?? []).map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border ${t.id === MDT_TOKEN_ID ? 'bg-neon-green/10 border-neon-green/20 text-neon-green' : 'bg-neon-purple/10 border-neon-purple/20 text-neon-purple'}`}>◈</div>
                  <div>
                    <div className="text-sm font-black text-white">{t.symbol}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{t.id}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-black font-mono ${t.id === MDT_TOKEN_ID ? 'text-neon-green' : 'text-white'}`}>{t.balance}</div>
                  <div className="text-[10px] text-slate-500">{t.symbol}</div>
                </div>
              </div>
            ))}
            {!loading && (assets?.tokens ?? []).length === 0 && (
              <div className="text-[12px] text-slate-500 font-mono text-center py-2">No tokens found</div>
            )}
          </div>
        </div>

        {/* Stake Info */}
        {stakeInfo && stakeInfo.role > 0 && (
          <div className="glass-panel rounded-2xl border border-neon-purple/20 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 text-[11px] font-black text-slate-400 uppercase tracking-widest">On-Chain Stake</div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {[
                { label: 'Role', val: ROLE_LABELS[stakeInfo.role] ?? 'Unknown', color: ROLE_COLORS[stakeInfo.role] ?? 'text-white' },
                { label: 'Staked', val: `${stakeInfo.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} MDT`, color: 'text-neon-green' },
                { label: 'Status', val: stakeInfo.isActive ? 'Active' : 'Inactive', color: stakeInfo.isActive ? 'text-neon-green' : 'text-yellow-400' },
                { label: 'Pending Reward', val: `${stakeInfo.pendingReward.toFixed(4)} MDT`, color: 'text-neon-yellow' },
              ].map(s => (
                <div key={s.label} className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">{s.label}</div>
                  <div className={`text-sm font-black ${s.color}`}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
