'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * Ordenación de tablas por columna.
 * Clic en la cabecera: ascendente → descendente → sin ordenar (orden original).
 */

export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

export type SortValue = string | number | boolean | null | undefined | false;
export type SortGetters<T> = Record<string, (row: T) => SortValue>;

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export function compareValues(a: SortValue, b: SortValue): number {
  const emptyA = a === null || a === undefined || a === false || a === '';
  const emptyB = b === null || b === undefined || b === false || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}

/** Devuelve una copia ordenada (o el mismo array si no hay orden activo). Los vacíos van siempre al final. */
export function sortRows<T>(rows: T[], sort: SortState | undefined, getters: SortGetters<T>): T[] {
  if (!sort) return rows;
  const get = getters[sort.key];
  if (!get) return rows;
  const factor = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: get(row) }))
    .sort((x, y) => {
      const emptyX = x.value === null || x.value === undefined || x.value === false || x.value === '';
      const emptyY = y.value === null || y.value === undefined || y.value === false || y.value === '';
      if (emptyX !== emptyY) return emptyX ? 1 : -1;
      return compareValues(x.value, y.value) * factor || x.index - y.index;
    })
    .map((item) => item.row);
}

/** Siguiente estado al pulsar una columna. */
export function nextSort(current: SortState | undefined, key: string): SortState | undefined {
  if (!current || current.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return undefined;
}

interface SortableThProps {
  sortKey: string;
  sort: SortState | undefined;
  onSort: (key: string) => void;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children: ReactNode;
}

export function SortableTh({ sortKey, sort, onSort, className = '', style, title, children }: SortableThProps) {
  const active = sort?.key === sortKey;
  const right = /\btext-right\b/.test(className);
  const center = /\btext-center\b/.test(className);
  return (
    <th
      className={`${className} cursor-pointer select-none transition-colors hover:bg-slate-200/70 ${active ? 'text-slate-900' : ''}`}
      style={style}
      title={title ?? 'Ordenar'}
      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''} ${center ? 'justify-center' : ''}`}>
        <span>{children}</span>
        <span aria-hidden className={`text-[9px] leading-none ${active ? 'text-brand-600' : 'text-slate-300'}`}>
          {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );
}
