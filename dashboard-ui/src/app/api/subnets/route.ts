import { NextResponse } from 'next/server';
import { contractService } from '@/lib/contracts';

export async function GET() {
  try {
    const registryAddress = process.env.NEXT_PUBLIC_SUBNET_REGISTRY_ADDRESS;
    
    if (!registryAddress) {
      return NextResponse.json(
        { error: 'Subnet Registry address not configured' },
        { status: 500 }
      );
    }

    const subnets = await contractService.getAllSubnets(registryAddress);
    
    return NextResponse.json({
      success: true,
      data: subnets
    });
  } catch (error: any) {
    console.error('Error fetching subnets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subnets' },
      { status: 500 }
    );
  }
}
