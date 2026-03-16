'use client';
/**
 * useStaking — wallet-aware staking flow (MetaMask or HashPack)
 *
 * MetaMask: uses ethers.BrowserProvider + window.ethereum
 * HashPack: uses hashConnect.sendTransaction() with ContractExecuteTransaction
 */

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { AccountId, ContractExecuteTransaction, ContractId, TransferTransaction, TokenId, ContractFunctionParameters } from '@hashgraph/sdk';
import { CONTRACTS, STAKING_VAULT_ABI, SUBNET_REGISTRY_ABI, StakeRole } from '@/lib/contracts';
import { useWallet } from '@/context/WalletContext';

export interface StakeInfo {
  amount: bigint;
  amountMDT: number;
  role: number;
  stakedAt: number;
  unstakeRequestedAt: number;
  isActive: boolean;
  pendingReward: bigint;
  pendingRewardMDT: number;
  pendingDeposit: number;
}

export interface StakingState {
  stakeInfo: StakeInfo | null;
  regFee: number;
  loading: boolean;
  txHash: string | null;
  txHashTransfer: string | null;   // HashPack: MDT transfer tx
  txHashContract: string | null;   // HashPack: contract execute tx
  error: string | null;
  step: string | null;
}

async function getMetaMaskProvider() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error('MetaMask not found. Install MetaMask and add Hedera Testnet (chainId 296).');
  const provider = new ethers.BrowserProvider(eth);
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x128' }] });
  } catch (switchErr: any) {
    if (switchErr.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x128',
          chainName: 'Hedera Testnet',
          nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
          rpcUrls: ['https://testnet.hashio.io/api'],
          blockExplorerUrls: ['https://hashscan.io/testnet'],
        }],
      });
    }
  }
  return provider;
}

/** Convert Hedera TransactionId object or string → consensus_timestamp via mirror node */
async function resolveHederaTxId(txId: any): Promise<string | null> {
  try {
    let mirrorId: string;
    if (typeof txId === 'string') {
      // Could be "0.0.8229683@1773560407.840163000" or "0.0.8229683-1773560407-840163000"
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
      // Hedera SDK TransactionId object
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

export function useStaking() {
  const { type: walletType, accountId: walletAccountId, address: walletEvm, hashConnect } = useWallet();

  const [state, setState] = useState<StakingState>({
    stakeInfo: null, regFee: 5, loading: false, txHash: null,
    txHashTransfer: null, txHashContract: null, error: null, step: null,
  });

  const setStep = (step: string) => setState(s => ({ ...s, step, error: null }));
  const setError = (error: string) => setState(s => ({ ...s, error, loading: false, step: null }));

  const loadStakeInfo = useCallback(async (evmAddress: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, provider);
      const [amount, role, stakedAt, unstakeRequestedAt, isActive, pendingReward] =
        await vault.getStakeInfo(evmAddress);
      const regFeeRaw = await vault.getCurrentRegFee();
      const pendingDep = await vault.pendingDeposit(evmAddress);
      setState(s => ({
        ...s,
        regFee: Number(regFeeRaw) / 1e8,
        stakeInfo: {
          amount, amountMDT: Number(amount) / 1e8,
          role: Number(role),
          stakedAt: Number(stakedAt),
          unstakeRequestedAt: Number(unstakeRequestedAt),
          isActive,
          pendingReward,
          pendingRewardMDT: Number(pendingReward) / 1e8,
          pendingDeposit: Number(pendingDep) / 1e8,
        },
      }));
    } catch (e: any) {
      console.warn('loadStakeInfo:', e.message);
    }
  }, []);

  // ── HashPack: send ContractExecuteTransaction via hashconnect ──────────────
  const stakeViaHashPack = useCallback(async (
    amountMDT: number,
    hederaAccountId: string,
    evmAddress: string,
    regFeeRaw: bigint,
  ): Promise<{ txHash: string; txHashTransfer: string; txHashContract: string }> => {
    if (!hashConnect) throw new Error('HashConnect not initialized');

    const stakeRaw = BigInt(Math.floor(amountMDT * 1e8));
    const totalMDT = Number(regFeeRaw) / 1e8 + amountMDT;
    const totalRaw = regFeeRaw + stakeRaw;
    const hederaId = AccountId.fromString(hederaAccountId);

    // MDT token ID: 0.0.8198586
    const MDT_TOKEN_ID = TokenId.fromString('0.0.8198586');
    // Vault Hedera account ID: resolve from EVM address via mirror node
    let vaultAccountId = '0.0.8219632'; // StakingVaultV2 Hedera account
    try {
      const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${CONTRACTS.STAKING_VAULT}`);
      const d = await r.json();
      if (d.account) vaultAccountId = d.account;
    } catch (_) {}

    // ── Step 1: User transfers MDT to vault via HashPack TransferTransaction ──
    setStep(`Step 1/3: Transferring ${totalMDT.toFixed(4)} MDT to vault — approve in HashPack...`);
    const totalRawNum = Number(totalRaw);
    const transferTx = new TransferTransaction()
      .addTokenTransfer(MDT_TOKEN_ID, hederaId, -totalRawNum)
      .addTokenTransfer(MDT_TOKEN_ID, AccountId.fromString(vaultAccountId), totalRawNum);

    const transferReceipt = await hashConnect.sendTransaction(hederaId as any, transferTx as any);
    const transferStatus = transferReceipt.status ? String(transferReceipt.status) : 'SUCCESS';
    if (transferStatus !== 'SUCCESS' && !transferStatus.includes('22')) {
      throw new Error(`MDT transfer failed: ${transferStatus}`);
    }

    // Resolve transfer tx consensus_timestamp
    const transferTxId = (transferReceipt as any).transactionId;
    const transferTs = await resolveHederaTxId(transferTxId) || '';
    const transferUrl = transferTs ? `https://hashscan.io/testnet/transaction/${transferTs}` : '';
    setStep(`Step 1/3: MDT transferred · ${transferStatus}${transferUrl ? ` · ${transferUrl}` : ''}`);

    // ── Step 2: Backend recordDeposit (confirms the transfer on-chain) ────────
    setStep('Step 2/3: Recording deposit on-chain...');
    const depositRes = await fetch('/api/staking/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: hederaAccountId, evmAddress, amount: totalMDT }),
    });
    const depositData = await depositRes.json();
    if (!depositRes.ok) throw new Error(depositData.error || 'recordDeposit failed');
    setStep(`Step 2/3: Deposit recorded — ${depositData.pendingDeposit} MDT credited`);

    // ── Step 3: User signs stake() via HashPack ContractExecuteTransaction ────
    setStep('Step 3/3: Staking via HashPack — approve in wallet...');
    const stakeParams = new ContractFunctionParameters()
      .addUint256(stakeRaw as any)
      .addUint8(Number(StakeRole.Miner));
    const contractId = ContractId.fromString(CONTRACTS.STAKING_VAULT_ID);

    const contractTx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(300000)
      .setFunction('stake', stakeParams);

    const stakeReceipt = await hashConnect.sendTransaction(hederaId as any, contractTx as any);
    const stakeStatus = stakeReceipt.status ? String(stakeReceipt.status) : 'SUCCESS';

    // Resolve contract tx consensus_timestamp
    const contractTxId = (stakeReceipt as any).transactionId;
    const contractTs = await resolveHederaTxId(contractTxId) || '';
    const contractUrl = contractTs ? `https://hashscan.io/testnet/transaction/${contractTs}` : '';
    setStep(`Step 3/3: Staked via HashPack · ${stakeStatus}${contractUrl ? ` · ${contractUrl}` : ''}`);

    // Store both tx links in state
    setState(s => ({
      ...s,
      txHashTransfer: transferTs || transferUrl,
      txHashContract: contractTs || contractUrl,
    }));

    return {
      txHash: contractTs || contractUrl || `hashpack_contract_${Date.now()}`,
      txHashTransfer: transferTs || '',
      txHashContract: contractTs || '',
    };
  }, [hashConnect]);

  // ── MetaMask: EVM flow ─────────────────────────────────────────────────────
  const stakeViaMetaMask = useCallback(async (
    amountMDT: number,
    hederaAccountId: string,
    regFeeRaw: bigint,
  ): Promise<string> => {
    const provider = await getMetaMaskProvider();
    const signer = await provider.getSigner();
    const evmAddress = await signer.getAddress();
    const stakeRaw = BigInt(Math.floor(amountMDT * 1e8));
    const totalRaw = regFeeRaw + stakeRaw;
    const totalMDT = Number(totalRaw) / 1e8;

    // Step 1: HTS cryptoTransfer MDT → vault
    setStep(`Step 1/3: Transferring ${totalMDT.toFixed(4)} MDT to vault (MetaMask)...`);
    const HTS_ABI = [
      'function cryptoTransfer((int64 amount, address accountID, bool isApproval)[] transferList, (address token, (int64 amount, address accountID, bool isApproval)[] transfers, bool deleteSpenderAllowance)[] tokenTransfers) external returns (int64 responseCode)',
    ];
    const hts = new ethers.Contract('0x0000000000000000000000000000000000000167', HTS_ABI, signer);
    try {
      const transferTx = await hts.cryptoTransfer(
        [],
        [{
          token: CONTRACTS.MDT_EVM,
          transfers: [
            { amount: -BigInt(totalRaw), accountID: evmAddress, isApproval: false },
            { amount: BigInt(totalRaw), accountID: CONTRACTS.STAKING_VAULT, isApproval: false },
          ],
          deleteSpenderAllowance: false,
        }],
        { gasLimit: 300000 }
      );
      setStep('Waiting for transfer confirmation...');
      await transferTx.wait();
      setStep('Step 1/3: Transfer OK');
    } catch (transferErr: any) {
      throw new Error(`MDT transfer failed: ${transferErr.reason || transferErr.message}`);
    }

    // Step 2: Backend recordDeposit
    setStep('Step 2/3: Recording deposit on-chain...');
    const depositRes = await fetch('/api/staking/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: hederaAccountId, evmAddress, amount: totalMDT }),
    });
    const depositData = await depositRes.json();
    if (!depositRes.ok) throw new Error(depositData.error || 'recordDeposit failed');
    setStep(`Step 2/3: Deposit recorded — ${depositData.pendingDeposit} MDT credited`);

    // Step 3: User signs stake() via MetaMask
    setStep(`Step 3/3: Staking ${amountMDT} MDT as Miner (MetaMask)...`);
    const vaultSigner = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, signer);
    const stakeTx = await vaultSigner.stake(stakeRaw, StakeRole.Miner, { gasLimit: 500000 });
    setStep('Waiting for stake confirmation...');
    const receipt = await stakeTx.wait();
    return receipt.hash as string;
  }, []);

  /**
   * Full stake flow — routes to MetaMask or HashPack based on connected wallet
   */
  const stakeAsMiner = useCallback(async (amountMDT: number) => {
    setState(s => ({ ...s, loading: true, txHash: null, error: null }));
    try {
      const readProvider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, readProvider);

      setStep('Reading registration fee...');
      const regFeeRaw: bigint = await vault.getCurrentRegFee();
      const regFeeMDT = Number(regFeeRaw) / 1e8;
      setState(s => ({ ...s, regFee: regFeeMDT }));

      // Resolve Hedera accountId
      let hederaAccountId = walletAccountId || '';
      let evmAddress = walletEvm || '';

      if (!hederaAccountId) {
        setStep('Resolving Hedera account...');
        if (walletType === 'metamask') {
          const provider = await getMetaMaskProvider();
          const signer = await provider.getSigner();
          evmAddress = await signer.getAddress();
          const mirrorRes = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${evmAddress}`);
          const mirrorData = await mirrorRes.json();
          hederaAccountId = mirrorData.account || '';
        }
        if (!hederaAccountId) throw new Error('Could not resolve Hedera accountId');
      }

      let txHashResult: string;

      if (walletType === 'hashpack') {
        const result = await stakeViaHashPack(amountMDT, hederaAccountId, evmAddress, regFeeRaw);
        txHashResult = result.txHash;
        setState(s => ({
          ...s,
          txHashTransfer: result.txHashTransfer,
          txHashContract: result.txHashContract,
        }));
      } else {
        txHashResult = await stakeViaMetaMask(amountMDT, hederaAccountId, regFeeRaw);
        // For MetaMask, evmAddress comes from signer
        const provider = await getMetaMaskProvider();
        const signer = await provider.getSigner();
        evmAddress = await signer.getAddress();
      }

      setState(s => ({ ...s, loading: false, txHash: txHashResult, step: `✓ Staked ${amountMDT} MDT as Miner` }));
      await loadStakeInfo(evmAddress);

      // Auto-submit HCS registration
      try {
        setState(s => ({ ...s, step: 'Submitting HCS registration...' }));
        await fetch('/api/hcs/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'miner',
            accountId: hederaAccountId,
            stakeAmount: amountMDT,
            capabilities: ['text_generation'],
            subnetIds: [0],
            skipOnChainStake: true,
          }),
        });
        setState(s => ({ ...s, step: `✓ Staked ${amountMDT} MDT & registered on HCS` }));
      } catch (hcsErr: any) {
        console.warn('HCS auto-register failed (non-fatal):', hcsErr.message);
        setState(s => ({ ...s, step: `✓ Staked ${amountMDT} MDT` }));
      }

      return txHashResult;
    } catch (e: any) {
      setError(e.reason || e.message || 'Stake failed');
      return null;
    }
  }, [walletType, walletAccountId, walletEvm, stakeViaHashPack, stakeViaMetaMask, loadStakeInfo]);

  const registerInSubnet = useCallback(async (subnetId: number) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const provider = await getMetaMaskProvider();
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, signer);
      setStep(`Registering in Subnet ${subnetId}...`);
      const tx = await registry.registerMiner(subnetId);
      setStep('Waiting for confirmation...');
      const receipt = await tx.wait();
      setState(s => ({ ...s, loading: false, txHash: receipt.hash, step: `✓ Registered in Subnet ${subnetId}` }));
      return receipt.hash as string;
    } catch (e: any) {
      setError(e.reason || e.message || 'Register failed');
      return null;
    }
  }, []);

  const claimRewards = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const provider = await getMetaMaskProvider();
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, signer);
      setStep('Claiming rewards...');
      const tx = await vault.claimRewards();
      const receipt = await tx.wait();
      setState(s => ({ ...s, loading: false, txHash: receipt.hash, step: '✓ Rewards claimed' }));
      return receipt.hash as string;
    } catch (e: any) {
      setError(e.reason || e.message || 'Claim failed');
      return null;
    }
  }, []);

  const requestUnstake = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const provider = await getMetaMaskProvider();
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_ABI, signer);
      setStep('Requesting unstake (7-day cooldown)...');
      const tx = await vault.requestUnstake();
      const receipt = await tx.wait();
      setState(s => ({ ...s, loading: false, txHash: receipt.hash, step: '✓ Unstake requested — withdraw in 7 days' }));
      return receipt.hash as string;
    } catch (e: any) {
      setError(e.reason || e.message || 'Unstake failed');
      return null;
    }
  }, []);

  return { ...state, loadStakeInfo, stakeAsMiner, registerInSubnet, claimRewards, requestUnstake };
}
