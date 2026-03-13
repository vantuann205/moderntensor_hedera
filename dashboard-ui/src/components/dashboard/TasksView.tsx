"use client";

import React, { useState } from 'react';
import { useTasks, useScores, useMiners } from '@/hooks/useRealData';

interface TasksViewProps {
  onBack: () => void;
  onSelectTask: (taskId: string) => void;
}

export default function TasksView({ onBack, onSelectTask }: TasksViewProps) {
  const { data: tasks, loading, error } = useTasks();
  const { data: scores } = useScores();
  const { data: miners } = useMiners();
  const [filterType, setFilterType] = useState<string>('all');

  // Calculate task stats from scores
  const tasksWithStats = React.useMemo(() => {
    if (!tasks || tasks.length === 0) return [];

    return tasks.map((task: any) => {
      const taskScores = scores?.filter((s: any) => s.taskId === task.taskId) || [];
      const validations = taskScores.length;
      const avgScore = validations > 0 
        ? taskScores.reduce((sum: number, s: any) => sum + s.score, 0) / validations 
        : 0;
      
      return {
        ...task,
        validations,
        avgScore,
        status: validations > 0 ? 'completed' : 'pending'
      };
    }).sort((a: any, b: any) => {
      // Sort by timestamp descending (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [tasks, scores]);

  const filteredTasks = filterType === 'all' 
    ? tasksWithStats 
    : tasksWithStats.filter((t: any) => t.taskType === filterType);

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
                        <span className="px-3 py-1 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/40 uppercase tracking-widest flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            {tasksWithStats.length} Total
                        </span>
                    </div>
                    <p className="text-slate-400 text-lg font-light max-w-2xl font-body tracking-wider">
                        AI tasks submitted and processed on Hedera HCS
                    </p>
                </div>
                
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Tasks', val: tasksWithStats.length, icon: 'task', color: 'text-neon-cyan', border: 'neon-border-cyan' },
                  { label: 'Completed', val: tasksWithStats.filter((t: any) => t.status === 'completed').length, icon: 'check_circle', color: 'text-neon-green', border: 'neon-border-green' },
                  { label: 'Total Rewards', val: (tasksWithStats.reduce((sum: number, t: any) => sum + (t.rewardAmount || 0), 0) / 1e10).toFixed(1) + 'K', icon: 'payments', color: 'text-neon-pink', border: 'neon-border-pink' },
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
                                          <th className="px-6 py-5">Task ID</th>
                                          <th className="px-6 py-5">Type</th>
                                          <th className="px-6 py-5">Prompt</th>
                                          <th className="px-6 py-5 text-right">Reward</th>
                                          <th className="px-6 py-5 text-right">Validations</th>
                                          <th className="px-6 py-5 text-right">Avg Score</th>
                                          <th className="px-6 py-5 text-center">Status</th>
                                      </tr>
                                  </thead>
                                  <tbody className="text-sm divide-y divide-white/5 font-mono tracking-widest">
                                      {filteredTasks.map((task: any, idx: number) => (
                                          <tr key={task.taskId} className="group hover:bg-neon-cyan/5 transition-colors cursor-pointer" onClick={() => onSelectTask(task.taskId)}>
                                              <td className="px-6 py-5">
                                                  <div className="flex items-center gap-4">
                                                      <div className="size-10 rounded-lg bg-neon-pink/20 p-[1px] shadow-[0_0_10px_rgba(0,0,0,0.4)]">
                                                          <div className="w-full h-full bg-slate-900 rounded-[7px] flex items-center justify-center">
                                                              <span className="material-symbols-outlined text-neon-pink text-sm">task</span>
                                                          </div>
                                                      </div>
                                                      <div className="flex flex-col">
                                                          <span className="font-bold text-white group-hover:text-neon-cyan transition-colors text-xs">{task.taskId}</span>
                                                          <span className="text-[10px] text-slate-500">
                                                            {task.consensusTimestamp ? (
                                                              <>
                                                                <a 
                                                                  href={`https://hashscan.io/testnet/transaction/${task.consensusTimestamp}`}
                                                                  target="_blank"
                                                                  rel="noopener noreferrer"
                                                                  className="text-neon-cyan hover:underline"
                                                                  onClick={(e) => e.stopPropagation()}
                                                                >
                                                                  View on HashScan
                                                                </a>
                                                              </>
                                                            ) : (
                                                              'On HCS'
                                                            )}
                                                          </span>
                                                      </div>
                                                  </div>
                                              </td>
                                              <td className="px-6 py-5">
                                                <span className="px-2 py-1 rounded text-[9px] bg-neon-purple/10 text-neon-purple border border-neon-purple/30">
                                                  {task.taskType?.replace('_', ' ')}
                                                </span>
                                              </td>
                                              <td className="px-6 py-5">
                                                <div className="text-white max-w-xs truncate text-xs">
                                                  {task.prompt}
                                                </div>
                                              </td>
                                              <td className="px-6 py-5 text-right">
                                                  <div className="font-bold text-neon-green">{(task.rewardAmount / 1e10).toFixed(1)}K</div>
                                                  <div className="text-[10px] text-slate-500">MDT</div>
                                              </td>
                                              <td className="px-6 py-5 text-right text-white font-bold">
                                                {task.validations}
                                              </td>
                                              <td className="px-6 py-5 text-right">
                                                <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] text-slate-300">
                                                  {task.avgScore > 0 ? task.avgScore.toFixed(1) : 'N/A'}
                                                </span>
                                              </td>
                                              <td className="px-6 py-5 text-center">
                                                  <span className={`px-3 py-1 rounded text-[10px] font-bold ${
                                                    task.status === 'completed' 
                                                      ? 'bg-green-500/10 text-green-400 border border-green-500/40'
                                                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/40'
                                                  }`}>
                                                    {task.status.toUpperCase()}
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
