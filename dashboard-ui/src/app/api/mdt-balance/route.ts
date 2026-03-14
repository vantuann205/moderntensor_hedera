import { NextResponse } from 'next/server';

// MDT token on Hedera testnet — HTS token 0.0.8198586
// EVM address = 0x + num in hex padded to 40 chars
const MDT_TOKEN_ID = process.env.NEXT_PUBLIC_MDT_TOKEN_ID || '0.0.8198586';
const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  try {
    // Query HTS token balance via Mirror Node
    const res = await fetch(
      `${MIRROR}/accounts/${accountId}/tokens?token.id=${MDT_TOKEN_ID}&limit=1`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    const tokens: any[] = data.tokens || [];
    const entry = tokens.find((t: any) => t.token_id === MDT_TOKEN_ID);

    // MDT has 8 decimals — convert smallest unit to MDT
    const rawBalance = entry ? BigInt(entry.balance) : 0n;
    const mdtBalance = Number(rawBalance) / 1e8;

    // Also fetch HBAR balance
    const accRes = await fetch(`${MIRROR}/accounts/${accountId}`, { cache: 'no-store' });
    const accData = await accRes.json();
    const hbarBalance = accData.balance?.balance ? Number(accData.balance.balance) / 1e8 : 0;
    const evmAddress: string = accData.evm_address || '';

    return NextResponse.json({
      success: true,
      accountId,
      evmAddress,
      mdtBalance,
      mdtRaw: rawBalance.toString(),
      hbarBalance,
      tokenId: MDT_TOKEN_ID,
      // min stakes per StakingVault.sol
      minMinerStake: 1000,
      minValidatorStake: 50000,
      hasEnoughForMiner: mdtBalance >= 1000,
      hasEnoughForValidator: mdtBalance >= 50000,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
