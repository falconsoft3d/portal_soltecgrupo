'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiAccountingForecast, AccountingForecastEvent, AccountingForecastResponse } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  CompanyFilter, Empty, Kpi, Panel, eur, eurShort, formatDay, monthShort, useCompanySelection,
} from '../components/AccountingUi';

/* ------------------------------------------------------------------ */
/*  Fechas en UTC (claves YYYY-MM-DD, sin desfases de zona horaria)     */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
const toTime = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const addMonths = (iso: string, n: number) => {
  const d = new Date(toTime(iso));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toIso(d.getTime());
};
const isWeekday = (t: number) => { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6; };

type Cat = 'in' | 'out' | 'adj' | 'est';
const CAT_LABEL: Record<Cat, string> = { in: 'Cobros', out: 'Pagos', adj: 'Ajustes de periodo', est: 'Estimación facturas' };
const CAT_FILL: Record<Cat, string> = { in: 'fill-emerald-500', out: 'fill-rose-400', adj: 'fill-amber-400', est: 'fill-sky-400' };
const CAT_BG: Record<Cat, string> = { in: 'bg-emerald-500', out: 'bg-rose-400', adj: 'bg-amber-400', est: 'bg-sky-400' };
const HORIZONS = [3, 6, 12, 24];

interface DayRow { date: string; in: number; out: number; adj: number; est: number; net: number; balance: number }
interface MonthRow { month: string; in: number; out: number; adj: number; est: number; net: number; end: number }

/* ------------------------------------------------------------------ */
/*  Gráficos                                                            */
/* ------------------------------------------------------------------ */

function Waterfall({ steps }: { steps: { label: string; value: number; total?: boolean }[] }) {
  const H = 220, PAD = 12, colW = 90, W = steps.length * colW;
  const bars: { label: string; value: number; total?: boolean; from: number; to: number }[] = [];
  for (const s of steps) {
    const prev = bars.length ? bars[bars.length - 1].to : 0;
    bars.push(s.total ? { ...s, from: 0, to: s.value } : { ...s, from: prev, to: prev + s.value });
  }
  const vals = bars.flatMap((b) => [b.from, b.to, 0]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const y = (v: number) => PAD + ((max - v) / ((max - min) || 1)) * (H - PAD * 2);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-56">
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#e5e7eb" vectorEffect="non-scaling-stroke" />
        {bars.map((b, i) => {
          const top = y(Math.max(b.from, b.to)), bot = y(Math.min(b.from, b.to));
          const cls = b.total ? 'fill-brand-500' : b.value >= 0 ? 'fill-emerald-500' : 'fill-rose-400';
          return (
            <g key={b.label}>
              <rect x={i * colW + 18} y={top} width={colW - 36} height={Math.max(bot - top, 1)} className={cls} rx={2} />
              {i < bars.length - 1 && (
                <line x1={i * colW + colW - 18} x2={(i + 1) * colW + 18} y1={y(b.to)} y2={y(b.to)} stroke="#9ca3af" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex mt-1">
        {bars.map((b) => (
          <div key={b.label} className="flex-1 text-center">
            <div className="text-[11px] text-gray-500 truncate">{b.label}</div>
            <div className={`text-xs font-semibold tabular-nums ${b.total ? 'text-gray-900' : b.value >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {b.total ? eurShort(b.value) : `${b.value >= 0 ? '+' : ''}${eurShort(b.value)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BalanceLine({ days }: { days: DayRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (days.length < 2) return <Empty />;
  const H = 200, PAD = 10, W = 1000;
  const vals = days.map((d) => d.balance);
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0);
  const x = (i: number) => (i / (days.length - 1)) * W;
  const y = (v: number) => PAD + ((max - v) / ((max - min) || 1)) * (H - PAD * 2);
  const path = days.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.balance)}`).join(' ');
  const area = `${path} L${W},${y(0)} L0,${y(0)} Z`;
  const h = hover !== null ? days[hover] : null;
  const ticks = days.filter((d) => d.date.endsWith('-01'));
  return (
    <div>
      <div className="text-xs text-gray-500 tabular-nums h-4 mb-1 text-right">
        {h ? `${formatDay(h.date)} · saldo ${eur(h.balance)} · neto del día ${eur(h.net)}` : ''}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-56"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - r.left) / r.width) * (days.length - 1)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <path d={area} className="fill-brand-100" opacity={0.6} />
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#f43f5e" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={path} fill="none" stroke="#5f3f58" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {h && hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="#9ca3af" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="relative h-4 text-[10px] text-gray-400">
        {ticks.map((d) => {
          const i = days.indexOf(d);
          return <span key={d.date} className="absolute -translate-x-1/2" style={{ left: `${(i / (days.length - 1)) * 100}%` }}>{monthShort(d.date.slice(0, 7))}</span>;
        })}
      </div>
    </div>
  );
}

/** Segmentos apilados: positivos hacia arriba desde 0, negativos hacia abajo. */
function stackSegments(m: MonthRow): { c: Cat; from: number; to: number }[] {
  const out: { c: Cat; from: number; to: number }[] = [];
  let up = 0;
  let down = 0;
  for (const c of ['in', 'out', 'adj', 'est'] as Cat[]) {
    const v = m[c];
    if (!v) continue;
    if (v > 0) { out.push({ c, from: up, to: up + v }); up += v; }
    else { out.push({ c, from: down, to: down + v }); down += v; }
  }
  return out;
}

function MonthlyStack({ months }: { months: MonthRow[] }) {
  if (!months.length) return <Empty />;
  const H = 220, PAD = 10, colW = 40, W = months.length * colW;
  const cats: Cat[] = ['in', 'out', 'adj', 'est'];
  const pos = months.map((m) => cats.reduce((s, c) => s + Math.max(m[c], 0), 0));
  const neg = months.map((m) => cats.reduce((s, c) => s + Math.min(m[c], 0), 0));
  const max = Math.max(...pos, ...months.map((m) => m.end), 0);
  const min = Math.min(...neg, ...months.map((m) => m.end), 0);
  const y = (v: number) => PAD + ((max - v) / ((max - min) || 1)) * (H - PAD * 2);
  const line = months.map((m, i) => `${i ? 'L' : 'M'}${i * colW + colW / 2},${y(m.end)}`).join(' ');
  return (
    <div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-2">
        {cats.map((c) => <span key={c} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${CAT_BG[c]}`} />{CAT_LABEL[c]}</span>)}
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-brand-600" />Saldo a fin de mes</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-60">
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#e5e7eb" vectorEffect="non-scaling-stroke" />
        {months.map((m, i) => (
          <g key={m.month}>
            <title>{`${monthShort(m.month)} · cobros ${eur(m.in)} · pagos ${eur(m.out)} · ajustes ${eur(m.adj)} · estimación ${eur(m.est)} · saldo ${eur(m.end)}`}</title>
            <rect x={i * colW} y={0} width={colW} height={H} fill="transparent" />
            {stackSegments(m).map(({ c, from, to }) => (
              <rect key={c} x={i * colW + 8} y={y(Math.max(from, to))} width={colW - 16} height={Math.max(Math.abs(y(from) - y(to)), 0.5)} className={CAT_FILL[c]} />
            ))}
          </g>
        ))}
        <path d={line} fill="none" stroke="#5f3f58" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      </svg>
      <div className="flex text-[10px] text-gray-400 mt-1">
        {months.map((m, i) => <span key={m.month} className="flex-1 text-center truncate">{months.length <= 12 || i % 2 === 0 ? monthShort(m.month) : ''}</span>)}
      </div>
    </div>
  );
}

function Heatmap({ days }: { days: DayRow[] }) {
  if (!days.length) return <Empty />;
  const max = Math.max(...days.map((d) => Math.abs(d.net)), 1);
  const byMonth = new Map<string, DayRow[]>();
  for (const d of days) {
    const k = d.date.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(d);
  }
  const color = (v: number) => {
    if (!v) return 'rgb(243 244 246)';
    const a = 0.15 + 0.85 * Math.min(Math.abs(v) / max, 1) ** 0.5;
    return v > 0 ? `rgba(16, 185, 129, ${a})` : `rgba(244, 63, 94, ${a})`;
  };
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] space-y-1">
        {Array.from(byMonth.entries()).map(([month, rows]) => (
          <div key={month} className="flex items-center gap-1">
            <span className="w-14 shrink-0 text-[11px] text-gray-500">{monthShort(month)}</span>
            <div className="grid flex-1 gap-0.5" style={{ gridTemplateColumns: 'repeat(31, minmax(0, 1fr))' }}>
              {rows.map((d) => (
                <div
                  key={d.date}
                  className="h-4 rounded-sm"
                  style={{ gridColumnStart: Number(d.date.slice(8, 10)), background: color(d.net) }}
                  title={`${formatDay(d.date)} · neto ${eur(d.net)} · saldo ${eur(d.balance)}`}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-1 pl-15 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(16,185,129,.8)' }} />Entra más de lo que sale</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(244,63,94,.8)' }} />Sale más de lo que entra</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Página                                                              */
/* ------------------------------------------------------------------ */

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-brand-600" />
      <span>
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
    </label>
  );
}

export default function PrevisionTesoreriaPage() {
  const [selected, setSelected] = useCompanySelection();
  const [data, setData] = useState<AccountingForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [horizon, setHorizon] = useState(6);
  const [base, setBase] = useState<'book' | 'statement'>('book');
  const [useAdj, setUseAdj] = useState(true);
  const [useIn, setUseIn] = useState(true);
  const [useOut, setUseOut] = useState(true);
  const [useEst, setUseEst] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    apiAccountingForecast(token, selected)
      .then((res) => {
        if (cancelled) return;
        if (res.success) { setData(res); setError(''); }
        else { setError(res.error || 'No se pudieron cargar los datos.'); setData(res.companies ? res : null); }
      })
      .catch(() => { if (!cancelled) setError('Error de conexión.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const changeCompanies = (ids: number[]) => { setLoading(true); setSelected(ids); };

  const calc = useMemo(() => {
    if (!data?.success || !data.today || !data.opening) return null;
    const today = data.today;
    const end = addMonths(today, horizon);
    const tToday = toTime(today), tEnd = toTime(end);
    const opening = data.opening[base];

    const days = new Map<string, DayRow>();
    for (let t = tToday; t <= tEnd; t += DAY) {
      const k = toIso(t);
      days.set(k, { date: k, in: 0, out: 0, adj: 0, est: 0, net: 0, balance: 0 });
    }

    const include = (e: AccountingForecastEvent) =>
      (e.kind === 'in' && useIn) || (e.kind === 'out' && useOut) || (e.kind === 'adj' && useAdj);
    const events = (data.events ?? []).filter((e) => include(e) && e.date <= end);
    for (const e of events) {
      const row = days.get(e.date < today ? today : e.date);
      if (row) row[e.kind] += e.amount;
    }

    // Estimación: pendiente no vencido repartido a partes iguales en los días laborables de los próximos N días
    if (useEst && data.estimate) {
      const n = data.estimate_days ?? 60;
      const work: string[] = [];
      for (let t = tToday + DAY; t <= tToday + n * DAY; t += DAY) if (isWeekday(t)) work.push(toIso(t));
      const per = (data.estimate.in + data.estimate.out) / (work.length || 1);
      for (const k of work) { const row = days.get(k); if (row) row.est += per; }
    }

    let bal = opening;
    const dayList = Array.from(days.values());
    for (const d of dayList) {
      d.net = d.in + d.out + d.adj + d.est;
      bal += d.net;
      d.balance = bal;
    }

    const months = new Map<string, MonthRow>();
    for (const d of dayList) {
      const k = d.date.slice(0, 7);
      const m = months.get(k) ?? { month: k, in: 0, out: 0, adj: 0, est: 0, net: 0, end: 0 };
      m.in += d.in; m.out += d.out; m.adj += d.adj; m.est += d.est; m.net += d.net; m.end = d.balance;
      months.set(k, m);
    }

    const sum = (c: Cat) => dayList.reduce((s, d) => s + d[c], 0);
    const minDay = dayList.reduce((a, d) => (d.balance < a.balance ? d : a), dayList[0]);
    const firstNeg = dayList.find((d) => d.balance < 0);
    const in30 = toIso(tToday + 30 * DAY);
    const upcoming = events.filter((e) => e.date <= in30);

    return {
      today, end, opening, dayList, months: Array.from(months.values()),
      totals: { in: sum('in'), out: sum('out'), adj: sum('adj'), est: sum('est') },
      final: bal, minDay, firstNeg, upcoming,
      heatDays: dayList.filter((d) => d.date <= addMonths(today, 6)),
    };
  }, [data, horizon, base, useAdj, useIn, useOut, useEst]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Previsión de tesorería</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Saldo previsto con cobros y pagos programados, ajustes de periodo de Odoo y estimación de facturas pendientes.
          </p>
        </div>
        {data?.companies && <CompanyFilter companies={data.companies} selected={selected} onChange={changeCompanies} />}
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-3">{error}</div>}

      {loading && !data ? (
        <div className="py-16 text-center text-gray-400 text-sm">Cargando…</div>
      ) : calc ? (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {/* Parámetros */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Horizonte</h2>
              <div className="flex flex-wrap gap-1.5">
                {HORIZONS.map((h) => (
                  <button
                    key={h} type="button" onClick={() => setHorizon(h)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${horizon === h ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >{h} meses</button>
                ))}
              </div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Saldo de partida</h2>
              <div className="flex flex-col gap-1.5 text-sm text-gray-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={base === 'book'} onChange={() => setBase('book')} className="accent-brand-600" />
                  Saldo contable <span className="text-gray-400 tabular-nums">{eur(data!.opening!.book)}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={base === 'statement'} onChange={() => setBase('statement')} className="accent-brand-600" />
                  Último estado de cuenta <span className="text-gray-400 tabular-nums">{eur(data!.opening!.statement)}</span>
                </label>
              </div>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
              <Toggle checked={useAdj} onChange={setUseAdj} label="Ajustes de periodo" hint="Asientos recurrentes de Odoo (mensuales, trimestrales…) proyectados hasta su fecha fin" />
              <Toggle checked={useIn} onChange={setUseIn} label="Cobros programados" hint="Cobros de Odoo con fecha posterior a hoy" />
              <Toggle checked={useOut} onChange={setUseOut} label="Pagos programados" hint="Pagos de Odoo con fecha posterior a hoy (pagarés, confirming…)" />
              <Toggle
                checked={useEst} onChange={setUseEst} label="Estimar facturas pendientes no vencidas"
                hint={`Cobro ${eur(data!.estimate?.in)} · pago ${eur(data!.estimate?.out)}, repartidos a partes iguales en los días laborables de los próximos ${data!.estimate_days ?? 60} días`}
              />
            </div>
          </section>

          {calc.firstNeg && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-3">
              El saldo previsto pasa a negativo el <strong>{formatDay(calc.firstNeg.date)}</strong> ({eur(calc.firstNeg.balance)}).
              El mínimo del periodo es {eur(calc.minDay.balance)} el {formatDay(calc.minDay.date)}.
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Saldo de partida (hoy)" value={eur(calc.opening)} />
            <Kpi label={`Saldo previsto a ${formatDay(calc.end)}`} value={eur(calc.final)} tone={calc.final >= 0 ? 'good' : 'bad'} hint={`Variación ${eur(calc.final - calc.opening)}`} />
            <Kpi label="Saldo mínimo previsto" value={eur(calc.minDay.balance)} hint={formatDay(calc.minDay.date)} tone={calc.minDay.balance >= 0 ? 'neutral' : 'bad'} />
            <Kpi label="Entradas / salidas previstas" value={eur(calc.totals.in + Math.max(calc.totals.est, 0))} hint={`Salidas ${eur(calc.totals.out + calc.totals.adj + Math.min(calc.totals.est, 0))}`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Panel title="De hoy al final del horizonte" subtitle="Cómo pasa el saldo de partida al saldo previsto">
              <Waterfall steps={[
                { label: 'Hoy', value: calc.opening, total: true },
                { label: 'Cobros', value: calc.totals.in },
                { label: 'Pagos', value: calc.totals.out },
                { label: 'Ajustes', value: calc.totals.adj },
                { label: 'Estimación', value: calc.totals.est },
                { label: 'Final', value: calc.final, total: true },
              ]} />
            </Panel>
            <Panel title="Saldo previsto de tesorería diario" subtitle="Pasa el ratón por el gráfico para ver cada día">
              <BalanceLine days={calc.dayList} />
            </Panel>
          </div>

          <Panel title="Calendario de movimientos" subtitle="Neto diario de los próximos 6 meses">
            <Heatmap days={calc.heatDays} />
          </Panel>

          <Panel title="Entradas y salidas por mes" subtitle="Movimientos previstos por categoría y saldo a fin de mes">
            <MonthlyStack months={calc.months} />
          </Panel>

          <Panel title="Resumen mensual">
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-y border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="px-5 py-2.5 text-left font-medium">Mes</th>
                    <th className="px-3 py-2.5 text-right font-medium">Cobros</th>
                    <th className="px-3 py-2.5 text-right font-medium">Pagos</th>
                    <th className="px-3 py-2.5 text-right font-medium">Ajustes</th>
                    <th className="px-3 py-2.5 text-right font-medium">Estimación</th>
                    <th className="px-3 py-2.5 text-right font-medium">Neto</th>
                    <th className="px-5 py-2.5 text-right font-medium">Saldo fin de mes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 tabular-nums">
                  {calc.months.map((m) => (
                    <tr key={m.month} className="hover:bg-gray-50">
                      <td className="px-5 py-2 text-gray-700 capitalize">{monthShort(m.month)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{m.in ? eur(m.in) : '—'}</td>
                      <td className="px-3 py-2 text-right text-rose-700">{m.out ? eur(m.out) : '—'}</td>
                      <td className="px-3 py-2 text-right text-amber-700">{m.adj ? eur(m.adj) : '—'}</td>
                      <td className="px-3 py-2 text-right text-sky-700">{m.est ? eur(m.est) : '—'}</td>
                      <td className={`px-3 py-2 text-right font-medium ${m.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{eur(m.net)}</td>
                      <td className={`px-5 py-2 text-right font-semibold ${m.end >= 0 ? 'text-gray-900' : 'text-rose-700'}`}>{eur(m.end)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Panel title="Próximos movimientos" subtitle="Próximos 30 días (sin la estimación)" right={<span className="text-xs text-gray-500">{calc.upcoming.length}</span>}>
              {calc.upcoming.length === 0 ? <Empty text="No hay movimientos en los próximos 30 días." /> : (
                <div className="overflow-x-auto -mx-5 max-h-[26rem] overflow-y-auto">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-y border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="px-5 py-2 text-left font-medium">Fecha</th>
                        <th className="px-3 py-2 text-left font-medium">Concepto</th>
                        <th className="px-3 py-2 text-left font-medium">Diario</th>
                        <th className="px-5 py-2 text-right font-medium">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {calc.upcoming.map((e, i) => (
                        <tr key={i}>
                          <td className="px-5 py-2 text-gray-600">{formatDay(e.date)}</td>
                          <td className="px-3 py-2 max-w-64">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${CAT_BG[e.kind]}`} title={CAT_LABEL[e.kind]} />
                              <span className="truncate text-gray-800" title={e.partner || e.ref}>{e.partner || e.ref || '—'}</span>
                            </div>
                            {e.partner && e.ref && <div className="text-xs text-gray-400 truncate pl-3.5">{e.ref}</div>}
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{e.journal}</td>
                          <td className={`px-5 py-2 text-right tabular-nums font-medium ${e.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{eur(e.amount, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Ajustes de periodo tal como están en Odoo" subtitle="Asientos recurrentes en borrador con su próxima fecha" right={<span className="text-xs text-gray-500">{data!.adjustments?.length ?? 0}</span>}>
              {!data!.adjustments?.length ? <Empty text="No hay asientos recurrentes que afecten a bancos o caja." /> : (
                <div className="overflow-x-auto -mx-5 max-h-[26rem] overflow-y-auto">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-y border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="px-5 py-2 text-left font-medium">Concepto</th>
                        <th className="px-3 py-2 text-left font-medium">Periodo</th>
                        <th className="px-3 py-2 text-left font-medium">Próxima</th>
                        <th className="px-3 py-2 text-left font-medium">Hasta</th>
                        <th className="px-5 py-2 text-right font-medium">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data!.adjustments!.map((a) => (
                        <tr key={a.id}>
                          <td className="px-5 py-2 max-w-64">
                            <div className="truncate text-gray-800" title={a.name}>{a.name}</div>
                            <div className="text-xs text-gray-400 truncate">{a.journal}{(data!.companies?.length ?? 0) > 1 ? ` · ${a.company}` : ''}</div>
                          </td>
                          <td className="px-3 py-2 text-gray-600">{a.period}</td>
                          <td className="px-3 py-2 text-gray-600">{formatDay(a.next_date)}</td>
                          <td className="px-3 py-2 text-gray-600">{a.until ? formatDay(a.until) : 'Sin fin'}</td>
                          <td className={`px-5 py-2 text-right tabular-nums font-medium ${a.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{eur(a.amount, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
