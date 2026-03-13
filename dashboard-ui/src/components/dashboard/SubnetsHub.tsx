"use client";

import React, { useState, useEffect } from 'react';
import { useProtocolStats } from '@/hooks/useRealData';

interface SubnetDetailProps {
  subnet: any;
  onBack: () => void;
}

const SubnetDetail: React.FC<SubnetDetailProps> = ({ subnet, onBack }) => {
  const [miners, setMiners] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubnetData() {
      try {
        const [minersRes, tasksRes, scoresRes] = await Promise.all([
          fetch('/api/hcs/miners'),
          fetch('/api/hcs/tasks'),
          fetch('/api/hcs/scores')
        ]);

        const [minersData, tasksData, scoresData] = await Promise.all([
          minersRes.json(),
          tasksRes.json(),
          scoresRes.json()
        ]);

        // Filter by subnet
        const subnetMiners = minersData.data?.filter((m: any) => 
          m.subnetIds?.includes(subnet.id)
        ) || [];
        
        setMiners(subnetMiners);
        setTasks(tasksData.data || []);
        setScores(scoresData.data || []);
      } catch (error) {
        console.error('Error fetching subnet data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSubnetData();
  }, [subnet.id]);

  const totalStaked = miners.reduce((sum, m) => sum + (m.stakeAmount || 0), 0);
  const avgScore = scores.length > 0 
    ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length 
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neon-cyan hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Subnets</span>
        </button>
      </div>

      {/* Subnet Header */}
      <div className="glass-panel rounded-xl p-8 border border-neon-cyan/30">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold text-neon-cyan mb-2">
              {subnet.name}
            </h1>
            <p className="text-text-secondary text-lg">{subnet.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{subnet.emission}</div>
            <div className="text-sm text-text-secondary">Emission Rate</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mt-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{miners.length}</div>
            <div className="text-sm text-text-secondary">Active Miners</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{tasks.length}</div>
            <div className="text-sm text-text-secondary">Total Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{(totalStaked / 100000000).toFixed(0)} MDT</div>
            <div className="text-sm text-text-secondary">Total Staked</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{avgScore.toFixed(1)}</div>
            <div className="text-sm text-text-secondary">Avg Score</div>
          </div>
        </div>
      </div>

      {/* Miners List */}
      <div className="glass-panel rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-display font-bold text-white mb-4">
          Miners ({miners.length})
        </h2>
        
        {loading ? (
          <div className="text-center py-8 text-text-secondary">Loading miners...</div>
        ) : miners.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">No miners registered yet</div>
        ) : (
          <div className="space-y-3">
            {miners.map((miner, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-panel-dark/50 rounded-lg border border-white/5 hover:border-neon-cyan/30 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-neon-cyan/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-neon-cyan">memory</span>
                  </div>
                  <div>
                    <div className="font-bold text-white">{miner.minerId}</div>
                    <div className="text-sm text-text-secondary">
                      {miner.capabilities?.join(', ') || 'N/A'}
                      {miner.consensusTimestamp && (
                        <>
                          {' • '}
                          <a 
                            href={`https://hashscan.io/testnet/transaction/${miner.consensusTimestamp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neon-cyan hover:underline"
                          >
                            View TX
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-neon-cyan">
                    {(miner.stakeAmount / 100000000).toFixed(0)} MDT
                  </div>
                  <div className="text-xs text-text-secondary">Staked</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Tasks */}
      <div className="glass-panel rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-display font-bold text-white mb-4">
          Recent Tasks ({tasks.length})
        </h2>
        
        {loading ? (
          <div className="text-center py-8 text-text-secondary">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">No tasks yet</div>
        ) : (
          <div className="space-y-3">
            {tasks.slice(-10).reverse().map((task, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-panel-dark/50 rounded-lg border border-white/5 hover:border-neon-pink/30 transition-colors">
                <div className="flex-1">
                  <div className="font-bold text-white">{task.taskId}</div>
                  <div className="text-sm text-text-secondary mt-1">
                    {task.taskType} • {task.prompt?.substring(0, 60)}...
                    {task.consensusTimestamp && (
                      <>
                        {' • '}
                        <a 
                          href={`https://hashscan.io/testnet/transaction/${task.consensusTimestamp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neon-pink hover:underline"
                        >
                          View TX
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="font-bold text-neon-green">
                    {(task.rewardAmount / 100000000).toFixed(0)} MDT
                  </div>
                  <div className="text-xs text-text-secondary">Reward</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Scores */}
      <div className="glass-panel rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-display font-bold text-white mb-4">
          Recent Validations ({scores.length})
        </h2>
        
        {loading ? (
          <div className="text-center py-8 text-text-secondary">Loading scores...</div>
        ) : scores.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">No validations yet</div>
        ) : (
          <div className="space-y-3">
            {scores.slice(-15).reverse().map((score, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-panel-dark/50 rounded-lg border border-white/5 hover:border-purple-500/30 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-400 text-sm">verified</span>
                  </div>
                  <div>
                    <div className="text-sm text-white">
                      <span className="text-purple-400">{score.validatorId}</span>
                      {' → '}
                      <span className="text-neon-cyan">{score.minerId}</span>
                    </div>
                    <div className="text-xs text-text-secondary">
                      Task: {score.taskId}
                      {score.consensusTimestamp && (
                        <>
                          {' • '}
                          <a 
                            href={`https://hashscan.io/testnet/transaction/${score.consensusTimestamp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:underline"
                          >
                            View TX
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-neon-green">
                    {score.score.toFixed(1)}
                  </div>
                  <div className="text-xs text-text-secondary">
                    Confidence: {(score.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface SubnetsHubProps {
  onSelect?: (id: number) => void;
}

export default function SubnetsHub({ onSelect }: SubnetsHubProps) {
  const { data: stats, loading, error } = useProtocolStats();
  const [selectedSubnet, setSelectedSubnet] = useState<any>(null);

  // Create subnets from real data
  const subnets = [
    {
      id: 0,
      name: 'General Intelligence',
      description: 'Text generation, code review, and general AI tasks',
      emission: '45%',
      miners: stats?.miners.filter(m => m.subnetIds?.includes(0)).length || 0,
      tasks: stats?.tasks.length || 0,
      color: 'neon-cyan'
    },
    {
      id: 1,
      name: 'Image Generation',
      description: 'Image generation, style transfer, and visual AI',
      emission: '30%',
      miners: stats?.miners.filter(m => m.subnetIds?.includes(1)).length || 0,
      tasks: 0,
      color: 'neon-pink'
    },
    {
      id: 2,
      name: 'Code Analysis',
      description: 'Code review, bug detection, and optimization',
      emission: '25%',
      miners: stats?.miners.filter(m => m.subnetIds?.includes(2)).length || 0,
      tasks: 0,
      color: 'neon-purple'
    }
  ];

  if (selectedSubnet) {
    return <SubnetDetail subnet={selectedSubnet} onBack={() => setSelectedSubnet(null)} />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">
            Subnets Hub
          </h1>
          <p className="text-text-secondary">
            Specialized AI compute networks on ModernTensor
          </p>
        </div>
        <div className="glass-panel px-6 py-3 rounded-lg border border-neon-cyan/30">
          <div className="text-sm text-text-secondary">Total Subnets</div>
          <div className="text-3xl font-bold text-neon-cyan">{subnets.length}</div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-text-secondary">
          Loading subnet data from Hedera HCS...
        </div>
      )}

      {error && (
        <div className="glass-panel rounded-xl p-6 border border-red-500/30 bg-red-500/10">
          <div className="text-red-400">Error loading data: {error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subnets.map((subnet) => (
          <div
            key={subnet.id}
            onClick={() => setSelectedSubnet(subnet)}
            className="glass-panel rounded-xl p-6 border border-white/10 hover:border-neon-cyan/50 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-display font-bold text-white group-hover:text-neon-cyan transition-colors">
                  {subnet.name}
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  {subnet.description}
                </p>
              </div>
              <div className={`text-2xl font-bold text-${subnet.color}`}>
                {subnet.emission}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <div className="text-2xl font-bold text-white">{subnet.miners}</div>
                <div className="text-xs text-text-secondary">Miners</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{subnet.tasks}</div>
                <div className="text-xs text-text-secondary">Tasks</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">View Details</span>
                <span className="material-symbols-outlined text-neon-cyan group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Real-time Stats */}
      {stats && (
        <div className="glass-panel rounded-xl p-6 border border-white/10">
          <h2 className="text-2xl font-display font-bold text-white mb-4">
            Network Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-bold text-neon-cyan">{stats.totalMiners}</div>
              <div className="text-sm text-text-secondary">Total Miners</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-neon-pink">{stats.totalValidators}</div>
              <div className="text-sm text-text-secondary">Validators</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-neon-green">{stats.totalTasks}</div>
              <div className="text-sm text-text-secondary">Tasks Processed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-neon-purple">
                {(stats.totalStaked / 100000000).toFixed(0)} MDT
              </div>
              <div className="text-sm text-text-secondary">Total Staked</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
