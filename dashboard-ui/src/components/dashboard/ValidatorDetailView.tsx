"use client";

import React from 'react';
import { useScores } from '@/hooks/useRealData';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Props {
  validatorId: string;
  onBack: () => void;
}

function toUTC7(ts: any): string {
  if (!ts) return '—';
  const secs = typeof ts === 'string' ? parseFloat(ts) : Number(ts);
  if (!secs || isNaN(secs)) return '—';
  return new Date(secs * 1000).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export default function ValidatorDetailView({ validatorId, onBack }: Props) {
  const { data: allScores, loading } = useScores();

  const scores = React.useMemo(() => {
    if (!allScores) return [];
    return allScores
      .filter((s: any) => s.validatorId === validatorId)
      .sort((a: any, b: any) => {
        const ta = a.consensusTimestamp ? parseFloat(a.consensusTimestamp) : 0;
        const tb = b.consensusTimestamp ? parseFloat(b.consensusTimestamp) : 0;
        return tb - ta;
      });
  }, [allScores, validatorId]);

  // Aggregate stats
  const stats = React.useMemo(() => {
    if (scores.length === 0) return null;
    const n = scores.length;
    const avgScore = scores.reduce((s: number, x: any) => s + (x.score ?? 0), 0) / n;
    const avgConf  = scores.reduce((s: number, x: any) => s + (x.confidence ?? 0), 0) / n;
    const avgRel   = scores.reduce((s: number, x: any) => s + (x.metrics?.relevance ?? 0), 0) / n;
    const avgQual  = scores.reduce((s: number, x: any) => s + (x.metrics?.quality ?? 0), 0) / n;
    const avgComp  = scores.reduce((s: number, x: any) => s + (x.metrics?.completeness ?? 0), 0) / n;
    const avgCrea  = scores.reduce((s: number, x: any) => s + (x.metrics?.creativity ?? 0), 0) / n;
    return { n, avgScore, avgConf, avgRel, avgQual, avgComp, avgCrea };
  }, [scores]);

  const radarData = stats ? [
    { metric: 'Relevance',    value: +stats.avgRel.toFixed(1) },
    { metric: 'Quality',      value: +stats.avgQual.toFixed(1) },
    { metric: 'Completeness', value: +stats.avgComp.toFixed(1) },
    { metric: 'Creativity',   value: +stats.avgCrea.toFixed(1) },
    { metric: 'Confidence',   value: +(stats.avgConf * 100).toFixed(1) },
  ] : [];

  const barData = scores.slice(0, 20).reverse().map((s: any, i: number) => ({
    name: `#${i + 1}`,
    score: +(s.score ?? 0).toFixed(1),
    confidence: +((s.confidence ?? 0) * 100).toFixed(1),
  }));

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full animate-fade-in-up">
      <div className="w-full max-w-[1600px] flex flex-col gap-8">

        {/* Breadcrumb */}
        <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-500 uppercase">
          <button className="hover:text-neon-cyan transition-colors" onClick={() => onBack()}>HOME</button>
          <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>VALIDATORS</button>
          <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          <span className="text-neon-purple">{validatorId}</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap justify-between items-end gap-6 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-400 text-3xl">verified</span>
            </div>
            <div>
              <h1 className="text-white text-3xl lg:text-4xl font-black font-display uppercase tracking-tight">{validatorId}</h1>
              <p className="text-slate-400 text-sm mt-1">Validator · Hedera HCS Scoring Topic</p>
            </div>
          </div>
          <a href="https://hashscan.io/testnet/topic/0.0.8198584" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan text-xs font-bold hover:bg-neon-cyan hover:text-black transition-all uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Verify on HashScan
          </a>
        </div>

        {loading && <div className="text-center py-12 text-slate-500 font-mono">Loading scores...</div>}

        {!loading && stats && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Tasks', val: stats.n, color: 'text-neon-cyan' },
                { label: 'Avg Score', val: stats.avgScore.toFixed(1), color: 'text-neon-green' },
                { label: 'Avg Confidence', val: (stats.avgConf * 100).toFixed(1) + '%', color: 'text-neon-purple' },
                { label: 'Avg Relevance', val: stats.avgRel.toFixed(1), color: 'text-neon-pink' },
                { label: 'Avg Quality', val: stats.avgQual.toFixed(1), color: 'text-yellow-400' },
              ].map((s, i) => (
                <div key={i} className="glass-panel p-5 rounded-xl border border-white/5">
                  <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-3xl font-black font-display tracking-tighter ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Radar */}
              <div className="glass-panel rounded-xl p-6 border border-white/5">
                <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-neon-purple text-base">radar</span>
                  Avg Metrics Radar
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#ffffff10" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Radar dataKey="value" stroke="#bc13fe" fill="#bc13fe" fillOpacity={0.25} strokeWidth={2} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0e17', border: '1px solid #1f293a', fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Bar chart score per task */}
              <div className="glass-panel rounded-xl p-6 border border-white/5">
                <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-neon-green text-base">bar_chart</span>
                  Score per Task (last 20)
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0e17', border: '1px solid #1f293a', fontSize: 12 }} />
                    <Bar dataKey="score" fill="#00f3ff" radius={[3, 3, 0, 0]} name="Score" />
                    <Bar dataKey="confidence" fill="#bc13fe" radius={[3, 3, 0, 0]} name="Conf %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tasks table */}
            <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-neon-cyan text-base">table_rows</span>
                  All Scored Tasks ({scores.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/5 border-b border-white/10 text-[12px] uppercase tracking-widest text-slate-400 font-bold">
                    <tr>
                      <th className="px-5 py-3">#</th>
                      <th className="px-5 py-3">Task ID</th>
                      <th className="px-5 py-3">Miner ID</th>
                      <th className="px-5 py-3 text-right">Score</th>
                      <th className="px-5 py-3 text-right">Confidence</th>
                      <th className="px-5 py-3 text-right">Relevance</th>
                      <th className="px-5 py-3 text-right">Quality</th>
                      <th className="px-5 py-3 text-right">Completeness</th>
                      <th className="px-5 py-3 text-right">Creativity</th>
                      <th className="px-5 py-3">Timestamp (UTC+7)</th>
                      <th className="px-5 py-3">Verify</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-white/5 font-mono">
                    {scores.map((s: any, idx: number) => (
                      <tr key={idx} className="hover:bg-neon-purple/5 transition-colors">
                        <td className="px-5 py-3 text-slate-500">{idx + 1}</td>
                        <td className="px-5 py-3 text-white font-bold max-w-[140px] truncate">{s.taskId}</td>
                        <td className="px-5 py-3 text-neon-cyan">{s.minerId}</td>
                        <td className="px-5 py-3 text-right font-bold text-neon-green">{(s.score ?? 0).toFixed(2)}</td>
                        <td className="px-5 py-3 text-right text-neon-purple">{((s.confidence ?? 0) * 100).toFixed(1)}%</td>
                        <td className="px-5 py-3 text-right text-slate-300">{s.metrics?.relevance != null ? s.metrics.relevance.toFixed(1) : '—'}</td>
                        <td className="px-5 py-3 text-right text-slate-300">{s.metrics?.quality != null ? s.metrics.quality.toFixed(1) : '—'}</td>
                        <td className="px-5 py-3 text-right text-slate-300">{s.metrics?.completeness != null ? s.metrics.completeness.toFixed(1) : '—'}</td>
                        <td className="px-5 py-3 text-right text-slate-300">{s.metrics?.creativity != null ? s.metrics.creativity.toFixed(1) : '—'}</td>
                        <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{toUTC7(s.consensusTimestamp)}</td>
                        <td className="px-5 py-3">
                          {s.consensusTimestamp ? (
                            <a href={`https://hashscan.io/testnet/transaction/${s.consensusTimestamp}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-neon-cyan hover:underline whitespace-nowrap text-[12px]">
                              HashScan
                            </a>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!loading && scores.length === 0 && (
          <div className="glass-panel rounded-xl p-12 border border-white/10 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-600 block mb-4">search_off</span>
            <div className="text-xl text-slate-400">No scores found for this validator</div>
          </div>
        )}
      </div>
    </div>
  );
}
