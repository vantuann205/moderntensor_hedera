'use client';

import { useState, useEffect } from 'react';
import { Network, Terminal, X, ShieldAlert, Cpu, Activity, Play, Info, Trophy, Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/context/WalletContext';

interface RegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ROLE_INFO = {
    miner: {
        title: 'Compute Miner',
        minStake: 100,
        description: 'Receive AI compute tasks, run models, and submit results to the network.',
        flow: 'Task → Miner Compute → Submit Result → Earn Reward',
        rewards: 'reward = (score / total_scores) × pool × stake_factor',
    },
    validator: {
        title: 'Consensus Validator',
        minStake: 50000,
        description: 'Verify miner computation results, score accuracy, and vote on consensus.',
        flow: 'Miner Result → Validator Verify → Score → Vote → HCS',
        rewards: 'reward = (stake × trust_score) / total_weight × validator_pool',
    },
};

export default function RegistrationModal({ isOpen, onClose }: RegistrationModalProps) {
    const queryClient = useQueryClient();
    const { isConnected, accountId, address, isMiner, isValidator } = useWallet();
    
    const [id, setId] = useState(accountId || address || '');
    const [stake, setStake] = useState('1000');
    const [type, setType] = useState<'miner' | 'validator'>('miner');
    
    const [isRegistering, setIsRegistering] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Pre-fill ID when wallet connects
    useEffect(() => {
        if (accountId || address) {
            setId(accountId || address || '');
        }
    }, [accountId, address]);

    if (!isOpen) return null;
    
    const roleInfo = ROLE_INFO[type];
    const stakeNum = Number(stake);
    const stakeInsufficient = stakeNum < roleInfo.minStake;

    const handleRegister = async () => {
        setIsRegistering(true);
        setErrorMsg('');
        setLogs(['[SYSTEM] Initializing on-chain registration sequence...']);
        setSuccess(false);

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, id, stake })
            });

            const data = await res.json();
            
            if (data.success) {
                const newLogs = (data.logs || '').split('\n').filter((l: string) => l.trim() !== '');
                setLogs((prev) => [...prev, ...newLogs, `[SYSTEM] Node registered on Hedera!`]);
                setSuccess(true);
                queryClient.invalidateQueries({ queryKey: ['miners'] });
                queryClient.invalidateQueries({ queryKey: ['network-stats'] });
            } else {
                setErrorMsg(data.error || 'Failed to register');
                setLogs((prev) => [...prev, `[ERROR] ${data.error || 'Registration failed'}`]);
            }
        } catch (err: any) {
            setLogs((prev) => [...prev, `[ERROR] Network error: ${err.message}`]);
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
            
            <div className="relative w-full max-w-4xl bg-[#0a0e17] border-2 border-white/20 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/20 bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-neon-cyan/20 flex items-center justify-center border border-neon-cyan/40">
                            <Network className="w-5 h-5 text-neon-cyan" />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">Register Neural Node</h2>
                            <p className="text-xs font-mono text-white/70">Initialize on-chain PoI verification via Hedera HCS</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X size={22} />
                    </button>
                </div>

                <div className="p-8 grid gap-6">
                    {/* Role Selector */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => { setType('miner'); setStake('1000'); }}
                            className={`text-left p-5 rounded-xl border-2 transition-all ${type === 'miner' ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-[0_0_20px_rgba(0,243,255,0.3)]' : 'bg-white/5 border-white/20 hover:border-white/40'}`}
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <Cpu size={18} className={type === 'miner' ? 'text-neon-cyan' : 'text-white'} />
                                <span className={`text-sm font-bold uppercase tracking-widest ${type === 'miner' ? 'text-neon-cyan' : 'text-white'}`}>Compute Miner</span>
                            </div>
                            <p className="text-xs text-white/80 leading-relaxed mb-3">Receive AI tasks, run models, submit results</p>
                            <div className={`text-[10px] font-mono ${type === 'miner' ? 'text-neon-cyan' : 'text-white/70'}`}>Min stake: 100 MDT</div>
                        </button>
                        
                        <button
                            onClick={() => { setType('validator'); setStake('50000'); }}
                            className={`text-left p-5 rounded-xl border-2 transition-all ${type === 'validator' ? 'bg-neon-purple/10 border-neon-purple/50 shadow-[0_0_20px_rgba(188,19,254,0.3)]' : 'bg-white/5 border-white/20 hover:border-white/40'}`}
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <ShieldAlert size={18} className={type === 'validator' ? 'text-neon-purple' : 'text-white'} />
                                <span className={`text-sm font-bold uppercase tracking-widest ${type === 'validator' ? 'text-neon-purple' : 'text-white'}`}>Consensus Validator</span>
                            </div>
                            <p className="text-xs text-white/80 leading-relaxed mb-3">Verify miner results, score accuracy, vote on HCS</p>
                            <div className={`text-[10px] font-mono ${type === 'validator' ? 'text-neon-purple' : 'text-white/70'}`}>Min stake: 50,000 MDT</div>
                        </button>
                    </div>

                    {/* Role Flow Banner */}
                    <div className={`rounded-xl p-4 border-2 text-xs font-mono space-y-2 ${type === 'validator' ? 'border-neon-purple/40 bg-neon-purple/10' : 'border-neon-cyan/40 bg-neon-cyan/10'}`}>
                        <div className={`flex items-center gap-2 font-bold ${type === 'validator' ? 'text-neon-purple' : 'text-neon-cyan'}`}>
                            <Zap size={13} /> {roleInfo.flow}
                        </div>
                        <div className="text-white flex items-center gap-2">
                            <Trophy size={13} className="shrink-0" /> {roleInfo.rewards}
                        </div>
                    </div>

                    {!isConnected && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-500/10 border-2 border-orange-500/40 text-orange-300 text-sm">
                            <Info size={18} />
                            Please connect your wallet first to verify your Neural Identity.
                        </div>
                    )}

                    {/* Form */}
                    <div className={`grid grid-cols-2 gap-5 ${!isConnected ? 'opacity-40 pointer-events-none' : ''}`}>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-white uppercase tracking-widest pl-1 flex items-center gap-2">
                                Stake Amount (MDT)
                                {stakeInsufficient && <span className="text-red-400 text-xs normal-case">min {roleInfo.minStake.toLocaleString()}</span>}
                            </label>
                            <input 
                                type="number"
                                value={stake}
                                onChange={(e) => setStake(e.target.value)}
                                className={`w-full bg-black/60 border-2 rounded-xl px-4 py-3 text-base text-white focus:outline-none font-mono transition-colors ${stakeInsufficient ? 'border-red-500/70' : 'border-white/30 focus:border-neon-cyan/70'}`}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-white uppercase tracking-widest pl-1">Neural ID</label>
                            <input 
                                type="text" 
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                className="w-full bg-black/60 border-2 border-white/30 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-neon-cyan/70 font-mono transition-colors"
                                disabled={isConnected}
                            />
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="flex items-start gap-2 text-red-300 text-sm bg-red-400/10 rounded-xl p-4 border-2 border-red-400/40">
                            <Info size={16} className="mt-0.5 shrink-0" /> {errorMsg}
                        </div>
                    )}

                    {/* Console */}
                    <div className="h-40 bg-black/90 rounded-xl border-2 border-white/20 p-4 font-mono text-sm overflow-y-auto">
                        <div className="flex items-center gap-2 text-white/60 mb-3 pb-2 border-b border-white/10">
                            <Terminal size={14} /><span>System Log Output</span>
                        </div>
                        {logs.length === 0 ? (
                            <div className="text-white/40 italic">Awaiting execution...</div>
                        ) : (
                            <div className="space-y-1">
                                {logs.map((log, i) => (
                                    <div key={i} className={log.includes('ERROR') ? 'text-red-400' : log.includes('Node registered') ? 'text-neon-green' : 'text-white/80'}>
                                        <span className="text-white/40 mr-2">{'>'}</span>{log}
                                    </div>
                                ))}
                                {isRegistering && (
                                    <div className="text-neon-cyan animate-pulse flex items-center gap-2 mt-2">
                                        <Activity size={14} /> Processing on-chain transaction...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/20 bg-black/40 flex justify-end gap-4">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors hover:bg-white/5">
                        {success ? 'Close' : 'Cancel'}
                    </button>
                    {!success ? (
                        <button 
                            onClick={handleRegister} 
                            disabled={isRegistering || stakeInsufficient || !id || !isConnected}
                            className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
                                isRegistering || stakeInsufficient || !id || !isConnected
                                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                                    : type === 'validator'
                                        ? 'bg-neon-purple text-white hover:bg-neon-purple/80 hover:shadow-[0_0_25px_rgba(188,19,254,0.5)]'
                                        : 'bg-neon-cyan text-white hover:bg-neon-cyan/80 hover:shadow-[0_0_25px_rgba(0,243,255,0.5)]'
                            }`}
                        >
                            {isRegistering ? <Activity size={16} className="animate-spin" /> : <Play size={16} />}
                            {isRegistering ? 'Executing...' : `Deploy ${type === 'validator' ? 'Validator' : 'Miner'} Node`}
                        </button>
                    ) : (
                        <button onClick={onClose} className="bg-neon-green text-black px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-neon-green/80 transition-all shadow-[0_0_20px_rgba(57,255,20,0.4)]">
                            Done ✓
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
