import { NextResponse } from 'next/server';
import { hcsMirrorClient } from '@/lib/hcs-mirror-client';

export async function GET() {
  try {
    const scores = await hcsMirrorClient.getScoreSubmissions();
    
    return NextResponse.json({
      success: true,
      data: scores,
      count: scores.length
    });
  } catch (error: any) {
    console.error('Error fetching scores from HCS:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scores' },
      { status: 500 }
    );
  }
}
