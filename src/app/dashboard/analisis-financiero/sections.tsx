'use client';

import { ReactNode, useState } from 'react';
import type { AccountingUnmapped } from '@/lib/api';
import {
  AF_BAL_ACT, AF_BAL_PAS, AF_BIG, AF_LBL, AF_PYG, AF_TOT, AfResult, RatioRule, Triple, fin, ratioState,
} from '@/lib/financialAnalysis';
import { Empty, Kpi, Panel, eurShort } from '../components/AccountingUi';

/* ------------------------------------------------------------------ */
/*  Formato                                                             */
/* ------------------------------------------------------------------ */

export const fE = (v: number) => (fin(v) ? v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—');
export const fN2 = (v: number) => (fin(v) ? v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
export const fP = (v: number) => (fin(v) ? `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` : '—');
export const fD = (v: number) => (fin(v) ? `${Math.round(v)} días` : '—');
const tone = (v: number) => (!fin(v) || v === 0 ? '' : v > 0 ? 'text-emerald-700' : 'text-rose-700');

const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-3">{children}</p>
);

const TH = 'px-3 py-2 text-right font-medium';
const thead = 'border-y border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide';

/* ------------------------------------------------------------------ */
/*  Tablas                                                              */
/* ------------------------------------------------------------------ */

function YearTable({ view, r, base }: { view: string[]; r: AfResult; base: Triple }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className={thead}>
            <th className="pl-5 pr-2 py-2 text-left font-medium">Cuentas</th>
            <th className="px-3 py-2 text-left font-medium">Concepto</th>
            {r.y.map((y, i) => (
              <FragmentCols key={y} cols={[<th key="y" className={TH}>{y}</th>, <th key="p" className={`${TH} text-gray-400`}>%</th>, ...(i ? [<th key="i" className={`${TH} text-gray-400 pr-5`}>Ind.</th>] : [])]} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 tabular-nums">
          {view.map((k) => {
            const tot = k[0] === '=';
            const key = tot ? k.slice(1) : k;
            const vals = tot ? (r[key as keyof AfResult] as Triple) : r.g(key);
            const label = tot ? AF_TOT[key] : AF_LBL[key][0];
            const big = AF_BIG.has(key);
            return (
              <tr key={k} className={tot ? (big ? 'bg-brand-50 font-semibold text-gray-900' : 'bg-gray-50 font-semibold text-gray-800') : 'text-gray-700'}>
                <td className="pl-5 pr-2 py-1.5 text-[11px] text-gray-400">{tot ? '' : AF_LBL[key][1]}</td>
                <td className="px-3 py-1.5">{label}</td>
                {[0, 1, 2].map((i) => (
                  <FragmentCols key={i} cols={[
                    <td key="v" className={`px-3 py-1.5 text-right ${vals[i] < 0 ? 'text-rose-700' : ''}`}>{fE(vals[i])}</td>,
                    <td key="p" className="px-3 py-1.5 text-right text-xs text-gray-400">{base[i] ? fN2((100 * vals[i]) / base[i]) : ''}</td>,
                    ...(i ? [<td key="x" className="px-3 py-1.5 text-right text-xs text-gray-400 pr-5">{vals[i - 1] ? fN2(vals[i] / vals[i - 1]) : ''}</td>] : []),
                  ]} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentCols({ cols }: { cols: ReactNode[] }) {
  return <>{cols}</>;
}

function Synth({ rows, r }: { rows: [string, Triple, boolean?][]; r: AfResult }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm whitespace-nowrap tabular-nums">
        <thead>
          <tr className={thead}>
            <th className="px-5 py-2 text-left font-medium">Concepto</th>
            <th className={TH}>{r.y[0]}</th>
            <th className={TH}>{r.y[1]}</th>
            <th className={TH}>Variación</th>
            <th className={TH}>%</th>
            <th className={TH}>{r.y[2]}</th>
            <th className={TH}>Variación</th>
            <th className={`${TH} pr-5`}>%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(([label, a, big]) => {
            const v1 = a[1] - a[0], v2 = a[2] - a[1];
            const p1 = a[0] ? (v1 / Math.abs(a[0])) * 100 : NaN, p2 = a[1] ? (v2 / Math.abs(a[1])) * 100 : NaN;
            return (
              <tr key={label} className={big ? 'bg-gray-50 font-semibold' : ''}>
                <td className="px-5 py-1.5 text-gray-700">{label}</td>
                <td className={`px-3 py-1.5 text-right ${tone(a[0])}`}>{fE(a[0])}</td>
                <td className={`px-3 py-1.5 text-right ${tone(a[1])}`}>{fE(a[1])}</td>
                <td className={`px-3 py-1.5 text-right ${tone(v1)}`}>{fE(v1)}</td>
                <td className="px-3 py-1.5 text-right text-xs text-gray-400">{fP(p1)}</td>
                <td className={`px-3 py-1.5 text-right font-semibold ${tone(a[2])}`}>{fE(a[2])}</td>
                <td className={`px-3 py-1.5 text-right ${tone(v2)}`}>{fE(v2)}</td>
                <td className="px-3 py-1.5 text-right text-xs text-gray-400 pr-5">{fP(p2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gráficos                                                            */
/* ------------------------------------------------------------------ */

const STATE_FILL = { ok: 'fill-emerald-500', warn: 'fill-amber-400', bad: 'fill-rose-500', na: 'fill-slate-300' };
const STATE_TXT = { ok: 'text-emerald-700', warn: 'text-amber-600', bad: 'text-rose-700', na: 'text-gray-700' };
const STATE_PILL = { ok: ['bg-emerald-50 text-emerald-700', 'Correcto'], warn: ['bg-amber-50 text-amber-700', 'Vigilar'], bad: ['bg-rose-50 text-rose-700', 'Riesgo'] };

function MiniBars({ vals, years, thr, states }: { vals: Triple; years: number[]; thr: number; states: string[] }) {
  const W = 260, H = 70, top = 6, bot = 14;
  const nums = vals.map((v) => (fin(v) ? v : 0));
  const ext = [...nums, 0, ...(fin(thr) ? [thr] : [])];
  let mx = Math.max(...ext);
  const mn = Math.min(...ext);
  if (mx === mn) mx = mn + 1;
  const y = (v: number) => top + ((mx - v) / (mx - mn)) * (H - top - bot);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 mt-2">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#e5e7eb" />
      {nums.map((v, i) => {
        const cx = (W / 6) * (2 * i + 1);
        return (
          <g key={i}>
            <rect x={cx - 23} y={Math.min(y(0), y(v))} width={46} height={Math.max(1.5, Math.abs(y(v) - y(0)))} rx={4}
              className={STATE_FILL[states[i] as keyof typeof STATE_FILL]} opacity={fin(vals[i]) ? 0.9 : 0.25} />
            <text x={cx} y={H - 2} textAnchor="middle" fontSize={10} fontWeight={700} fill="#9ca3af">{years[i]}</text>
          </g>
        );
      })}
      {fin(thr) && <line x1={0} x2={W} y1={y(thr)} y2={y(thr)} stroke="#374151" strokeDasharray="4 4" opacity={0.6} />}
    </svg>
  );
}

function Ratio({ name, formula, vals, r, fmt, rule = null, note }: {
  name: string; formula: string; vals: Triple; r: AfResult; fmt: (v: number) => string; rule?: RatioRule; note?: string;
}) {
  const st = vals.map((v) => ratioState(v, rule));
  const last = st[2] !== 'na' ? STATE_PILL[st[2] as 'ok' | 'warn' | 'bad'] : null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-800">{name}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {formula}{rule ? ` · objetivo ${rule[0]} ${String(rule[1]).replace('.', ',')}` : ''}
            {note && <><br />{note}</>}
          </div>
        </div>
        {last && <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${last[0]}`}>{last[1]}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {vals.map((v, i) => (
          <div key={i}>
            <div className="text-[11px] text-gray-400">{r.y[i]}</div>
            <div className={`text-sm font-bold tabular-nums ${STATE_TXT[st[i]]}`}>{fmt(v)}</div>
          </div>
        ))}
      </div>
      <MiniBars vals={vals} years={r.y} thr={rule ? rule[1] : NaN} states={st} />
    </div>
  );
}

const SERIES_COLORS = ['#714B67', '#10b981', '#f43f5e', '#f59e0b', '#0ea5e9', '#64748b'];

function Legend({ items, line = false }: { items: string[]; line?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-2">
      {items.map((l, i) => (
        <span key={l} className="flex items-center gap-1.5">
          <span className={line ? 'w-3 h-0.5' : 'w-2.5 h-2.5 rounded-sm'} style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />{l}
        </span>
      ))}
    </div>
  );
}

/** Barras agrupadas por año. */
function YearBars({ years, series, scale = 1 }: { years: number[]; series: [string, Triple][]; scale?: number }) {
  const H = 180, PAD = 8, groupW = 100, W = years.length * groupW;
  const all = series.flatMap(([, v]) => v.map((x) => (fin(x) ? x / scale : 0)));
  const max = Math.max(...all, 0), min = Math.min(...all, 0);
  const y = (v: number) => PAD + ((max - v) / ((max - min) || 1)) * (H - PAD * 2);
  const bw = (groupW - 24) / series.length;
  return (
    <div>
      <Legend items={series.map(([l]) => l)} />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-48">
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#e5e7eb" vectorEffect="non-scaling-stroke" />
        {years.map((yr, gi) => series.map(([label, vals], si) => {
          const v = fin(vals[gi]) ? vals[gi] / scale : 0;
          return (
            <rect key={`${yr}-${label}`} x={gi * groupW + 12 + si * bw} y={Math.min(y(0), y(v))} width={bw - 2}
              height={Math.max(Math.abs(y(v) - y(0)), 0.5)} fill={SERIES_COLORS[si % SERIES_COLORS.length]} rx={1.5}>
              <title>{`${label} ${yr}: ${scale === 1 ? fE(vals[gi]) : fN2(v)}`}</title>
            </rect>
          );
        }))}
      </svg>
      <div className="flex text-xs text-gray-500 mt-1">{years.map((yr) => <span key={yr} className="flex-1 text-center">{yr}</span>)}</div>
    </div>
  );
}

/** Líneas por año. */
function YearLines({ years, series, fmt }: { years: number[]; series: [string, Triple][]; fmt: (v: number) => string }) {
  const H = 180, PAD = 14, W = 300;
  const all = series.flatMap(([, v]) => v.filter(fin));
  const max = Math.max(...all, 0), min = Math.min(...all, 0);
  const x = (i: number) => (W / 6) * (2 * i + 1);
  const y = (v: number) => PAD + ((max - v) / ((max - min) || 1)) * (H - PAD * 2);
  return (
    <div>
      <Legend items={series.map(([l]) => l)} line />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48">
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#e5e7eb" />
        {series.map(([label, vals], si) => {
          const pts = vals.map((v, i) => [x(i), fin(v) ? y(v) : NaN]).filter(([, yy]) => fin(yy));
          const color = SERIES_COLORS[si % SERIES_COLORS.length];
          return (
            <g key={label}>
              <path d={pts.map(([xx, yy], i) => `${i ? 'L' : 'M'}${xx},${yy}`).join(' ')} fill="none" stroke={color} strokeWidth={2} />
              {vals.map((v, i) => fin(v) && <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={color}><title>{`${label} ${years[i]}: ${fmt(v)}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      <div className="flex text-xs text-gray-500">{years.map((yr) => <span key={yr} className="flex-1 text-center">{yr}</span>)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Subpestañas                                                         */
/* ------------------------------------------------------------------ */

export function BalanceTab({ r }: { r: AfResult }) {
  return (
    <>
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start">
        <Panel title="Activo"><YearTable view={AF_BAL_ACT} r={r} base={r.D} /></Panel>
        <Panel title="Pasivo y patrimonio neto"><YearTable view={AF_BAL_PAS} r={r} base={r.H} /></Panel>
      </div>
      <Note><b>%</b> = peso sobre el total del activo o del pasivo · <b>Ind.</b> = año / año anterior. Saldos a 31/12 de cada ejercicio (o a hoy si el ejercicio está en curso).</Note>
    </>
  );
}

export function ExplotacionTab({ r, employees, onEmployees }: { r: AfResult; employees: Triple; onEmployees: (i: number, v: number) => void }) {
  const prodRows: [string, Triple, (v: number) => string][] = [
    ['Producción por empleado', r.prodEmp, fE], ['Coste de personal por empleado', r.costeEmp, fE],
    ['Producción por euro de sueldos', r.prodSue, fN2], ['Margen bruto por euro de sueldos', r.mbSue, fN2], ['Beneficio por euro de sueldos', r.bnSue, fN2],
  ];
  return (
    <>
      <Panel title="Cuenta de explotación · rentabilidad" subtitle="% = peso sobre la producción">
        <YearTable view={AF_PYG} r={r} base={r.prod} />
      </Panel>
      <Panel title="Plantilla y productividad" subtitle="El nº de empleados no está en la contabilidad: escríbelo aquí (se guarda en este navegador)">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm whitespace-nowrap tabular-nums">
            <thead>
              <tr className={thead}>
                <th className="px-5 py-2 text-left font-medium">Concepto</th>
                {r.y.map((y) => <th key={y} className={`${TH} pr-5`}>{y}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="px-5 py-1.5 text-gray-700">Nº de empleados</td>
                {[0, 1, 2].map((i) => (
                  <td key={i} className="px-3 py-1 text-right pr-5">
                    <input
                      type="number" min={0} value={employees[i] || ''} placeholder="0"
                      onChange={(e) => onEmployees(i, Math.max(0, Number(e.target.value) || 0))}
                      className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-5 py-1.5 text-gray-700">de los gastos de personal, Seguridad Social</td>
                {[0, 1, 2].map((i) => <td key={i} className="px-3 py-1.5 text-right pr-5">{fE(r.g('ss')[i])}</td>)}
              </tr>
              {prodRows.map(([l, a, f]) => (
                <tr key={l} className="bg-gray-50 font-medium">
                  <td className="px-5 py-1.5 text-gray-700">{l}</td>
                  {[0, 1, 2].map((i) => <td key={i} className="px-3 py-1.5 text-right pr-5">{f(a[i])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>La Seguridad Social solo sirve para repartir el valor añadido: se resta del personal y se suma a las administraciones.</Note>
      </Panel>
    </>
  );
}

export function MasasTab({ r }: { r: AfResult }) {
  const COLS = { inm: '#714B67', exi: '#f59e0b', rea: '#10b981', fp: '#5f3f58', dlp: '#0ea5e9', dcp: '#f43f5e' };
  return (
    <>
      <Panel title="Gráfico de masas patrimoniales" subtitle="La altura de cada bloque es su peso en el balance">
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
          {[['Inmovilizado', COLS.inm], ['Existencias', COLS.exi], ['Realizable + disponible', COLS.rea], ['Fondos propios', COLS.fp], ['Deuda a largo', COLS.dlp], ['Deuda a corto', COLS.dcp]].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {r.y.map((y, i) => {
            const act: [string, number, string][] = [['Inmovilizado', r.A[i], COLS.inm], ['Existencias', r.B[i], COLS.exi], ['Realizable + disponible', r.C[i], COLS.rea]];
            const pas: [string, number, string][] = [['Fondos propios', r.fp[i], COLS.fp], ['Deuda a largo', r.g('deuda_lp')[i], COLS.dlp], ['Deuda a corto', r.G[i], COLS.dcp]];
            const tot = Math.max(1, act.reduce((s, a) => s + Math.max(0, a[1]), 0), pas.reduce((s, a) => s + Math.max(0, a[1]), 0));
            const col = (cap: string, arr: [string, number, string][]) => (
              <div className="flex-1 flex flex-col">
                <div className="text-[11px] font-semibold text-gray-500 text-center mb-1">{cap}</div>
                <div className="h-64 flex flex-col justify-end rounded-lg overflow-hidden bg-gray-50">
                  {arr.map(([l, v, c]) => v > 0 && (
                    <div key={l} className="flex flex-col items-center justify-center text-[11px] text-white font-medium text-center px-1 leading-tight" style={{ height: `${(v / tot) * 100}%`, background: c }} title={`${l}: ${fE(v)}`}>
                      {v / tot > 0.09 && <>{l}<span className="opacity-80">{eurShort(v)}</span></>}
                    </div>
                  ))}
                </div>
              </div>
            );
            const fm = r.fmMasas[i];
            return (
              <div key={y} className="text-center">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">{y}</h4>
                <div className="flex gap-2">{col('ACTIVO', act)}{col('PASIVO', pas)}</div>
                <span className={`inline-block mt-2 text-xs font-semibold rounded-full px-2.5 py-1 ${fm >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>Fondo de maniobra {eurShort(fm)}</span>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Fondo de maniobra por masas" subtitle="Capitales permanentes − inmovilizado">
        <Synth r={r} rows={[['Fondos propios', r.fp], ['Deudas a largo plazo', r.g('deuda_lp')], ['Capitales permanentes', r.capPerm, true], ['Inmovilizado', r.A.map((v) => -v) as Triple], ['Fondo de maniobra', r.fmMasas, true]]} />
        <Note>Si el fondo de maniobra es positivo, los recursos a largo plazo financian todo el inmovilizado y además una parte del circulante. Es la situación sana.</Note>
      </Panel>
    </>
  );
}

export function ResumenTab({ r }: { r: AfResult }) {
  const L = 2;
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={`Fondo de maniobra aparente · ${r.y[L]}`} value={fE(r.fm[L])} hint="Activo circulante − pasivo circulante" tone={r.fm[L] >= 0 ? 'good' : 'bad'} />
        <Kpi label={`Fondo de maniobra necesario · ${r.y[L]}`} value={fE(r.fmNec[L])} hint="Gastos diarios × maduración − financiación de proveedores" />
        <Kpi label={`${r.fmExc[L] >= 0 ? 'Exceso' : 'Déficit'} de fondo de maniobra · ${r.y[L]}`} value={fE(r.fmExc[L])} hint="Aparente − necesario" tone={r.fmExc[L] >= 0 ? 'good' : 'bad'} />
        <Kpi label={`Días de autonomía · ${r.y[L]}`} value={fD(r.diasAut[L])} hint="Días de gastos que cubre el fondo de maniobra" />
      </div>
      <Panel title="Fondos de maniobra">
        <Synth r={r} rows={[['+ Activo circulante', r.ac], ['− Pasivo circulante', r.pc], ['Fondo de maniobra aparente', r.fm, true], ['Fondo de maniobra necesario', r.fmNec, true], ['Exceso (+) o déficit (−)', r.fmExc, true]]} />
        <p className="text-xs text-gray-500 mt-2">Días de autonomía: {r.y.map((y, i) => <span key={y} className="mr-3"><b>{y}</b> {fD(r.diasAut[i])}</span>)}</p>
      </Panel>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Composición de la deuda total">
          <YearBars years={r.y} series={[['Deuda a largo plazo', r.g('deuda_lp')], ['Deuda a corto plazo', r.G]]} />
          <div className="mt-4"><Synth r={r} rows={[['Deudas a largo plazo', r.g('deuda_lp')], ['Deudas a corto plazo', r.G], ['Deuda total', r.deudaTot, true], ['Total balance', r.H]]} /></div>
        </Panel>
        <Panel title="Capacidad de endeudamiento">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {r.y.map((y, i) => (
              <div key={y} className="rounded-xl border border-gray-100 px-3 py-2">
                <div className="text-xs text-gray-500">Endeudamiento posible {y}</div>
                <div className={`text-lg font-bold tabular-nums ${tone(r.endPos[i])}`}>{fE(r.endPos[i])}</div>
                <div className="text-xs text-gray-400">Devolución de préstamos {fP(r.devol[i])}</div>
              </div>
            ))}
          </div>
          <Note><b>Endeudamiento posible</b> = patrimonio neto / 0,4 − pasivo total: cuánta deuda más admitiría la empresa sin que los fondos propios bajen del 40 % del pasivo. <b>Ratio de devolución de préstamos</b> = cash-flow / deuda bancaria × 100.</Note>
        </Panel>
      </div>
      <Panel title="Cuadro de síntesis">
        <Synth r={r} rows={[['Clientes', r.g('clientes')], ['Proveedores y acreedores', r.provAcr], ['Activo real', r.activoReal], ['Existencias', r.B], ['Deuda con bancos a c/p y l/p', r.deudaBanc], ['Cifra de negocio', r.g('cn'), true], ['Total de gastos generales', r.gtosGen], ['Resultado neto', r.rn, true], ['Gastos de explotación diarios', r.gtosDia]]} />
        <Note>Fondo de maniobra necesario = (gastos diarios × periodo de maduración) − (compras / días × plazo de pago). Activo real = total − intangible − inversiones financieras.</Note>
      </Panel>
    </>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div>
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{children}</div>
  </div>
);

export function Ratios1Tab({ r }: { r: AfResult }) {
  const inc: [string, Triple, Triple][] = [['Rotación de existencias', r.pAlm, r.incStock], ['Plazo de cobro', r.pCob, r.incCobro], ['Plazo de pago', r.pPag, r.incPago]];
  return (
    <>
      <Section title="Plazos">
        <Ratio r={r} name="Plazo medio de almacenamiento" formula="Existencias medias × días / compras consumidas" vals={r.pAlm} fmt={fD} note="El primer año usa las existencias finales; los siguientes, la media con el año anterior." />
        <Ratio r={r} name="Plazo de cobro" formula="Clientes × días / ventas con IVA (×1,21)" vals={r.pCob} fmt={fD} rule={['<', 60]} />
        <Ratio r={r} name="Plazo de pago" formula="Proveedores × días / compras con IVA (×1,21)" vals={r.pPag} fmt={fD} rule={['<', 60]} note="Límite legal 60 días (Ley 15/2010)." />
        <Ratio r={r} name="Período de maduración" formula="Plazo de almacenamiento + plazo de cobro" vals={r.mad} fmt={fD} />
      </Section>
      <Section title="Liquidez y solvencia">
        <Ratio r={r} name="Liquidez general" formula="Activo circulante / pasivo circulante" vals={r.liq} fmt={fN2} rule={['>', 1.5]} />
        <Ratio r={r} name="Liquidez inmediata" formula="Realizable + disponible / pasivo circulante" vals={r.liqInm} fmt={fN2} rule={['>', 0.9]} />
        <Ratio r={r} name="Tesorería" formula="Disponible / pasivo circulante" vals={r.tes} fmt={fN2} rule={['>', 0.1]} />
        <Ratio r={r} name="Garantía" formula="Activo real / deuda total" vals={r.gar} fmt={fN2} rule={['>', 1.5]} />
        <Ratio r={r} name="Coste de la deuda" formula="Gastos financieros / deuda con coste × 100" vals={r.coste} fmt={fP} />
        <Ratio r={r} name="Cobertura de intereses" formula="Beneficio antes de financieros / gastos financieros" vals={r.cobInt} fmt={fN2} rule={['>', 3]} />
      </Section>
      <Panel title="Incidencias en tesorería" subtitle="Cuánto dinero liberan (+) o consumen (−) los cambios de plazos">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm whitespace-nowrap tabular-nums">
            <thead>
              <tr className={thead}>
                <th className="px-5 py-2 text-left font-medium">Por</th>
                <th className={TH}>{r.y[0]}</th><th className={TH}>{r.y[1]}</th><th className={TH}>Pérd./gan. tesorería</th>
                <th className={TH}>{r.y[2]}</th><th className={`${TH} pr-5`}>Pérd./gan. tesorería</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {inc.map(([l, d, x]) => (
                <tr key={l}>
                  <td className="px-5 py-1.5 text-gray-700">{l}</td>
                  <td className="px-3 py-1.5 text-right">{fD(d[0])}</td><td className="px-3 py-1.5 text-right">{fD(d[1])}</td>
                  <td className={`px-3 py-1.5 text-right ${tone(x[1])}`}>{fE(x[1])}</td>
                  <td className="px-3 py-1.5 text-right">{fD(d[2])}</td>
                  <td className={`px-3 py-1.5 text-right pr-5 ${tone(x[2])}`}>{fE(x[2])}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-5 py-1.5">Suma</td><td /><td />
                <td className={`px-3 py-1.5 text-right ${tone(r.incTot[1])}`}>{fE(r.incTot[1])}</td><td />
                <td className={`px-3 py-1.5 text-right pr-5 ${tone(r.incTot[2])}`}>{fE(r.incTot[2])}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>Cobrar antes, almacenar menos o pagar más tarde libera tesorería. Se calcula sobre 360 días, como en la plantilla.</Note>
      </Panel>
    </>
  );
}

export function Ratios2Tab({ r }: { r: AfResult }) {
  return (
    <>
      <Section title="Rotaciones">
        <Ratio r={r} name="Rotación del activo circulante" formula="Ventas / activo circulante" vals={r.rotAC} fmt={fN2} />
        <Ratio r={r} name="Rotación del activo fijo" formula="Ventas / activo fijo" vals={r.rotAF} fmt={fN2} />
        <Ratio r={r} name="Rotación del capital propio" formula="Ventas / capital propio" vals={r.rotCP} fmt={fN2} />
        <Ratio r={r} name="Rotación de clientes" formula="Ventas / clientes" vals={r.rotCli} fmt={fN2} />
      </Section>
      <Section title="Rentabilidad y autonomía">
        <Ratio r={r} name="Rentabilidad económica" formula="Beneficio / activo × 100" vals={r.rentEc} fmt={fP} rule={['>', 3.5]} />
        <Ratio r={r} name="Rentabilidad financiera" formula="Beneficio / capital propio × 100" vals={r.rentFin} fmt={fP} rule={['>', 6]} />
        <Ratio r={r} name="Autonomía financiera" formula="Capital propio / pasivo" vals={r.aut} fmt={fN2} rule={['>', 0.4]} />
      </Section>
      <Section title="Probabilidad de suspensión de pagos">
        <Ratio r={r} name="Cash-flow / deudas totales" formula="Cash-flow / deuda total" vals={r.cfDeuda} fmt={fN2} rule={['>', 0.4]} />
        <Ratio r={r} name="Factor Z" formula="−4,2 + 1,35·liquidez + 6,5·autonomía + 7·rent. económica + 5·rent. financiera" vals={r.z} fmt={fN2} rule={['>', 0]} note="Por debajo de 0 indica riesgo de insolvencia." />
        <Ratio r={r} name="Fondo de maniobra / activo" formula="Fondo de maniobra / activo total" vals={r.fmAct} fmt={fN2} rule={['>', 0.3]} />
      </Section>
    </>
  );
}

export function OriAplTab({ r }: { r: AfResult }) {
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(2);
  const items = (i: number) => ({
    inm: r.A[i], exi: r.B[i], rea: r.C[i] - r.g('inv_grupo')[i] - r.g('disp')[i], dis: r.g('disp')[i] + r.g('inv_grupo')[i],
    fp: r.fp[i], dlp: r.g('deuda_lp')[i], dcp: r.G[i],
  });
  type K = keyof ReturnType<typeof items>;
  const a = items(from), b = items(to), d = (k: K) => b[k] - a[k];
  const act: [string, K][] = [['Inmovilizado neto', 'inm'], ['Existencias', 'exi'], ['Realizable', 'rea'], ['Disponible', 'dis']];
  const pas: [string, K][] = [['Fondos propios', 'fp'], ['Deudas a largo plazo', 'dlp'], ['Deudas a corto plazo', 'dcp']];
  const apl = [...act.map(([l, k]) => [l, Math.max(0, d(k))] as const), ...pas.map(([l, k]) => [l, Math.max(0, -d(k))] as const)];
  const ori = [...act.map(([l, k]) => [l, Math.max(0, -d(k))] as const), ...pas.map(([l, k]) => [l, Math.max(0, d(k))] as const)];
  const sa = apl.reduce((s, x) => s + x[1], 0), so = ori.reduce((s, x) => s + x[1], 0);
  const max = Math.max(...apl.map((x) => x[1]), ...ori.map((x) => x[1]), 1);
  const sel = (v: number, set: (n: number) => void) => (
    <select value={v} onChange={(e) => set(Number(e.target.value))} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
      {r.y.map((y, i) => <option key={y} value={i}>{y}</option>)}
    </select>
  );
  const side = (title: string, rows: [string, K][]) => (
    <div className="overflow-x-auto -mx-5 lg:mx-0">
      <table className="w-full text-sm whitespace-nowrap tabular-nums">
        <thead><tr className={thead}><th className="px-5 lg:px-3 py-2 text-left font-medium">{title}</th><th className={TH}>{r.y[from]}</th><th className={TH}>{r.y[to]}</th><th className={`${TH} pr-5 lg:pr-3`}>Diferencia</th></tr></thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(([l, k]) => (
            <tr key={k}><td className="px-5 lg:px-3 py-1.5 text-gray-700">{l}</td><td className="px-3 py-1.5 text-right">{fE(a[k])}</td><td className="px-3 py-1.5 text-right">{fE(b[k])}</td><td className={`px-3 py-1.5 text-right pr-5 lg:pr-3 ${tone(d(k))}`}>{fE(d(k))}</td></tr>
          ))}
          <tr className="bg-gray-50 font-semibold">
            <td className="px-5 lg:px-3 py-1.5">Total</td>
            <td className="px-3 py-1.5 text-right">{fE(rows.reduce((s, [, k]) => s + a[k], 0))}</td>
            <td className="px-3 py-1.5 text-right">{fE(rows.reduce((s, [, k]) => s + b[k], 0))}</td>
            <td className="px-3 py-1.5 text-right pr-5 lg:pr-3">{fE(rows.reduce((s, [, k]) => s + d(k), 0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
  const flow = (title: string, rows: readonly (readonly [string, number])[], total: number, color: string) => (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <ul className="space-y-2">
        {rows.filter((x) => x[1]).map(([l, v]) => (
          <li key={l}>
            <div className="flex justify-between text-xs"><span className="text-gray-700">{l}</span><span className="tabular-nums font-medium">{fE(v)}</span></div>
            <div className="h-1.5 mt-1 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${color}`} style={{ width: `${(v / max) * 100}%` }} /></div>
          </li>
        ))}
        {!rows.some((x) => x[1]) && <Empty />}
      </ul>
      <div className="flex justify-between text-sm font-semibold border-t border-gray-100 mt-3 pt-2"><span>Total</span><span className="tabular-nums">{fE(total)}</span></div>
    </div>
  );
  return (
    <>
      <Panel title="Estado de origen y aplicación de fondos" right={<div className="flex items-center gap-2 text-sm text-gray-600">Comparar {sel(from, setFrom)} con {sel(to, setTo)}</div>}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{side('Activo', act)}{side('Pasivo', pas)}</div>
      </Panel>
      <Panel title="¿De dónde ha salido el dinero y a qué se ha dedicado?" subtitle={`${r.y[from]} → ${r.y[to]}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {flow('Aplicaciones (usos)', apl, sa, 'bg-rose-400')}
          {flow('Orígenes (fuentes)', ori, so, 'bg-emerald-500')}
        </div>
        <Note>Aumentos de activo y bajadas de pasivo son aplicaciones; bajadas de activo y aumentos de pasivo son orígenes. Si el balance cuadra, los dos totales coinciden.</Note>
      </Panel>
    </>
  );
}

export function ValorAnadidoTab({ r }: { r: AfResult }) {
  const parts: [string, Triple, string][] = [
    ['Al personal', r.vaPers, '#714B67'], ['A las administraciones', r.vaAdm, '#f59e0b'], ['A los bancos', r.vaBanc, '#f43f5e'],
    ['A terceros (seguros, profesionales, alquileres)', r.vaTerc, '#0ea5e9'], ['A la empresa (amortizaciones y provisiones)', r.vaEmp, '#64748b'], ['A la propiedad (resultado)', r.vaProp, '#10b981'],
  ];
  const otros = r.vaEmp.map((v, i) => v + r.g('otros_ing')[i] + r.g('ben_ext')[i] - r.g('perd_ext')[i]) as Triple;
  const detail: [string, Triple, boolean?][] = [
    ['Gastos de personal (sin Seguridad Social)', r.vaPers, true], ['Tasas y tributos', r.g('tributos')], ['Impuesto sobre sociedades', r.g('is')], ['Seguridad Social', r.g('ss')], ['A las administraciones', r.vaAdm, true],
    ['Gastos financieros', r.g('gfin')], ['Servicios bancarios', r.g('serv_banc')], ['A los bancos', r.vaBanc, true],
    ['Primas de seguro', r.g('primas')], ['Servicios profesionales', r.g('serv_prof')], ['Arrendamientos y cánones', r.g('arrend')], ['A terceros', r.vaTerc, true],
    ['Amortizaciones, provisiones y excesos', otros], ['− Otros ingresos y beneficios extraordinarios', r.g('otros_ing').map((v, i) => -(v + r.g('ben_ext')[i])) as Triple], ['+ Pérdidas extraordinarias', r.g('perd_ext')], ['A la empresa', r.vaEmp, true],
    ['A la propiedad (resultado neto)', r.vaProp, true],
  ];
  return (
    <>
      <Panel title="Reparto del valor añadido" subtitle="Quién se lleva cada euro que genera la empresa">
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
          {parts.map(([l, , c]) => <span key={l} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}</span>)}
        </div>
        <div className="space-y-2">
          {r.y.map((y, i) => {
            const tot = parts.reduce((s, p) => s + Math.max(0, p[1][i]), 0) || 1;
            return (
              <div key={y} className="flex items-center gap-3">
                <b className="w-12 text-sm text-gray-700">{y}</b>
                <div className="flex-1 flex h-7 rounded-lg overflow-hidden bg-gray-100">
                  {parts.map(([l, a, c]) => a[i] > 0 && (
                    <div key={l} className="flex items-center justify-center text-[11px] text-white font-medium" style={{ width: `${(a[i] / tot) * 100}%`, background: c }} title={`${l}: ${fE(a[i])}`}>
                      {a[i] / tot > 0.07 ? `${Math.round((a[i] / tot) * 100)} %` : ''}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Detalle">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm whitespace-nowrap tabular-nums">
            <thead>
              <tr className={thead}>
                <th className="px-5 py-2 text-left font-medium">Concepto</th>
                {r.y.map((y) => <FragmentCols key={y} cols={[<th key="y" className={TH}>{y}</th>, <th key="p" className={`${TH} text-gray-400`}>%</th>]} />)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr className="bg-brand-50 font-semibold">
                <td className="px-5 py-1.5">VALOR AÑADIDO</td>
                {r.va.map((v, i) => <FragmentCols key={i} cols={[<td key="v" className="px-3 py-1.5 text-right">{fE(v)}</td>, <td key="p" className="px-3 py-1.5 text-right text-xs text-gray-400">100</td>]} />)}
              </tr>
              {detail.map(([l, a, big]) => (
                <tr key={l} className={big ? 'bg-gray-50 font-semibold' : 'text-gray-700'}>
                  <td className="px-5 py-1.5">{l}</td>
                  {a.map((v, i) => <FragmentCols key={i} cols={[<td key="v" className="px-3 py-1.5 text-right">{fE(v)}</td>, <td key="p" className="px-3 py-1.5 text-right text-xs text-gray-400">{r.va[i] ? fN2((100 * v) / r.va[i]) : ''}</td>]} />)}
                </tr>
              ))}
              <tr className="text-xs text-gray-500">
                <td className="px-5 py-1.5">Línea de cuadre (debe ser 0)</td>
                {r.vaChk.map((v, i) => <FragmentCols key={i} cols={[<td key="v" className={`px-3 py-1.5 text-right ${Math.abs(v) > 1 ? 'text-rose-700' : 'text-emerald-700'}`}>{fE(v)}</td>, <td key="p" />]} />)}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function UmbralTab({ r }: { r: AfResult }) {
  const [i, setI] = useState(2);
  const dias = r.dias[i];
  const dayOk = fin(r.umbralDia[i]) && r.umbralDia[i] >= 0 && r.umbralDia[i] <= dias;
  const fecha = dayOk ? new Date(Date.UTC(r.y[i], 0, Math.ceil(r.umbralDia[i]))) : null;
  const seg = fin(r.prod[i]) && r.prod[i] ? ((r.prod[i] - r.umbral[i]) / r.prod[i]) * 100 : NaN;
  // Gráfico: producción acumulada vs gastos totales (fijos + variables) a lo largo del ejercicio
  const fixed = r.gestr[i], prod = r.prod[i], variable = fin(r.mc[i]) ? prod * (1 - r.mc[i]) : 0;
  const W = 600, H = 220, PAD = 14;
  const max = Math.max(prod, fixed + variable, fixed, 1), min = Math.min(0, fixed);
  const x = (d: number) => (d / dias) * W;
  const y = (v: number) => PAD + ((max - v) / ((max - min) || 1)) * (H - PAD * 2);
  return (
    <Panel
      title="Umbral de rentabilidad" subtitle="Punto en el que los ingresos cubren todos los gastos"
      right={
        <div className="flex gap-1">
          {r.y.map((y2, j) => (
            <button key={y2} type="button" onClick={() => setI(j)} className={`text-xs px-3 py-1.5 rounded-full border ${j === i ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{y2}</button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Umbral de rentabilidad" value={fE(r.umbral[i])} hint="Gastos fijos / margen de contribución" />
        <Kpi label="Sobre la producción" value={fP(r.umbralFr[i] * 100)} hint={`Producción ${fE(prod)}`} />
        <Kpi label="Se alcanza el" value={fecha ? `${fecha.getUTCDate()} de ${MONTHS[fecha.getUTCMonth()]}` : fin(r.umbralDia[i]) && r.umbralDia[i] > dias ? 'No se alcanza' : '—'} hint={`Día ${fin(r.umbralDia[i]) ? Math.ceil(r.umbralDia[i]) : '—'} del ejercicio`} tone={fecha ? 'good' : 'bad'} />
        <Kpi label="Margen de seguridad" value={fP(seg)} hint="Cuánto podría caer la producción sin pérdidas" tone={seg >= 0 ? 'good' : 'bad'} />
      </div>
      <div className="mt-5">
        <Legend items={['Producción acumulada', 'Gastos totales', 'Gastos fijos (estructura)']} line />
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-60">
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#e5e7eb" />
          <line x1={x(0)} y1={y(0)} x2={x(dias)} y2={y(prod)} stroke={SERIES_COLORS[0]} strokeWidth={2.5} />
          <line x1={x(0)} y1={y(fixed)} x2={x(dias)} y2={y(fixed + variable)} stroke={SERIES_COLORS[1]} strokeWidth={2.5} />
          <line x1={x(0)} y1={y(fixed)} x2={x(dias)} y2={y(fixed)} stroke={SERIES_COLORS[2]} strokeWidth={1.5} strokeDasharray="5 4" />
          {dayOk && <circle cx={x(r.umbralDia[i])} cy={y(r.umbral[i])} r={5} fill="#111827"><title>{`Umbral: ${fE(r.umbral[i])}`}</title></circle>}
        </svg>
        <div className="flex justify-between text-[10px] text-gray-400">{MONTHS.filter((_, m) => m % 2 === 0).map((m) => <span key={m}>{m.slice(0, 3)}</span>)}</div>
      </div>
      <Note>Gastos fijos = gastos de estructura. Margen de contribución = (gastos de estructura + resultado de actividades ordinarias) / producción. Gastos variables = producción × (1 − margen de contribución).</Note>
    </Panel>
  );
}

export function GraficosTab({ r }: { r: AfResult }) {
  const k = 1000;
  const idx = (a: Triple) => a.map((v) => (a[0] ? v / a[0] : NaN)) as Triple;
  const pct = (a: Triple) => a.map((v, i) => (r.prod[i] ? (100 * v) / r.prod[i] : NaN)) as Triple;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Panel title="Activo y deuda" subtitle="Miles de euros"><YearBars years={r.y} scale={k} series={[['Activo', r.D], ['Deuda a largo', r.g('deuda_lp')], ['Deuda a corto', r.G]]} /></Panel>
      <Panel title="Realizable + disponible frente a deuda a corto" subtitle="Miles de euros"><YearBars years={r.y} scale={k} series={[['Realizable + disponible', r.C], ['Deuda a corto', r.G]]} /></Panel>
      <Panel title="Cifra de negocio, clientes y deuda a corto" subtitle="Miles de euros"><YearBars years={r.y} scale={k} series={[['Cifra de negocio', r.g('cn')], ['Clientes', r.g('clientes')], ['Deuda a corto', r.G]]} /></Panel>
      <Panel title="Índices de evolución" subtitle="Primer año = 1"><YearLines years={r.y} fmt={fN2} series={[['Cifra de negocio', idx(r.g('cn'))], ['Clientes', idx(r.g('clientes'))], ['Deuda a corto', idx(r.G)]]} /></Panel>
      <Panel title="Producción y gastos" subtitle="Miles de euros"><YearBars years={r.y} scale={k} series={[['Producción', r.prod], ['Compras', r.g('compras')], ['Gastos de estructura', r.gestr], ['Gastos de funcionamiento', r.gfunc], ['Resultado act. ordinarias', r.rao]]} /></Panel>
      <Panel title="Peso sobre la producción" subtitle="%"><YearLines years={r.y} fmt={fP} series={[['Compras', pct(r.g('compras'))], ['Gastos de estructura', pct(r.gestr)], ['Gastos de funcionamiento', pct(r.gfunc)], ['Resultado act. ordinarias', pct(r.rao)]]} /></Panel>
    </div>
  );
}

export function CuentasTab({ r, unmapped }: { r: AfResult; unmapped: AccountingUnmapped[] }) {
  return (
    <>
      <Panel title="Comprobaciones" subtitle="Como en la portada de la plantilla: deben salir a 0">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm whitespace-nowrap tabular-nums">
            <thead><tr className={thead}><th className="px-5 py-2 text-left font-medium">Comprobación</th>{r.y.map((y) => <th key={y} className={`${TH} pr-5`}>{y}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {([['Activo − pasivo', r.chkBal], ['Resultado del balance − resultado neto de explotación', r.chkRes]] as [string, Triple][]).map(([l, a]) => (
                <tr key={l}>
                  <td className="px-5 py-1.5 text-gray-700">{l}</td>
                  {a.map((v, i) => <td key={i} className={`px-3 py-1.5 text-right pr-5 font-medium ${Math.abs(v) > 1 ? 'text-rose-700' : 'text-emerald-700'}`}>{Math.abs(v) > 1 ? fE(v) : 'Cuadra'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Cuentas sin clasificar" subtitle="Cuentas cuyo código no encaja en ninguna partida de la plantilla. Se han sumado a la partida indicada para que el balance cuadre.">
        {unmapped.length === 0 ? <Empty text="Todas las cuentas con saldo están clasificadas." /> : (
          <div className="overflow-x-auto -mx-5 max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm whitespace-nowrap tabular-nums">
              <thead className="sticky top-0"><tr className={thead}>
                <th className="px-5 py-2 text-left font-medium">Ejercicio</th><th className="px-3 py-2 text-left font-medium">Cuenta</th>
                <th className="px-3 py-2 text-left font-medium">Sumada a</th><th className={`${TH} pr-5`}>Saldo</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {unmapped.map((u, i) => (
                  <tr key={i}>
                    <td className="px-5 py-1.5 text-gray-500">{u.year}</td>
                    <td className="px-3 py-1.5 text-gray-800"><span className="font-mono text-xs text-gray-500 mr-2">{u.code}</span>{u.name}</td>
                    <td className="px-3 py-1.5 text-gray-600">{AF_LBL[u.to]?.[0] ?? u.to}</td>
                    <td className="px-3 py-1.5 text-right pr-5">{fE(u.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Note>Saldo con el signo contable de Odoo (deudor +, acreedor −). Si una cuenta debería ir a otra partida, dímelo y se añade su prefijo a la clasificación.</Note>
      </Panel>
    </>
  );
}
