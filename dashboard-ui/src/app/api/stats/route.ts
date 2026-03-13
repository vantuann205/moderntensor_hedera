import { NextResponse } from 'next/server';
import { contractService } from '@/lib/contracts';

export async function GET() {
  try {
    const registryAddress = process.env.NEXT_PUBLIC_SUBNET_REGISTRY_ADDRESS;
    const vaultAddress = process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS;
    const tokenAddress = process.env.NEXT_PUBLIC_MDT_TOKEN_ADDRESS;
    
    if (!registryAddress || !vaultAddress || !tokenAddress) {
      return NextResponse.json(
        { error: 'Contract addresses not configured' },
        { status: 500 }
      );
    }

    const [protocolStats, tokenInfo] = await Promise.all([
      contractService.getProtocolStats(registryAddress, vaultAddress),
      contractService.getTokenInfo(tokenAddress)
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        ...protocolStats,
        token: tokenInfo
      }
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
