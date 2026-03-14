"use client";

import React, { useState } from 'react';
import { useTasks, useScores, useMiners } from '@/hooks/useRealData';
import SubmitTaskModal from '@/components/ui-custom/SubmitTaskModal';
import { useSort } from '@/lib/hooks/useSort';
import SortTh from '@/components/ui-custom/SortTh';

interface TasksViewProps {
  onBack: () => void;
  onSelectTask: (taskId: string) => void;
}

export default function TasksView({ onBack, onSelectTask }: TasksViewProps) {
  const { data: tasks, loading, error } = useTasks();
  const { data: scores } = useScores();
  const { data: miners } = useMiners();
  const [filterType, setFilterType] = useState<string>('all');
  const [showSubmit, setShowSubmit] = useState(false);
  const { sort, toggle, sortData } = useSort('timestamp', 'desc');

  // Calculate task stats from scores
  const tasksWithStats = React.useMemo(() => {
    if (!tasks || tasks.length === 0) return [];

    return tasks.map((task: any) => {
      const taskScores = scores?.filter((s: any) => s.taskId === task.taskId) || [];
      const validations = taskScores.length;
      const avgScore = validations > 0
        ? taskScores.reduce((sum: number, s: any) => sum + s.score, 0) / validations
        : 0;

      // Status: completed only if has validated scores, otherwise pending
      const status = validations > 0 ? 'completed' : 'pending';

      return { ...task, validations, avgScore, status };
    }).sort((a: any, b: any) => {
      const tA = a.consensusTimestamp ? Number(a.consensusTimestamp.replace('.', '')) : new Date(a.timestamp).getTime();
      const tB = b.consensusTimestamp ? Number(b.consensusTimestamp.replace('.', '')) : new Date(b.timestamp).getTime();
      return tB - tA;
    });
  }, [tasks, scores]);

  const filteredTasks = filterType === 'all' 
    ? tasksWithStats 
    : tasksWithStats.filter((t: any) => t.taskType === filterType);

  const sortedTasks = sortData(filteredTasks, (t: any, col) => {
    if (col === 'taskId') return t.taskId;
    if (col === 'taskType') return t.taskType;
    if (col === 'reward') return t.rewardAmount;
    if (col === 'subnet') return t.subnetId ?? 0;
    if (col === 'requester') return t.requester;
    if (col === 'deadline') return t.deadline ?? 24;
    if (col === 'timestamp') return t.consensusTimestamp
      ? Number(t.consensusTimestamp.split('.')[0])
      : new Date(t.timestamp).getTime() / 1000;
    if (col === 'status') return t.status;
    return (t as any)[col];
  });

  const taskTypes = [...new Set(tasks?.map((t: any) => t.taskType) || [])];

  return (
    <div className="flex justify-center py-8 px-4 lg:px-12 relative z-10 w-full animate-fade-in-up">
        <div className="w-full max-w-[1600px] flex flex-col gap-8">
            <div className="flex gap-2 items-center text-xs font-mono tracking-widest text-slate-500 uppercase">
                <button className="hover:text-neon-cyan transition-colors" onClick={onBack}>HOME</button>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                <span className="text-neon-cyan">TASKS</span>
            </div>

            <div className="flex flex-wrap justify-between items-end gap-6 pb-6 border-b border-white/5 relative">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                        <h1 className="text-white text-4xl lg:text-5xl font-black leading-tight tracking-tight uppercase font-display neon-text">Network Tasks</h1>
                    </div>
                    <p className="text-slate-400 text-lg font-light max-w-2xl font-body tracking-wider">
                        AI tasks submitted and processed on Hedera HCS
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <a href="https://hashscan.io/testnet/topic/0.0.8198585" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan text-xs font-bold hover:bg-neon-cyan hover:text-black transition-all uppercase tracking-widest">
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    Verify on HashScan
                  </a>
                  <button onClick={() => setShowSubmit(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-neon-pink/10 border border-neon-pink/40 text-neon-pink hover:bg-neon-pink/20 transition-all">
                    <span className="material-symbols-outlined text-sm">add_task</span>
                    Submit Task
                  </button>
                  {/* Filter */}
                  <div className="flex gap-2">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      filterType === 'all'
                        ? 'bg-neon-cyan text-black'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    All Tasks
                  </button>
                  {taskTypes.slice(0, 4).map((type: string) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        filterType === type
                          ? 'bg-neon-pink text-black'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                  </div>
                </div>
            </div>

            <SubmitTaskModal isOpen={showSubmit} onClose={() => setShowSubmit(false)} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Tasks', val: tasksWithStats.length, icon: 'task', color: 'text-neon-cyan', border: 'neon-border-cyan' },
                  { label: 'Completed', val: tasksWithStats.filter((t: any) => t.status === 'completed').length, icon: 'check_circle', color: 'text-neon-green', border: 'neon-border-green' },
                  { label: 'Total Rewards', val: tasksWithStats.reduce((sum: number, t: any) => sum + (t.rewardAmount || 0), 0) / 1e8 > 1000 ? (tasksWithStats.reduce((sum: number, t: any) => sum + (t.rewardAmount || 0), 0) / 1e8 / 1000).toFixed(1) + 'K' : (tasksWithStats.reduce((sum: number, t: any) => sum + (t.rewardAmount || 0), 0) / 1e8).toFixed(1), icon: 'payments', color: 'text-neon-pink', border: 'neon-border-pink' },
                  { label: 'Avg Score', val: tasksWithStats.length > 0 ? (tasksWithStats.reduce((sum: number, t: any) => sum + t.avgScore, 0) / tasksWithStats.filter((t: any) => t.avgScore > 0).length).toFixed(1) : '0', icon: 'star', color: 'text-neon-purple', border: 'border-l-2 border-neon-purple' }
                ].map((stat, i) => (
                  <div key={i} className={`glass-panel p-5 rounded-xl ${stat.border} relative overflow-hidden group`}>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                      <div className="flex items-end justify-between mt-1 z-10">
                          <p className="text-white text-3xl font-black font-display tracking-tighter">{stat.val}</p>
                          <span className={`material-symbols-outlined ${stat.color} text-2xl opacity-50`}>{stat.icon}</span>
                      </div>
                  </div>
                ))}
            </div>

            {loading && (
              <div className="text-center py-12 text-text-secondary">
                Loading tasks from Hedera HCS...
              </div>
            )}

            {error && (
              <div className="glass-panel rounded-xl p-6 border border-red-500/30 bg-red-500/10">
                <div className="text-red-400">Error: {error}</div>
              </div>
            )}

            {!loading && !error && filteredTasks.length === 0 && (
              <div className="glass-panel rounded-xl p-12 border border-white/10 text-center">
                <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">search_off</span>
                <div className="text-xl text-slate-400">No tasks found</div>
                <div className="text-sm text-slate-500 mt-2">Tasks will appear here after submission</div>
              </div>
            )}

            {!loading && filteredTasks.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  <div className="xl:col-span-8 flex flex-col gap-6">
                      <div className="glass-panel rounded-xl overflow-hidden border border-white/5 font-body">
                          <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                  <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                                      <tr>
                                          <SortTh col="taskId" sort={sort} onToggle={toggle} className="px-4 py-4">Task ID</SortTh>
                                          <SortTh col="taskType" sort={sort} onToggle={toggle} className="px-4 py-4">Task Type</SortTh>
                                          <th className="px-4 py-4">Prompt</th>
                                          <SortTh col="reward" sort={sort} onToggle={toggle} className="px-4 py-4 text-right">Reward</SortTh>
                                          <SortTh col="subnet" sort={sort} onToggle={toggle} className="px-4 py-4 text-center">Subnet</SortTh>
                                          <SortTh col="requester" sort={sort} onToggle={toggle} className="px-4 py-4">Requester</SortTh>
                                          <SortTh col="deadline" sort={sort} onToggle={toggle} className="px-4 py-4 text-right">Deadline</SortTh>
                                          <SortTh col="timestamp" sort={sort} onToggle={toggle} className="px-4 py-4">Timestamp</SortTh>
                                          <SortTh col="status" sort={sort} onToggle={toggle} className="px-4 py-4 text-center">Status</SortTh>
                                      </tr>
                                  </thead>
                                  <tbody className="text-sm divide-y divide-white/5 font-mono tracking-widest">
                                      {sortedTasks.map((task: any) => (
                                          <tr key={task.taskId} className="group hover:bg-neon-cyan/5 transition-colors cursor-pointer" onClick={() => onSelectTask(task.taskId)}>
                                              {/* Task ID */}
                                              <td className="px-4 py-4">
                                                  <div className="flex items-center gap-2">
                                                      <div className="size-8 rounded-lg bg-neon-pink/20 flex items-center justify-center shrink-0">
                                                          <span className="material-symbols-outlined text-neon-pink text-sm">task</span>
                                                      </div>
                                                      <div className="flex flex-col min-w-0">
                                                          <span className="font-bold text-white group-hover:text-neon-cyan transition-colors text-[10px] truncate max-w-[120px]">{task.taskId}</span>
                                                          {task.consensusTimestamp ? (
                                                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                              Verify on{' '}
                                                              <a href={`https://hashscan.io/testnet/transaction/${task.consensusTimestamp}`}
                                                                target="_blank" rel="noopener noreferrer"
                                                                className="text-neon-cyan hover:underline"
                                                                onClick={e => e.stopPropagation()}>
                                                                HashScan
                                                              </a>
                                                            </span>
                                                          ) : <span className="text-[9px] text-slate-600 whitespace-nowrap">Recorded on HCS</span>}
                                                      </div>
                                                  </div>
                                              </td>
                                              {/* Task Type */}
                                              <td className="px-4 py-4">
                                                  <span className="px-2 py-1 rounded text-[9px] bg-neon-purple/10 text-neon-purple border border-neon-purple/30 whitespace-nowrap">
                                                      {task.taskType?.replace(/_/g, ' ')}
                                                  </span>
                                              </td>
                                              {/* Prompt */}
                                              <td className="px-4 py-4 max-w-[160px]">
                                                  <div className="text-white truncate text-[11px]" title={task.prompt}>{task.prompt || '—'}</div>
                                              </td>
                                              {/* Reward */}
                                              <td className="px-4 py-4 text-right whitespace-nowrap">
                                                  <div className="font-bold text-neon-green text-xs">{(task.rewardAmount / 1e8).toFixed(2)}</div>
                                                  <div className="text-[9px] text-slate-500">MDT</div>
                                              </td>
                                              {/* Subnet */}
                                              <td className="px-4 py-4 text-center">
                                                  <span className="px-2 py-1 rounded text-[9px] bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
                                                      {task.subnetId ?? 0}
                                                  </span>
                                              </td>
                                              {/* Requester */}
                                              <td className="px-4 py-4">
                                                  <span className="text-[10px] text-slate-400 font-mono">{task.requester || '—'}</span>
                                              </td>
                                              {/* Deadline */}
                                              <td className="px-4 py-4 text-right">
                                                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                      {task.deadline ? `${task.deadline}h` : '24h'}
                                                  </span>
                                              </td>
                                              {/* Timestamp */}
                                              <td className="px-4 py-4">
                                                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                      {task.consensusTimestamp
                                                          ? new Date(Number(task.consensusTimestamp.split('.')[0]) * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
                                                          : task.timestamp
                                                              ? new Date(task.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
                                                              : '—'}
                                                  </span>
                                              </td>
                                              {/* Status */}
                                              <td className="px-4 py-4 text-center">
                                                  <span className={`px-2 py-1 rounded text-[9px] font-bold whitespace-nowrap ${
                                                      task.status === 'completed'
                                                          ? 'bg-green-500/10 text-green-400 border border-green-500/40'
                                                          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/40'
                                                  }`}>
                                                      {task.status?.toUpperCase()}
                                                  </span>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>

                  <div className="xl:col-span-4 flex flex-col gap-6">
                      {/* Task Types Distribution */}
                      <div className="glass-panel p-6 rounded-xl border-t border-neon-pink shadow-[0_0_20px_rgba(255,0,255,0.05)] relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10">
                            <span className="material-symbols-outlined text-8xl text-neon-pink">analytics</span>
                          </div>
                          <h3 className="text-white font-bold text-lg mb-6 font-display uppercase tracking-wider neon-text-pink">
                            Task Distribution
                          </h3>
                          <div className="flex flex-col gap-3">
                              {taskTypes.map((type: string) => {
                                const count = tasksWithStats.filter((t: any) => t.taskType === type).length;
                                const percentage = (count / tasksWithStats.length * 100).toFixed(0);
                                return (
                                  <div key={type} className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-slate-400">{type.replace('_', ' ')}</span>
                                      <span className="text-sm font-bold text-white">{count} ({percentage}%)</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                      <div 
                                        className="bg-gradient-to-r from-neon-pink to-neon-purple h-full transition-all"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                      </div>

                      {/* Top Requesters */}
                      <div className="glass-panel p-6 rounded-xl border border-white/10">
                        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                          <span className="material-symbols-outlined text-neon-cyan">person</span>
                          Top Requesters
                        </h3>
                        <div className="space-y-3">
                          {(() => {
                            const requesterMap = new Map();
                            tasksWithStats.forEach((task: any) => {
                              const count = requesterMap.get(task.requester) || 0;
                              requesterMap.set(task.requester, count + 1);
                            });
                            return Array.from(requesterMap.entries())
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 5)
                              .map(([requester, count], idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-panel-dark/50 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-neon-cyan/20 flex items-center justify-center text-xs font-bold text-neon-cyan">
                                      #{idx + 1}
                                    </div>
                                    <span className="text-sm text-white font-mono">{requester.substring(0, 12)}...</span>
                                  </div>
                                  <span className="text-sm font-bold text-neon-cyan">{count}</span>
                                </div>
                              ));
                          })()}
                        </div>
                      </div>

                      {/* Verification Link */}
                      <div className="glass-panel p-6 rounded-xl border border-neon-cyan/30">
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                          <span className="material-symbols-outlined text-neon-cyan">link</span>
                          Verify on Hedera
                        </h3>
                        <a
                          href="https://hashscan.io/testnet/topic/0.0.8198585"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full px-4 py-3 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-neon-cyan hover:bg-neon-cyan hover:text-black transition-all text-center font-bold text-sm"
                        >
                          View Task Topic on HashScan
                        </a>
                        <div className="text-xs text-slate-500 mt-3 text-center">
                          All tasks are recorded on Hedera HCS
                        </div>
                      </div>
                  </div>
              </div>
            )}
        </div>
    </div>
  );
}
