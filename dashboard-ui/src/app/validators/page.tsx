'use client';

import { useValidators } from '@/lib/hooks/useProtocolData';
import { stakeValidator } from '@/lib/hooks/useProtocolData';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import ValidatorVerifyModal from '@/components/ui-custom/ValidatorVerifyModal';
import { Shield, Search, ArrowRight, Activity, Zap, Lock, AlertCircle, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';
import { CountUp } from '@/components/ui-custom/NeuralMetagraph';

export default function ValidatorsPage() {
    const { data: validators = [], isLoading } = useValidators();
    const [search, setSearch] = useState('');
    const [stakingTarget, setStakingTarget] = useState<any>(null);
    const [stakeAmount, setStakeAmount] = useState('');
    const [stakeState, setStakeState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [stakeMsg, setStakeMsg] = useState('');
    const [verifyOpen, setVerifyOpen] = useState(false);
    const [verifyMiner, setVerifyMiner] = useState('');

    const filtered = (validators as any[]).filter((v: any) => {
        const id = String(v.id || v.validator_id || v.account_id || '').toLowerCase();
        return id.includes(search.toLowerCase());
    });

    const handleStake = async () => {
        if (!stakingTarget || !stakeAmount || isNaN(Number(stakeAmount))) return;
        setStakeState('loading');
        try {
            const result = await stakeValidator(stakingTarget.validator_id || stakingTarget.id, Number(stakeAmount));
            setStakeState('success');
            setStakeMsg(result.message || 'Stake submitted!');
        } catch (e: any) {
            setStakeState('error');
            setStakeMsg(e.message || 'Stake failed');
        }
    };

    const closeModal = () => {
        setStakingTarget(null);
        setStakeAmount('');
        setStakeState('idle');
        setStakeMsg('');
    };

    const formatUTC7 = (ts: any) => {
        if (!ts) return '—';
        const date = new Date(Number(ts) * (String(ts).length > 10 ? 1 : 1000));
        return date.toLocaleString('en-GB', { 
            timeZone: 'Asia/Ho_Chi_Minh', 
            hour12: false,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-display font-bold text-white uppercase tracking-tighter italic">
                        Metagraph <span className="text-neon-purple">Validators</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neon-purple animate-pulse shadow-[0_0_8px_#bc13fe]" />
                        Consensus Layer Verification Authority
                    </p>
                </div>
                <div className="flex items-center gap-4 bg-neon-purple/5 border border-neon-purple/20 px-4 py-2 rounded-xl">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Active Validators</span>
                        <span className="text-lg font-display font-bold text-neon-purple tracking-tight">{(validators as any[]).length}</span>
                    </div>
                    <Shield size={24} className="text-neon-purple/40" />
                </div>
            </div>

            {/* Search */}
            <div className="relative group max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-neon-purple transition-colors" />
                <Input
                    placeholder="SCAN VALIDATORS..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-11 bg-black/40 border-white/10 text-white placeholder:text-slate-600 focus:border-neon-purple/40 h-11 text-xs font-mono tracking-widest uppercase transition-all"
                />
            </div>

            {/* Table */}
            <div className="panel overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-purple/20 to-transparent" />
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                                <th className="px-6 py-5">Rank</th>
                                <th className="px-6 py-5">Validator Identity</th>
                                <th className="px-6 py-5">Subnet(s)</th>
                                <th className="px-6 py-5">Registration Date</th>
                                <th className="px-6 py-5">Network Status</th>
                                <th className="px-6 py-5 text-right">Stake Control (MDT)</th>
                                <th className="px-6 py-5 text-right">Emissions (MDT)</th>
                                <th className="px-6 py-5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i}><td colSpan={8} className="px-6 py-4"><Skeleton className="h-10 bg-white/5 rounded-lg" /></td></tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-24 text-slate-600 uppercase tracking-widest text-xs font-bold">No Consensus Nodes Found</td></tr>
                            ) : filtered.map((v: any, idx: number) => {
                                const id = v.id || v.validator_id || v.account_id || `val-${idx}`;
                                const status = v.status || 'active';
                                const stake = v.stake_amount ?? v.stake ?? 0;
                                const emissions = v.total_emissions ?? 0;
                                const subnets = v.subnet_ids || [0];
                                return (
                                    <tr key={id} className="group hover:bg-neon-purple/[0.02] transition-colors cursor-pointer data-row">
                                        <td className="px-6 py-5 text-slate-500 text-xs font-bold">#{String(idx + 1).padStart(2, '00')}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-white font-bold text-base tracking-tight group-hover:text-neon-purple transition-colors">{id}</span>
                                                <span className="text-[10px] text-white/50 uppercase tracking-widest">Authority_Token</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-wrap gap-1.5">
                                                {subnets.map((s: number) => (
                                                    <span key={s} className="text-[10px] font-bold text-neon-cyan border border-neon-cyan/40 bg-neon-cyan/10 px-2.5 py-1 rounded-full">
                                                        Subnet-{s}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs text-white font-bold uppercase whitespace-nowrap">
                                                {formatUTC7(v.registered_at)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <StatusBadge status={status} />
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-white font-bold text-base">
                                                    {stake > 0 ? <CountUp end={Number(stake)} decimals={0} /> : <span className="text-white/40 italic text-sm">Not Staked</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Zap size={12} className="text-neon-green animate-pulse" />
                                                <span className="text-neon-green font-bold text-base">
                                                    {emissions > 0 ? <CountUp end={Number(emissions)} decimals={2} /> : <span className="text-white/40">—</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex items-center gap-2 justify-center">
                                                <button
                                                    onClick={() => setStakingTarget(v)}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-neon-purple border border-neon-purple/40 bg-neon-purple/10 px-4 py-2 rounded-lg hover:bg-neon-purple/20 transition-all uppercase tracking-widest"
                                                >
                                                    <Lock size={12} />
                                                    Stake
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        {/* Validator Verify Modal */}
        <ValidatorVerifyModal
            isOpen={verifyOpen}
            onClose={() => { setVerifyOpen(false); setVerifyMiner(''); }}
            minerId={verifyMiner}
        />

        {/* Staking Modal */}
            {stakingTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={closeModal}>
                    <div className="bg-[#0a0e17] border border-neon-purple/30 rounded-2xl p-8 w-full max-w-md shadow-[0_0_60px_rgba(188,19,254,0.15)] relative" onClick={e => e.stopPropagation()}>
                        <button onClick={closeModal} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                            <X size={18} />
                        </button>
                        <h2 className="text-xl font-display font-bold text-white mb-1 uppercase tracking-tight italic">
                            Stake on <span className="text-neon-purple">Validator</span>
                        </h2>
                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-6">
                            {stakingTarget.account_id || stakingTarget.id}
                        </p>

                        <div className="space-y-4">
                            {/* Subnet info */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {(stakingTarget.subnet_ids || [1]).map((s: number) => (
                                    <span key={s} className="text-[9px] font-bold text-neon-cyan border border-neon-cyan/30 bg-neon-cyan/5 px-2 py-1 rounded-full">
                                        Subnet-{s}
                                    </span>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-black/40 border border-white/5 p-3 rounded-lg">
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Current Stake</p>
                                    <p className="text-white font-bold font-mono">{stakingTarget.stake_amount || 0} ℏ</p>
                                </div>
                                <div className="bg-black/40 border border-white/5 p-3 rounded-lg">
                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Total Emissions</p>
                                    <p className="text-neon-green font-bold font-mono">{Number(stakingTarget.total_emissions || 0).toFixed(2)} MDT</p>
                                </div>
                            </div>

                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder="Amount to stake (HBAR)..."
                                    value={stakeAmount}
                                    onChange={e => setStakeAmount(e.target.value)}
                                    className="w-full bg-black/60 border border-white/10 text-white placeholder:text-slate-600 focus:border-neon-purple/50 h-12 px-4 text-sm font-mono rounded-xl outline-none transition-all focus:shadow-[0_0_20px_rgba(188,19,254,0.15)]"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">ℏ HBAR</span>
                            </div>

                            {stakeState === 'success' && (
                                <div className="flex items-start gap-2 text-neon-green text-xs bg-neon-green/5 border border-neon-green/20 rounded-lg p-3">
                                    <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                                    <span>{stakeMsg}</span>
                                </div>
                            )}
                            {stakeState === 'error' && (
                                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-400/5 border border-red-400/20 rounded-lg p-3">
                                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                    <span>{stakeMsg}</span>
                                </div>
                            )}

                            <button
                                onClick={handleStake}
                                disabled={!stakeAmount || stakeState === 'loading' || stakeState === 'success'}
                                className="w-full h-12 rounded-xl font-display font-bold text-sm uppercase tracking-widest bg-neon-purple/70 hover:bg-neon-purple text-white border border-neon-purple/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {stakeState === 'loading' ? 'Submitting...' : stakeState === 'success' ? 'Staked ✓' : (
                                    <><Lock size={14} /> Confirm Stake</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
