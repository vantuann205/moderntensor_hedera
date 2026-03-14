import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { hcsMirrorClient } from '@/lib/hcs-mirror-client';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const minerId = decodeURIComponent(id);

  try {
    // 1. Try local registry first (has reputation/task data)
    let local: any = null;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, 'miner_registry.json'), 'utf8');
      const parsed = JSON.parse(raw);
      const minersObj = parsed.miners || parsed;
      const all: any[] = typeof minersObj === 'object' && !Array.isArray(minersObj)
        ? Object.values(minersObj)
        : Array.isArray(minersObj) ? minersObj : [];
      local = all.find((m: any) =>
        m.miner_id === minerId || m.id === minerId || m.account_id === minerId
      ) || null;
    } catch (_) {}

    // 2. Try HCS mirror for on-chain registration record
    let hcsRecord: any = null;
    try {
      const all = await hcsMirrorClient.getMinerRegistrations();
      const found = all.find((m: any) =>
        m.minerId === minerId || m.accountId === minerId
      );
      if (found) {
        hcsRecord = {
          miner_id: found.minerId,
          account_id: found.accountId,
          stake_amount: found.stakeAmount,
          subnet_ids: found.subnetIds,
          capabilities: found.capabilities,
          registered_at: found.consensusTimestamp
            ? Math.floor(parseFloat(found.consensusTimestamp))
            : undefined,
          hcs_sequence: (found as any).sequenceNumber,
          status: 'active',
        };
      }
    } catch (_) {}

    if (!local && !hcsRecord) {
      return NextResponse.json({ success: false, error: 'Miner not found' }, { status: 404 });
    }

    // 3. Enrich with task scores
    let trust_score = local?.reputation?.score ?? 0.5;
    let tasks_completed = local?.reputation?.successful_tasks ?? 0;
    try {
      const taskRaw = await fs.readFile(path.join(DATA_DIR, 'task_manager.json'), 'utf8');
      const taskData = JSON.parse(taskRaw);
      const assignments = Object.values(taskData.assignments || {}).flat() as any[];
      const mine = assignments.filter((a: any) => a.miner_id === minerId);
      if (mine.length > 0) {
        tasks_completed = mine.length;
        trust_score = mine.reduce((s: number, a: any) => s + (a.score || 0), 0) / mine.length;
      }
    } catch (_) {}

    const data = {
      ...(hcsRecord || {}),
      ...(local || {}),
      miner_id: minerId,
      trust_score,
      tasks_completed,
    };

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
