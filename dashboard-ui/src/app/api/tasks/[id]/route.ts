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

    const taskId = parseInt(params.id);
    const task = await contractService.getTask(registryAddress, taskId);
    
    return NextResponse.json({
      success: true,
      data: task
    });
  } catch (error: any) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task' },
      { status: 500 }
    );
  }
}
