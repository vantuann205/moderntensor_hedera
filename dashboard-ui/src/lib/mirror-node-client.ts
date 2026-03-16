export interface MirrorBlock {
  height: number;
  hash: string;
  timestamp: string;
  timestamp_to?: string;
  count: number;
  gas_used: number;
  name?: string;
}

export interface MirrorTransaction {
  transaction_id: string;
  hash: string;
  consensus_timestamp: string;
  name: string;
  result: string;
  charged_tx_fee: number;
  max_fee: number;
  valid_duration_seconds: number;
  transaction_nonce: number;
  memo_base64: string;
  node: string;
  payer_account_id: string;
  block_number?: number;
  block_hash?: string;
  transfers: { account: string; amount: number; is_approval: boolean }[];
  valid_start_timestamp: string;
  // HCS Specific
  sequence_number?: number;
  running_hash?: string;
  running_hash_version?: number;
  message?: string;
}

export class MirrorNodeClient {
  private mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com/api/v1';

  async getLatestBlocks(limit: number = 10): Promise<MirrorBlock[]> {
    try {
      const response = await fetch(`${this.mirrorNodeUrl}/blocks?limit=${limit}&order=desc`, { cache: 'no-store' });
      if (!response.ok) return [];
      const data = await response.json();
      return data.blocks.map((b: any) => ({
        height: b.number,
        hash: b.hash,
        timestamp: b.timestamp.from,
        timestamp_to: b.timestamp.to,
        count: b.count,
        gas_used: b.gas_used,
        name: b.name
      }));
    } catch (e) {
      console.error('Error fetching blocks:', e);
      return [];
    }
  }

  async getBlock(heightOrHash: string): Promise<MirrorBlock | null> {
    try {
      const response = await fetch(`${this.mirrorNodeUrl}/blocks/${heightOrHash}`, { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json();
      return {
        height: data.number,
        hash: data.hash,
        timestamp: data.timestamp.from,
        timestamp_to: data.timestamp.to,
        count: data.count,
        gas_used: data.gas_used,
        name: data.name
      };
    } catch (e) {
      console.error('Error fetching block:', e);
      return null;
    }
  }

  async getLatestTransactions(limit: number = 10): Promise<MirrorTransaction[]> {
    try {
      const response = await fetch(`${this.mirrorNodeUrl}/transactions?limit=${limit}&order=desc`, { cache: 'no-store' });
      if (!response.ok) return [];
      const data = await response.json();
      return data.transactions.map((t: any) => ({
        transaction_id: t.transaction_id,
        hash: t.hash,
        consensus_timestamp: t.consensus_timestamp,
        name: t.name,
        result: t.result,
        charged_tx_fee: t.charged_tx_fee,
        max_fee: t.max_fee,
        valid_duration_seconds: t.valid_duration_seconds,
        transaction_nonce: t.transaction_nonce,
        memo_base64: t.memo_base64,
        node: t.node,
        payer_account_id: t.payer_account_id,
        block_number: t.block_number,
        block_hash: t.block_hash,
        transfers: t.transfers,
        valid_start_timestamp: t.valid_start_timestamp
      }));
    } catch (e) {
      console.error('Error fetching transactions:', e);
      return [];
    }
  }

  async getTransaction(idOrHash: string): Promise<MirrorTransaction | null> {
    try {
      // Robust normalization of Transaction ID
      // Handles: 0.0.x@sec.nano, 0.0.x-sec-nano, 0.0.x.sec.nano
      let normalizedId = idOrHash;
      
      if (idOrHash.includes('@') || (idOrHash.split('.').length > 3)) {
          // Replace @ with -
          normalizedId = idOrHash.replace('@', '-');
          // If there's a dot after the third part (the account number), replace it with - 
          // Example: 0.0.8127455.1773381054.764939069 -> 0.0.8127455-1773381054-764939069
          const parts = normalizedId.split('-');
          if (parts.length > 1) {
              const txParts = parts[1].split('.');
              if (txParts.length > 1) {
                  normalizedId = `${parts[0]}-${txParts.join('-')}`;
              }
          }
      }

      const response = await fetch(`${this.mirrorNodeUrl}/transactions/${normalizedId}`, { cache: 'no-store' });
      
      if (!response.ok) {
        // Try searching by transaction ID parameter if direct fetch failed
        const searchParams = new URLSearchParams();
        searchParams.append('transactionid', normalizedId);
        searchParams.append('limit', '1');
        
        const searchResponse = await fetch(`${this.mirrorNodeUrl}/transactions?${searchParams.toString()}`, { cache: 'no-store' });
        if (!searchResponse.ok) return null;
        const searchData = await searchResponse.json();
        if (!searchData.transactions || searchData.transactions.length === 0) {
            // Last ditch: maybe it's a timestamp
            const tsResponse = await fetch(`${this.mirrorNodeUrl}/transactions?timestamp=${idOrHash}&limit=1`, { cache: 'no-store' });
            if (tsResponse.ok) {
                const tsData = await tsResponse.json();
                if (tsData.transactions && tsData.transactions.length > 0) return tsData.transactions[0];
            }
            return null;
        }
        return searchData.transactions[0];
      }
      
      const data = await response.json();
      if (!data.transactions || data.transactions.length === 0) return null;
      
      const transaction = data.transactions[0];
      
      // If it's an HCS Submit Message, fetch the message details
      if (transaction.name === 'CONSENSUSSUBMITMESSAGE') {
        try {
          const msgResponse = await fetch(`${this.mirrorNodeUrl}/topics/messages/${transaction.consensus_timestamp}`, { cache: 'no-store' });
          if (msgResponse.ok) {
            const msgData = await msgResponse.json();
            transaction.sequence_number = msgData.sequence_number;
            transaction.running_hash = msgData.running_hash;
            transaction.running_hash_version = msgData.running_hash_version;
            transaction.message = msgData.message; // Base64
          }
        } catch (e) {
          console.error('Error fetching HCS message details:', e);
        }
      }

      return transaction;
    } catch (e) {
      console.error('Error fetching transaction:', e);
      return null;
    }
  }

  async getHbarPrice(): Promise<number> {
    try {
      const response = await fetch(`${this.mirrorNodeUrl}/network/exchangerate`, { cache: 'no-store' });
      if (!response.ok) return 0.09; // Mock default
      const data = await response.json();
      return data.current_rate.cent_equivalent / 100;
    } catch {
      return 0.09;
    }
  }

  async search(query: string): Promise<any> {
    // Basic pattern matching for search
    if (!query) return null;
    
    // Account ID: 0.0.x
    if (/^\d+\.\d+\.\d+$/.test(query)) {
      return { type: 'account', id: query };
    }
    
    // Transaction ID: account@seconds.nanos
    if (/^\d+\.\d+\.\d+@\d+\.\d+$/.test(query)) {
      // Sometimes transaction IDs are formatted with - instead of @
      return { type: 'transaction', id: query };
    }
    
    if (/^\d+\.\d+\.\d+-\d+-\d+$/.test(query)) {
        const parts = query.split('-');
        const formattedId = `${parts[0]}.${parts[1]}.${parts[2]}@${parts[3]}.${parts[4]}`;
        return { type: 'transaction', id: formattedId };
    }

    // Hash or generic hex
    if (/^0x[a-fA-F0-9]{64}$/.test(query) || /^[a-fA-F0-9]{64}$/.test(query)) {
      return { type: 'hash', id: query };
    }

    // Block number
    if (/^\d+$/.test(query)) {
      return { type: 'block', id: query };
    }

    return null;
  }
}

export const mirrorNodeClient = new MirrorNodeClient();
