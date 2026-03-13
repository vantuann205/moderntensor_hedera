import { NextResponse } from 'next/server';
import { mirrorNodeClient } from '@/lib/mirror-node-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    if (type === 'blocks') {
      const blocks = await mirrorNodeClient.getLatestBlocks(limit);
      return NextResponse.json({ success: true, data: blocks });
    }

    if (type === 'transactions') {
      const transactions = await mirrorNodeClient.getLatestTransactions(limit);
      return NextResponse.json({ success: true, data: transactions });
    }

    if (type === 'transaction') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
      const [transaction, hbarPrice] = await Promise.all([
        mirrorNodeClient.getTransaction(id),
        mirrorNodeClient.getHbarPrice()
      ]);
      return NextResponse.json({ success: true, data: { transaction, hbarPrice } });
    }

    if (type === 'search') {
      const query = searchParams.get('query');
      if (!query) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
      const result = await mirrorNodeClient.search(query);
      return NextResponse.json({ success: true, data: result });
    }

    // Default: fetch both for initial view
    const [blocks, transactions] = await Promise.all([
      mirrorNodeClient.getLatestBlocks(5),
      mirrorNodeClient.getLatestTransactions(5)
    ]);

    return NextResponse.json({
      success: true,
      data: { blocks, transactions }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
