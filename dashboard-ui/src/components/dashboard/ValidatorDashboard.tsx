"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { AccountId, ContractExecuteTransaction, ContractId, ContractFunctionParameters, Long } from '@hashgraph/sdk';
import { useWallet } from '@/context/WalletContext';
import { CONTRACTS, STAKING_VAULT_VALIDATOR_ABI, SUBNET_REGISTRY_ABI, StakeRole } from '@/lib/contracts';
import { Shield, ExternalLink, RefreshCw, ChevronRight, AlertCircle, CheckCircle, Gift, Unlock, TrendingUp, Star, Gavel, Award, BarChart2, Zap } from 'lucide-react';

function toUTC7(ts: any): string {
  if (!ts) return '—';
  const secs = typeof ts === 'string' ? parseFloat(ts) : Number(ts);
  if (!secs || isNaN(secs)) return '—';
  return new Date(secs * 1000).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

// Hedera txId (0.0.X@secs.nanos) → hashscan.io URL
// transaction/TX_ID or topic/TOPIC_ID/message/SEQUENCE
function hashscanUrl(txId: string, isSequence?: boolean, topicId?: string): string {
  if (!txId || txId === 'submitted' || txId === 'hcs-only' || txId === 'finalized') return '';
  
  if (isSequence && topicId) {
    return `https://hashscan.io/testnet/topic/${topicId}/message/${txId}`;
  }

  const base = 'https://hashscan.io/testnet/transaction/';
  if (txId.includes('@')) {
    const [acc, time] = txId.split('@');
    return base + `${acc}-${time.replace('.', '-')}`;
  }
  return base + txId;
}

function unstakeCountdown(at: number): string {
  const remaining = (at + 7 * 24 * 3600) - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return 'Ready to withdraw';
  const d = Math.floor(remaining / 86400), h = Math.floor((remaining % 86400) / 3600), m = Math.floor((remaining % 3600) / 60);
  return `${d}d ${h}h ${m}m remaining`;
}

// ── Score Submission Panel ────────────────────────────────────────────────────
const METRIC_KEYS = ['relevance', 'quality', 'completeness', 'creativity'] as const;

function ScoreSubmissionPanel({ accountId, evmAddress }: { accountId: string; evmAddress: string }) {
  const { type: walletType, hashConnect } = useWallet();
  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any[]>>({});
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [scores, setScores] = useState<Record<string, string>>({});   // key: `${taskId}_${idx}`
  // metrics: key = `${taskKey}_${idx}_${metricName}`, value = string 0-100
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, { onChainTx: string; hcsTx: string; hcsSeq?: number }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch('/api/hcs/tasks');
      const json = await res.json();
      if (json.success) {
        const all: any[] = json.data || [];
        // API already filters completed/scored tasks — just sort
        const sorted = [...all].sort((a, b) => (b.sequenceNumber ?? 0) - (a.sequenceNumber ?? 0));

        // Fetch on-chain submissions only for tasks that have an onChainTaskId
        const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, provider);
        const subMap: Record<string, any[]> = {};
        await Promise.all(sorted.slice(0, 15).filter(t => t.onChainTaskId != null && t.onChainTaskId !== '').map(async (t) => {
          try {
            const subs = await registry.getSubmissions(t.onChainTaskId);
            subMap[t.onChainTaskId] = subs.map((s: any, i: number) => ({
              index: i,
              miner: s.miner,
              resultHash: s.resultHash,
              score: Number(s.score),
              validated: s.validated,
              submittedAt: Number(s.submittedAt),
              validationCount: Number(s.validationCount),
            }));
          } catch (_) { subMap[t.onChainTaskId] = []; }
        }));
        setSubmissions(subMap);
        setTasks(sorted.slice(0, 15));
      }
    } catch (_) {}
    finally { setLoadingTasks(false); }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const scoreSubmission = async (task: any, subIdx: number) => {
    const taskKey = task.onChainTaskId ?? task.taskId ?? task.hcs_sequence;
    const key = `${taskKey}_${subIdx}`;
    const scoreVal = Number(scores[key] ?? '');
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 10000) {
      setErrors(e => ({ ...e, [key]: 'Score must be 0–10000' })); return;
    }
    // Build metrics object (0-100 scale)
    const metricsObj: Record<string, number> = {};
    for (const mk of METRIC_KEYS) {
      const raw = Number(metrics[`${key}_${mk}`] ?? '');
      if (!isNaN(raw) && raw >= 0 && raw <= 100) metricsObj[mk] = raw;
    }
    const confVal = Math.min(1, Math.max(0, Number(confidence[key] ?? '1') || 1));

    setSubmitting(s => ({ ...s, [key]: true })); setErrors(e => ({ ...e, [key]: '' }));
    try {
      const onChainId = task.onChainTaskId;
      let onChainTx = '';

      // HCS-only task — no on-chain call
      if (!onChainId) {
        const hcsRes = await fetch('/api/hcs/scores/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: task.taskId, validatorId: accountId, minerId: task.requester,
            score: scoreVal / 100, confidence: confVal, metrics: metricsObj,
          }),
        });
        const hcsData = await hcsRes.json();
        setDone(d => ({ ...d, [key]: { onChainTx: 'hcs-only', hcsTx: hcsData.transactionId || '', hcsSeq: hcsData.sequence } }));
        await loadTasks();
        return;
      }

      // On-chain submit
      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, signer);
        const tx = await registry.validateSubmission(onChainId, subIdx, scoreVal, { gasLimit: 300000 });
        const receipt = await tx.wait();
        onChainTx = receipt.hash;
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.SUBNET_REGISTRY_ID);
        const params = new ContractFunctionParameters()
          .addUint256(Long.fromString(String(onChainId)))
          .addUint256(Long.fromNumber(subIdx))
          .addUint256(Long.fromNumber(scoreVal));
        const receipt = await hashConnect.sendTransaction(hederaId,
          new ContractExecuteTransaction().setContractId(contractId).setGas(300000).setFunction('validateSubmission', params));
        onChainTx = String(receipt.transactionId || 'submitted');
      }

      // After on-chain success → submit HCS score_submit message with full metrics
      const minerId = submissions[onChainId]?.[subIdx]?.miner || task.requester || '';
      const hcsRes = await fetch('/api/hcs/scores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: String(task.taskId || onChainId),
          validatorId: accountId,
          minerId,
          score: scoreVal / 100,   // store as 0-100 float
          confidence: confVal,
          metrics: metricsObj,
        }),
      });
      const hcsData = await hcsRes.json();
      setDone(d => ({ ...d, [key]: { onChainTx, hcsTx: hcsData.transactionId || '', hcsSeq: hcsData.sequence } }));
      await loadTasks();
    } catch (e: any) { setErrors(er => ({ ...er, [key]: e.reason || e.message || 'Failed' })); }
    finally { setSubmitting(s => ({ ...s, [key]: false })); }
  };

  const finalizeTask = async (task: any) => {
    const key = `finalize_${task.onChainTaskId ?? task.taskId}`;
    setSubmitting(s => ({ ...s, [key]: true })); setErrors(e => ({ ...e, [key]: '' }));
    try {
      if (!task.onChainTaskId) {
        setDone(d => ({ ...d, [key]: { onChainTx: 'hcs-only', hcsTx: '' } }));
        setSubmitting(s => ({ ...s, [key]: false }));
        return;
      }
      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, signer);
        const tx = await registry.finalizeTask(task.onChainTaskId, { gasLimit: 400000 });
        const receipt = await tx.wait();
        setDone(d => ({ ...d, [key]: { onChainTx: receipt.hash, hcsTx: '' } }));
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.SUBNET_REGISTRY_ID);
        const params = new ContractFunctionParameters().addUint256(Long.fromString(String(task.onChainTaskId)));
        const receipt = await hashConnect.sendTransaction(hederaId,
          new ContractExecuteTransaction().setContractId(contractId).setGas(400000).setFunction('finalizeTask', params));
        setDone(d => ({ ...d, [key]: { onChainTx: String(receipt.transactionId || 'finalized'), hcsTx: '' } }));
      }
      await loadTasks();
    } catch (e: any) { setErrors(er => ({ ...er, [key]: e.reason || e.message || 'Finalize failed' })); }
    finally { setSubmitting(s => ({ ...s, [key]: false })); }
  };

  return (
    <div className="glass-panel rounded-2xl border border-neon-cyan/20 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center"><Star size={14} className="text-neon-cyan" /></div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Score Submissions</div>
            <div className="text-[9px] text-slate-500 font-mono">SubnetRegistryV2.validateSubmission(taskId, idx, score 0–10000)</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-neon-cyan border border-neon-cyan/30 bg-neon-cyan/5 px-2 py-1 rounded-full uppercase tracking-widest">{tasks.length} tasks</span>
          <button onClick={loadTasks} className="text-slate-600 hover:text-neon-cyan transition-colors"><RefreshCw size={12} /></button>
        </div>
      </div>

      <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
        {loadingTasks ? (
          <div className="py-8 text-center text-slate-600 text-xs font-mono">Loading tasks from HCS + contract...</div>
        ) : tasks.length === 0 ? (
          <div className="py-10 text-center">
            <Star size={24} className="text-slate-700 mx-auto mb-2" />
            <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No on-chain tasks yet</div>
            <div className="text-slate-700 text-[10px] mt-1">Tasks created via createTask() will appear here</div>
          </div>
        ) : tasks.map((task, ti) => {
          const onChainId = task.onChainTaskId ?? null;
          const taskKey = onChainId ?? task.taskId ?? String(task.sequenceNumber ?? ti);
          const subs = onChainId ? (submissions[onChainId] || []) : [];
          const finalizeKey = `finalize_${taskKey}`;
          const hasScoredSubs = subs.some(s => s.validated);
          const isHcsOnly = !onChainId;
          return (
            <div key={ti} className="px-5 py-4 space-y-3">
              {/* Task header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black text-neon-cyan border border-neon-cyan/30 bg-neon-cyan/5 px-2 py-0.5 rounded uppercase tracking-widest">{task.taskType || 'TASK'}</span>
                    <span className="text-[9px] text-slate-600 font-mono">Subnet {task.subnetId ?? 0}</span>
                    {onChainId
                      ? <span className="text-[9px] text-neon-purple font-mono">On-chain #{onChainId}</span>
                      : <span className="text-[9px] text-yellow-400/70 font-mono border border-yellow-400/20 px-1.5 py-0.5 rounded">HCS-only</span>
                    }
                    {task.sequenceNumber && <span className="text-[9px] text-slate-600 font-mono">Seq #{task.sequenceNumber}</span>}
                  </div>
                  <div className="text-xs text-slate-300 line-clamp-1 font-mono">{task.prompt || task.taskHash || task.taskId}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-neon-green font-black text-sm">{Number(task.rewardAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} MDT</div>
                  <div className="text-[9px] text-slate-500">{isHcsOnly ? 'HCS payment' : `${subs.length} submission${subs.length !== 1 ? 's' : ''}`}</div>
                </div>
              </div>

              {/* HCS-only tasks: show score input directly (no on-chain submissions to list) */}
              {isHcsOnly ? (() => {
                const key = `${taskKey}_0`;
                const doneEntry = done[key];
                return doneEntry ? (
                  <div className="space-y-1 pl-2">
                    <div className="flex items-center gap-2 text-neon-green text-[10px] font-bold">
                      <CheckCircle size={10} /> Score recorded via HCS
                    </div>
                    {doneEntry.hcsTx && hashscanUrl(doneEntry.hcsTx) && (
                      <a href={hashscanUrl(doneEntry.hcsTx)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neon-cyan text-[10px] hover:underline ml-4">
                        <ExternalLink size={9} /> HCS Score Message
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pl-2">
                    {/* Metric inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      {METRIC_KEYS.map(mk => (
                        <div key={mk}>
                          <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1 capitalize">{mk} (0-100)</label>
                          <input type="number" min="0" max="100" placeholder="0-100" value={metrics[`${key}_${mk}`] || ''}
                            onChange={e => setMetrics(m => ({ ...m, [`${key}_${mk}`]: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white font-mono text-xs focus:border-neon-cyan/40 outline-none" />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1">Overall Score (0–10000)</label>
                        <input type="number" min="0" max="10000" placeholder="0–10000" value={scores[key] || ''}
                          onChange={e => setScores(sc => ({ ...sc, [key]: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-neon-cyan/40 outline-none" />
                      </div>
                      <div className="w-24">
                        <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1">Confidence</label>
                        <input type="number" min="0" max="1" step="0.01" placeholder="0-1" value={confidence[key] || ''}
                          onChange={e => setConfidence(c => ({ ...c, [key]: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-white font-mono text-xs focus:border-neon-cyan/40 outline-none" />
                      </div>
                      <button onClick={() => scoreSubmission(task, 0)} disabled={submitting[key]}
                        className="self-end px-4 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-black text-[10px] uppercase tracking-widest rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
                        <Star size={10} /> {submitting[key] ? 'Scoring...' : 'Score (HCS)'}
                      </button>
                    </div>
                    {errors[key] && <div className="text-[10px] text-red-400 font-mono">✗ {errors[key]}</div>}
                  </div>
                );
              })() : null}

              {/* On-chain submissions */}
              {!isHcsOnly && (subs.length === 0 ? (
                <div className="text-[10px] text-slate-600 font-mono pl-2">No submissions yet</div>
              ) : subs.map((sub, si) => {
                const key = `${onChainId}_${si}`;
                const doneEntry = done[key];
                return (
                  <div key={si} className={`p-3 rounded-xl border space-y-2 ${sub.validated ? 'bg-neon-green/5 border-neon-green/20' : 'bg-white/[0.02] border-white/10'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[9px] text-slate-500 font-mono">Miner: {sub.miner.slice(0, 10)}...{sub.miner.slice(-6)}</div>
                        <div className="text-[9px] text-slate-600 font-mono mt-0.5">Hash: {sub.resultHash.slice(0, 20)}... · {sub.validationCount} validations</div>
                      </div>
                      {sub.validated && (
                        <div className="text-right">
                          <div className="text-neon-green font-black text-sm">{(sub.score / 100).toFixed(0)}%</div>
                          <div className="text-[9px] text-neon-green">Consensus</div>
                        </div>
                      )}
                    </div>
                    {!sub.validated && (
                      doneEntry ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-neon-green text-[10px] font-bold">
                            <CheckCircle size={10} /> Scored
                            {doneEntry.onChainTx && hashscanUrl(doneEntry.onChainTx) && (
                              <a href={hashscanUrl(doneEntry.onChainTx)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-neon-cyan hover:underline ml-1">
                                <ExternalLink size={9} /> On-chain TX
                              </a>
                            )}
                          </div>
                          {doneEntry.hcsTx && hashscanUrl(doneEntry.hcsTx) && (
                            <a href={hashscanUrl(doneEntry.hcsTx)} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-neon-purple text-[10px] hover:underline ml-4">
                              <ExternalLink size={9} /> HCS Score Message
                              {doneEntry.hcsSeq && <span className="text-slate-500 ml-1">Seq #{doneEntry.hcsSeq}</span>}
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Metric inputs */}
                          <div className="grid grid-cols-2 gap-2">
                            {METRIC_KEYS.map(mk => (
                              <div key={mk}>
                                <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1 capitalize">{mk} (0-100)</label>
                                <input type="number" min="0" max="100" placeholder="0-100" value={metrics[`${key}_${mk}`] || ''}
                                  onChange={e => setMetrics(m => ({ ...m, [`${key}_${mk}`]: e.target.value }))}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white font-mono text-xs focus:border-neon-cyan/40 outline-none" />
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1">Overall Score (0–10000)</label>
                              <input type="number" min="0" max="10000" placeholder="0–10000" value={scores[key] || ''}
                                onChange={e => setScores(sc => ({ ...sc, [key]: e.target.value }))}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-neon-cyan/40 outline-none" />
                            </div>
                            <div className="w-24">
                              <label className="text-[9px] text-slate-500 uppercase tracking-widest block mb-1">Confidence</label>
                              <input type="number" min="0" max="1" step="0.01" placeholder="0-1" value={confidence[key] || ''}
                                onChange={e => setConfidence(c => ({ ...c, [key]: e.target.value }))}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-white font-mono text-xs focus:border-neon-cyan/40 outline-none" />
                            </div>
                            <button onClick={() => scoreSubmission(task, si)} disabled={submitting[key]}
                              className="self-end px-4 py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-black text-[10px] uppercase tracking-widest rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
                              <Star size={10} /> {submitting[key] ? 'Scoring...' : 'Score'}
                            </button>
                          </div>
                        </div>
                      )
                    )}
                    {errors[key] && <div className="text-[10px] text-red-400 font-mono">✗ {errors[key]}</div>}
                  </div>
                );
              }))}

              {/* Finalize button — shown when at least one submission has consensus */}
              {hasScoredSubs && (
                <div className="pt-1">
                  {done[finalizeKey] ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-neon-green text-[10px] font-bold">
                        <Gavel size={10} /> Task Finalized
                        {done[finalizeKey].onChainTx && hashscanUrl(done[finalizeKey].onChainTx) && (
                          <a href={hashscanUrl(done[finalizeKey].onChainTx)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-neon-cyan hover:underline ml-1">
                            <ExternalLink size={9} /> HashScan
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => finalizeTask(task)} disabled={submitting[finalizeKey]}
                      className="w-full py-2 bg-neon-purple/10 hover:bg-neon-purple/20 border border-neon-purple/40 text-neon-purple font-black text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                      <Gavel size={10} /> {submitting[finalizeKey] ? 'Finalizing...' : 'Finalize Task & Distribute Rewards'}
                    </button>
                  )}
                  {errors[finalizeKey] && <div className="text-[10px] text-red-400 font-mono mt-1">✗ {errors[finalizeKey]}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-white/5 bg-black/20 text-[10px] text-slate-600 font-mono">
        Score 0–10000 · 10000 = perfect · Consensus reached after min validators score · finalizeTask() distributes rewards
      </div>
    </div>
  );
}

// ── Validator Reputation Panel ────────────────────────────────────────────────
function ValidatorReputationPanel({ evmAddress }: { evmAddress: string }) {
  const [rep, setRep] = useState<{
    totalValidations: number;
    accurateValidations: number;
    reputationScore: number; // basis points 0-10000
    lastActiveAt: number;
    totalEarnings: number;
    pendingWithdrawal: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!evmAddress) return;
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, provider);
      const [totalV, accurateV, repScore, lastActive, earnings, pending] = await Promise.all([
        registry.getValidatorReputation(evmAddress).then((r: any) => [
          Number(r.totalValidations),
          Number(r.accurateValidations),
          Number(r.reputationScore),
          Number(r.lastActiveAt),
        ]),
        registry.validatorEarnings(evmAddress).then(Number),
        registry.pendingWithdrawals(evmAddress).then(Number),
      ]);
      const [tv, av, rs, la] = totalV as number[];
      setRep({
        totalValidations: tv,
        accurateValidations: av,
        reputationScore: rs,
        lastActiveAt: la,
        totalEarnings: earnings / 1e8,
        pendingWithdrawal: pending / 1e8,
      });
    } catch (_) {}
    finally { setLoading(false); }
  }, [evmAddress]);

  useEffect(() => { load(); }, [load]);

  const repPct = rep ? (rep.reputationScore / 100).toFixed(1) : '—';
  const repColor = rep
    ? rep.reputationScore >= 8000 ? 'text-neon-green' : rep.reputationScore >= 5000 ? 'text-neon-cyan' : 'text-yellow-400'
    : 'text-slate-500';
  const repBarColor = rep
    ? rep.reputationScore >= 8000 ? 'bg-neon-green' : rep.reputationScore >= 5000 ? 'bg-neon-cyan' : 'bg-yellow-400'
    : 'bg-slate-600';

  return (
    <div className="glass-panel rounded-2xl border border-neon-purple/30 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
            <Award size={14} className="text-neon-purple" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">On-Chain Reputation</div>
            <div className="text-[9px] text-slate-500 font-mono">SubnetRegistryV2.getValidatorReputation()</div>
          </div>
        </div>
        <button onClick={load} className="text-slate-600 hover:text-neon-cyan transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          <div className="text-center text-slate-600 text-xs font-mono py-4">Loading from chain...</div>
        ) : (
          <>
            {/* Reputation score bar */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Reputation Score</span>
                <span className={`text-2xl font-black font-mono ${repColor}`}>{repPct}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${repBarColor}`}
                  style={{ width: `${rep ? rep.reputationScore / 100 : 0}%` }} />
              </div>
              <div className="text-[9px] text-slate-600 font-mono">
                {rep?.reputationScore === 0 && rep?.totalValidations === 0
                  ? 'No validations yet — score starts at 50% after first validation'
                  : rep?.reputationScore === 5000 && rep?.totalValidations === 0
                  ? 'Neutral starting score — validate tasks to build reputation'
                  : `${rep?.accurateValidations} / ${rep?.totalValidations} accurate (within 20% of median)`}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Validations', val: rep?.totalValidations ?? 0, color: 'text-neon-cyan' },
                { label: 'Accurate', val: rep?.accurateValidations ?? 0, color: 'text-neon-green' },
                { label: 'Total Earned', val: `${(rep?.totalEarnings ?? 0).toFixed(4)} MDT`, color: 'text-neon-yellow' },
                { label: 'Pending Withdrawal', val: `${(rep?.pendingWithdrawal ?? 0).toFixed(4)} MDT`, color: 'text-neon-pink' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-black/30 border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">{s.label}</div>
                  <div className={`font-black text-sm ${s.color}`}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* How reputation works */}
            <div className="p-3 bg-neon-purple/5 border border-neon-purple/20 rounded-xl space-y-1.5">
              <div className="text-[9px] text-neon-purple font-black uppercase tracking-widest flex items-center gap-1.5">
                <BarChart2 size={9} /> How Rewards Are Weighted
              </div>
              <div className="text-[9px] text-slate-400 space-y-0.5 font-mono">
                <div>share = <span className="text-white">deviation_weight</span> × <span className="text-neon-cyan">reputation</span> × <span className="text-neon-green">stake_amount</span></div>
                <div className="text-slate-500 mt-1">· Score within 20% of median → weight 100 (accurate)</div>
                <div className="text-slate-500">· Score within 50% of median → weight 50 (partial)</div>
                <div className="text-slate-500">· Score outside 50% → weight 0 (penalized)</div>
              </div>
            </div>

            {rep?.lastActiveAt && rep.lastActiveAt > 0 && (
              <div className="text-[9px] text-slate-600 font-mono">
                Last active: {toUTC7(rep.lastActiveAt)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Completed Tasks Panel (Miner weight/score results) ────────────────────────
function CompletedTasksPanel({ evmAddress }: { evmAddress: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hcs/tasks');
      const json = await res.json();
      if (!json.success) return;
      const all: any[] = json.data || [];
      // Only tasks with onChainTaskId — fetch their on-chain status
      const withId = all.filter(t => t.onChainTaskId != null && t.onChainTaskId !== '');
      if (withId.length === 0) { setTasks([]); return; }

      const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, provider);

      const enriched = await Promise.all(withId.slice(0, 10).map(async (t) => {
        try {
          const task = await registry.getTask(t.onChainTaskId);
          return {
            ...t,
            status: Number(task.status),
            winningMiner: task.winningMiner,
            winningScore: Number(task.winningScore),
            rewardAmount: Number(task.rewardAmount) / 1e8,
            deadline: Number(task.deadline),
          };
        } catch (_) { return t; }
      }));
      setTasks(enriched);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const STATUS_LABELS = ['Created', 'In Progress', 'Pending Review', 'Completed', 'Cancelled', 'Expired'];
  const STATUS_COLORS = ['text-slate-400', 'text-neon-cyan', 'text-yellow-400', 'text-neon-green', 'text-red-400', 'text-slate-600'];

  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
            <Zap size={14} className="text-neon-green" />
          </div>
          <div>
            <div className="text-sm font-black text-white uppercase tracking-wider">Task Results</div>
            <div className="text-[9px] text-slate-500 font-mono">On-chain status · winner · score</div>
          </div>
        </div>
        <button onClick={load} className="text-slate-600 hover:text-neon-cyan transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-slate-600 text-xs font-mono">Loading task results...</div>
        ) : tasks.length === 0 ? (
          <div className="py-10 text-center">
            <Zap size={24} className="text-slate-700 mx-auto mb-2" />
            <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No on-chain tasks yet</div>
          </div>
        ) : tasks.map((t, i) => {
          const statusLabel = STATUS_LABELS[t.status ?? 0] ?? 'Unknown';
          const statusColor = STATUS_COLORS[t.status ?? 0] ?? 'text-slate-400';
          const isCompleted = t.status === 3;
          const scorePct = isCompleted && t.winningScore ? (t.winningScore / 100).toFixed(0) : null;
          return (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isCompleted ? 'text-neon-green border-neon-green/30 bg-neon-green/5' : 'text-slate-400 border-white/10 bg-white/[0.02]'}`}>
                      {statusLabel}
                    </span>
                    <span className="text-[9px] text-neon-purple font-mono">#{t.onChainTaskId}</span>
                    <span className="text-[9px] text-slate-600 font-mono">Subnet {t.subnetId ?? 0}</span>
                  </div>
                  <div className="text-xs text-slate-300 line-clamp-1 font-mono">{t.prompt || t.taskHash || t.taskId}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-neon-green font-black text-sm">{(t.rewardAmount ?? 0).toLocaleString()} MDT</div>
                  {scorePct && <div className="text-[9px] text-neon-cyan font-mono">Score: {scorePct}%</div>}
                </div>
              </div>
              {isCompleted && t.winningMiner && t.winningMiner !== '0x0000000000000000000000000000000000000000' && (
                <div className="flex flex-col gap-2 p-3 bg-neon-green/5 rounded-xl border border-neon-green/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[9px] font-mono">
                      <CheckCircle size={9} className="text-neon-green flex-shrink-0" />
                      <span className="text-slate-400">Winner:</span>
                      <span className="text-white">{t.winningMiner.slice(0, 10)}...{t.winningMiner.slice(-6)}</span>
                    </div>
                    <div className="text-[10px] font-black text-neon-green uppercase tracking-widest">
                      Final Score: {scorePct}%
                    </div>
                  </div>
                  
                  {/* HCS Verification Proof Link */}
                  <div className="flex items-center gap-3 pt-1 border-t border-white/5">
                    {t.hcs_sequence && (
                      <a href={hashscanUrl(t.hcs_sequence, true, '0.0.8198584')} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neon-cyan text-[9px] font-bold hover:underline">
                        <ExternalLink size={9} /> HCS Score Proof
                      </a>
                    )}
                    {t.hcs_transaction_id && (
                      <a href={hashscanUrl(t.hcs_transaction_id)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neon-purple text-[9px] font-bold hover:underline">
                        <Shield size={9} /> Verify Result TX
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-white/5 bg-black/20 text-[9px] text-slate-600 font-mono">
        Score = median of validator scores · Rewards auto-distributed on finalizeTask()
      </div>
    </div>
  );
}

interface Props { onBack: () => void; }

export default function ValidatorDashboard({ onBack }: Props) {
  const { accountId, isConnected, address: evmAddress, type: walletType, hashConnect } = useWallet();
  const [stakeInfo, setStakeInfo] = useState<any>(null);
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [myReg, setMyReg] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txStep, setTxStep] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [, tick] = useState(0);

  const loadData = useCallback(async () => {
    if (!accountId || !evmAddress) return;
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACTS.HEDERA_RPC);
      const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_VALIDATOR_ABI, provider);
      const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, provider);
      const [info, earnings] = await Promise.all([vault.getStakeInfo(evmAddress), registry.pendingWithdrawals(evmAddress)]);
      setStakeInfo({ amount: Number(info.amount) / 1e8, role: Number(info.role), stakedAt: Number(info.stakedAt), unstakeRequestedAt: Number(info.unstakeRequestedAt), isActive: info.isActive });
      setPendingEarnings(Number(earnings) / 1e8);
      const minRes = await fetch('/api/hcs/miners');
      const minData = await minRes.json();
      if (minData.success) {
        const mine = (minData.data || []).filter((m: any) => (m.miner_id === accountId || m.account_id === accountId) && m.role === 'validator').sort((a: any, b: any) => (b.hcs_sequence ?? 0) - (a.hcs_sequence ?? 0));
        if (mine.length > 0) setMyReg(mine[0]);
      }
      const scRes = await fetch('/api/hcs/scores');
      const scData = await scRes.json();
      if (scData.success) setScores((scData.data || []).filter((s: any) => s.validatorId === accountId || s.validator_id === accountId));
    } catch (e: any) { console.warn('ValidatorDashboard:', e.message); }
    finally { setLoading(false); }
  }, [accountId, evmAddress]);

  useEffect(() => { loadData(); const t = setInterval(loadData, 30000); return () => clearInterval(t); }, [loadData]);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(t); }, []);

  const withdrawEarnings = async () => {
    setTxStep('Withdrawing earnings...'); setTxError(null); setTxHash(null);
    try {
      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const registry = new ethers.Contract(CONTRACTS.SUBNET_REGISTRY, SUBNET_REGISTRY_ABI, signer);
        const tx = await registry.withdrawEarnings({ gasLimit: 200000 });
        const receipt = await tx.wait();
        setTxHash(receipt.hash); setTxStep(`✓ Withdrawn ${pendingEarnings.toFixed(4)} MDT`); setPendingEarnings(0);
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.SUBNET_REGISTRY_ID);
        const receipt = await hashConnect.sendTransaction(hederaId, new ContractExecuteTransaction().setContractId(contractId).setGas(200000).setFunction('withdrawEarnings'));
        setTxHash(String(receipt.transactionId || '')); setTxStep(`✓ Withdrawn ${pendingEarnings.toFixed(4)} MDT`); setPendingEarnings(0);
      }
      await loadData();
    } catch (e: any) { setTxError(e.message); setTxStep(null); }
  };

  const requestUnstake = async () => {
    setTxStep('Requesting unstake...'); setTxError(null);
    try {
      if (walletType === 'metamask') {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const vault = new ethers.Contract(CONTRACTS.STAKING_VAULT, STAKING_VAULT_VALIDATOR_ABI, signer);
        const tx = await vault.requestUnstake({ gasLimit: 200000 });
        const receipt = await tx.wait();
        setTxHash(receipt.hash); setTxStep('✓ Unstake requested — 7-day cooldown');
      } else if (walletType === 'hashpack' && hashConnect && accountId) {
        const hederaId = AccountId.fromString(accountId);
        const contractId = ContractId.fromString(CONTRACTS.STAKING_VAULT_ID);
        await hashConnect.sendTransaction(hederaId, new ContractExecuteTransaction().setContractId(contractId).setGas(200000).setFunction('requestUnstake'));
        setTxStep('✓ Unstake requested — 7-day cooldown');
      }
      await loadData();
    } catch (e: any) { setTxError(e.message); setTxStep(null); }
  };

  if (!isConnected || !accountId) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="text-center space-y-3">
          <Shield size={40} className="text-slate-700 mx-auto" />
          <div className="text-slate-500 font-bold uppercase tracking-widest text-sm">Connect wallet to view validator dashboard</div>
        </div>
      </div>
    );
  }

  const isStaked = stakeInfo?.isActive && stakeInfo?.role === StakeRole.Validator;
  const hasUnstake = stakeInfo && stakeInfo.unstakeRequestedAt > 0;
  const COOLDOWN = 7 * 24 * 3600;
  const canWithdrawStake = hasUnstake && Math.floor(Date.now() / 1000) >= stakeInfo.unstakeRequestedAt + COOLDOWN;
  // Normalize scores to 0-100 scale (HCS scores from Python SDK are 0-100, not 0-1)
  const avgScore = scores.length > 0
    ? scores.reduce((a: number, s: any) => {
        const raw = Number(s.score ?? 0);
        return a + (raw > 1 ? raw : raw * 100);
      }, 0) / scores.length
    : null;

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 w-full animate-fade-in-up">
      <div className="w-full max-w-[1400px] flex flex-col gap-8">
        <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-500 uppercase">
          <button className="hover:text-neon-purple transition-colors" onClick={onBack}>HOME</button>
          <ChevronRight size={12} />
          <span className="text-neon-purple">VALIDATOR DASHBOARD</span>
        </div>
        <div className="flex flex-wrap justify-between items-start gap-6 pb-6 border-b border-white/5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-neon-purple">verified</span>
              </div>
              <div>
                <h1 className="text-3xl font-black text-white uppercase tracking-tighter font-display">Validator <span className="text-neon-purple">Dashboard</span></h1>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{accountId}</div>
              </div>
            </div>
            {isStaked ? (
              <div className="flex items-center gap-2 text-[10px] font-bold text-neon-green"><CheckCircle size={12} /><span>On-chain staked · {stakeInfo.amount.toLocaleString()} MDT · Validator</span></div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] font-bold text-yellow-400"><AlertCircle size={12} /><span>Pending subnet owner approval</span></div>
            )}
          </div>
          <button onClick={() => { setLoading(true); loadData(); }} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-all">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Staked', val: stakeInfo ? `${stakeInfo.amount.toLocaleString()} MDT` : '—', icon: 'lock', color: 'text-neon-purple', sub: isStaked ? 'Active · Validator' : 'Pending approval' },
            { label: 'Pending Earnings', val: pendingEarnings > 0 ? `${pendingEarnings.toFixed(4)} MDT` : '—', icon: 'payments', color: 'text-neon-green', sub: '8% of task rewards' },
            { label: 'Avg Accuracy', val: avgScore !== null ? `${avgScore.toFixed(1)}%` : '—', icon: 'verified', color: 'text-neon-cyan', sub: `${scores.length} validations` },
            { label: 'HCS Registered', val: myReg ? `Seq #${myReg.hcs_sequence}` : '—', icon: 'hub', color: 'text-neon-pink', sub: myReg ? toUTC7(myReg.consensusTimestamp) : 'Not registered' },
          ].map((s, i) => (
            <div key={i} className="glass-panel p-5 rounded-xl border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">{s.label}</span>
                <span className={`material-symbols-outlined text-lg opacity-30 ${s.color}`}>{s.icon}</span>
              </div>
              <div className="font-black font-display text-xl text-white tracking-tight">{s.val}</div>
              <div className="text-[9px] text-slate-600 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 flex flex-col gap-6">
            <ScoreSubmissionPanel accountId={accountId} evmAddress={evmAddress || ''} />
            <CompletedTasksPanel evmAddress={evmAddress || ''} />
            {!isStaked && stakeInfo && (
              <div className="glass-panel p-5 border border-yellow-400/30 space-y-2">
                <div className="flex items-center gap-2 text-yellow-400 font-black text-sm uppercase tracking-widest"><AlertCircle size={16} />Pending Subnet Owner Approval</div>
                <div className="text-[11px] text-slate-400 leading-relaxed">You have staked MDT but are not yet activated. A subnet owner must call <code className="text-white">addValidator(subnetId, {evmAddress})</code> on SubnetRegistryV2.</div>
                <div className="text-[10px] text-slate-500 font-mono">Your EVM address: <span className="text-white">{evmAddress}</span></div>
              </div>
            )}
            <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center"><TrendingUp size={14} className="text-neon-cyan" /></div>
                  <div>
                    <div className="text-sm font-black text-white uppercase tracking-wider">Validation History</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest">HCS Topic 0.0.8198584</div>
                  </div>
                </div>
                {avgScore !== null && <div className="text-right"><div className="text-neon-cyan font-black text-lg">{avgScore.toFixed(1)}%</div><div className="text-[9px] text-slate-500 uppercase tracking-widest">Avg Accuracy</div></div>}
              </div>
              <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                {loading ? <div className="py-8 text-center text-slate-600 text-xs font-mono">Loading...</div>
                  : scores.length === 0 ? (
                    <div className="py-10 text-center">
                      <TrendingUp size={24} className="text-slate-700 mx-auto mb-2" />
                      <div className="text-slate-600 text-xs font-bold uppercase tracking-widest">No validations yet</div>
                    </div>
                  ) : scores.map((s: any, i: number) => {
                    const raw = Number(s.score ?? 0);
                    // Normalize: HCS scores can be 0-100 (Python) or 0-1
                    const score100 = raw > 1 ? raw : raw * 100;
                    const sc = score100 >= 80 ? 'text-neon-green' : score100 >= 60 ? 'text-neon-cyan' : 'text-yellow-400';
                    const barColor = score100 >= 80 ? 'bg-neon-green' : score100 >= 60 ? 'bg-neon-cyan' : 'bg-yellow-400';
                    const metrics = s.metrics ?? {};
                    return (
                      <div key={i} className="px-6 py-3 space-y-2 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-mono text-white">Task: {String(s.taskId || '').substring(0, 20)}...</div>
                            <div className="text-[9px] text-slate-600 mt-0.5">
                              Miner: {s.minerId || s.miner_id || '—'}
                              {s.confidence != null && <span className="ml-2">· conf {(Number(s.confidence) * 100).toFixed(0)}%</span>}
                              {s.consensusTimestamp && <span className="ml-2">· {toUTC7(s.consensusTimestamp)}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-black text-lg ${sc}`}>{score100.toFixed(1)}%</div>
                            {s.consensusTimestamp && (
                              <a href={`https://hashscan.io/testnet/transaction/${s.consensusTimestamp}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-neon-cyan/60 hover:text-neon-cyan text-[9px] justify-end mt-0.5">
                                <ExternalLink size={8} /> HCS
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score100}%` }} />
                        </div>
                        {Object.keys(metrics).length > 0 && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                            {Object.entries(metrics).map(([k, v]) => {
                              const vp = Number(v ?? 0); const vPct = vp > 1 ? vp : vp * 100;
                              return (
                                <div key={k} className="flex items-center justify-between">
                                  <span className="text-[9px] text-slate-600 capitalize">{k}</span>
                                  <span className="text-[9px] text-slate-400 font-mono">{vPct.toFixed(0)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <ValidatorReputationPanel evmAddress={evmAddress || ''} />
            <div className="glass-panel rounded-2xl border border-neon-green/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center"><Gift size={14} className="text-neon-green" /></div>
                <div><div className="text-sm font-black text-white uppercase tracking-wider">Earnings</div><div className="text-[9px] text-slate-500 font-mono">SubnetRegistryV2.pendingWithdrawals</div></div>
              </div>
              <div className="p-5 space-y-4">
                <div className={`p-4 rounded-xl border ${pendingEarnings > 0 ? 'bg-neon-green/5 border-neon-green/20' : 'bg-white/[0.02] border-white/10'}`}>
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Pending Withdrawal</div>
                  <div className={`text-2xl font-black font-mono ${pendingEarnings > 0 ? 'text-neon-green' : 'text-slate-600'}`}>{pendingEarnings.toFixed(4)} MDT</div>
                  <div className="text-[9px] text-slate-600 mt-1">8% of finalized task rewards</div>
                </div>
                {pendingEarnings > 0 && (
                  <button onClick={withdrawEarnings} disabled={!!txStep && !txStep.startsWith('✓')}
                    className="w-full py-3 bg-neon-green/10 hover:bg-neon-green/20 border border-neon-green/40 text-neon-green font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    <Gift size={12} /> Withdraw {pendingEarnings.toFixed(4)} MDT
                  </button>
                )}
                {txStep && <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl text-[10px] font-mono text-neon-cyan">{txStep}</div>}
                {txError && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-mono text-red-400">✗ {txError}</div>}
                {txHash && hashscanUrl(txHash) && <a href={hashscanUrl(txHash)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-neon-cyan text-[10px] font-bold hover:underline"><ExternalLink size={10} /> View TX on HashScan</a>}
              </div>
            </div>
            <div className="glass-panel rounded-2xl border border-neon-purple/30 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center"><Shield size={14} className="text-neon-purple" /></div>
                <div><div className="text-sm font-black text-white uppercase tracking-wider">Stake Status</div><div className="text-[9px] text-slate-500 font-mono">StakingVaultV2</div></div>
              </div>
              <div className="p-5 space-y-3">
                {stakeInfo ? (
                  <>
                    <div className={`p-4 rounded-xl border space-y-2 ${isStaked ? 'bg-neon-green/5 border-neon-green/20' : hasUnstake ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-white/[0.02] border-white/10'}`}>
                      <div className="flex justify-between"><span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Status</span><span className={`text-xs font-black ${isStaked ? 'text-neon-green' : hasUnstake ? 'text-yellow-400' : 'text-slate-500'}`}>{isStaked ? 'ACTIVE · VALIDATOR' : hasUnstake ? 'UNSTAKING' : 'INACTIVE'}</span></div>
                      <div className="flex justify-between"><span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Amount</span><span className="text-white font-black">{stakeInfo.amount.toLocaleString()} MDT</span></div>
                      {stakeInfo.stakedAt > 0 && <div className="flex justify-between"><span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Since</span><span className="text-slate-300 text-[10px] font-mono">{toUTC7(stakeInfo.stakedAt)}</span></div>}
                      {hasUnstake && (
                        <div className="mt-2 p-2 bg-yellow-400/10 rounded-lg border border-yellow-400/20">
                          <div className="flex justify-between items-center"><span className="text-[9px] text-yellow-400 uppercase tracking-widest font-bold">Unlock In</span><span className={`text-[10px] font-black ${canWithdrawStake ? 'text-neon-green' : 'text-yellow-400'}`}>{unstakeCountdown(stakeInfo.unstakeRequestedAt)}</span></div>
                          {!canWithdrawStake && (() => { const pct = Math.min(100, Math.max(0, ((Math.floor(Date.now() / 1000) - stakeInfo.unstakeRequestedAt) / COOLDOWN) * 100)); return <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-2"><div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} /></div>; })()}
                        </div>
                      )}
                    </div>
                    {isStaked && !hasUnstake && (
                      <button onClick={requestUnstake} disabled={!!txStep && !txStep.startsWith('✓')}
                        className="w-full py-2 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 text-red-400/60 hover:text-red-400 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                        <Unlock size={10} /> Request Unstake (7-day cooldown)
                      </button>
                    )}
                  </>
                ) : <div className="text-slate-600 text-xs font-mono text-center py-4">Loading...</div>}
              </div>
            </div>
            <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-3">
              <div className="text-sm font-black text-white uppercase tracking-wider">Validator Flow</div>
              {[
                { n: '1', label: 'Stake MDT', desc: 'StakingVaultV2.stake(500+ MDT, Validator)', done: !!stakeInfo?.isActive },
                { n: '2', label: 'Await Approval', desc: 'Subnet owner calls addValidator(subnetId, you)', done: isStaked },
                { n: '3', label: 'Score Submissions', desc: 'SubnetRegistryV2.validateSubmission(taskId, idx, score)', done: scores.length > 0 },
                { n: '4', label: 'Earn Rewards', desc: '8% of task reward, weighted by reputation', done: pendingEarnings > 0 },
                { n: '5', label: 'Withdraw', desc: 'SubnetRegistryV2.withdrawEarnings()', done: false },
              ].map((s) => (
                <div key={s.n} className={`flex items-start gap-3 p-3 rounded-xl border ${s.done ? 'bg-neon-green/5 border-neon-green/20' : 'bg-white/[0.02] border-white/5'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black ${s.done ? 'bg-neon-green/20 text-neon-green border border-neon-green/40' : 'bg-neon-purple/10 text-neon-purple border border-neon-purple/30'}`}>{s.done ? '✓' : s.n}</div>
                  <div><div className="text-[11px] font-bold text-white">{s.label}</div><div className="text-[9px] text-slate-600 font-mono mt-0.5">{s.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}