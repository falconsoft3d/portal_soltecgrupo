/**
 * Motor de previsión compartido por "Previsión de tesorería" y "Bancos"
 * (misma lógica que movimientos() y serie() del artefacto).
 */
import { useState } from 'react';
import type { AccountingForecastJournal, AccountingForecastResponse } from '@/lib/api';
import { DAY, addMonthsIso, fD, toIso, toTime } from './lib';

export type Origin = 'cobro' | 'pago' | 'ajuste' | 'estim';
export const ORIGIN_LABEL: Record<Origin, string> = { cobro: 'Cobro', pago: 'Pago', ajuste: 'Ajuste', estim: 'Estimación' };

export interface Mov {
  date: string; amount: number; origin: Origin; company_id: number; journal_id: number | false; journal: string; concept: string;
}

export interface Toggles { adj: boolean; cob: boolean; pag: boolean; est: boolean; cart: boolean; base: 'book' | 'statement' }
const DEFAULT_TOGGLES: Toggles = { adj: true, cob: true, pag: true, est: false, cart: true, base: 'book' };
const TOGGLES_KEY = 'portal_cf_toggles_v1';

/** Interruptores de la previsión (se recuerdan en el navegador y los comparte Bancos). */
export function useToggles(): [Toggles, (t: Partial<Toggles>) => void] {
  const [t, setT] = useState<Toggles>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(TOGGLES_KEY) : null;
      return raw ? { ...DEFAULT_TOGGLES, ...JSON.parse(raw) } : DEFAULT_TOGGLES;
    } catch { return DEFAULT_TOGGLES; }
  });
  const update = (p: Partial<Toggles>) => {
    setT((prev) => {
      const next = { ...prev, ...p };
      try { localStorage.setItem(TOGGLES_KEY, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
      return next;
    });
  };
  return [t, update];
}

export const horizonEnd = (today: string, months: number) => addMonthsIso(today, months);

export function selectedJournals(data: AccountingForecastResponse, t: Toggles, companyId?: number): AccountingForecastJournal[] {
  return (data.journals ?? []).filter((j) => (t.cart || !j.portfolio) && (companyId === undefined || j.company_id === companyId));
}

export const baseBalance = (j: AccountingForecastJournal, t: Toggles) =>
  (t.base === 'statement' && j.has_statement ? j.statement_balance : j.balance);

/** Movimientos previstos hasta `end` según los interruptores. */
export function movimientos(data: AccountingForecastResponse, t: Toggles, end: string): Mov[] {
  const today = data.today!;
  const journals = selectedJournals(data, t);
  const ok = new Set(journals.map((j) => j.id));
  const allIds = new Set((data.journals ?? []).map((j) => j.id));
  const out: Mov[] = [];
  for (const e of data.events ?? []) {
    if (e.date > end) continue;
    if (e.kind === 'adj' && !t.adj) continue;
    if (e.kind === 'in' && !t.cob) continue;
    if (e.kind === 'out' && !t.pag) continue;
    out.push({
      date: e.date < today ? today : e.date, amount: e.amount, origin: e.kind === 'in' ? 'cobro' : e.kind === 'out' ? 'pago' : 'ajuste',
      company_id: e.company_id, journal_id: e.journal_id, journal: e.journal, concept: e.concept,
    });
  }
  if (t.est) {
    const n = data.estimate_days ?? 60;
    const days: string[] = [];
    const t0 = toTime(today);
    for (let i = 1; i <= n; i++) {
      const tt = t0 + i * DAY, w = new Date(tt).getUTCDay();
      if (w % 6 !== 0 && toIso(tt) <= end) days.push(toIso(tt));
    }
    for (const est of data.estimate ?? []) {
      // Se imputa al banco principal (mayor saldo) de la compañía
      const main = (data.journals ?? []).filter((j) => j.company_id === est.company_id && j.kind === 'banco').sort((a, b) => b.balance - a.balance)[0];
      const per = (est.in - est.out) / (days.length || 1);
      if (!per) continue;
      for (const d of days) {
        out.push({ date: d, amount: per, origin: 'estim', company_id: est.company_id, journal_id: main?.id ?? false, journal: main?.name ?? '', concept: 'Estimación facturas no vencidas (cobros − pagos)' });
      }
    }
  }
  return out
    .filter((m) => !m.journal_id || ok.has(m.journal_id) || !allIds.has(m.journal_id))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.amount - a.amount));
}

export interface Serie {
  ini: number; labels: string[]; vals: number[]; dates: string[]; porDia: Map<string, number>;
  min: number; minD: string; fin: number; neg: string | null;
}

/** Saldo diario de hoy a `end` partiendo del saldo de los diarios indicados. */
export function serie(movs: Mov[], journals: AccountingForecastJournal[], t: Toggles, today: string, end: string): Serie {
  const ini = journals.reduce((s, j) => s + baseBalance(j, t), 0);
  const porDia = new Map<string, number>();
  for (const m of movs) porDia.set(m.date, (porDia.get(m.date) ?? 0) + m.amount);
  const labels: string[] = [], vals: number[] = [], dates: string[] = [];
  let s = ini;
  for (let tt = toTime(today), te = toTime(end); tt <= te; tt += DAY) {
    const k = toIso(tt);
    s += porDia.get(k) ?? 0;
    dates.push(k); labels.push(fD(k)); vals.push(Math.round(s * 100) / 100);
  }
  let mi = 0;
  vals.forEach((v, i) => { if (v < vals[mi]) mi = i; });
  const neg = vals.findIndex((v) => v < 0);
  return { ini, labels, vals, dates, porDia, min: vals[mi] ?? ini, minD: dates[mi] ?? today, fin: vals[vals.length - 1] ?? ini, neg: neg >= 0 ? dates[neg] : null };
}
