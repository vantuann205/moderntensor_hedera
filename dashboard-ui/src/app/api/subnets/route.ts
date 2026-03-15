import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const REGISTRY_HEDERA_ID = '0.0.8219634';
const REGISTRY_EVM = '0xbdbd7a138c7f815b1A7f432C1d06b2B95E46Ba1F';
const HEDERA_RPC = 'https://testnet.hashio.io/api';
const SUBNET_CREATED_SIG = ethers.id('SubnetCreated(uint256,string,address,uint256)');

const REGISTRY_ABI = [
  'function getSubnet(uint256 id) view returns (uint256 id, string name, string description, address owner, uint256 feeRate, uint256 minTaskReward, uint256 totalVolume, uint256 totalTasks, uint256 activeMiners, uint8 status, uint256 createdAt)',
];

// Canonical subnet definitions — used as fallback when on-chain has no subnets yet
const CANONICAL_SUBNETS = [
  { id: 0, name: 'General Intelligence', description: 'Text generation, code review, and general AI tasks', emission: '45%' },
  { id: 1, name: 'Image Generation', description: 'Image generation, style transfer, and visual AI', emission: '30%' },
  { id: 2, name: 'Code Analysis', description: 'Code review, bug detection, and optimization', emission: '25%' },
];

export async function GET() {
  try {
    // 1. Query mirror node for SubnetCreated events
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://testnet.mirrornode.hedera.com/api/v1/contracts/${REGISTRY_HEDERA_ID}/results/logs?limit=100&order=asc`,
      { signal: controller.signal, cache: 'no-store' }
    );
    clearTimeout(timeout);

    const data = res.ok ? await res.json() : { logs: [] };
    const rawLogs: any[] = data.logs || [];

    // Extract subnet IDs from SubnetCreated events
    const onChainIds = new Set<number>();
    for (const log of rawLogs) {
      const topics: string[] = log.topics || [];
      if (topics[0]?.toLowerCase() === SUBNET_CREATED_SIG.toLowerCase() && topics[1]) {
        const id = parseInt(topics[1], 16);
        if (!isNaN(id)) onChainIds.add(id);
      }
    }

    let subnets: any[];

    if (onChainIds.size === 0) {
      // No on-chain subnets yet — return canonical list
      subnets = CANONICAL_SUBNETS.map(s => ({ ...s, activeMiners: 0, status: 0, onChain: false }));
    } else {
      // Fetch details for each on-chain subnet
      const provider = new ethers.JsonRpcProvider(HEDERA_RPC);
      const registry = new ethers.Contract(REGISTRY_EVM, REGISTRY_ABI, provider);
      subnets = [];

      for (const id of Array.from(onChainIds).sort((a, b) => a - b)) {
        const canonical = CANONICAL_SUBNETS.find(c => c.id === id);
        try {
          const s = await Promise.race([
            registry.getSubnet(id),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
          ]) as any;
          subnets.push({
            id,
            name: s.name || canonical?.name || `Subnet ${id}`,
            description: s.description || canonical?.description || '',
            emission: canonical?.emission || '—',
            activeMiners: Number(s.activeMiners),
            status: Number(s.status),
            onChain: true,
          });
        } catch (_) {
          subnets.push({
            id,
            name: canonical?.name || `Subnet ${id}`,
            description: canonical?.description || '',
            emission: canonical?.emission || '—',
            activeMiners: 0,
            status: 0,
            onChain: true,
          });
        }
      }
    }

    return NextResponse.json({ success: true, data: subnets });
  } catch (e: any) {
    // Always return canonical fallback — never fail
    return NextResponse.json({
      success: true,
      data: CANONICAL_SUBNETS.map(s => ({ ...s, activeMiners: 0, status: 0, onChain: false })),
    });
  }
}
