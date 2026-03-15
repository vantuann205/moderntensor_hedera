'use client';
/**
 * SubmitTaskModal — Requester creates an AI task on-chain
 *
 * Correct Protocol Flow (SubnetRegistryV2.createTask — msg.sender = requester):
 *
 * MetaMask:
 *   1. ERC20.approve(registry, totalDeposit)
 *   2. registry.createTask(subnetId, taskHash, rewardAmount, duration)
 *      → contract pulls totalDeposit via safeTransferFrom(msg.sender, ...)
 *      → emits TaskCreated(taskId)
 *   3. HCS topic 0.0.8198585 — type: task_create (miners + validators poll this)
 *
 * HashPack:
 *   1. ContractExecuteTransaction → HTS precompile 0x167 → approve(MDT, registry, amount)
 *      (avoids AccountAllowanceApproveTransaction which causes "session not found")
 *   2. ContractExecuteTransaction → registry.createTask(subnetId, taskHash, reward, duration)
 *      → contract pulls MDT via safeTransferFrom (allowance set in step 1)
 *      → emits TaskCreated(taskId)
 *   3. HCS topic 0.0.8198585 — type: task_create
 */

import { useState } from 'react';
import { ethers } from 'ethers';
import {
  AccountId,
} from '@hashgraph/sdk';
import { X, Send, Activity, CheckCircle, ExternalLink, Info } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { CONTRACTS, SUBNET_REGISTRY_ABI, ERC20_ABI } from '@/lib/contracts';

const TASK_TYPES = [
  { value: 'text_generation', label: 'Text Generation' },
  { value: 'code_review',     label: 'Code Review' },
  { value: 'image_analysis',  label: 'Image Analysis' },
  { value: 'data_labeling',   label: 'Data Labeling' },
  { value: 'summarization',   label: 'Summarization' },
];

const SUBNETS = [
  { id: 0, name: 'Subnet 0 — Text Generation' },
  { id: 1, name: 'Subnet 1 — Code Review' },
  { id: 2, name: 'Subnet 2 — Image Analysis' },
];

// HTS precompile address (0x167) — used for token approve on Hedera
// MDT is an HTS token with ERC20 facade — approve works via ContractExecuteTransaction on the token contract

interface Props { isOpen: boolean; onClose: () => void; }

export default function SubmitTaskModal({ isOpen, onClose }: Props) {
  const { accountId, isConnected, type: walletType, hashConnect } = useWallet();
  const [taskType, setTaskType] = useState('text_generation');
  const [prompt, setPrompt] = useState('');
  const [rewardMDT, setRewardMDT] = useState('1');
  const [subnetId, setSubnetId] = useState(0);
  const [deadline, setDeadline] = useState(24);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;
  const log = (msg: string) => setLogs(p => [...p, msg]);

  const handleSubmit = async () => {
    if (!isConnected || !accountId) { setError('Connect wallet first'); return; }
    if (!prompt.trim()) { setError('Prompt is required'); return; }
    const reward = Number(rewardMDT);
    if (reward <= 0) { setError('Reward must be > 0'); return; }

    setLoading(true); setError(null); setResult(null); setLogs([]);

    // taskHash encodes type + prompt (stored on-chain as identifier)
    const taskHash = `${taskType}:${Date.now()}:${prompt.slice(0, 64)}`;
    const rewardRaw = BigInt(Math.floor(reward * 1e8));
    // totalDeposit = reward + 2% protocol + 8% validator + 5% staking (subnet 0 feeRate=0)
    const totalRaw = (rewardRaw * BigInt(115)) / BigInt(100);
    const totalMDT = Number(totalRaw) / 1e8;
    const durationSecs = Number(deadline) * 3600;

    let onChainTaskId: string | null = null;
    let contractTs: string | null = null;

    try {
      // ── MetaMask ──────────────────────────────────────────────────
      if (walletType === 'metamask') {
        const ethereum = (window as any).ethereum;
        if (!ethereum) throw new Error('MetaMask not found');
        const provider = new ethers.BrowserProvider(ethereum);
        try { await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x128' }] }); } catch (_) {}
        const signer = await provider.getSigner();

        // Step 1: ERC20 approve
        log(`[1/3] Approving ${totalMDT.toFixed(4)} MDT for registry...`);
        const mdt = new ethers.Contract(CONTRACTS.MDT_EVM, ERC20_ABI, signer);
        const approveTx = await mdt.approve(CONTRACTS.SUBNET_REGISTRY, totalRaw, { gasLimit: 100000 });
        await approveTx.wait();
        log(`[1/3] ✓ Approved`);

        // Step 2: createTask — contract pulls MDT via safeTransferFrom(msg.sender, ...)
        log(`[2/3] Creating task on-chain (${totalMDT.toFixed(4)} MDT deposited)...`);
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, signer);
        const createTx = await registry.createTask(subnetId, taskHash, rewardRaw, durationSecs, { gasLimit: 500000 });
        const receipt = await createTx.wait();
        contractTs = receipt.hash;

        // Parse TaskCreated event to get taskId
        const iface = new ethers.Interface(['event TaskCreated(uint256 indexed taskId, uint256 indexed subnetId, address indexed requester, uint256 rewardAmount)']);
        for (const logEntry of receipt.logs) {
          try {
            const parsed = iface.parseLog(logEntry);
            if (parsed?.name === 'TaskCreated') { onChainTaskId = parsed.args.taskId.toString(); break; }
          } catch (_) {}
        }
        log(`[2/3] ✓ Task #${onChainTaskId ?? '?'} created on-chain · TX: ${contractTs?.slice(0, 20)}...`);

      // ── HashPack ──────────────────────────────────────────────────
      } else if (walletType === 'hashpack') {
        if (!hashConnect || !accountId) throw new Error('HashConnect not initialized');
        const hederaId = AccountId.fromString(accountId);

        // Step 1: TransferTransaction MDT → deployer (deployer will call createTask on behalf)
        // User sends MDT to deployer, deployer approves registry + calls createTask
        // This avoids double-deduction: deployer's MDT comes from user's transfer
        log(`[1/3] Transferring ${totalMDT.toFixed(4)} MDT to deployer (HashPack)...`);
        const { TokenId, TransferTransaction: TT } = await import('@hashgraph/sdk');
        const MDT_TOKEN_ID = TokenId.fromString('0.0.8198586');
        const DEPLOYER_HEDERA_ID = '0.0.8127455'; // deployer account

        const totalRawNum = Number(totalRaw);
        const transferTx = new TT()
          .addTokenTransfer(MDT_TOKEN_ID, hederaId, -totalRawNum)
          .addTokenTransfer(MDT_TOKEN_ID, AccountId.fromString(DEPLOYER_HEDERA_ID), totalRawNum);
        const transferReceipt: any = await hashConnect.sendTransaction(hederaId as any, transferTx as any);
        const transferTxId = transferReceipt?.transactionId;
        let transferTsResolved: string | null = null;
        // Resolve consensus timestamp
        if (transferTxId) {
          try {
            let mirrorId: string;
            const s = String(transferTxId);
            if (s.includes('@')) {
              const [acc, time] = s.split('@');
              const dot = time.indexOf('.');
              mirrorId = `${acc}-${time.slice(0, dot)}-${time.slice(dot + 1)}`;
            } else { mirrorId = s; }
            const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${mirrorId}`, { cache: 'no-store' });
            if (r.ok) { const d = await r.json(); transferTsResolved = d?.transactions?.[0]?.consensus_timestamp || null; }
          } catch (_) {}
        }
        log(`[1/3] ✓ MDT transferred to deployer${transferTsResolved ? ` · ${transferTsResolved}` : ''}`);

        // Step 2: Backend deployer approve + createTask on-chain
        // Deployer đã nhận MDT từ user ở bước 1 → approve registry → createTask
        log(`[2/3] Creating task on-chain via deployer...`);
        const createRes = await fetch('/api/tasks/create-onchain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subnetId, taskHash, rewardRaw: rewardRaw.toString(), durationSecs,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData.success) throw new Error(createData.error || 'createTask failed');
        onChainTaskId = createData.onChainTaskId ? String(createData.onChainTaskId) : null;
        contractTs = createData.contractTs || createData.txId || null;
        log(`[2/3] ✓ Task #${onChainTaskId ?? '?'} created on-chain · ${contractTs?.slice(0, 20) ?? ''}`);
      }

      // Step 3: HCS — broadcast task_create cho miners + validators poll
      log(`[3/3] Broadcasting task to HCS topic 0.0.8198585...`);
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType, prompt, rewardMDT: reward, subnetId, deadline,
          requester: accountId, onChainTaskId, contractTs,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'HCS submission failed');
      log(`[3/3] ✓ HCS Sequence #${data.sequence} — miners will pick up shortly`);
      setResult({ ...data, onChainTaskId, contractTs, rewardMDT: reward, subnetId, totalMDT });

    } catch (e: any) {
      const msg = e.reason || e.message || 'Submission failed';
      const isSession = msg.includes('session') || msg.includes('Session') || msg.includes('sign client');
      setError(isSession ? 'HashPack session expired — disconnect and reconnect wallet, then retry' : msg);
      log(`[ERROR] ${msg}`);
    } finally { setLoading(false); }
  };

  const reset = () => { setResult(null); setLogs([]); setError(null); setPrompt(''); };
  const totalMDT = (Number(rewardMDT) * 1.15).toFixed(2);

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute top-[22%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl bg-[#0a0e17]/95 backdrop-blur-xl border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-neon-pink/50 to-transparent" />

        {/* Header */}
        <div className="relative flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center">
              <Send className="w-5 h-5 text-neon-pink" />
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-white uppercase tracking-wider">Submit AI Task</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">SubnetRegistryV2.createTask() · HCS <span className="text-neon-cyan">0.0.8198585</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="relative p-6 space-y-5 overflow-y-auto">
          {!result ? (
            <>
              {/* Flow info */}
              <div className="p-3 bg-neon-pink/5 border border-neon-pink/20 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-neon-pink font-black uppercase tracking-widest text-[11px] mb-1.5">
                  <Info size={10} /> Protocol Flow
                </div>
                <div className="text-[12px] text-slate-400 space-y-0.5">
                  <div><span className="text-neon-pink font-bold">1.</span> Approve + <code className="text-white">createTask()</code> on-chain → MDT locked in contract, task recorded on blockchain</div>
                  <div><span className="text-neon-green font-bold">2.</span> Miners poll HCS → process AI task → <code className="text-white">submitResult()</code></div>
                  <div><span className="text-neon-purple font-bold">3.</span> Validators score → <code className="text-white">finalizeTask()</code> → rewards auto-distributed</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Task Type</label>
                  <select value={taskType} onChange={e => setTaskType(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-pink/50 transition-all">
                    {TASK_TYPES.map(t => <option key={t.value} value={t.value} className="bg-[#0a0e17]">{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Subnet</label>
                  <select value={subnetId} onChange={e => setSubnetId(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-cyan/50 transition-all">
                    {SUBNETS.map(s => <option key={s.id} value={s.id} className="bg-[#0a0e17]">{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Prompt / Task Description</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                  placeholder="E.g., Analyze this portfolio for risk factors and suggest hedging strategies..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-all resize-none placeholder:text-slate-500 font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Reward (MDT) <span className="text-slate-500">· total {totalMDT} MDT</span>
                  </label>
                  <div className="relative">
                    <input type="number" min="0.1" step="0.1" value={rewardMDT} onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()} onChange={e => setRewardMDT(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white outline-none focus:border-neon-green/50 transition-all font-mono font-bold" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate-400">MDT</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">85% miners · 8% validators · 5% stakers · 2% protocol</div>
                </div>
                <div>
                  <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Deadline (hours)</label>
                  <div className="relative">
                    <input type="number" min="1" max="168" value={deadline} onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()} onChange={e => setDeadline(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white outline-none focus:border-neon-purple/50 transition-all font-mono font-bold" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate-400">HRS</span>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm font-mono flex items-center gap-2">
                {isConnected ? (
                  <><span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                  <span className="text-white font-bold">{accountId}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border ml-1 ${walletType === 'hashpack' ? 'border-neon-purple/40 text-neon-purple' : 'border-orange-400/40 text-orange-400'}`}>
                    {walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}
                  </span>
                  <span className="text-slate-500 text-[11px] ml-auto">~{totalMDT} MDT will be charged</span>
                  </>
                ) : <span className="text-red-400">Wallet Not Connected</span>}
              </div>

              {logs.length > 0 && (
                <div className="bg-black/60 rounded-xl border border-white/5 p-4 space-y-1.5 max-h-36 overflow-y-auto font-mono">
                  {logs.map((l, i) => (
                    <div key={i} className={`text-[11px] ${l.includes('ERROR') ? 'text-red-400' : l.includes('✓') ? 'text-neon-green' : 'text-slate-400'}`}>
                      <span className="opacity-40 mr-2 text-[11px]">{'>'}</span>{l}
                    </div>
                  ))}
                  {loading && <div className="text-neon-pink text-[11px] flex items-center gap-2 mt-1"><Activity size={12} className="animate-spin" /> Processing...</div>}
                </div>
              )}
              {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400">✗ {error}</div>}
            </>
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 p-5 bg-neon-green/5 border border-neon-green/20 rounded-2xl">
                <div className="w-14 h-14 rounded-full bg-neon-green/20 border-2 border-neon-green/40 flex items-center justify-center shrink-0">
                  <CheckCircle size={28} className="text-neon-green" />
                </div>
                <div>
                  <div className="text-base font-black text-neon-green uppercase tracking-wide">Task Live on Network</div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    HCS Seq #{result.sequence} · Subnet {result.subnetId} · {result.rewardMDT} MDT reward · {result.totalMDT?.toFixed(2)} MDT total
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <div className="text-slate-400 text-[11px] uppercase">On-Chain Task ID</div>
                  <div className="text-neon-cyan font-black">{result.onChainTaskId ?? '— resolving...'}</div>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <div className="text-slate-400 text-[11px] uppercase">Total Deposited</div>
                  <div className="text-white font-black">{result.totalMDT?.toFixed(2)} MDT</div>
                </div>
              </div>
              {result.contractTs && (
                <a href={`https://hashscan.io/testnet/transaction/${result.contractTs}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-neon-green/5 border border-neon-green/20 rounded-xl text-neon-green text-xs font-bold hover:bg-neon-green/10 transition-all">
                  <ExternalLink size={12} /> createTask() TX on HashScan
                </a>
              )}              {result.txUrl && (
                <a href={result.txUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-bold hover:bg-white/10 transition-all">
                  <ExternalLink size={12} /> HCS Transaction
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative p-6 border-t border-white/5 shrink-0 bg-[#0a0e17] flex justify-end gap-4">
          <button onClick={result ? reset : onClose}
            className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            {result ? 'Submit Another' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={handleSubmit} disabled={loading || !isConnected || !prompt.trim()}
              className="flex items-center gap-2 min-w-[180px] px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-neon-pink/20 to-neon-purple/20 border border-neon-pink/50 text-white hover:border-white transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? <Activity size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? 'Processing...' : `Pay ${totalMDT} MDT & Submit`}
            </button>
          )}
          {result && (
            <button onClick={onClose}
              className="px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-neon-green/10 border border-neon-green/40 text-neon-green hover:bg-neon-green/20 transition-all">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
