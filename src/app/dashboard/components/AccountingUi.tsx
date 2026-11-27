'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import type { AccountingAmountRow, AccountingCompany } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Formato                                                             */
/* ------------------------------------------------------------------ */

export function eur(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function eurShort(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`;
  if (a >= 1_000) return `${(v / 1_000).toLocaleString('es-ES', { maximumFractionDigits: 0 })} k€`;
  return `${Math.round(v)} €`;
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function monthShort(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/* ------------------------------------------------------------------ */
/*  Filtro de compañías (se recuerda por navegador)                     */
/* ------------------------------------------------------------------ */

const COMPANY_KEY = 'portal_accounting_companies_v1';

export function useCompanySelection(): [number[], (ids: number[]) => void] {
  const [selected, setSelected] = useState<number[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
    } catch {
      return [];
    }
  });
  const update = (ids: number[]) => {
    setSelected(ids);
    try { localStorage.setItem(COMPANY_KEY, JSON.stringify(ids)); } catch { /* sin almacenamiento */ }
  };
  return [selected, update];
}

export function CompanyFilter({ companies, selected, onChange }: {
  companies: AccountingCompany[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (companies.length <= 1) {
    return companies[0] ? <span className="text-sm text-gray-500">{companies[0].name}</span> : null;
  }
  const valid = selected.filter((id) => companies.some((c) => c.id === id));
  const all = valid.length === 0;
  const label = all
    ? 'Todas las compañías'
    : valid.length === 1
      ? companies.find((c) => c.id === valid[0])?.name ?? '1 compañía'
      : `${valid.length} compañías`;

  const toggle = (id: number) => {
    const current = all ? companies.map((c) => c.id) : valid;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    // Ninguna o todas marcadas = todas
    onChange(next.length === 0 || next.length === companies.length ? [] : next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 min-w-56 max-w-80 border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm text-gray-700 hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
        <span className="flex-1 text-left truncate">{label}</span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg py-1" role="listbox" aria-multiselectable="true">
          <label className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
            <input type="checkbox" checked={all} onChange={() => onChange([])} className="accent-brand-600" />
            Todas las compañías
          </label>
          <div className="max-h-72 overflow-y-auto">
            {companies.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={all || valid.includes(c.id)} onChange={() => toggle(c.id)} className="accent-brand-600" />
                <span className="truncate" title={c.name}>{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bloques                                                             */
/* ------------------------------------------------------------------ */

export function Panel({ title, subtitle, children, className = '', right }: {
  title: string; subtitle?: string; children: ReactNode; className?: string; right?: ReactNode;
}) {
  return (
    <section className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>
      <header className="px-5 pt-4 pb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

const TONES = {
  neutral: 'text-gray-900',
  good: 'text-emerald-700',
  bad: 'text-rose-700',
  warn: 'text-amber-600',
} as const;

export function Kpi({ label, value, hint, tone = 'neutral' }: {
  label: string; value: string; hint?: string; tone?: keyof typeof TONES;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${TONES[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export function Empty({ text = 'Sin datos.' }: { text?: string }) {
  return <p className="text-sm text-gray-400 py-6 text-center">{text}</p>;
}

/** Barras horizontales: nombre + importe, con barra proporcional al máximo. */
export function HBarList({ rows, color = 'bg-brand-500' }: { rows: AccountingAmountRow[]; color?: string }) {
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.map((r) => Math.abs(r.amount)), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex justify-between gap-3 text-xs">
            <span className="text-gray-700 truncate" title={r.name}>{r.name}</span>
            <span className="text-gray-900 font-medium tabular-nums shrink-0">{eur(r.amount)}</span>
          </div>
          <div className="h-1.5 mt-1 rounded-full bg-gray-100">
            <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${(Math.abs(r.amount) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Barra apilada horizontal con leyenda (p. ej. antigüedad de deuda). */
export function StackedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0);
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {total > 0 && segments.map((s) => s.value > 0 && (
          <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${eur(s.value)}`} />
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${s.color}`} />
            <span className="truncate">{s.label}</span>
            <span className="ml-auto tabular-nums text-gray-900">{eur(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras mensuales de entradas / salidas con línea de neto. */
export function MonthlyBars({ data }: { data: { month: string; in: number; out: number; net: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty />;
  const H = 200;
  const PAD = 8;
  const max = Math.max(...data.flatMap((d) => [d.in, d.out, Math.abs(d.net)]), 1);
  const minNet = Math.min(0, ...data.map((d) => d.net));
  const top = max;
  const bottom = Math.min(0, minNet);
  const y = (v: number) => PAD + ((top - v) / (top - bottom)) * (H - PAD * 2);
  const colW = 30;
  const W = data.length * colW;
  const zero = y(0);
  const netPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${i * colW + colW / 2},${y(d.net)}`).join(' ');
  const h = hover !== null ? data[hover] : null;
  return (
    <div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-2">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Cobros de clientes</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />Pagos a proveedores</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-brand-600" />Neto del mes</span>
        <span className="ml-auto text-gray-500 tabular-nums min-h-4">
          {h ? `${monthShort(h.month)} · cobros ${eur(h.in)} · pagos ${eur(h.out)} · neto ${eur(h.net)}` : ''}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-56" onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={zero} y2={zero} stroke="#e5e7eb" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const x = i * colW;
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={0} width={colW} height={H} fill={hover === i ? '#f5f0f4' : 'transparent'} />
              <rect x={x + 4} y={y(d.in)} width={10} height={Math.max(zero - y(d.in), 0)} className="fill-emerald-500" rx={1.5} />
              <rect x={x + 16} y={y(d.out)} width={10} height={Math.max(zero - y(d.out), 0)} className="fill-rose-400" rx={1.5} />
            </g>
          );
        })}
        <path d={netPath} fill="none" stroke="#5f3f58" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      </svg>
      <div className="flex text-[10px] text-gray-400 mt-1">
        {data.map((d, i) => (
          <span key={d.month} className="flex-1 text-center truncate">{i % 2 === 0 || data.length <= 12 ? monthShort(d.month) : ''}</span>
        ))}
      </div>
    </div>
  );
}
