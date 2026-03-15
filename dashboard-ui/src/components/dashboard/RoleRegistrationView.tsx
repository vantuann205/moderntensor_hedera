"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { AccountId, ContractExecuteTransaction, ContractId, ContractFunctionParameters, TransferTransaction, TokenId } from '@hashgraph/sdk';
import { useWallet } from '@/context/WalletContext';
import { ViewState } from '@/types';

// ── Shared Faucet Panel ───────────────────────────────────────────────────────
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
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Faucet failed');
      setResult(data);
      // Countdown 5s then re-check balance
      let secs = 5;
      setCountdown(secs);
      const t = setInterval(() => {
        secs -= 1;
        setCountdown(secs);
        if (secs <= 0) { clearInterval(t); setCountdown(null); onSuccess(); }
      }, 1000);
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
          <div className="text-[9px] text-slate-500 font-mono">MDT · 0.0.8198586 · Hedera Testnet</div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1.5">Wallet Address</div>
          <div className="px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl font-mono text-sm text-white break-all select-all">
            {accountId || '—'}
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-yellow-400/5 border border-yellow-400/20 rounded-xl">
          <div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Amount</div>
            <div className="text-xl font-black text-yellow-400 mt-0.5">500 MDT</div>
          </div>
          <div className="text-right text-[9px] text-slate-500 font-mono">
            <div>Need: {needed} MDT</div>
            <div>({stake} stake + ~{regFee} fee)</div>
          </div>
        </div>
        {result && (
          <div className="p-4 bg-neon-green/5 border border-neon-green/20 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-neon-green text-[11px] font-black">
              <span className="material-symbols-outlined text-sm">check_circle</span> {result.amount} MDT sent successfully
            </div>
            {result.txId && <div className="text-[9px] text-slate-500 font-mono break-all">TX: {result.txId}</div>}
            {result.txUrl && (
              <a href={result.txUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-neon-cyan text-[10px] font-bold hover:underline">
                <span className="material-symbols-outlined text-xs">open_in_new</span> View on HashScan
              </a>
            )}
            {countdown !== null
              ? <div className="text-[9px] text-yellow-400 font-mono animate-pulse">Checking balance in {countdown}s...</div>
              : <div className="text-[9px] text-slate-500 font-mono">Refreshing balance...</div>
            }
          </div>
        )}
        {err && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-mono text-red-400">✗ {err}</div>
        )}
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

interface Props {
  onBack: () => void;
  onViewChange: (v: ViewState) => void;
  onRegistered?: () => void;
}

const CAPABILITIES = ['text_generation', 'code_review', 'image_analysis', 'data_labeling', 'summarization'];
const MIN_STAKE = { miner: 10 };
const REG_FEE_BUFFER = 6;
const VAULT_EVM = '0x99968cF6Aa38337a4dD3cBf40D13011293Cf718f';
const VAULT_ID = '0.0.8219632';
const REGISTRY_EVM = '0xbdbd7a138c7f815b1A7f432C1d06b2B95E46Ba1F';
const REGISTRY_ID = '0.0.8219634';
const HEDERA_RPC = 'https://testnet.hashio.io/api';

const VAULT_ABI = [
  'function stake(uint256 amount, uint8 role) external',
  'function stakes(address user) external view returns (uint256 amount, uint8 role, uint256 stakedAt, uint256 unstakeRequestedAt, bool isActive, uint256 rewardDebt)',
  'function pendingDeposit(address user) external view returns (uint256)',
  'function getCurrentRegFee() external view returns (uint256)',
  'function isMiner(address user) external view returns (bool)',
];

const REGISTRY_ABI = [
  'function registerMiner(uint256 subnetId) external',
  'function isMiner(uint256 subnetId, address miner) view returns (bool)',
  'function subnetCount() view returns (uint256)',
  'function getSubnet(uint256 id) view returns (uint256 id, string name, string description, address owner, uint256 feeRate, uint256 minTaskReward, uint256 totalVolume, uint256 totalTasks, uint256 activeMiners, uint8 status, uint256 createdAt)',
];

interface SubnetInfo { id: number; name: string; activeMiners: number; status: number; }

/** Resolve Hedera TransactionId (object or string) → consensus_timestamp via mirror node */
async function resolveHederaTxId(txId: any): Promise<string | null> {
  try {
    let mirrorId: string;
    if (!txId) return null;
    if (typeof txId === 'string') {
      if (txId.includes('@')) {
        const [acc, time] = txId.split('@');
        const dotIdx = time.indexOf('.');
        const secs = time.slice(0, dotIdx);
        const nanos = time.slice(dotIdx + 1);
        mirrorId = `${acc}-${secs}-${nanos}`;
      } else {
        mirrorId = txId;
      }
    } else if (txId?.accountId && txId?.validStart) {
      const acc = txId.accountId.toString();
      const secs = txId.validStart.seconds?.toString() || '0';
      const nanos = txId.validStart.nanos?.toString().padStart(9, '0') || '000000000';
      mirrorId = `${acc}-${secs}-${nanos}`;
    } else {
      return null;
    }
    const res = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/transactions/${mirrorId}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.transactions?.[0]?.consensus_timestamp || null;
    }
  } catch (_) {}
  return null;
}

type Step = 'idle' | 'checking' | 'need_faucet' | 'faucet_pending' | 'deposit' | 'staking' | 'subnet_reg' | 'hcs' | 'done' | 'error';
interface BalanceInfo { mdtBalance: number; hbarBalance: number; evmAddress: string; hasEnough: boolean; }

export default function RoleRegistrationView({ onBack, onViewChange, onRegistered }: Props) {
  const { accountId, address: walletEvm, isConnected, type: walletType, hashConnect } = useWallet();
  const [stake, setStake] = useState(10);
  const [caps, setCaps] = useState<string[]>(['text_generation']);
  const [selectedSubnets, setSelectedSubnets] = useState<number[]>([]);
  const [availableSubnets, setAvailableSubnets] = useState<SubnetInfo[]>([]);
  const [minersPerSubnet, setMinersPerSubnet] = useState<Record<number, number>>({});
  const [step, setStep] = useState<Step>('idle');
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [faucetResult, setFaucetResult] = useState<any>(null);
  const [stakeResult, setStakeResult] = useState<any>(null);
  const [hcsResult, setHcsResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => setLogs(prev => [...prev, msg]);
  const minStake = MIN_STAKE.miner;
  const totalNeeded = stake + REG_FEE_BUFFER;

  const toggleCap = (c: string) =>
    setCaps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const toggleSubnet = (id: number) =>
    setSelectedSubnets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Load available subnets from /api/subnets (single source of truth, same as SubnetsHub)
  useEffect(() => {
    async function loadSubnets() {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 8000);
        const [subRes, statsRes] = await Promise.all([
          fetch('/api/subnets', { signal: controller.signal, cache: 'no-store' }),
          fetch('/api/protocol-stats', { cache: 'no-store' }),
        ]);
        const subData = await subRes.json();
        const statsData = statsRes.ok ? await statsRes.json() : null;

        if (statsData?.success && statsData.data?.minersPerSubnet) {
          setMinersPerSubnet(statsData.data.minersPerSubnet);
        }

        if (subData.success && Array.isArray(subData.data) && subData.data.length > 0) {
          const list: SubnetInfo[] = subData.data.map((s: any) => ({
            id: s.id,
            name: s.name || `Subnet ${s.id}`,
            activeMiners: s.activeMiners ?? 0,
            status: s.status ?? 0,
          }));
          setAvailableSubnets(list);
          setSelectedSubnets([list[0].id]);
        } else {
          throw new Error('empty');
        }
      } catch (e) {
        const fallback = [{ id: 0, name: 'General Intelligence', activeMiners: 0, status: 0 }];
        setAvailableSubnets(fallback);
        setSelectedSubnets([0]);
      }
    }
    loadSubnets();
  }, []);

  // ── Step 1: Check MDT balance ──────────────────────────────────────────────
  const checkBalance = useCallback(async () => {
    if (!accountId) return;
    setStep('checking'); setError(null);
    log(`Checking MDT balance for ${accountId}...`);
    try {
      const res = await fetch(`/api/mdt-balance?accountId=${accountId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const info: BalanceInfo = {
        mdtBalance: data.mdtBalance,
        hbarBalance: data.hbarBalance,
        evmAddress: data.evmAddress || walletEvm || '',
        hasEnough: data.mdtBalance >= totalNeeded,
      };
      setBalance(info);
      log(`Balance: ${data.mdtBalance.toFixed(2)} MDT · ${data.hbarBalance.toFixed(4)} HBAR`);
      if (info.hasEnough) {
        log(`✓ Sufficient MDT (need ${totalNeeded}, have ${data.mdtBalance.toFixed(2)})`);
        setStep('idle');
      } else {
        log(`✗ Need ${totalNeeded} MDT (stake + regFee), have ${data.mdtBalance.toFixed(2)}`);
        setStep('need_faucet');
      }
    } catch (e: any) { setError(e.message); setStep('error'); }
  }, [accountId, totalNeeded, walletEvm]);

  // ── Step 2: Faucet ─────────────────────────────────────────────────────────
  const requestFaucet = async () => {
    if (!accountId) return;
    setStep('faucet_pending'); setError(null);
    log(`Requesting 100 MDT from faucet...`);
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFaucetResult(data);
      log(`✓ Faucet: ${data.amount} MDT sent`);
      if (data.txUrl) log(`  HashScan: ${data.txUrl}`);
      await checkBalance();
    } catch (e: any) { setError(e.message); setStep('need_faucet'); }
  };

  // ── Step 3: recordDeposit (backend, deployer key) ──────────────────────────
  const doRecordDeposit = async (evmAddress: string): Promise<boolean> => {
    setStep('deposit');
    log(`Recording deposit on StakingVaultV2 (${totalNeeded} MDT)...`);
    try {
      const res = await fetch('/api/staking/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, evmAddress, amount: totalNeeded }),
      });
      const data = await res.json();
      if (!res.ok) {
        log(`⚠ recordDeposit: ${data.error} — may already have deposit`);
        return true; // non-fatal, pendingDeposit may already exist
      }
      log(`✓ recordDeposit · pendingDeposit: ${data.pendingDeposit} MDT`);
      if (data.hashscanUrl) log(`  tx: ${data.hashscanUrl}`);
      return true;
    } catch (e: any) {
      log(`⚠ recordDeposit failed: ${e.message}`);
      return true; // non-fatal
    }
  };

  // ── Step 4: On-chain stake via wallet (HashPack or MetaMask) ───────────────
  // Both flows: 1) Transfer MDT→vault (user signs)  2) recordDeposit (backend)  3) stake() (user signs)
  const doOnChainStake = async (evmAddress: string): Promise<{ txHash: string; txHashTransfer?: string; txHashContract?: string } | null> => {
    setStep('staking');
    const amountRaw = BigInt(Math.floor(stake * 1e8));
    const stakeRole = 1; // Miner=1

    log(`Staking ${stake} MDT on-chain via ${walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}...`);
    log(`Vault: StakingVaultV2 · ${VAULT_EVM}`);

    try {
      if (walletType === 'metamask') {
        const ethereum = (window as any).ethereum;
        if (!ethereum) throw new Error('MetaMask not found');
        const provider = new ethers.BrowserProvider(ethereum);
        try { await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x128' }] }); } catch (_) {}
        const signer = await provider.getSigner();
        const signerAddr = await signer.getAddress();

        const vaultRead = new ethers.Contract(VAULT_EVM, VAULT_ABI, provider);
        const existing = await vaultRead.stakes(signerAddr);
        if (existing.isActive) {
          log(`✓ Already staked on-chain (${Number(existing.amount) / 1e8} MDT)`);
          return { txHash: 'already_staked' };
        }

        // Get regFee
        let regFeeRaw = BigInt(1 * 1e8);
        try { const f = await vaultRead.getCurrentRegFee(); regFeeRaw = BigInt(f.toString()); } catch (_) {}
        const totalRaw = regFeeRaw + amountRaw;
        const totalMDT = Number(totalRaw) / 1e8;

        // Step 1: HTS cryptoTransfer MDT → vault (user signs in MetaMask)
        setStep('deposit');
        log(`Step 1/3: Transferring ${totalMDT} MDT to vault via HTS (MetaMask)...`);
        const HTS_ABI_LOCAL = [
          'function cryptoTransfer((int64 amount, address accountID, bool isApproval)[] transferList, (address token, (int64 amount, address accountID, bool isApproval)[] transfers, bool deleteSpenderAllowance)[] tokenTransfers) external returns (int64 responseCode)',
        ];
        const MDT_EVM = '0x00000000000000000000000000000000007d257a';
        const hts = new ethers.Contract('0x0000000000000000000000000000000000000167', HTS_ABI_LOCAL, signer);
        const transferTx = await hts.cryptoTransfer(
          [],
          [{
            token: MDT_EVM,
            transfers: [
              { amount: -BigInt(totalRaw), accountID: signerAddr, isApproval: false },
              { amount: BigInt(totalRaw), accountID: VAULT_EVM, isApproval: false },
            ],
            deleteSpenderAllowance: false,
          }],
          { gasLimit: 300000 }
        );
        const transferReceipt = await transferTx.wait();
        log(`✓ Step 1/3: MDT transferred · ${transferReceipt.hash}`);

        // Step 2: recordDeposit (backend/owner)
        setStep('deposit');
        log(`Step 2/3: Recording deposit on-chain...`);
        const depositRes = await fetch('/api/staking/deposit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, evmAddress: signerAddr, amount: totalMDT }),
        });
        const depositData = await depositRes.json();
        if (!depositRes.ok) throw new Error(depositData.error || 'recordDeposit failed');
        log(`✓ Step 2/3: pendingDeposit credited`);

        // Step 3: stake() (user signs in MetaMask)
        setStep('staking');
        log(`Step 3/3: Calling vault.stake(${stake} MDT, Miner) — approve in MetaMask...`);
        const vault = new ethers.Contract(VAULT_EVM, VAULT_ABI, signer);
        const stakeTx = await vault['stake(uint256,uint8)'](amountRaw, stakeRole, { gasLimit: 300000 });
        const stakeReceipt = await stakeTx.wait();
        log(`✓ Step 3/3: Staked · ${stakeReceipt.hash}`);
        return { txHash: stakeReceipt.hash, txHashTransfer: transferReceipt.hash, txHashContract: stakeReceipt.hash };

      } else if (walletType === 'hashpack') {
        if (!hashConnect || !accountId) throw new Error('HashConnect not initialized');

        const provider = new ethers.JsonRpcProvider(HEDERA_RPC);
        const vaultRead = new ethers.Contract(VAULT_EVM, VAULT_ABI, provider);

        // Check already staked
        const existing = await vaultRead.stakes(evmAddress);
        if (existing.isActive) {
          log(`✓ Already staked on-chain (${Number(existing.amount) / 1e8} MDT)`);
          return { txHash: 'already_staked' };
        }

        const hederaId = AccountId.fromString(accountId);
        const MDT_TOKEN_ID = TokenId.fromString('0.0.8198586');

        // Resolve vault Hedera account ID
        let vaultAccountId = '0.0.8219632';
        try {
          const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${VAULT_EVM}`);
          const d = await r.json();
          if (d.account) vaultAccountId = d.account;
        } catch (_) {}

        // Get current regFee from contract
        let regFeeRaw = BigInt(1 * 1e8); // floor fallback
        try {
          const regFeeResult = await vaultRead.getCurrentRegFee();
          regFeeRaw = BigInt(regFeeResult.toString());
        } catch (_) {}

        const totalRaw = regFeeRaw + amountRaw;
        const totalMDT = Number(totalRaw) / 1e8;
        log(`regFee: ${Number(regFeeRaw) / 1e8} MDT · total to transfer: ${totalMDT} MDT`);

        // ── Step 1: Transfer MDT to vault via HashPack ──────────────────────
        log(`Step 1/3: Transferring ${totalMDT} MDT to vault — approve in HashPack...`);
        const transferTx = new TransferTransaction()
          .addTokenTransfer(MDT_TOKEN_ID, hederaId, -Number(totalRaw))
          .addTokenTransfer(MDT_TOKEN_ID, AccountId.fromString(vaultAccountId), Number(totalRaw));

        const transferReceipt = await hashConnect.sendTransaction(hederaId, transferTx);
        const transferStatus = String(transferReceipt.status ?? 'SUCCESS');
        if (!transferStatus.includes('SUCCESS') && !transferStatus.includes('22')) {
          throw new Error(`MDT transfer failed: ${transferStatus}`);
        }
        const transferTs = await resolveHederaTxId(transferReceipt.transactionId);
        log(`✓ Step 1/3: MDT transferred${transferTs ? ` · ${transferTs}` : ''}`);

        // ── Step 2: recordDeposit (backend) ────────────────────────────────
        log(`Step 2/3: Recording deposit on-chain...`);
        const depositRes = await fetch('/api/staking/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, evmAddress, amount: totalMDT }),
        });
        const depositData = await depositRes.json();
        if (!depositRes.ok) throw new Error(depositData.error || 'recordDeposit failed');
        log(`✓ Step 2/3: pendingDeposit: ${depositData.pendingDeposit} MDT`);

        // ── Step 3: stake() via HashPack ContractExecuteTransaction ─────────
        log(`Step 3/3: Calling vault.stake() — approve in HashPack...`);
        const params = new ContractFunctionParameters()
          .addUint256(amountRaw.toString())
          .addUint8(stakeRole);

        const contractId = ContractId.fromString(VAULT_ID);
        const contractTx = new ContractExecuteTransaction()
          .setContractId(contractId)
          .setGas(300000)
          .setFunction('stake', params);

        const stakeReceipt = await hashConnect.sendTransaction(hederaId, contractTx);
        const stakeStatus = String(stakeReceipt.status ?? 'SUCCESS');
        const contractTs = await resolveHederaTxId(stakeReceipt.transactionId);
        log(`✓ Step 3/3: Staked · status: ${stakeStatus}${contractTs ? ` · ${contractTs}` : ''}`);

        return {
          txHash: contractTs || `hashpack_${Date.now()}`,
          txHashTransfer: transferTs || undefined,
          txHashContract: contractTs || undefined,
        };
      }

      throw new Error('No wallet connected');
    } catch (e: any) {
      log(`✗ On-chain stake failed: ${e.message}`);
      setError(`On-chain stake failed: ${e.message}`);
      return null;
    }
  };

  // ── Step 5: Register in subnets on-chain ──────────────────────────────────
  const doRegisterSubnets = async (evmAddress: string, subnets: number[]): Promise<void> => {
    if (subnets.length === 0) return;
    setStep('subnet_reg');

    for (const subnetId of subnets) {
      log(`Registering in Subnet ${subnetId} on SubnetRegistryV2...`);
      try {
        if (walletType === 'metamask') {
          const ethereum = (window as any).ethereum;
          if (!ethereum) throw new Error('MetaMask not found');
          const provider = new ethers.BrowserProvider(ethereum);
          const signer = await provider.getSigner();
          const registry = new ethers.Contract(REGISTRY_EVM, REGISTRY_ABI, signer);

          // Check already registered
          const already = await registry.isMiner(subnetId, evmAddress);
          if (already) { log(`✓ Already in Subnet ${subnetId}`); continue; }

          const tx = await registry.registerMiner(subnetId, { gasLimit: 200000 });
          const receipt = await tx.wait();
          log(`✓ Registered in Subnet ${subnetId} · tx: ${receipt.hash}`);

        } else if (walletType === 'hashpack') {
          if (!hashConnect || !accountId) throw new Error('HashConnect not initialized');

          const provider = new ethers.JsonRpcProvider(HEDERA_RPC);
          const registry = new ethers.Contract(REGISTRY_EVM, REGISTRY_ABI, provider);
          const already = await registry.isMiner(subnetId, evmAddress);
          if (already) { log(`✓ Already in Subnet ${subnetId}`); continue; }

          const hederaId = AccountId.fromString(accountId);
          const contractId = ContractId.fromString(REGISTRY_ID);
          const params = new ContractFunctionParameters().addUint256(subnetId.toString());

          const tx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(200000)
            .setFunction('registerMiner', params);

          const receipt = await hashConnect.sendTransaction(hederaId, tx);
          const ts = await resolveHederaTxId(receipt.transactionId);
          log(`✓ Registered in Subnet ${subnetId}${ts ? ` · ${ts}` : ''}`);
        }
      } catch (e: any) {
        log(`⚠ Subnet ${subnetId} registration: ${e.message}`);
        // Non-fatal — continue with other subnets
      }
    }
  };

  // ── Full registration flow ─────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!accountId || !isConnected) return;
    if (caps.length === 0) { setError('Select at least one capability'); return; }
    if (stake < minStake) { setError(`Minimum stake is ${minStake} MDT`); return; }
    if (selectedSubnets.length === 0) { setError('Select at least one subnet'); return; }
    if (!balance) { await checkBalance(); return; }
    if (!balance.hasEnough) { setStep('need_faucet'); return; }

    setError(null);
    const evmAddress = balance.evmAddress || walletEvm || '';

    // Check if already staked on-chain
    let alreadyStaked = false;
    try {
      const provider = new ethers.JsonRpcProvider(HEDERA_RPC);
      const vaultRead = new ethers.Contract(VAULT_EVM, VAULT_ABI, provider);
      const existing = await vaultRead.stakes(evmAddress);
      alreadyStaked = existing.isActive;
    } catch (_) {}

    let stakeRes: { txHash: string; txHashTransfer?: string; txHashContract?: string } | null = null;

    if (alreadyStaked) {
      log(`✓ Already staked on-chain — skipping stake steps`);
      stakeRes = { txHash: 'already_staked' };
    } else {
      stakeRes = await doOnChainStake(evmAddress);
      if (stakeRes === null) {
        log(`✗ On-chain stake failed — registration blocked. Fix the error and retry.`);
        return;
      }
    }

    setStakeResult(stakeRes);

    // Register in selected subnets on-chain
    await doRegisterSubnets(evmAddress, selectedSubnets);

    // HCS registration
    setStep('hcs');
    log(`Submitting miner_register to HCS topic 0.0.8198583...`);
    try {
      const res = await fetch('/api/hcs/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'miner', accountId, stakeAmount: stake,
          capabilities: caps,
          subnetIds: selectedSubnets,
          skipOnChainStake: true,
          ...(stakeRes?.txHash ? { stakeTxHash: stakeRes.txHash } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 402 && data.code === 'INSUFFICIENT_MDT') {
        setBalance(prev => prev ? { ...prev, hasEnough: false, mdtBalance: data.balance } : null);
        setStep('need_faucet'); setError(data.message); return;
      }
      if (!res.ok || data.error) throw new Error(data.error || 'HCS registration failed');
      setHcsResult({ ...data, stakeTxHash: stakeRes?.txHash });
      log(`✓ HCS sequence #${data.sequence} · topic ${data.topicId}`);
      setStep('done');
      setTimeout(() => onRegistered?.(), 1500);
    } catch (e: any) { setError(e.message); setStep('error'); }
  };

  useEffect(() => {
    if (isConnected && accountId && step === 'idle') checkBalance();
  }, [isConnected, accountId]); // eslint-disable-line

  const busy = ['checking', 'faucet_pending', 'deposit', 'staking', 'subnet_reg', 'hcs'].includes(step);

  const stepLabel = {
    idle: 'Ready', checking: 'Checking balance...', need_faucet: 'Insufficient MDT',
    faucet_pending: 'Requesting MDT...', deposit: 'Recording deposit...', staking: 'Staking on-chain...',
    subnet_reg: 'Registering in subnets...', hcs: 'Submitting to HCS...', done: 'Registered ✓', error: 'Error',
  }[step];

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span> Back
        </button>
        <div>
          <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
            Join as <span className="text-neon-cyan">AI Miner</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${step === 'done' ? 'bg-neon-green' : step === 'need_faucet' || step === 'error' ? 'bg-yellow-400' : 'bg-neon-cyan animate-pulse'}`} />
            {stepLabel}
            {walletType && <span className="text-slate-600">· via {walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}</span>}
          </p>
        </div>
      </div>

      {/* Balance card */}
      {balance && (
        <div className={`glass-panel p-4 flex items-center justify-between border ${balance.hasEnough ? 'border-neon-green/20' : 'border-yellow-400/30'}`}>
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-xl ${balance.hasEnough ? 'text-neon-green' : 'text-yellow-400'}`}>
              {balance.hasEnough ? 'check_circle' : 'warning'}
            </span>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider">MDT Balance</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {balance.mdtBalance.toFixed(2)} MDT · {balance.hbarBalance.toFixed(4)} HBAR
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-black font-mono ${balance.hasEnough ? 'text-neon-green' : 'text-yellow-400'}`}>
              {balance.mdtBalance.toFixed(0)} / {totalNeeded}
            </div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">MDT (stake + regFee)</div>
          </div>
        </div>
      )}

      {/* Faucet panel */}
      {(step === 'need_faucet' || step === 'faucet_pending') && (
        <FaucetPanel
          accountId={accountId || ''}
          needed={totalNeeded}
          stake={stake}
          regFee={REG_FEE_BUFFER}
          onSuccess={() => checkBalance()}
        />
      )}

      {/* Registration form */}
      {step !== 'done' && (
        <div className="glass-panel p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Registration Details</h3>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
              {[
                { label: 'Balance', done: !!balance?.hasEnough, active: step === 'checking' || step === 'need_faucet' },
                { label: 'Stake', done: !!stakeResult, active: step === 'deposit' || step === 'staking' },
                { label: 'Subnet', done: step === 'hcs' || step === 'done', active: step === 'subnet_reg' },
                { label: 'HCS', done: step === 'done', active: step === 'hcs' },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <span className="text-white/10">→</span>}
                  <span className={s.done ? 'text-neon-green' : s.active ? 'text-neon-cyan' : 'text-slate-600'}>
                    {s.done ? '✓' : `${i + 1}.`} {s.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Hedera Account ID</label>
            <div className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white flex items-center justify-between">
              <span>{isConnected ? accountId : <span className="text-slate-500">Connect wallet first</span>}</span>
              {walletType && (
                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${walletType === 'hashpack' ? 'border-neon-purple/40 text-neon-purple bg-neon-purple/10' : 'border-orange-400/40 text-orange-400 bg-orange-400/10'}`}>
                  {walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
              Stake Amount (MDT) <span className="text-neon-cyan">· min {minStake} MDT</span>
            </label>
            <input type="number" min={minStake} value={stake}
              onChange={e => setStake(Number(e.target.value))}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white focus:border-neon-cyan/40 outline-none" />
            <div className="text-[10px] text-slate-600 mt-1">Total needed: {totalNeeded} MDT (stake + ~{REG_FEE_BUFFER} regFee buffer)</div>
          </div>

          <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Capabilities</label>
              <div className="flex flex-wrap gap-2">
                {CAPABILITIES.map(cap => (
                  <button key={cap} onClick={() => toggleCap(cap)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                      caps.includes(cap) ? 'bg-neon-cyan/15 border-neon-cyan/50 text-neon-cyan' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}>
                    {cap.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

          {/* Subnet selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
              Subnets <span className="text-neon-cyan">· select at least one</span>
            </label>
            {availableSubnets.length === 0 ? (
              <div className="text-[10px] text-slate-600 font-mono">Loading subnets...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableSubnets.map(s => (
                  <button key={s.id} onClick={() => toggleSubnet(s.id)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1.5 ${
                      selectedSubnets.includes(s.id)
                        ? 'bg-neon-purple/15 border-neon-purple/50 text-neon-purple'
                        : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}>
                    <span className="material-symbols-outlined text-xs">hub</span>
                    {s.name || `Subnet ${s.id}`}
                    <span className="text-[9px] opacity-60">{minersPerSubnet[s.id] ?? s.activeMiners} miners</span>
                  </button>
                ))}
              </div>
            )}
            {selectedSubnets.length > 0 && (
              <div className="text-[9px] text-slate-600 mt-1 font-mono">
                Selected: {selectedSubnets.map(id => `Subnet ${id}`).join(', ')}
              </div>
            )}
          </div>

          {/* On-chain flow info */}
          <div className="p-3 bg-neon-purple/5 border border-neon-purple/20 rounded-xl text-[10px] text-slate-400 leading-relaxed space-y-0.5">
            <span className="text-neon-purple font-black uppercase tracking-widest block mb-1">On-Chain Flow · StakingVaultV2 + SubnetRegistryV2</span>
            {walletType === 'hashpack' ? (<>
              <div>1. HashPack: <code className="text-neon-cyan">TransferTransaction — {totalNeeded} MDT → vault</code></div>
              <div>2. Backend: <code className="text-neon-cyan">recordDeposit(userEVM, {totalNeeded} MDT)</code></div>
              <div>3. HashPack: <code className="text-neon-cyan">vault.stake({stake * 1e8}, 1)</code></div>
              <div>4. HashPack: <code className="text-neon-cyan">registry.registerMiner(subnetId) × {selectedSubnets.length}</code></div>
              <div>5. HCS: <code className="text-neon-cyan">miner_register → topic 0.0.8198583</code></div>
            </>) : (<>
              <div>1. Backend: <code className="text-neon-cyan">recordDeposit(userEVM, {totalNeeded} MDT)</code></div>
              <div>2. MetaMask: <code className="text-neon-cyan">vault.stake({stake * 1e8}, 1)</code></div>
              <div>3. MetaMask: <code className="text-neon-cyan">registry.registerMiner(subnetId) × {selectedSubnets.length}</code></div>
              <div>4. HCS: <code className="text-neon-cyan">miner_register → topic 0.0.8198583</code></div>
            </>)}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-mono text-red-400">✗ {error}</div>
          )}

          {(() => {
            const missingCaps = caps.length === 0;
            const missingSubnet = selectedSubnets.length === 0;
            const missingBalance = balance && !balance.hasEnough;
            const missingStake = stake < minStake;
            const notReady = missingCaps || missingSubnet || missingBalance || missingStake;
            const isDisabled = busy || !isConnected || notReady;

            const btnLabel = step === 'checking' ? 'Checking balance...'
              : step === 'deposit' ? 'Recording deposit...'
              : step === 'staking' ? `Staking via ${walletType === 'hashpack' ? 'HashPack' : 'MetaMask'}...`
              : step === 'subnet_reg' ? 'Registering in subnets...'
              : step === 'hcs' ? 'Submitting to HCS...'
              : step === 'need_faucet' ? 'Get MDT first ↑'
              : missingCaps ? 'Select at least one capability'
              : missingSubnet ? 'Select at least one subnet'
              : missingStake ? `Min stake is ${minStake} MDT`
              : missingBalance ? `Need ${totalNeeded} MDT — use faucet ↑`
              : 'Register as AI Miner';

            const btnColor = busy
              ? 'bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan opacity-70 cursor-wait'
              : isDisabled
              ? 'bg-slate-800/60 border-slate-700/60 text-slate-500 cursor-not-allowed'
              : 'bg-neon-cyan/10 hover:bg-neon-cyan/25 border-neon-cyan/50 text-neon-cyan hover:shadow-[0_0_16px_rgba(0,243,255,0.2)]';

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
              <span className="material-symbols-outlined text-xl text-neon-green">check_circle</span>
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-wider text-neon-green">Registered on Hedera</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">On-chain stake confirmed · HCS registered</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
              <div className="text-slate-500 text-[9px] uppercase tracking-widest">HCS</div>
              <div className="text-white">Sequence #{hcsResult.sequence}</div>
              <div className="text-slate-400">Topic {hcsResult.topicId}</div>
            </div>
            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
              <div className="text-slate-500 text-[9px] uppercase tracking-widest">On-Chain Stake</div>
              <div className="text-white">{stake} MDT</div>
              <div className="text-neon-green text-[10px]">
                {stakeResult?.txHash === 'already_staked' ? 'Already staked ✓' : 'Staked ✓'}
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            {hcsResult.txUrl && (
              <a href={hcsResult.txUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-neon-cyan text-xs font-bold hover:underline">
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                HCS Transaction
              </a>
            )}
            {stakeResult?.txHashContract && (
              <a href={`https://hashscan.io/testnet/transaction/${stakeResult.txHashContract}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-neon-green text-xs font-bold hover:underline">
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                Stake TX (Contract)
              </a>
            )}
            {stakeResult?.txHashTransfer && (
              <a href={`https://hashscan.io/testnet/transaction/${stakeResult.txHashTransfer}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-neon-cyan text-xs font-bold hover:underline">
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                MDT Transfer TX
              </a>
            )}
            {stakeResult?.txHash && stakeResult.txHash !== 'already_staked' && !stakeResult.txHashContract && !stakeResult.txHash.startsWith('hashpack_') && (
              <a href={`https://hashscan.io/testnet/transaction/${stakeResult.txHash}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-neon-green text-xs font-bold hover:underline">
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                Stake TX
              </a>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono text-center animate-pulse">
            Redirecting to Miner Dashboard...
          </div>
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
