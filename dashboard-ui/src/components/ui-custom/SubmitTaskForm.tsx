'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SubmitTaskForm() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState({
        type: 'inference',
        input: '',
        reward: '1.5',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Simulate Hedera transaction and network assignment
        toast.info("Submitting task to Hedera Testnet...");

        await new Promise(r => setTimeout(r, 2000));
        toast.success("Transaction successful! HCS Message sent.");

        await new Promise(r => setTimeout(r, 1500));
        toast.info("Network assigning miner...");

        await new Promise(r => setTimeout(r, 1500));
        setLoading(false);
        setSuccess(true);
        toast.success("Task assigned to protocol_miner");

        setTimeout(() => {
            setSuccess(false);
            setFormData({ ...formData, input: '' });
        }, 5000);
    };

    return (
        <Card className="panel border-0 shadow-none">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-cyan-400 mb-1">
                    <Zap size={16} fill="currentColor" />
                    <Badge variant="outline" className="text-[10px] font-mono border-cyan-400/30 text-cyan-400">SIMULATOR</Badge>
                </div>
                <CardTitle className="text-lg font-bold text-white">Submit AI Task</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                    Send a new compute request to the ModernTensor network.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {success ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
                        <div className="w-12 h-12 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center mb-4">
                            <CheckCircle2 className="text-green-400" size={24} />
                        </div>
                        <h3 className="text-white font-semibold">Task Submitted!</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                            Task has been broadcast and assigned. Watch the Activity Feed for updates.
                        </p>
                        <Button variant="ghost" className="mt-4 text-cyan-400 text-xs hover:bg-cyan-400/5" onClick={() => setSuccess(false)}>
                            Submit another
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="type" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Task Type</Label>
                            <select
                                id="type"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400/40"
                            >
                                <option value="inference">LLM Inference</option>
                                <option value="training">Model Training</option>
                                <option value="verification">Validator Check</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="input" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Input Data / Prompt</Label>
                            <Input
                                id="input"
                                placeholder="Enter AI prompt or data hash..."
                                value={formData.input}
                                onChange={e => setFormData({ ...formData, input: e.target.value })}
                                required
                                className="bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 h-10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="reward" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reward (MDT)</Label>
                            <div className="relative">
                                <Input
                                    id="reward"
                                    type="number"
                                    step="0.1"
                                    value={formData.reward}
                                    onChange={e => setFormData({ ...formData, reward: e.target.value })}
                                    className="bg-white/5 border-white/10 text-slate-200 focus:border-cyan-400/40 h-10"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500">ℏ FEE INCL.</span>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading || !formData.input}
                            className="w-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/20 font-bold transition-all"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-3.5 w-3.5" />
                                    Broadcast Task
                                </>
                            )}
                        </Button>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
