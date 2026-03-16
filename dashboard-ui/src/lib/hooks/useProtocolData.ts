'use client';

import { useState, useEffect } from 'react';

// Re-export from hooks/useRealData for backward compat
export { useProtocolStats, useTasks, useScores } from '@/hooks/useRealData';

export function useMiners() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch_() {
      try {
        setIsLoading(true);
        const hcsRes = await fetch('/api/hcs/miners');
        const hcsJson = await hcsRes.json();
        let miners: any[] = hcsJson.success ? hcsJson.data : [];
        try {
          const localRes = await fetch('/api/miners');
          const localJson = await localRes.json();
          const localMiners: any[] = Array.isArray(localJson) ? localJson : [];
          const localMap: Record<string, any> = {};
          localMiners.forEach((m: any) => { const id = m.miner_id || m.id; if (id) localMap[id] = m; });
          if (miners.length === 0 && localMiners.length > 0) {
            miners = localMiners;
          } else {
            miners = miners.map((m: any) => {
              const id = m.miner_id || m.account_id;
              const local = localMap[id] || {};
              return { ...local, ...m, miner_id: m.miner_id || m.account_id, account_id: m.account_id || m.miner_id, stake_amount: m.stake_amount ?? local.stake_amount ?? 0, subnet_ids: m.subnet_ids ?? local.subnet_ids ?? [0], capabilities: m.capabilities ?? local.capabilities ?? [], trust_score: m.trust_score ?? local.trust_score ?? 0.5, tasks_completed: m.tasks_completed ?? local.tasks_completed ?? 0, registered_at: m.registered_at || local.registered_at, status: m.status || local.status || 'active', reputation: local.reputation };
            });
          }
        } catch (_) {}
        setData(miners); setError(null);
      } catch (err: any) { setError(err.message); }
      finally { setIsLoading(false); }
    }
    fetch_();
    const t = setInterval(fetch_, 20000);
    return () => clearInterval(t);
  }, []);

  return { data, isLoading, error };
}

export function useMiner(id: string) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    fetch(`/api/miners/${encodeURIComponent(id)}`).then(r => r.json()).then(j => {
      setData(j.success ? j.data : null); setError(j.success ? null : j.error); setIsLoading(false);
    }).catch((e: any) => { setError(e.message); setIsLoading(false); });
  }, [id]);
  return { data, isLoading, error };
}

// ── Exports used by legacy pages ──────────────────────────────────────────────
function makeSimpleHook(url: string) {
  return function () {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
      fetch(url).then(r => r.json()).then(j => { setData(j.data || j || []); setIsLoading(false); })
        .catch((e: any) => { setError(e.message); setIsLoading(false); });
    }, []);
    return { data, isLoading, error };
  };
}

export const useValidators = makeSimpleHook('/api/hcs/miners?role=validator');
export const useSubnets = makeSimpleHook('/api/hcs/miners');
export const useEmissions = makeSimpleHook('/api/hcs/scores');

export function useValidator(id: string) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    fetch(`/api/hcs/miners?id=${encodeURIComponent(id)}`).then(r => r.json()).then(j => {
      setData(j.data?.[0] || null); setIsLoading(false);
    }).catch((e: any) => { setError(e.message); setIsLoading(false); });
  }, [id]);
  return { data, isLoading, error };
}

export function useTask(id: string) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    fetch('/api/hcs/tasks').then(r => r.json()).then(j => {
      const tasks: any[] = j.data || [];
      setData(tasks.find(t => String(t.taskId) === id || String(t.onChainTaskId) === id) || null);
      setIsLoading(false);
    }).catch((e: any) => { setError(e.message); setIsLoading(false); });
  }, [id]);
  return { data, isLoading, error };
}

export function useNetworkState() {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    fetch('/api/protocol-stats').then(r => r.json()).then(j => { setData(j.data || null); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);
  return { data, isLoading };
}

export async function stakeValidator(_address: string, _amount: number) {
  return { success: false, error: 'Use the dashboard staking UI' };
}
