// Format utilities for displaying blockchain data

export function formatMDT(value: bigint | string, decimals: number = 8): string {
  const bigValue = typeof value === 'string' ? BigInt(value) : value;
  const divisor = BigInt(10 ** decimals);
  const integerPart = bigValue / divisor;
  const fractionalPart = bigValue % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return integerPart.toLocaleString();
  }
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  return `${integerPart.toLocaleString()}.${trimmedFractional}`;
}

export function formatAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - (timestamp * 1000);
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value / 100).toFixed(decimals)}%`;
}

export function formatBasisPoints(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function getStatusLabel(status: number): string {
  const statusMap: Record<number, string> = {
    0: 'Active',
    1: 'Paused',
    2: 'Deprecated',
    // Task statuses
    3: 'Created',
    4: 'In Progress',
    5: 'Pending Review',
    6: 'Completed',
    7: 'Cancelled',
    8: 'Expired'
  };
  
  return statusMap[status] || 'Unknown';
}

export function getStatusColor(status: number): string {
  const colorMap: Record<number, string> = {
    0: 'text-green-500',
    1: 'text-yellow-500',
    2: 'text-red-500',
    3: 'text-blue-500',
    4: 'text-cyan-500',
    5: 'text-purple-500',
    6: 'text-green-500',
    7: 'text-gray-500',
    8: 'text-red-500'
  };
  
  return colorMap[status] || 'text-gray-500';
}

export function getRoleLabel(role: number): string {
  const roleMap: Record<number, string> = {
    0: 'None',
    1: 'Miner',
    2: 'Validator'
  };
  
  return roleMap[role] || 'Unknown';
}
