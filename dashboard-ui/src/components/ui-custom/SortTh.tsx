import React from 'react';
import type { SortState } from '@/lib/hooks/useSort';

interface Props {
  col: string;
  sort: SortState;
  onToggle: (col: string) => void;
  children: React.ReactNode;
  className?: string;
}

export default function SortTh({ col, sort, onToggle, children, className = '' }: Props) {
  const active = sort.col === col;
  return (
    <th
      className={`cursor-pointer select-none group ${className}`}
      onClick={() => onToggle(col)}
    >
      <span className="flex items-center gap-1 whitespace-nowrap">
        {children}
        <span className="flex flex-col leading-none opacity-40 group-hover:opacity-100 transition-opacity">
          <span className={`text-[10px] leading-none ${active && sort.dir === 'asc' ? 'text-neon-cyan opacity-100' : ''}`}>▲</span>
          <span className={`text-[10px] leading-none ${active && sort.dir === 'desc' ? 'text-neon-cyan opacity-100' : ''}`}>▼</span>
        </span>
      </span>
    </th>
  );
}
