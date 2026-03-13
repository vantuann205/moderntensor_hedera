'use client';

import { useState, useEffect } from 'react';

export interface ProtocolStats {
  subnetCount: number;
  totalProtocolFees: bigint;
  totalStaked: bigint;
  activeMinerCount: number;
  activeValidatorCount: number;
  token: {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: bigint;
  };
}

export interface SubnetData {
  id: number;
  name: string;
  description: string;
  owner: string;
  feeRate: number;
  minTaskReward: string;
  totalVolume: string;
  totalTasks: number;
  activeMiners: number;
  status: number;
  createdAt: number;
}

export interface UserData {
  address: string;
  earnings: {
    minerEarnings: string;
    validatorEarnings: string;
    total: string;
  };
  stake: {
    amount: string;
    role: number;
    stakedAt: number;
    unstakeRequestedAt: number;
    isActive: boolean;
  };
  tokenBalance: string;
}

export function useProtocolStats() {
  const [data, setData] = useState<ProtocolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats');
        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
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
    const interval = setInterval(fetchStats, 10000); // Refresh every 10s
    
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useSubnets() {
  const [data, setData] = useState<SubnetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubnets() {
      try {
        const response = await fetch('/api/subnets');
        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to fetch subnets');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch subnets');
      } finally {
        setLoading(false);
      }
    }

    fetchSubnets();
    const interval = setInterval(fetchSubnets, 15000); // Refresh every 15s
    
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useUserData(address: string | null) {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setData(null);
      setLoading(false);
      return;
    }

    async function fetchUserData() {
      setLoading(true);
      try {
        const response = await fetch(`/api/user/${address}`);
        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to fetch user data');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
    const interval = setInterval(fetchUserData, 10000); // Refresh every 10s
    
    return () => clearInterval(interval);
  }, [address]);

  return { data, loading, error };
}
