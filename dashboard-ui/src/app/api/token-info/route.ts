import { NextResponse } from 'next/server';

const MIRROR_NODE = 'https://testnet.mirrornode.hedera.com/api/v1';
const MDT_TOKEN_ID = process.env.NEXT_PUBLIC_MDT_TOKEN_ID || '0.0.8198586';

export async function GET() {
  try {
    const res = await fetch(`${MIRROR_NODE}/tokens/${MDT_TOKEN_ID}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Mirror node error: ${res.status}`);
    const data = await res.json();

    const decimals = parseInt(data.decimals || '8');
    const totalSupply = parseInt(data.total_supply || '0') / Math.pow(10, decimals);
    const circulatingSupply = totalSupply; // HTS: all minted supply is circulating

    return NextResponse.json({
      success: true,
      data: {
        tokenId: data.token_id,
        name: data.name,
        symbol: data.symbol,
        decimals,
        totalSupply,
        circulatingSupply,
        maxSupply: data.max_supply ? parseInt(data.max_supply) / Math.pow(10, decimals) : null,
        treasuryAccountId: data.treasury_account_id,
        createdTimestamp: data.created_timestamp,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
