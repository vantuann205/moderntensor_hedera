import { NextResponse } from 'next/server';

const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';
const VAULT_HEDERA_ID = '0.0.8219632'; // StakingVaultV2

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  try {
    // 1. Get all CONTRACTCALL txs from this account to StakingVaultV2 (SUCCESS only)
    const contractRes = await fetch(
      `${MIRROR}/transactions?account.id=${accountId}&transactiontype=CONTRACTCALL&limit=50&order=desc`,
      { cache: 'no-store' }
    );
    const contractData = contractRes.ok ? await contractRes.json() : { transactions: [] };
    const contractTxs: any[] = (contractData.transactions || [])
      .filter((t: any) => t.entity_id === VAULT_HEDERA_ID && t.result === 'SUCCESS');

    // 2. Get all CRYPTOTRANSFER txs from this account (MDT transfers to vault)
    const transferRes = await fetch(
      `${MIRROR}/transactions?account.id=${accountId}&transactiontype=CRYPTOTRANSFER&limit=50&order=desc`,
      { cache: 'no-store' }
    );
    const transferData = transferRes.ok ? await transferRes.json() : { transactions: [] };

    // Find MDT transfers to vault by checking token_transfers
    // We'll enrich contract txs by finding the closest preceding CRYPTOTRANSFER
    const allTransfers: any[] = transferData.transactions || [];

    // 3. For each successful contract call, find the MDT transfer that happened just before it
    const stakeEvents = contractTxs.map((ctx: any) => {
      const ctxTs = parseFloat(ctx.consensus_timestamp);

      // Find the closest CRYPTOTRANSFER within 60s before this contract call
      const matchedTransfer = allTransfers.find((t: any) => {
        const tTs = parseFloat(t.consensus_timestamp);
        return tTs < ctxTs && ctxTs - tTs < 60;
      });

      return {
        contractTs: ctx.consensus_timestamp,
        contractTxId: ctx.transaction_id,
        transferTs: matchedTransfer?.consensus_timestamp || null,
        transferTxId: matchedTransfer?.transaction_id || null,
        timestamp: ctxTs,
      };
    });

    // 4. Also get token transfer amounts for MDT
    // Enrich with token_transfers detail if available
    const enriched = await Promise.all(
      stakeEvents.map(async (ev) => {
        let mdtAmount: number | null = null;
        if (ev.transferTs) {
          try {
            const detail = await fetch(
              `${MIRROR}/transactions/${ev.transferTs}`,
              { cache: 'no-store' }
            );
            if (detail.ok) {
              const d = await detail.json();
              const tokenTransfers: any[] = d.transactions?.[0]?.token_transfers || [];
              // Find MDT (0.0.8198586) outgoing from this account
              const mdt = tokenTransfers.find(
                (tt: any) => tt.token_id === '0.0.8198586' && tt.account === accountId && tt.amount < 0
              );
              if (mdt) mdtAmount = Math.abs(mdt.amount) / 1e8;
            }
          } catch (_) {}
        }
        return { ...ev, mdtAmount };
      })
    );

    return NextResponse.json({ success: true, data: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
