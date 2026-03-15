'use client';

/**
 * SubmitTaskModal — Requester submits an AI task
 *
 * Flow:
 * 1. User fills: taskType, prompt, rewardMDT, subnetId, deadline
 * 2. On-chain: SubnetRegistryV2.createTask(subnetId, taskHash, rewardAmount, duration)
 *    - MetaMask: HTS cryptoTransfer MDT → registry, then createTask()
 *    - HashPack: TransferTransaction MDT → registry, then ContractExecuteTransaction createTask()
 * 3. HCS: submit task_submit message to topic 0.0.8198585 (includes on-chain taskId)
 * 4. Show HashScan links for both TX
 */

import { useState } from 'react';
import { ethers } from 'ethers';
import { AccountId, ContractExecuteTransaction, ContractId, ContractFunctionParameters, TransferTransaction, TokenId } from '@hashgraph/sdk';
import { X, Send, Activity, CheckCircle, ExternalLink } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { CONTRACTS, SUBNET_REGISTRY_ABI, HTS_ABI, HTS_PRECOMPILE } from '@/lib/contracts';

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

async function resolveHederaTxId(txId: any): Promise<string | null> {
  try {
    let mirrorId: string;
    if (!txId) return null;
    if (typeof txId === 'string') {
      if (txId.includes('@')) {
        const [acc, time] = txId.split('@');
        const dot = time.indexOf('.');
        mirrorId = `${acc}-${time.slice(0, dot)}-${time.slice(dot + 1)}`;
      } else { mirrorId = txId; }
    } else if (txId?.accountId && txId?.validStart) {
      const acc = txId.accountId.toString();
      const secs = txId.validStart.seconds?.toString() || '0';
      const nanos = txId.validStart.nanos?.toString().padStart(9, '0') || '000000000';
      mirrorId = `${acc}-${secs}-${nanos}`;
    } else { return null; }
    const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${mirrorId}`, { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); return d?.transactions?.[0]?.consensus_timestamp || null; }
  } catch (_) {}
  return null;
}

interface Props { isOpen: boolean; onClose: () => void; }

export default function SubmitTaskModal({ isOpen, onClose }: Props) {
  const { accountId, isConnected, type: walletType, hashConnect, address: evmAddress } = useWallet();

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

    // taskHash = keccak256-like identifier stored on-chain
    const taskHash = `${taskType}:${Date.now()}:${prompt.slice(0, 32)}`;
    const rewardRaw = BigInt(Math.floor(reward * 1e8));
    // Fee split: 2% protocol + 8% validator + 5% staking + subnetFee(0) = 15% overhead
    // totalDeposit = reward + 15% = reward * 1.15
    const totalRaw = (rewardRaw * BigInt(115)) / BigInt(100);
    const totalMDT = Number(totalRaw) / 1e8;
    const durationSecs = deadline * 3600;

    let onChainTaskId: string | null = null;
    let transferTs: string | null = null;
    let contractTs: string | null = null;

    try {
      // ── Step 1: On-chain createTask ──────────────────────────────────────
      log(`[1/3] Creating task on-chain · SubnetRegistryV2...`);
      log(`      Subnet ${subnetId} · Reward ${reward} MDT · Total deposit ~${totalMDT.toFixed(2)} MDT`);

      if (walletType === 'metamask') {
        const ethereum = (window as any).ethereum;
        if (!ethereum) throw new Error('MetaMask not found');
        const provider = new ethers.BrowserProvider(ethereum);
        try {
          await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x128' }] });
        } catch (_) {}
        const signer = await provider.getSigner();
        const signerAddr = await signer.getAddress();

        // Transfer MDT to registry via HTS precompile
        log(`[1a] Transferring ${totalMDT.toFixed(2)} MDT to registry (MetaMask)...`);
        const hts = new ethers.Contract(HTS_PRECOMPILE, HTS_ABI, signer);
        const transferTx = await hts.cryptoTransfer(
          [],
          [{
            token: CONTRACTS.MDT_EVM,
            transfers: [
              { amount: -BigInt(totalRaw), accountID: signerAddr, isApproval: false },
              { amount: BigInt(totalRaw), accountID: CONTRACTS.SUBNET_REGISTRY, isApproval: false },
            ],
            deleteSpenderAllowance: false,
          }],
          { gasLimit: 300000 }
        );
        await transferTx.wait();
        log(`[1a] ✓ MDT transferred`);

        // createTask
        log(`[1b] Calling createTask()...`);
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, signer);
        const createTx = await registry.createTask(subnetId, taskHash, rewardRaw, durationSecs, { gasLimit: 400000 });
        const createReceipt = await createTx.wait();
        contractTs = createReceipt.hash;
        // Parse TaskCreated event to get taskId
        const iface = new ethers.Interface(['event TaskCreated(uint256 indexed taskId, uint256 indexed subnetId, address indexed requester, uint256 rewardAmount)']);
        for (const logEntry of createReceipt.logs) {
          try {
            const parsed = iface.parseLog(logEntry);
            if (parsed?.name === 'TaskCreated') { onChainTaskId = parsed.args.taskId.toString(); break; }
          } catch (_) {}
        }
        log(`[1b] ✓ Task created on-chain · taskId: ${onChainTaskId ?? 'unknown'}`);

      } else if (walletType === 'hashpack') {
        if (!hashConnect || !accountId) throw new Error('HashConnect not initialized');
        const hederaId = AccountId.fromString(accountId);
        const MDT_TOKEN_ID = TokenId.fromString('0.0.8198586');

        // Resolve registry Hedera account
        let registryAccountId = '0.0.8219634';
        try {
          const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${CONTRACTS.SUBNET_REGISTRY}`);
          const d = await r.json();
          if (d.account) registryAccountId = d.account;
        } catch (_) {}

        log(`[1a] Transferring ${totalMDT.toFixed(2)} MDT to registry (HashPack)...`);
        const transferTx = new TransferTransaction()
          .addTokenTransfer(MDT_TOKEN_ID, hederaId, -Number(totalRaw))
          .addTokenTransfer(MDT_TOKEN_ID, AccountId.fromString(registryAccountId), Number(totalRaw));
        const transferReceipt = await hashConnect.sendTransaction(hederaId, transferTx);
        transferTs = await resolveHederaTxId(transferReceipt.transactionId);
        log(`[1a] ✓ MDT transferred${transferTs ? ` · ${transferTs}` : ''}`);

        log(`[1b] Calling createTask() (HashPack)...`);
        const contractId = ContractId.fromEvmAddress(0, 0, CONTRACTS.SUBNET_REGISTRY);
        const params = new ContractFunctionParameters()
          .addUint256(String(subnetId))
          .addString(taskHash)
          .addUint256(rewardRaw.toString())
          .addUint256(String(durationSecs));
        const createTx = new ContractExecuteTransaction()
          .setContractId(contractId)
          .setGas(400000)
          .setFunction('createTask', params);
        const createReceipt = await hashConnect.sendTransaction(hederaId, createTx);
        contractTs = await resolveHederaTxId(createReceipt.transactionId);
        log(`[1b] ✓ Task created${contractTs ? ` · ${contractTs}` : ''}`);
        // Note: can't easily parse taskId from HashPack receipt — use HCS taskId as reference
      }

      // ── Step 2: HCS submit ───────────────────────────────────────────────
      log(`[2/3] Submitting to HCS topic 0.0.8198585...`);
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType, prompt,
          rewardMDT: reward,
          subnetId, deadline,
          requester: accountId,
          onChainTaskId,
          contractTs,
          transferTs,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'HCS submission failed');
      log(`[2/3] ✓ HCS Sequence #${data.sequence} · Topic ${data.topicId}`);

      // ── Step 3: Done ─────────────────────────────────────────────────────
      log(`[3/3] ✓ Task live on network`);
      setResult({ ...data, onChainTaskId, transferTs, contractTs, rewardMDT: reward, subnetId });

    } catch (e: any) {
      setError(e.reason || e.message || 'Submission failed');
      log(`[ERROR] ${e.reason || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setLogs([]); setError(null); setPrompt(''); };

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute top-[22%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl bg-[#0a0e17]/95 backdrop-blur-xl border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.8),0_0_40px_rgba(255,0,128,0.1)] rounded-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">

        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-neon-pink/50 to-transparent" />
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-neon-pink/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between p-6 sm:p-8 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center">
              <Send className="w-5 h-5 text-neon-pink" />
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-white uppercase tracking-wider">Submit AI Request</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                SubnetRegistryV2 on-chain · HCS Topic <span className="text-neon-cyan">0.0.8198585</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="relative p-6 sm:p-8 space-y-5 overflow-y-auto">
          {!result ? (
            <>
              {/* Flow info */}
              <div className="p-3 bg-neon-pink/5 border border-neon-pink/20 rounded-xl text-[10px] text-slate-400 space-y-0.5">
                <div className="text-neon-pink font-black uppercase tracking-widest text-[9px] mb-1">Request Flow</div>
                <div>1. Pay MDT reward → SubnetRegistryV2 (on-chain, immutable)</div>
                <div>2. <code className="text-white">registry.createTask(subnetId, taskHash, reward, duration)</code></div>
                <div>3. HCS: <code className="text-neon-cyan">task_submit → topic 0.0.8198585</code> (transparent, tamper-proof)</div>
                <div>4. Miners poll HCS → run AI + generate zkML proof → <code className="text-white">submitResult()</code></div>
                <div>5. Validators score submissions (model confidence 50% · proof validity 30% · speed 20%)</div>
                <div>6. <code className="text-white">finalizeTask()</code> → auto-distributes: 82% miners · 8% validators · 5% stakers · 2% protocol · 3% subnet</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Task Type</label>
                  <select value={taskType} onChange={e => setTaskType(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white appearance-none outline-none focus:border-neon-pink/50 transition-all cursor-pointer">
                    {TASK_TYPES.map(t => <option key={t.value} value={t.value} className="bg-[#0a0e17]">{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Subnet Routing</label>
                  <select value={subnetId} onChange={e => setSubnetId(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white appearance-none outline-none focus:border-neon-cyan/50 transition-all cursor-pointer">
                    {SUBNETS.map(s => <option key={s.id} value={s.id} className="bg-[#0a0e17]">{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Task Description / Prompt</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                  placeholder="E.g., Analyze this portfolio for risk factors, generate a financial report..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-sm text-white outline-none focus:border-white/30 transition-all resize-none placeholder:text-slate-600 font-mono" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Reward (MDT) <span className="text-slate-600">· total ~{(Number(rewardMDT) * 1.15).toFixed(2)} MDT incl. fees</span>
                  </label>
                  <div className="relative">
                    <input type="number" min="0.1" step="0.1" value={rewardMDT} onChange={e => setRewardMDT(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white outline-none focus:border-neon-green/50 transition-all font-mono font-bold" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">MDT</span>
                  </div>
                  <div className="text-[9px] text-slate-600 mt-1">82% → miners · 8% → validators · 5% → stakers · 2% → protocol · 3% → subnet</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Deadline</label>
                  <div className="relative">
                    <input type="number" min="1" max="168" value={deadline} onChange={e => setDeadline(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white outline-none focus:border-neon-purple/50 transition-all font-mono font-bold" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">HOURS</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Requester Account</label>
                <div className="px-4 py-3.5 bg-black/40 border border-white/5 rounded-xl text-sm font-mono text-slate-400 flex items-center justify-between">
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                      <span className="text-white font-bold">{accountId}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${walletType === 'hashpack' ? 'border-neon-purple/40 text-neon-purple' : 'border-orange-400/40 text-orange-400'}`}>
                        {walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}
                      </span>
                    </div>
                  ) : <span className="text-red-400">Wallet Not Connected</span>}
                </div>
              </div>

              {logs.length > 0 && (
                <div className="bg-black/60 rounded-xl border border-white/5 p-4 space-y-1.5 max-h-36 overflow-y-auto font-mono">
                  {logs.map((l, i) => (
                    <div key={i} className={`text-[11px] ${l.includes('ERROR') ? 'text-red-400' : l.includes('✓') ? 'text-neon-green' : 'text-slate-400'}`}>
                      <span className="opacity-40 mr-2 text-[9px]">{'>'}</span>{l}
                    </div>
                  ))}
                  {loading && (
                    <div className="text-neon-pink text-[11px] flex items-center gap-2 mt-1">
                      <Activity size={12} className="animate-spin" /> Processing on-chain...
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400">✗ {error}</div>
              )}
            </>
          ) : (
            /* Success */
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4 p-5 bg-neon-green/5 border border-neon-green/20 rounded-2xl">
                <div className="w-14 h-14 rounded-full bg-neon-green/20 border-2 border-neon-green/40 flex items-center justify-center shrink-0">
                  <CheckCircle size={28} className="text-neon-green" />
                </div>
                <div>
                  <div className="text-base font-black text-neon-green uppercase tracking-wide">Task Live on Network</div>
                  <div className="text-xs text-slate-400 font-mono mt-1">HCS Seq #{result.sequence} · Subnet {result.subnetId}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <div className="text-slate-500 text-[9px] uppercase tracking-widest">HCS Task ID</div>
                  <div className="text-white text-[10px] break-all">{result.taskId}</div>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <div className="text-slate-500 text-[9px] uppercase tracking-widest">On-Chain Task ID</div>
                  <div className="text-neon-cyan font-black">{result.onChainTaskId ?? 'See contract events'}</div>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <div className="text-slate-500 text-[9px] uppercase tracking-widest">Reward</div>
                  <div className="text-neon-green font-black text-base">{result.rewardMDT} MDT</div>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                  <div className="text-slate-500 text-[9px] uppercase tracking-widest">Total Deposited</div>
                  <div className="text-white font-black">{(result.rewardMDT * 1.15).toFixed(2)} MDT</div>
                </div>
              </div>

              {/* TX Links */}
              <div className="space-y-2">
                {result.transferTs && (
                  <a href={`https://hashscan.io/testnet/transaction/${result.transferTs}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl text-neon-cyan text-xs font-bold hover:bg-neon-cyan/10 transition-all">
                    <ExternalLink size={12} /> MDT Transfer TX
                    <span className="text-slate-600 font-normal text-[10px] ml-auto">{result.transferTs}</span>
                  </a>
                )}
                {result.contractTs && (
                  <a href={`https://hashscan.io/testnet/transaction/${result.contractTs}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-neon-green/5 border border-neon-green/20 rounded-xl text-neon-green text-xs font-bold hover:bg-neon-green/10 transition-all">
                    <ExternalLink size={12} /> createTask() Contract TX
                    <span className="text-slate-600 font-normal text-[10px] ml-auto">{String(result.contractTs).slice(0, 20)}...</span>
                  </a>
                )}
                {result.txUrl && (
                  <a href={result.txUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-bold hover:bg-white/10 transition-all">
                    <ExternalLink size={12} /> HCS Transaction
                  </a>
                )}
              </div>

              <div className="p-3 bg-neon-purple/5 border border-neon-purple/20 rounded-xl text-[10px] text-slate-400 space-y-0.5">
                <div className="text-neon-purple font-black uppercase tracking-widest text-[9px] mb-1">What happens next</div>
                <div>→ Miners polling HCS pick up your request</div>
                <div>→ They run AI computation + generate zkML proof (STARK/Groth16)</div>
                <div>→ Call <code className="text-white">submitResult(taskId, resultHash)</code> on-chain</div>
                <div>→ Validators score: model confidence 50% · proof validity 30% · speed 20%</div>
                <div>→ <code className="text-white">finalizeTask()</code> auto-distributes rewards by weight</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative p-6 sm:p-8 border-t border-white/5 shrink-0 bg-[#0a0e17] flex justify-end gap-4">
          <button onClick={result ? reset : onClose}
            className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            {result ? 'Submit Another' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={handleSubmit} disabled={loading || !isConnected || !prompt.trim()}
              className="flex items-center gap-2 min-w-[160px] px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-neon-pink/20 to-neon-purple/20 border border-neon-pink/50 text-white hover:border-white transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? <Activity size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? 'Processing...' : 'Submit to Network'}
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
