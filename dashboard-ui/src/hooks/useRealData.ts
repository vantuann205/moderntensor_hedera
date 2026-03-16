'use client';

import { useState, useEffect } from 'react';

export interface ProtocolStats {
  totalMiners: number;
  totalValidators: number;
  totalSubnets: number;
  totalTasks: number;
  totalScores: number;
  totalStaked: number;
  avgScore: number;
  miners: any[];
  tasks: any[];
  scores: any[];
  minersPerSubnet?: Record<number, number>;
  tasksPerSubnet?: Record<number, number>;
  validatorsPerSubnet?: Record<number, number>;
}

export function useProtocolStats() {
  const [data, setData] = useState<ProtocolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const response = await fetch('/api/protocol-stats');
        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to fetch stats');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch stats');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Refresh every 15s
    
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useMiners() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMiners() {
      try {
        setLoading(true);
        const response = await fetch('/api/hcs/miners');
        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to fetch miners');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch miners');
      } finally {
        setLoading(false);
      }
    }

    fetchMiners();
    const interval = setInterval(fetchMiners, 20000); // Refresh every 20s
    
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useTasks(options?: { all?: boolean }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTasks() {
      try {
        setLoading(true);
        const url = options?.all ? '/api/hcs/tasks?all=true' : '/api/hcs/tasks';
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to fetch tasks');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch tasks');
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
    const interval = setInterval(fetchTasks, 20000); // Refresh every 20s
    
    return () => clearInterval(interval);
  }, [options?.all]);

  return { data, loading, error };
}

export function useScores() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScores() {
      try {
        setLoading(true);
        const response = await fetch('/api/hcs/scores');
        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to fetch scores');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch scores');
      } finally {
        setLoading(false);
      }
    }

    fetchScores();
    const interval = setInterval(fetchScores, 20000); // Refresh every 20s
    
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useLatestBlocks(limit: number = 10) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBlocks() {
      try {
        const response = await fetch(`/api/explorer/mirror?type=blocks&limit=${limit}`);
        const result = await response.json();
        if (result.success) setData(result.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchBlocks();
    const interval = setInterval(fetchBlocks, 10000);
    return () => clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
}

export function useLatestTransactions(limit: number = 10) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const response = await fetch(`/api/explorer/mirror?type=transactions&limit=${limit}`);
        const result = await response.json();
        if (result.success) setData(result.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 10000);
    return () => clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
}

export function useTransactionDetails(id: string | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
        setData(null);
        return;
    }
    async function fetchDetails() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/explorer/mirror?type=transaction&id=${id}`);
        const result = await response.json();
        if (result.success) setData(result.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id]);

  return { data, loading, error };
}

export function useBlockDetails(id: string | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
        setData(null);
        return;
    }
    async function fetchDetails() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/explorer/mirror?type=block&id=${id}`);
        const result = await response.json();
        if (result.success) setData(result.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id]);

  return { data, loading, error };
}
