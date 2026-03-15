"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { AccountId, ContractExecuteTransaction, ContractId, ContractFunctionParameters, TransferTransaction, TokenId } from '@hashgraph/sdk';
import { useWallet } from '@/context/WalletContext';
import { CONTRACTS, STAKING_VAULT_ABI, HTS_ABI, HTS_PRECOMPILE, StakeRole } from '@/lib/contracts';
import { ViewState } from '@/types';
import { CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';

// ── Faucet Panel ──────────────────────────────────────────────────────────────
function FaucetPanel({ accountId, needed, stake, regFee, onSuccess }: {
  accountId: string; needed: number; stake: number; regFee: number; onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const request = async () => {
    if (!accountId) return;
    setLoading(true); setErr(null); setResult(null);
    try {
      const res = await fetch('/api/faucet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Faucet failed');
      setResult(data);
      let secs = 5; setCountdown(secs);
      const t = setInterval(() => { secs -= 1; setCountdown(secs); if (secs <= 0) { clearInterval(t); setCountdown(null); onSuccess(); } }, 1000);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="glass-panel border border-yellow-400/30 overflow-hidden">
      <div className="px-5 py-4 border-b border-yellow-400/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-yellow-400 text-lg">water_drop</span>
        </div>
        <div>
          <div className="text-sm font-black text-yellow-400 uppercase tracking-wider">Testnet MDT Faucet</div>
          <div className="text-[11px] text-slate-500 font-mono">MDT · 0.0.8198586 · Hedera Testnet</div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <div className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mb-1.5">Wallet Address</div>
          <div className="px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl font-mono text-sm text-white break-all select-all">{accountId || '—'}</div>
        </div>
        <div className="flex items-center justify-between p-3 bg-yellow-400/5 border border-yellow-400/20 rounded-xl">
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">Amount</div>
            <div className="text-xl font-black text-yellow-400 mt-0.5">500 MDT</div>
          </div>
          <div className="text-right text-[11px] text-slate-500 font-mono">
            <div>Need: {needed} MDT</div>
            <div>({stake} stake + ~{regFee} fee)</div>
          </div>
        </div>
        {result && (
          <div className="p-4 bg-neon-green/5 border border-neon-green/20 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-neon-green text-[11px] font-black"><CheckCircle size={14} /> {result.amount} MDT sent successfully</div>
            {result.txId && <div className="text-[11px] text-slate-500 font-mono break-all">TX: {result.txId}</div>}
            {result.txUrl && <a href={result.txUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-neon-cyan text-[12px] font-bold hover:underline"><ExternalLink size={10} /> View on HashScan</a>}
            {countdown !== null
              ? <div className="text-[11px] text-yellow-400 font-mono animate-pulse">Checking balance in {countdown}s...</div>
              : <div className="text-[11px] text-slate-500 font-mono">Refreshing balance...</div>}
          </div>
        )}
        {err && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[12px] font-mono text-red-400 flex items-start gap-2"><AlertCircle size={10} className="mt-0.5 flex-shrink-0" />{err}</div>}
        {!result && (
          <button onClick={request} disabled={loading || !accountId}
            className="w-full py-3 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">water_drop</span>
            {loading ? 'Requesting 500 MDT...' : 'Request 500 MDT from Faucet'}
          </button>
        )}
      </div>
    </div>
  );
}

interface Props { onBack: () => void; onViewChange: (v: ViewState) => void; onRegistered?: () => void; }

const MIN_HOLDER_STAKE = 1;
const REG_FEE_BUFFER = 6;

async function resolveHederaTxId(txId: any): Promise<string | null> {
  try {
    let mirrorId: string;
    if (!txId) return null;
    if (typeof txId === 'string') {
      if (txId.includes('@')) { const [acc, time] = txId.split('@'); const dotIdx = time.indexOf('.'); mirrorId = `${acc}-${time.slice(0, dotIdx)}-${time.slice(dotIdx + 1)}`; }
      else { mirrorId = txId; }
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

type Step = 'idle' | 'checking' | 'need_faucet' | 'deposit' | 'staking' | 'hcs' | 'done' | 'error';

export default function HolderRegistrationView({ onBack, onViewChange, onRegistered }: Props) {
  const { accountId, address: walletEvm, isConnected, type: walletType, hashConnect } = useWallet();
  const [stake, setStake] = useState<string>('1');
  const stakeNum = stake === '' ? 0 : Number(stake);
  const [step, setStep] = useState<Step>('idle');
  const [balance, setBalance] = useState<{ mdtBalance: number; hbarBalance: number; evmAddress: string; hasEnough: boolean } | null>(null);
  const [stakeResult, setStakeResult] = useState<{ txHash: string; txHashTransfer?: string; txHashContract?: string } | null>(null);
  const [hcsResult, setHcsResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [alreadyStaked, setAlreadyStaked] = useState(false);

  const log = (msg: string) => setLogs(prev => [...prev, msg]);
  const totalNeeded = stakeNum + REG_FEE_BUFFER;
  const busy = ['checking', 'deposit', 'staking', 'hcs'].includes(step);

  const checkBalance = useCallback(async () => {
    if (!accountId) return;
    setStep('checking'); setError(null); setLogs([]);
    log(`Checking MDT balance for ${accountId}...`);
    try {
      const res = await fetch(`/api/mdt-balance?accountId=${accountId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const evmAddr = data.evmAddress || walletEvm || '';
      const info = { mdtBalance: data.mdtBalance, hbarBalance: data.hbarBalance, evmAddress: evmAddr, hasEnough: data.mdtBalance >= totalNeeded };
      setBalance(info);
      log(`Balance: ${data.mdtBalance.toFixed(2)} MDT`);

      // Check existing stake role — 1 account = 1 role
      const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, provider);
      const stakeInfo = await vault.getStakeInfo(evmAddr);
      if (stakeInfo.isActive) {
        const role = Number(stakeInfo.role);
        if (role === StakeRole.Holder) {
          setAlreadyStaked(true);
          log(`✓ Already staked as Holder (${Number(stakeInfo.amount) / 1e8} MDT)`);
        } else {
          const roleName = role === StakeRole.Miner ? 'Miner' : role === StakeRole.Validator ? 'Validator' : `role ${role}`;
          setError(`This wallet is already staked as ${roleName}. One account = one role. You must requestUnstake() → wait 7 days → withdraw() before registering as Holder.`);
          setStep('error');
          return;
        }
      }
      setStep(info.hasEnough ? 'idle' : 'need_faucet');
    } catch (e: any) { setError(e.message); setStep('error'); }
  }, [accountId, totalNeeded, walletEvm]);

  useEffect(() => { if (isConnected && accountId) checkBalance(); }, [isConnected, accountId]); // eslint-disable-line

  const doStake = async (evmAddress: string): Promise<{ txHash: string; txHashTransfer?: string; txHashContract?: string } | null> => {
    setStep('staking');
    const amountRaw = BigInt(Math.floor(stakeNum * 1e8));
    const stakeRole = StakeRole.Holder; // 3
    try {
      if (walletType === 'metamask') {
        const ethereum = (window as any).ethereum;
        if (!ethereum) throw new Error('MetaMask not found');
        const provider = new ethers.BrowserProvider(ethereum);
        try { await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x128' }] }); } catch (_) {}
        const signer = await provider.getSigner();
        const signerAddr = await signer.getAddress();
        const vaultRead = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, provider);
        const existing = await vaultRead.getStakeInfo(signerAddr);
        if (existing.isActive && Number(existing.role) === StakeRole.Holder) { log(`✓ Already staked as Holder`); return { txHash: 'already_staked' }; }
        if (existing.isActive) {
          const roleName = Number(existing.role) === StakeRole.Miner ? 'Miner' : 'Validator';
          throw new Error(`Already staked as ${roleName}. One account = one role. Request unstake first.`);
        }

        let regFeeRaw = BigInt(1 * 1e8);
        try { const f = await vaultRead.getCurrentRegFee(); regFeeRaw = BigInt(f.toString()); } catch (_) {}
        const totalRaw = regFeeRaw + amountRaw;
        const totalMDT = Number(totalRaw) / 1e8;

        setStep('deposit');
        log(`Step 1/3: Transferring ${totalMDT} MDT to vault via HTS (MetaMask)...`);
        const hts = new ethers.Contract(HTS_PRECOMPILE, HTS_ABI, signer);
        const transferTx = await hts.cryptoTransfer([], [{ token: CONTRACTS.MDT_EVM, transfers: [{ amount: -BigInt(totalRaw), accountID: signerAddr, isApproval: false }, { amount: BigInt(totalRaw), accountID: CONTRACTS.STAKING_VAULT, isApproval: false }], deleteSpenderAllowance: false }], { gasLimit: 300000 });
        const transferReceipt = await transferTx.wait();
        log(`✓ Step 1/3: MDT transferred · ${transferReceipt.hash}`);

        setStep('deposit');
        log(`Step 2/3: Recording deposit...`);
        const depositRes = await fetch('/api/staking/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, evmAddress: signerAddr, amount: totalMDT }) });
        const depositData = await depositRes.json();
        if (!depositRes.ok) throw new Error(depositData.error || 'recordDeposit failed');
        log(`✓ Step 2/3: pendingDeposit credited`);

        setStep('staking');
        log(`Step 3/3: Calling vault.stake(${stakeNum} MDT, Holder) — approve in MetaMask...`);
        const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, signer);
        const stakeTx = await vault['stake(uint256,uint8)'](amountRaw, stakeRole, { gasLimit: 300000 });
        const stakeReceipt = await stakeTx.wait();
        log(`✓ Step 3/3: Staked · ${stakeReceipt.hash}`);
        return { txHash: stakeReceipt.hash, txHashTransfer: transferReceipt.hash, txHashContract: stakeReceipt.hash };

      } else if (walletType === 'hashpack') {
        if (!hashConnect || !accountId) throw new Error('HashConnect not initialized');
        const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
        const vaultRead = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, provider);
        const existing = await vaultRead.getStakeInfo(evmAddress);
        if (existing.isActive) { log(`✓ Already staked`); return { txHash: 'already_staked' }; }

        const hederaId = AccountId.fromString(accountId);
        const MDT_TOKEN_ID = TokenId.fromString('0.0.8198586');
        let vaultAccountId = CONTRACTS.STAKING_VAULT_ID;
        try { const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${CONTRACTS.STAKING_VAULT}`); const d = await r.json(); if (d.account) vaultAccountId = d.account; } catch (_) {}

        let regFeeRaw = BigInt(1 * 1e8);
        try { const f = await vaultRead.getCurrentRegFee(); regFeeRaw = BigInt(f.toString()); } catch (_) {}
        const totalRaw = regFeeRaw + amountRaw;
        const totalMDT = Number(totalRaw) / 1e8;
        log(`Step 1/3: Transferring ${totalMDT} MDT to vault — approve in HashPack...`);

        const transferTx = new TransferTransaction().addTokenTransfer(MDT_TOKEN_ID, hederaId, -Number(totalRaw)).addTokenTransfer(MDT_TOKEN_ID, AccountId.fromString(vaultAccountId), Number(totalRaw));
        const transferReceipt = await hashConnect.sendTransaction(hederaId, transferTx);
        const transferTs = await resolveHederaTxId(transferReceipt.transactionId);
        log(`✓ Step 1/3: MDT transferred${transferTs ? ` · ${transferTs}` : ''}`);

        log(`Step 2/3: Recording deposit...`);
        const depositRes = await fetch('/api/staking/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, evmAddress, amount: totalMDT }) });
        const depositData = await depositRes.json();
        if (!depositRes.ok) throw new Error(depositData.error || 'recordDeposit failed');
        log(`✓ Step 2/3: pendingDeposit: ${depositData.pendingDeposit} MDT`);

        log(`Step 3/3: Calling vault.stake(${stakeNum} MDT, Holder) — approve in HashPack...`);
        const params = new ContractFunctionParameters().addUint256(amountRaw.toString()).addUint8(stakeRole);
        const contractId = ContractId.fromString(CONTRACTS.STAKING_VAULT_ID);
        const contractTx = new ContractExecuteTransaction().setContractId(contractId).setGas(300000).setFunction('stake', params);
        const stakeReceipt = await hashConnect.sendTransaction(hederaId, contractTx);
        const contractTs = await resolveHederaTxId(stakeReceipt.transactionId);
        log(`✓ Step 3/3: Staked${contractTs ? ` · ${contractTs}` : ''}`);
        return { txHash: contractTs || `hashpack_${Date.now()}`, txHashTransfer: transferTs || undefined, txHashContract: contractTs || undefined };
      }
      throw new Error('No wallet connected');
    } catch (e: any) { log(`✗ Stake failed: ${e.message}`); setError(`Stake failed: ${e.message}`); return null; }
  };

  const handleRegister = async () => {
    if (!accountId || !isConnected) return;
    if (stakeNum < MIN_HOLDER_STAKE) { setError(`Minimum stake is ${MIN_HOLDER_STAKE} MDT`); return; }
    if (!balance) { await checkBalance(); return; }
    if (!balance.hasEnough && !alreadyStaked) { setStep('need_faucet'); return; }
    setError(null);

    const evmAddress = balance.evmAddress || walletEvm || '';
    let res: typeof stakeResult = null;
    if (alreadyStaked) {
      log(`✓ Already staked as Holder — skipping stake`);
      res = { txHash: 'already_staked' };
    } else {
      res = await doStake(evmAddress);
      if (!res) return;
    }
    setStakeResult(res);

    setStep('hcs');
    log(`Submitting holder_register to HCS topic 0.0.8198583...`);
    try {
      const hcsRes = await fetch('/api/hcs/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'holder', accountId, stakeAmount: stakeNum, skipOnChainStake: true }),
      });
      const hcsData = await hcsRes.json();
      if (!hcsRes.ok) throw new Error(hcsData.error || 'HCS failed');
      setHcsResult({ ...hcsData, stakeTxHash: res?.txHash });
      log(`✓ HCS sequence #${hcsData.sequence}`);
      setStep('done');
      setTimeout(() => onRegistered?.(), 1500);
    } catch (e: any) { setError(e.message); setStep('error'); }
  };

  const stepLabel = { idle: 'Ready', checking: 'Checking...', need_faucet: 'Insufficient MDT', deposit: 'Recording deposit...', staking: 'Staking on-chain...', hcs: 'Submitting to HCS...', done: 'Registered ✓', error: 'Error' }[step];

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span> Back
        </button>
        <div>
          <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
            Join as <span className="text-neon-green">Holder</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${step === 'done' ? 'bg-neon-green' : step === 'error' ? 'bg-red-400' : 'bg-neon-green animate-pulse'}`} />
            {stepLabel}
            {walletType && <span className="text-slate-600">· via {walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}</span>}
          </p>
        </div>
      </div>

      {/* Info box */}
      <div className="glass-panel p-4 border border-neon-green/20 space-y-2 text-[11px] text-slate-400 leading-relaxed">
        <div className="flex items-center gap-2 text-neon-green font-black text-xs uppercase tracking-widest">
          <span className="material-symbols-outlined text-sm">savings</span> Holder Registration Flow
        </div>
        <div>1. Stake ≥1 MDT as Holder role on <span className="text-white font-mono">StakingVaultV2</span></div>
        <div>2. Submit HCS registration to topic <span className="text-neon-cyan font-mono">0.0.8198583</span></div>
        <div>3. Earn <span className="text-neon-green font-bold">5% of all network task rewards</span> pro-rata by stake weight</div>
        <div className="text-yellow-400 text-[10px] pt-1">⚠ Unstaking requires a 7-day cooldown period.</div>
      </div>

      {/* Balance */}
      {balance && (
        <div className={`glass-panel p-4 flex items-center justify-between border ${balance.hasEnough || alreadyStaked ? 'border-neon-green/20' : 'border-yellow-400/30'}`}>
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-xl ${balance.hasEnough || alreadyStaked ? 'text-neon-green' : 'text-yellow-400'}`}>
              {balance.hasEnough || alreadyStaked ? 'check_circle' : 'warning'}
            </span>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider">MDT Balance</div>
              <div className="text-[10px] text-slate-500 font-mono">{balance.mdtBalance.toFixed(2)} MDT · {balance.hbarBalance.toFixed(4)} HBAR</div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-black font-mono ${balance.hasEnough || alreadyStaked ? 'text-neon-green' : 'text-yellow-400'}`}>
              {alreadyStaked ? 'Staked ✓' : `${balance.mdtBalance.toFixed(0)} / ${totalNeeded}`}
            </div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">{alreadyStaked ? 'Already staked as Holder' : 'MDT needed'}</div>
          </div>
        </div>
      )}

      {/* Faucet */}
      {step === 'need_faucet' && (
        <FaucetPanel accountId={accountId || ''} needed={totalNeeded} stake={stakeNum} regFee={REG_FEE_BUFFER} onSuccess={() => checkBalance()} />
      )}

      {/* Blocked — already staked as different role */}
      {step === 'error' && error && error.includes('already staked as') && (
        <div className="glass-panel p-5 border border-red-500/30 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase tracking-widest">
            <AlertCircle size={14} /> Role Conflict
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{error}</p>
          <div className="p-3 bg-yellow-400/5 border border-yellow-400/20 rounded-xl text-[10px] text-yellow-400 space-y-1">
            <div className="font-black uppercase tracking-widest mb-1">How to switch to Holder</div>
            <div>1. Go to your current dashboard → <span className="text-white font-bold">Request Unstake</span></div>
            <div>2. Wait <span className="text-white font-bold">7 days</span> cooldown</div>
            <div>3. <span className="text-white font-bold">Withdraw</span> your stake</div>
            <div>4. Come back here and register as Holder</div>
          </div>
        </div>
      )}

      {/* Form */}
      {step !== 'done' && step !== 'error' && (
        <div className="glass-panel p-6 space-y-5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Hedera Account ID</label>
            <div className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white">
              {isConnected ? accountId : <span className="text-slate-500">Connect wallet first</span>}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
              Stake Amount (MDT) <span className="text-neon-green">· min {MIN_HOLDER_STAKE} MDT</span>
            </label>
            <input
              type="number" min={MIN_HOLDER_STAKE} value={stake}
              onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
              onChange={e => setStake(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white focus:border-neon-green/40 outline-none"
            />
            <div className="text-[10px] text-slate-600 mt-1">Total needed: {totalNeeded} MDT (stake + ~{REG_FEE_BUFFER} regFee buffer)</div>
          </div>

          {/* On-chain flow info */}
          <div className="p-3 bg-neon-green/5 border border-neon-green/20 rounded-xl text-[10px] text-slate-400 space-y-0.5">
            <span className="text-neon-green font-black uppercase tracking-widest block mb-1">On-Chain Flow</span>
            {walletType === 'hashpack' ? (<>
              <div>1. HashPack: <code className="text-neon-cyan">TransferTransaction — {totalNeeded} MDT → vault</code></div>
              <div>2. Backend: <code className="text-neon-cyan">recordDeposit(userEVM, {totalNeeded} MDT)</code></div>
              <div>3. HashPack: <code className="text-neon-cyan">vault.stake({stakeNum * 1e8}, 3 /* Holder */)</code></div>
            </>) : (<>
              <div>1. MetaMask: <code className="text-neon-cyan">HTS cryptoTransfer — {totalNeeded} MDT → vault</code></div>
              <div>2. Backend: <code className="text-neon-cyan">recordDeposit(userEVM, {totalNeeded} MDT)</code></div>
              <div>3. MetaMask: <code className="text-neon-cyan">vault.stake({stakeNum * 1e8}, 3 /* Holder */)</code></div>
            </>)}
            <div>4. HCS: <code className="text-neon-cyan">holder_register → topic 0.0.8198583</code></div>
          </div>

          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400">✗ {error}</div>}

          {(() => {
            const notReady = !isConnected || stakeNum < MIN_HOLDER_STAKE || (!balance?.hasEnough && !alreadyStaked);
            const isDisabled = busy || notReady;
            const btnLabel = busy ? stepLabel
              : !isConnected ? 'Connect wallet first'
              : stakeNum < MIN_HOLDER_STAKE ? `Min stake is ${MIN_HOLDER_STAKE} MDT`
              : !balance?.hasEnough && !alreadyStaked ? `Need ${totalNeeded} MDT — use faucet ↑`
              : alreadyStaked ? 'Submit HCS Registration'
              : 'Stake & Register as Holder';
            const btnColor = busy ? 'bg-neon-green/10 border-neon-green/40 text-neon-green opacity-70 cursor-wait'
              : isDisabled ? 'bg-slate-800/60 border-slate-700/60 text-slate-500 cursor-not-allowed'
              : 'bg-neon-green/10 hover:bg-neon-green/25 border-neon-green/50 text-neon-green hover:shadow-[0_0_16px_rgba(0,255,163,0.2)]';
            return (
              <button onClick={handleRegister} disabled={isDisabled}
                className={`w-full py-3 border font-black text-xs uppercase tracking-widest rounded-xl transition-all ${btnColor}`}>
                {btnLabel}
              </button>
            );
          })()}
        </div>
      )}

      {/* Success */}
      {step === 'done' && hcsResult && (
        <div className="glass-panel p-6 space-y-4 border border-neon-green/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-neon-green/10 border border-neon-green/30">
              <CheckCircle size={20} className="text-neon-green" />
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-wider text-neon-green">Staked & Registered as Holder</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">Earning passive rewards from network task pool</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
              <div className="text-slate-500 text-[9px] uppercase tracking-widest">HCS</div>
              <div className="text-white">Sequence #{hcsResult.sequence}</div>
              <div className="text-slate-400">Topic {hcsResult.topicId}</div>
            </div>
            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
              <div className="text-slate-500 text-[9px] uppercase tracking-widest">Stake</div>
              <div className="text-white">{stakeNum} MDT</div>
              <div className="text-neon-green text-[10px]">Role: Holder (3)</div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {hcsResult.txUrl && <a href={hcsResult.txUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-neon-cyan text-xs font-bold hover:underline"><ExternalLink size={10} /> HCS Transaction</a>}
            {stakeResult?.txHashContract && <a href={`https://hashscan.io/testnet/transaction/${stakeResult.txHashContract}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-neon-green text-xs font-bold hover:underline"><ExternalLink size={10} /> Stake TX</a>}
            {stakeResult?.txHashTransfer && <a href={`https://hashscan.io/testnet/transaction/${stakeResult.txHashTransfer}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-neon-cyan text-xs font-bold hover:underline"><ExternalLink size={10} /> MDT Transfer TX</a>}
          </div>
          <button onClick={() => onViewChange(ViewState.HOLDER_DASHBOARD)}
            className="w-full py-2.5 bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/40 text-neon-green font-black text-xs uppercase tracking-widest rounded-xl transition-all">
            Go to Holder Dashboard
          </button>
        </div>
      )}

      {/* Activity log */}
      {logs.length > 0 && (
        <div className="glass-panel p-4 space-y-1">
          <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Activity Log</div>
          {logs.map((l, i) => (
            <div key={i} className={`text-[10px] font-mono ${l.startsWith('✓') ? 'text-neon-green' : l.startsWith('⚠') ? 'text-yellow-400' : 'text-slate-400'}`}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
