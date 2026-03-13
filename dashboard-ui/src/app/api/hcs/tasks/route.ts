import { NextResponse } from 'next/server';
import { hcsMirrorClient } from '@/lib/hcs-mirror-client';

export async function GET() {
  try {
    const tasks = await hcsMirrorClient.getTaskSubmissions();
    
    return NextResponse.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error: any) {
    console.error('Error fetching tasks from HCS:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
