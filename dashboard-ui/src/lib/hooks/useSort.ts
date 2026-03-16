import { useState, useCallback } from 'react';

export type SortDir = 'asc' | 'desc' | null;

export interface SortState {
  col: string | null;
  dir: SortDir;
}

export function useSort(defaultCol?: string, defaultDir: SortDir = 'desc') {
  const [sort, setSort] = useState<SortState>({ col: defaultCol ?? null, dir: defaultDir });

  const toggle = useCallback((col: string) => {
    setSort(prev => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: null, dir: null };
    });
  }, []);

  const sortData = useCallback(<T>(data: T[], getValue: (row: T, col: string) => any): T[] => {
    if (!sort.col || !sort.dir) return data;
    return [...data].sort((a, b) => {
      const av = getValue(a, sort.col!);
      const bv = getValue(b, sort.col!);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [sort]);

  return { sort, toggle, sortData };
}
