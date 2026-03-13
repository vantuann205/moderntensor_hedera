import { NextResponse } from 'next/server';
import { contractService } from '@/lib/contracts';

export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
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

    const userAddress = params.address;

    const [earnings, stakeInfo, tokenBalance] = await Promise.all([
      contractService.getUserEarnings(registryAddress, userAddress),
      contractService.getStakeInfo(vaultAddress, userAddress),
      contractService.getTokenBalance(tokenAddress, userAddress)
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        address: userAddress,
        earnings,
        stake: stakeInfo,
        tokenBalance
      }
    });
  } catch (error: any) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}
