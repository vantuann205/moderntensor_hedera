import { NextResponse } from 'next/server';
import { contractService } from '@/lib/contracts';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const registryAddress = process.env.NEXT_PUBLIC_SUBNET_REGISTRY_ADDRESS;
    
    if (!registryAddress) {
      return NextResponse.json(
        { error: 'Subnet Registry address not configured' },
        { status: 500 }
      );
    }

    const subnetId = parseInt(params.id);
    const subnet = await contractService.getSubnet(registryAddress, subnetId);
    
    return NextResponse.json({
      success: true,
      data: subnet
    });
  } catch (error: any) {
    console.error('Error fetching subnet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subnet' },
      { status: 500 }
    );
  }
}
