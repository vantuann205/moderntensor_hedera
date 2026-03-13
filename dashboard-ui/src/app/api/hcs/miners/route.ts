import { NextResponse } from 'next/server';
import { hcsMirrorClient } from '@/lib/hcs-mirror-client';

export async function GET() {
  try {
    const miners = await hcsMirrorClient.getMinerRegistrations();
    
    return NextResponse.json({
      success: true,
      data: miners,
      count: miners.length
    });
  } catch (error: any) {
    console.error('Error fetching miners from HCS:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch miners' },
      { status: 500 }
    );
  }
}
