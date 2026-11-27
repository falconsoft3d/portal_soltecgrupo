'use client';

import { CSSProperties, Fragment, ReactNode, createContext, useContext, useMemo, useState } from 'react';
import type { AccountingUnmapped } from '@/lib/api';
import {
  AF_BAL_ACT, AF_BAL_PAS, AF_BIG, AF_LBL, AF_PYG, AF_TOT, AfResult, RatioRule, Triple, fin, ratioState,
} from '@/lib/financialAnalysis';
import ChartCanvas from '../components/cuadro/ChartCanvas';
import { Drill } from '../components/cuadro/drill';
import { AnyOpts, C, baseOpts, compact, e0, fonts, hbarOpts, rgba, zeroLine } from '../components/cuadro/lib';
import { Tbl } from '../components/cuadro/xlsx';

/* ------------------------------------------------------------------ */
/*  Formatos (afE, afN2, afP, afD del artefacto)                        */
/* ------------------------------------------------------------------ */

export const afE = (v: number) => (fin(v) ? e0(v) : '—');
export const afN2 = (v: number) => (fin(v) ? v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
export const afP = (v: number) => (fin(v) ? `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` : '—');
export const afD = (v: number) => (fin(v) ? `${Math.round(v)} días` : '—');
const cls = (v: number) => (v < 0 ? 'neg' : '');
const cvar = (c: string) => ({ '--c': c } as CSSProperties);

const Note = ({ children }: { children: ReactNode }) => <div className="note">{children}</div>;
const Legend = ({ items }: { items: [string, string, boolean?][] }) => (
  <div className="legend">{items.map(([l, c, ln]) => <span key={l} className={ln ? 'ln' : ''} style={cvar(c)}>{l}</span>)}</div>
);

/** Compañías y borradores del análisis, para enlazar cada importe con sus apuntes. */
export const AfDrillCtx = createContext<{ c: number[]; draft: boolean } | null>(null);

/** Importe de una partida que abre los apuntes que la forman. */
function AfAmount({ k, i, r, label, children }: { k: string; i: number; r: AfResult; label: string; children: ReactNode }) {
  const ctx = useContext(AfDrillCtx);
  if (!ctx) return <>{children}</>;
  return <Drill spec={{ t: 'acct', key: k, year: r.y[i], draft: ctx.draft, c: ctx.c, l: `${label} · ${r.y[i]}` }}>{children}</Drill>;
}

/* ------------------------------------------------------------------ */
/*  Tablas                                                              */
/* ------------------------------------------------------------------ */

function YearHead({ r, pc = true }: { r: AfResult; pc?: boolean }) {
  return (
    <>
      {r.y.map((y, i) => (
        <Fragment key={y}>
          <th className="n yr">{y}</th>
          {pc && <th className="n pc">%</th>}
          {i > 0 && <th className="n pc">Ind.</th>}
        </Fragment>
      ))}
    </>
  );
}

function AfRows({ view, r, base }: { view: string[]; r: AfResult; base: Triple }) {
  return (
    <>
      {view.map((k) => {
        const tot = k[0] === '=';
        const key = tot ? k.slice(1) : k;
        const vals = tot ? (r[key as keyof AfResult] as Triple) : r.g(key);
        const lbl = tot ? AF_TOT[key] : AF_LBL[key][0];
        return (
          <tr key={k} className={`${tot ? 'tot' : ''} ${AF_BIG.has(key) ? 'big' : ''}`}>
            <td className="code">{tot ? '' : AF_LBL[key][1]}</td>
            <td className="lbl">{tot ? <b>{lbl}</b> : lbl}</td>
            {[0, 1, 2].map((i) => (
              <Fragment key={i}>
                <td className={`n ${cls(vals[i])}`}>{tot || !vals[i] ? afE(vals[i]) : <AfAmount k={key} i={i} r={r} label={lbl}>{afE(vals[i])}</AfAmount>}</td>
                <td className="n pc">{base[i] ? afN2((100 * vals[i]) / base[i]) : ''}</td>
                {i > 0 && <td className="n ix">{vals[i - 1] ? afN2(vals[i] / vals[i - 1]) : ''}</td>}
              </Fragment>
            ))}
          </tr>
        );
      })}
    </>
  );
}

function Synth({ rows, r, name = 'Cuadro' }: { rows: [string, Triple, boolean?][]; r: AfResult; name?: string }) {
  return (
    <Tbl name={name} className="tbl">
      <table className="aft">
        <thead><tr><th>Concepto</th><th className="n">{r.y[0]}</th><th className="n">{r.y[1]}</th><th className="n">Variación</th><th className="n">%</th><th className="n">{r.y[2]}</th><th className="n">Variación</th><th className="n">%</th></tr></thead>
        <tbody>
          {rows.map(([l, a, big]) => {
            const v1 = a[1] - a[0], v2 = a[2] - a[1];
            const p1 = a[0] ? (v1 / Math.abs(a[0])) * 100 : NaN, p2 = a[1] ? (v2 / Math.abs(a[1])) * 100 : NaN;
            return (
              <tr key={l} className={big ? 'tot' : ''}>
                <td className="lbl">{l}</td>
                <td className={`n ${cls(a[0])}`}>{afE(a[0])}</td><td className={`n ${cls(a[1])}`}>{afE(a[1])}</td>
                <td className={`n ${cls(v1)}`}>{afE(v1)}</td><td className="n pc">{afP(p1)}</td>
                <td className={`n ${cls(a[2])}`}><b>{afE(a[2])}</b></td>
                <td className={`n ${cls(v2)}`}>{afE(v2)}</td><td className="n pc">{afP(p2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Tbl>
  );
}

/* ------------------------------------------------------------------ */
/*  Tarjeta de ratio con minibarras (afRatio + afMini)                  */
/* ------------------------------------------------------------------ */

const STATE_COL: Record<string, string> = { ok: C.pos, warn: C.warn, bad: C.neg, na: C.estim };
const STATE_TXT: Record<string, string> = { ok: 'Correcto', warn: 'Vigilar', bad: 'Riesgo' };

function AfMini({ vals, years, thr, states }: { vals: Triple; years: number[]; thr: number; states: string[] }) {
  const W = 260, H = 70, top = 6, bot = 14;
  const nums = vals.map((v) => (fin(v) ? v : 0));
  const ext = [...nums, 0, ...(fin(thr) ? [thr] : [])];
  let mx = Math.max(...ext);
  const mn = Math.min(...ext);
  if (mx === mn) mx = mn + 1;
  const y = (v: number) => top + ((mx - v) / (mx - mn)) * (H - top - bot);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={C.line} />
      {nums.map((v, i) => {
        const cx = (W / 6) * (2 * i + 1), bw = 46, y0 = y(0), y1 = y(v);
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(1.5, Math.abs(y1 - y0))} rx={4} fill={STATE_COL[states[i]] ?? C.estim} opacity={fin(vals[i]) ? 0.9 : 0.25} />
            <text x={cx} y={H - 2} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.muted}>{years[i]}</text>
          </g>
        );
      })}
      {fin(thr) && <line x1={0} x2={W} y1={y(thr)} y2={y(thr)} stroke={C.ink} strokeDasharray="4 4" strokeWidth={1.2} opacity={0.6} />}
    </svg>
  );
}

function Ratio({ name, formula, vals, r, fmt, rule = null, note }: {
  name: string; formula: string; vals: Triple; r: AfResult; fmt: (v: number) => string; rule?: RatioRule; note?: string;
}) {
  const st = vals.map((v) => ratioState(v, rule));
  const last = st[2] !== 'na' ? st[2] : null;
  return (
    <div className="rcard">
      <div className="rt">
        <div>
          <div className="rn">{name}</div>
          <div className="rf">{formula}{rule ? ` · objetivo ${rule[0]} ${String(rule[1]).replace('.', ',')}` : ''}{note && <><br />{note}</>}</div>
        </div>
        {last && <span className={`pill ${last}`}>{STATE_TXT[last]}</span>}
      </div>
      <div className="rv">{vals.map((v, i) => <div key={i}><span>{r.y[i]}</span><b className={st[i]}>{fmt(v)}</b></div>)}</div>
      <AfMini vals={vals} years={r.y} thr={rule ? rule[1] : NaN} states={st} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gráficos (afCharts)                                                 */
/* ------------------------------------------------------------------ */

const yl = (r: AfResult) => r.y.map(String);
function barCfg(r: AfResult, sets: [string, number[], string][], opts?: (o: AnyOpts) => void) {
  const o = baseOpts(); o.scales.x.ticks.maxTicksLimit = 10;
  if (opts) opts(o);
  return { type: 'bar', data: { labels: yl(r), datasets: sets.map(([l, d, c]) => ({ label: l, data: d, backgroundColor: c, borderRadius: 4, maxBarThickness: 38 })) }, options: o, plugins: [zeroLine] };
}
function lineCfg(r: AfResult, sets: [string, number[], string][], fmt: (v: number) => string) {
  const o = baseOpts();
  o.scales.y.ticks.callback = (v: number | string) => fmt(Number(v));
  o.plugins.tooltip.callbacks.label = (c: { dataset: { label: string }; parsed: { y: number } }) => ` ${c.dataset.label}: ${fmt(c.parsed.y)}`;
  return { type: 'line', data: { labels: yl(r), datasets: sets.map(([l, d, c]) => ({ label: l, data: d, borderColor: c, backgroundColor: c, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2.5, tension: 0.25 })) }, options: o };
}

/* ------------------------------------------------------------------ */
/*  Subpestañas                                                         */
/* ------------------------------------------------------------------ */

export function BalanceTab({ r }: { r: AfResult }) {
  return (
    <>
      <Note>Importes calculados desde la contabilidad (saldos a 31/12, o a hoy si el ejercicio está en curso). Pulsa un importe para ver los apuntes que lo forman. Las filas en gris son totales. <b>%</b> = peso sobre el total del activo o del pasivo · <b>Ind.</b> = año / año anterior.</Note>
      <div className="grid k2" style={{ alignItems: 'start' }}>
        <div className="card"><h2>Activo</h2><Tbl name="Activo" className="tbl"><table className="aft"><thead><tr><th /><th>Concepto</th><YearHead r={r} /></tr></thead><tbody><AfRows view={AF_BAL_ACT} r={r} base={r.D} /></tbody></table></Tbl></div>
        <div className="card"><h2>Pasivo y patrimonio neto</h2><Tbl name="Pasivo y patrimonio neto" className="tbl"><table className="aft"><thead><tr><th /><th>Concepto</th><YearHead r={r} /></tr></thead><tbody><AfRows view={AF_BAL_PAS} r={r} base={r.H} /></tbody></table></Tbl></div>
      </div>
    </>
  );
}

export function ExplotacionTab({ r, employees, onEmployees }: { r: AfResult; employees: Triple; onEmployees: (i: number, v: number) => void }) {
  const prodRows: [string, Triple, (v: number) => string][] = [
    ['Producción por empleado', r.prodEmp, afE], ['Coste de personal por empleado', r.costeEmp, afE],
    ['Producción por euro de sueldos', r.prodSue, afN2], ['Margen bruto por euro de sueldos', r.mbSue, afN2], ['Beneficio por euro de sueldos', r.bnSue, afN2],
  ];
  return (
    <>
      <Note>Importes sin signo, como en la plantilla: la variación de existencias va en negativo si disminuyen, y los excesos de provisiones con signo menos. <b>%</b> = peso sobre la producción. Pulsa un importe para ver sus apuntes.</Note>
      <div className="card"><h2>Cuenta de explotación · rentabilidad</h2><Tbl name="Cuenta de explotación · rentabilidad" className="tbl"><table className="aft"><thead><tr><th /><th>Concepto</th><YearHead r={r} /></tr></thead><tbody><AfRows view={AF_PYG} r={r} base={r.prod} /></tbody></table></Tbl></div>
      <div className="card">
        <h2>Plantilla y productividad <small>el nº de empleados no está en la contabilidad: escríbelo aquí</small></h2>
        <Tbl name="Plantilla y productividad" className="tbl">
          <table className="aft">
            <thead><tr><th /><th>Concepto</th><YearHead r={r} pc={false} /></tr></thead>
            <tbody>
              <tr>
                <td className="code" /><td className="lbl">Nº de empleados</td>
                {[0, 1, 2].map((i) => (
                  <Fragment key={i}>
                    <td className="n"><input className="afi" inputMode="numeric" value={employees[i] || ''} placeholder="0" onChange={(e) => onEmployees(i, Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))} aria-label={`Empleados ${r.y[i]}`} /></td>
                    {i > 0 && <td className="n ix">{employees[i - 1] ? afN2(employees[i] / employees[i - 1]) : ''}</td>}
                  </Fragment>
                ))}
              </tr>
              <tr>
                <td className="code">{AF_LBL.ss[1]}</td><td className="lbl">{AF_LBL.ss[0]}</td>
                {[0, 1, 2].map((i) => <Fragment key={i}><td className="n">{r.g('ss')[i] ? <AfAmount k="ss" i={i} r={r} label="Seguridad Social">{afE(r.g('ss')[i])}</AfAmount> : afE(r.g('ss')[i])}</td>{i > 0 && <td className="n ix">{r.g('ss')[i - 1] ? afN2(r.g('ss')[i] / r.g('ss')[i - 1]) : ''}</td>}</Fragment>)}
              </tr>
              {prodRows.map(([l, a, f]) => (
                <tr key={l} className="tot">
                  <td /><td className="lbl">{l}</td>
                  {[0, 1, 2].map((i) => <Fragment key={i}><td className="n">{f(a[i])}</td>{i > 0 && <td className="n ix">{fin(a[i]) && fin(a[i - 1]) && a[i - 1] ? afN2(a[i] / a[i - 1]) : ''}</td>}</Fragment>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Tbl>
        <Note>La Seguridad Social solo sirve para repartir el valor añadido: se resta del personal y se suma a las administraciones.</Note>
      </div>
    </>
  );
}

export function MasasTab({ r }: { r: AfResult }) {
  const COL = { inm: C.cG, exi: C.ajuste, rea: C.cobro, fp: C.accent, dlp: C.estim, dcp: C.pago };
  return (
    <>
      <div className="card">
        <h2>Gráfico de masas patrimoniales <small>la altura de cada bloque es su peso en el balance</small></h2>
        <Legend items={[['Inmovilizado', COL.inm], ['Existencias', COL.exi], ['Realizable + disponible', COL.rea], ['Fondos propios', COL.fp], ['Deuda a largo', COL.dlp], ['Deuda a corto', COL.dcp]]} />
        <div className="masas">
          {r.y.map((y, i) => {
            const act: [string, number, string][] = [['Inmovilizado', r.A[i], COL.inm], ['Existencias', r.B[i], COL.exi], ['Realizable + disponible', r.C[i], COL.rea]];
            const pas: [string, number, string][] = [['Fondos propios', r.fp[i], COL.fp], ['Deuda a largo', r.g('deuda_lp')[i], COL.dlp], ['Deuda a corto', r.G[i], COL.dcp]];
            const tot = Math.max(1, act.reduce((s, a) => s + Math.max(0, a[1]), 0), pas.reduce((s, a) => s + Math.max(0, a[1]), 0));
            const col = (cap: string, arr: [string, number, string][]) => (
              <div className="mcol">
                <div className="cap">{cap}</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: 8, overflow: 'hidden' }}>
                  {arr.map(([l, v, c]) => v > 0 && (
                    <div key={l} className="mblk" style={{ height: `${(v / tot) * 100}%`, background: c }} title={`${l}: ${afE(v)}`}>
                      {v / tot > 0.09 && <>{l}<small>{compact(v)}</small></>}
                    </div>
                  ))}
                </div>
              </div>
            );
            const fm = r.fmMasas[i];
            return (
              <div key={y} className="masa-y">
                <h4>{y}</h4>
                <div className="masa-cols">{col('ACTIVO', act)}{col('PASIVO', pas)}</div>
                <span className={`masa-fm pill ${fm >= 0 ? 'ok' : 'bad'}`}>Fondo de maniobra {compact(fm)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <h2>Fondo de maniobra por masas <small>capitales permanentes − inmovilizado</small></h2>
        <Synth name="Fondo de maniobra por masas" r={r} rows={[['Fondos propios', r.fp], ['Deudas a largo plazo', r.g('deuda_lp')], ['Capitales permanentes', r.capPerm, true], ['Inmovilizado', r.A.map((v) => -v) as Triple], ['Fondo de maniobra', r.fmMasas, true]]} />
        <Note>Si el fondo de maniobra es positivo, los recursos a largo plazo financian todo el inmovilizado y además una parte del circulante. Es la situación sana.</Note>
      </div>
    </>
  );
}

export function ResumenTab({ r }: { r: AfResult }) {
  const L = 2;
  const deuda = useMemo(() => {
    const o = baseOpts(); o.scales.x.stacked = true; o.scales.y.stacked = true;
    return { type: 'bar', data: { labels: yl(r), datasets: [
      { label: 'Deuda a largo', data: r.g('deuda_lp'), backgroundColor: C.estim, borderRadius: 4, maxBarThickness: 46 },
      { label: 'Deuda a corto', data: r.G, backgroundColor: C.pago, borderRadius: 4, maxBarThickness: 46 },
    ] }, options: o };
  }, [r]);
  const tile = (l: string, v: number, s: string, c: string) => (
    <div className="card kpi" style={{ borderTop: `4px solid ${c}` }}><div className="lbl">{l} · {r.y[L]}</div><div className={`val ${cls(v)}`}>{afE(v)}</div><div className="sub">{s}</div></div>
  );
  return (
    <>
      <div className="grid k4">
        {tile('Fondo de maniobra aparente', r.fm[L], 'Activo circulante − pasivo circulante', C.accent)}
        {tile('Fondo de maniobra necesario', r.fmNec[L], 'Gastos diarios × maduración − financiación de proveedores', C.cG)}
        {tile(r.fmExc[L] >= 0 ? 'Exceso de fondo de maniobra' : 'Déficit de fondo de maniobra', r.fmExc[L], 'Aparente − necesario', r.fmExc[L] >= 0 ? C.pos : C.neg)}
        <div className="card kpi" style={{ borderTop: `4px solid ${C.ajuste}` }}><div className="lbl">Días de autonomía · {r.y[L]}</div><div className="val">{afD(r.diasAut[L])}</div><div className="sub">Días de gastos que cubre el fondo de maniobra</div></div>
      </div>
      <div className="card">
        <h2>Fondos de maniobra</h2>
        <Synth name="Fondos de maniobra" r={r} rows={[['+ Activo circulante', r.ac], ['− Pasivo circulante', r.pc], ['Fondo de maniobra aparente', r.fm, true], ['Fondo de maniobra necesario', r.fmNec, true], ['Exceso (+) o déficit (−)', r.fmExc, true]]} />
        <div className="legend" style={{ marginTop: 4 }}>Días de autonomía: {r.y.map((y, i) => <Fragment key={y}><b>{y}</b> {afD(r.diasAut[i])}{i < 2 ? ' · ' : ''}</Fragment>)}</div>
      </div>
      <div className="grid k2">
        <div className="card">
          <h2>Composición de la deuda total</h2>
          <ChartCanvas config={deuda} className="chart short" />
          <Legend items={[['Deuda a largo plazo', C.estim], ['Deuda a corto plazo', C.pago]]} />
          <Synth name="Composición de la deuda total" r={r} rows={[['Deudas a largo plazo', r.g('deuda_lp')], ['Deudas a corto plazo', r.G], ['Deuda total', r.deudaTot, true], ['Total balance', r.H]]} />
        </div>
        <div className="card">
          <h2>Capacidad de endeudamiento</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
            {r.y.map((y, i) => (
              <div key={y} className="kpi"><div className="lbl">Endeudamiento posible {y}</div><div className={`val ${cls(r.endPos[i])}`} style={{ fontSize: 20 }}>{afE(r.endPos[i])}</div><div className="sub">Devolución de préstamos {afP(r.devol[i])}</div></div>
            ))}
          </div>
          <Note><b>Endeudamiento posible</b> = patrimonio neto / 0,4 − pasivo total: cuánta deuda más admitiría la empresa sin que los fondos propios bajen del 40 % del pasivo. <b>Ratio de devolución de préstamos</b> = cash-flow / deuda bancaria × 100: qué parte de la deuda con bancos se podría devolver con un año de cash-flow.</Note>
        </div>
      </div>
      <div className="card">
        <h2>Cuadro de síntesis</h2>
        <Synth name="Cuadro de síntesis" r={r} rows={[['Clientes', r.g('clientes')], ['Proveedores y acreedores', r.provAcr], ['Activo real', r.activoReal], ['Existencias', r.B], ['Deuda con bancos a c/p y l/p', r.deudaBanc], ['Cifra de negocio', r.g('cn'), true], ['Total de gastos generales', r.gtosGen], ['Resultado neto', r.rn, true], ['Gastos de explotación diarios', r.gtosDia]]} />
        <Note>Fondo de maniobra necesario = (gastos diarios × periodo de maduración) − (compras / días × plazo de pago). Activo real = total − intangible − inversiones financieras.</Note>
      </div>
    </>
  );
}

export function Ratios1Tab({ r }: { r: AfResult }) {
  const Y = r.y;
  const inc: [string, Triple, Triple][] = [['Rotación de existencias', r.pAlm, r.incStock], ['Plazo de cobro', r.pCob, r.incCobro], ['Plazo de pago', r.pPag, r.incPago]];
  return (
    <>
      <div className="rsec">Plazos</div>
      <div className="rgrid">
        <Ratio r={r} name="Plazo medio de almacenamiento" formula="Existencias medias × días / compras consumidas" vals={r.pAlm} fmt={afD} note="El primer año usa las existencias finales; los siguientes, la media con el año anterior." />
        <Ratio r={r} name="Plazo de cobro" formula="Clientes × días / ventas con IVA (×1,21)" vals={r.pCob} fmt={afD} rule={['<', 60]} />
        <Ratio r={r} name="Plazo de pago" formula="Proveedores × días / compras con IVA (×1,21)" vals={r.pPag} fmt={afD} rule={['<', 60]} note="Límite legal 60 días (Ley 15/2010)." />
        <Ratio r={r} name="Período de maduración" formula="Plazo de almacenamiento + plazo de cobro" vals={r.mad} fmt={afD} />
      </div>
      <div className="rsec">Liquidez y solvencia</div>
      <div className="rgrid">
        <Ratio r={r} name="Liquidez general" formula="Activo circulante / pasivo circulante" vals={r.liq} fmt={afN2} rule={['>', 1.5]} />
        <Ratio r={r} name="Liquidez inmediata" formula="Realizable + disponible / pasivo circulante" vals={r.liqInm} fmt={afN2} rule={['>', 0.9]} />
        <Ratio r={r} name="Tesorería" formula="Disponible / pasivo circulante" vals={r.tes} fmt={afN2} rule={['>', 0.1]} />
        <Ratio r={r} name="Garantía" formula="Activo real / deuda total" vals={r.gar} fmt={afN2} rule={['>', 1.5]} />
        <Ratio r={r} name="Coste de la deuda" formula="Gastos financieros / deuda con coste × 100" vals={r.coste} fmt={afP} />
        <Ratio r={r} name="Cobertura de intereses" formula="Beneficio antes de financieros / gastos financieros" vals={r.cobInt} fmt={afN2} rule={['>', 3]} />
      </div>
      <div className="card">
        <h2>Incidencias en tesorería <small>cuánto dinero liberan (+) o consumen (−) los cambios de plazos</small></h2>
        <Tbl name="Incidencias en tesorería" className="tbl">
          <table className="aft">
            <thead><tr><th>Por</th><th className="n">{Y[0]}</th><th className="n">{Y[1]}</th><th className="n">Pérd./gan. tesorería</th><th className="n">{Y[2]}</th><th className="n">Pérd./gan. tesorería</th></tr></thead>
            <tbody>
              {inc.map(([l, d, x]) => (
                <tr key={l}><td className="lbl">{l}</td><td className="n">{afD(d[0])}</td><td className="n">{afD(d[1])}</td><td className={`n ${cls(x[1])}`}>{afE(x[1])}</td><td className="n">{afD(d[2])}</td><td className={`n ${cls(x[2])}`}>{afE(x[2])}</td></tr>
              ))}
              <tr className="tot"><td className="lbl">Suma</td><td /><td /><td className={`n ${cls(r.incTot[1])}`}>{afE(r.incTot[1])}</td><td /><td className={`n ${cls(r.incTot[2])}`}>{afE(r.incTot[2])}</td></tr>
            </tbody>
          </table>
        </Tbl>
        <Note>Cobrar antes, almacenar menos o pagar más tarde libera tesorería. Se calcula sobre 360 días, como en la plantilla.</Note>
      </div>
    </>
  );
}

export function Ratios2Tab({ r }: { r: AfResult }) {
  return (
    <>
      <div className="rsec">Rotaciones</div>
      <div className="rgrid">
        <Ratio r={r} name="Rotación del activo circulante" formula="Ventas / activo circulante" vals={r.rotAC} fmt={afN2} />
        <Ratio r={r} name="Rotación del activo fijo" formula="Ventas / activo fijo" vals={r.rotAF} fmt={afN2} />
        <Ratio r={r} name="Rotación del capital propio" formula="Ventas / capital propio" vals={r.rotCP} fmt={afN2} />
        <Ratio r={r} name="Rotación de clientes" formula="Ventas / clientes" vals={r.rotCli} fmt={afN2} />
      </div>
      <div className="rsec">Rentabilidad y autonomía</div>
      <div className="rgrid">
        <Ratio r={r} name="Rentabilidad económica" formula="Beneficio / activo × 100" vals={r.rentEc} fmt={afP} rule={['>', 3.5]} />
        <Ratio r={r} name="Rentabilidad financiera" formula="Beneficio / capital propio × 100" vals={r.rentFin} fmt={afP} rule={['>', 6]} />
        <Ratio r={r} name="Autonomía financiera" formula="Capital propio / pasivo" vals={r.aut} fmt={afN2} rule={['>', 0.4]} />
      </div>
      <div className="rsec">Probabilidad de suspensión de pagos</div>
      <div className="rgrid">
        <Ratio r={r} name="Cash-flow / deudas totales" formula="Cash-flow / deuda total" vals={r.cfDeuda} fmt={afN2} rule={['>', 0.4]} />
        <Ratio r={r} name="Factor Z" formula="−4,2 + 1,35·liquidez + 6,5·autonomía + 7·rent. económica + 5·rent. financiera" vals={r.z} fmt={afN2} rule={['>', 0]} note="Por debajo de 0 indica riesgo de insolvencia." />
        <Ratio r={r} name="Fondo de maniobra / activo" formula="Fondo de maniobra / activo total" vals={r.fmAct} fmt={afN2} rule={['>', 0.3]} />
      </div>
    </>
  );
}

export function OriAplTab({ r }: { r: AfResult }) {
  const [f, setF] = useState(0);
  const [to, setTo] = useState(2);
  type K = 'inm' | 'exi' | 'rea' | 'dis' | 'fp' | 'dlp' | 'dcp';
  const items = (i: number): Record<K, number> => ({
    inm: r.A[i], exi: r.B[i], rea: r.C[i] - r.g('inv_grupo')[i] - r.g('disp')[i], dis: r.g('disp')[i] + r.g('inv_grupo')[i],
    fp: r.fp[i], dlp: r.g('deuda_lp')[i], dcp: r.G[i],
  });
  const a = items(f), b = items(to), d = (k: K) => b[k] - a[k];
  const act: [string, K][] = [['Inmovilizado neto', 'inm'], ['Existencias', 'exi'], ['Realizable', 'rea'], ['Disponible', 'dis']];
  const pas: [string, K][] = [['Fondos propios', 'fp'], ['Deudas a largo plazo', 'dlp'], ['Deudas a corto plazo', 'dcp']];
  const apl = [...act.map(([l, k]) => [l, Math.max(0, d(k))] as [string, number]), ...pas.map(([l, k]) => [l, Math.max(0, -d(k))] as [string, number])];
  const ori = [...act.map(([l, k]) => [l, Math.max(0, -d(k))] as [string, number]), ...pas.map(([l, k]) => [l, Math.max(0, d(k))] as [string, number])];
  const sa = apl.reduce((s, x) => s + x[1], 0), so = ori.reduce((s, x) => s + x[1], 0);

  const chart = useMemo(() => {
    const L = ['Inmovilizado', 'Existencias', 'Realizable', 'Disponible', 'Fondos propios', 'Deuda l/p', 'Deuda c/p'];
    const keys: K[] = ['inm', 'exi', 'rea', 'dis', 'fp', 'dlp', 'dcp'];
    const A0 = items(f), B0 = items(to);
    const vals = keys.map((k, i) => { const dd = B0[k] - A0[k]; return i < 4 ? -dd : dd; }); // + origen, − aplicación
    const o = hbarOpts(30);
    o.scales.x.ticks.callback = (v: number | string) => compact(Number(v));
    o.scales.y.ticks.font = { family: fonts().ui, size: 11.5, weight: 700 };
    o.plugins.tooltip.callbacks.label = (c: { parsed: { x: number } }) => ` ${c.parsed.x >= 0 ? 'Origen' : 'Aplicación'}: ${e0(Math.abs(c.parsed.x))}`;
    return { type: 'bar', data: { labels: L, datasets: [{ data: vals, backgroundColor: vals.map((v) => (v >= 0 ? C.cobro : C.pago)), borderRadius: 5, barThickness: 20 }] }, options: o };
  }, [r, f, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = (v: number, set: (n: number) => void) => (
    <select className="afyear" style={{ width: 'auto' }} value={v} onChange={(e) => set(Number(e.target.value))}>
      {r.y.map((y, i) => <option key={y} value={i}>{y}</option>)}
    </select>
  );
  const tb = (rows: [string, K][]) => (
    <>
      {rows.map(([l, k]) => <tr key={k}><td className="lbl">{l}</td><td className="n">{afE(a[k])}</td><td className="n">{afE(b[k])}</td><td className={`n ${cls(d(k))}`}>{afE(d(k))}</td></tr>)}
    </>
  );
  const totRow = (label: string, rows: [string, K][]) => (
    <tr className="tot"><td>{label}</td><td className="n">{afE(rows.reduce((s, x) => s + a[x[1]], 0))}</td><td className="n">{afE(rows.reduce((s, x) => s + b[x[1]], 0))}</td><td className="n">{afE(rows.reduce((s, x) => s + d(x[1]), 0))}</td></tr>
  );
  return (
    <>
      <div className="card">
        <div className="afhead"><h2>Estado de origen y aplicación de fondos</h2><div className="yrsel" style={{ alignItems: 'center' }}>Comparar {sel(f, setF)} con {sel(to, setTo)}</div></div>
        <div className="grid k2">
          <Tbl name="Origen y aplicación · Activo" className="tbl"><table className="aft"><thead><tr><th>Activo</th><th className="n">{r.y[f]}</th><th className="n">{r.y[to]}</th><th className="n">Diferencia</th></tr></thead><tbody>{tb(act)}{totRow('Total activo', act)}</tbody></table></Tbl>
          <Tbl name="Origen y aplicación · Pasivo" className="tbl"><table className="aft"><thead><tr><th>Pasivo</th><th className="n">{r.y[f]}</th><th className="n">{r.y[to]}</th><th className="n">Diferencia</th></tr></thead><tbody>{tb(pas)}{totRow('Total pasivo', pas)}</tbody></table></Tbl>
        </div>
      </div>
      <div className="card">
        <h2>¿De dónde ha salido el dinero y a qué se ha dedicado? <small>{r.y[f]} → {r.y[to]}</small></h2>
        <Legend items={[['Aplicaciones (usos)', C.pago], ['Orígenes (fuentes)', C.cobro]]} />
        <ChartCanvas config={chart} />
        <div className="grid k2">
          <Tbl name="Aplicaciones de fondos" className="tbl"><table className="aft"><thead><tr><th>Aplicación</th><th className="n">Importe</th></tr></thead><tbody>{apl.filter((x) => x[1]).map((x) => <tr key={x[0]}><td>{x[0]}</td><td className="n">{afE(x[1])}</td></tr>)}<tr className="tot"><td>Total aplicaciones</td><td className="n">{afE(sa)}</td></tr></tbody></table></Tbl>
          <Tbl name="Orígenes de fondos" className="tbl"><table className="aft"><thead><tr><th>Origen</th><th className="n">Importe</th></tr></thead><tbody>{ori.filter((x) => x[1]).map((x) => <tr key={x[0]}><td>{x[0]}</td><td className="n">{afE(x[1])}</td></tr>)}<tr className="tot"><td>Total orígenes</td><td className="n">{afE(so)}</td></tr></tbody></table></Tbl>
        </div>
        <Note>Aumentos de activo y bajadas de pasivo son aplicaciones; bajadas de activo y aumentos de pasivo son orígenes. Si el balance cuadra, los dos totales coinciden.</Note>
      </div>
    </>
  );
}

export function ValorAnadidoTab({ r }: { r: AfResult }) {
  const parts: [string, Triple, string][] = [
    ['Al personal', r.vaPers, C.cS], ['A las administraciones', r.vaAdm, C.ajuste], ['A los bancos', r.vaBanc, C.pago],
    ['A terceros (seguros, profesionales, alquileres)', r.vaTerc, C.estim], ['A la empresa (amortizaciones y provisiones)', r.vaEmp, C.cG], ['A la propiedad (resultado)', r.vaProp, C.cobro],
  ];
  const amort = r.vaEmp.map((v, i) => v + r.g('otros_ing')[i] + r.g('ben_ext')[i] - r.g('perd_ext')[i]) as Triple;
  const detail: [string, Triple, boolean?][] = [
    ['Gastos de personal (sin Seguridad Social)', r.vaPers, true], ['Tasas y tributos', r.g('tributos')], ['Impuesto sobre sociedades', r.g('is')], ['Seguridad Social', r.g('ss')], ['A las administraciones', r.vaAdm, true],
    ['Gastos financieros', r.g('gfin')], ['Servicios bancarios', r.g('serv_banc')], ['A los bancos', r.vaBanc, true],
    ['Primas de seguro', r.g('primas')], ['Servicios profesionales', r.g('serv_prof')], ['Arrendamientos y cánones', r.g('arrend')], ['A terceros', r.vaTerc, true],
    ['Amortizaciones, provisiones y excesos', amort], ['− Otros ingresos y beneficios extraordinarios', r.g('otros_ing').map((v, i) => -(v + r.g('ben_ext')[i])) as Triple], ['+ Pérdidas extraordinarias', r.g('perd_ext')], ['A la empresa', r.vaEmp, true],
    ['A la propiedad (resultado neto)', r.vaProp, true],
  ];
  return (
    <>
      <div className="card">
        <h2>Reparto del valor añadido <small>quién se lleva cada euro que genera la empresa</small></h2>
        <Legend items={parts.map(([l, , c]) => [l, c])} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {r.y.map((y, i) => {
            const tot = parts.reduce((s, p) => s + Math.max(0, p[1][i]), 0) || 1;
            return (
              <div key={y} className="varow">
                <b>{y}</b>
                <div className="vabar">
                  {parts.map(([l, a, c]) => a[i] > 0 && (
                    <i key={l} style={{ width: `${(a[i] / tot) * 100}%`, background: c }} title={`${l}: ${afE(a[i])}`}>{a[i] / tot > 0.07 ? `${Math.round((a[i] / tot) * 100)} %` : ''}</i>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <h2>Detalle</h2>
        <Tbl name="Valor añadido · detalle" className="tbl">
          <table className="aft">
            <thead><tr><th>Concepto</th>{r.y.map((y) => <Fragment key={y}><th className="n">{y}</th><th className="n pc">%</th></Fragment>)}</tr></thead>
            <tbody>
              <tr className="tot big"><td className="lbl">VALOR AÑADIDO</td>{r.va.map((v, i) => <Fragment key={i}><td className="n">{afE(v)}</td><td className="n pc">100</td></Fragment>)}</tr>
              {detail.map(([l, a, big]) => (
                <tr key={l} className={big ? 'tot' : ''}>
                  <td className="lbl">{l}</td>
                  {a.map((v, i) => <Fragment key={i}><td className={`n ${cls(v)}`}>{afE(v)}</td><td className="n pc">{r.va[i] ? afN2((100 * v) / r.va[i]) : ''}</td></Fragment>)}
                </tr>
              ))}
              <tr><td className="lbl muted">Línea de cuadre (debe ser 0)</td>{r.vaChk.map((v, i) => <Fragment key={i}><td className={`n ${Math.abs(v) > 1 ? 'neg' : 'pos'}`}>{afE(v)}</td><td /></Fragment>)}</tr>
            </tbody>
          </table>
        </Tbl>
      </div>
    </>
  );
}

const MS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function UmbralTab({ r }: { r: AfResult }) {
  const [i, setI] = useState(2);
  const dias = r.dias[i];
  const dayOk = fin(r.umbralDia[i]) && r.umbralDia[i] >= 0 && r.umbralDia[i] <= dias;
  const fecha = dayOk ? new Date(Date.UTC(r.y[i], 0, Math.ceil(r.umbralDia[i]))) : null;
  const seg = r.prod[i] ? ((r.prod[i] - r.umbral[i]) / r.prod[i]) * 100 : NaN;

  const chart = useMemo(() => {
    const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const pr = r.prod[i], gf = r.gestr[i], gv = 1 - r.mc[i];
    const ing = [0, ...M.map((_, k) => (pr / 12) * (k + 1))], cost = ing.map((x) => gf + x * gv), fij = ing.map(() => gf);
    const o = baseOpts(); o.interaction = { mode: 'index', intersect: false };
    const um = r.umbralFr[i] * 12;
    const { ui } = fonts();
    const mark = {
      id: 'umb',
      afterDraw(c: { scales: Record<string, { getPixelForValue: (v: number) => number }>; ctx: CanvasRenderingContext2D; chartArea: { top: number; bottom: number; right: number } }) {
        if (!fin(um) || um < 0 || um > 12) return;
        const x = c.scales.x, y = c.scales.y, g = c.ctx;
        const px = x.getPixelForValue(0) + ((x.getPixelForValue(12) - x.getPixelForValue(0)) * um) / 12;
        g.save(); g.strokeStyle = C.ink; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(px, c.chartArea.top); g.lineTo(px, c.chartArea.bottom); g.stroke(); g.setLineDash([]);
        g.fillStyle = C.ink; g.beginPath(); g.arc(px, y.getPixelForValue(gf + ((pr * um) / 12) * gv), 6, 0, Math.PI * 2); g.fill();
        g.font = `800 11px ${ui}`; g.textAlign = px > c.chartArea.right - 90 ? 'right' : 'left'; g.fillText(` Umbral ${compact(r.umbral[i])} `, px, c.chartArea.top + 12);
        g.restore();
      },
    };
    return { type: 'line', data: { labels: ['inicio', ...M], datasets: [
      { label: 'Producción acumulada', data: ing, borderColor: C.cobro, backgroundColor: rgba(C.cobro, 0.12), fill: false, pointRadius: 3, borderWidth: 2.5 },
      { label: 'Gastos totales', data: cost, borderColor: C.pago, pointRadius: 3, borderWidth: 2.5 },
      { label: 'Gastos fijos', data: fij, borderColor: C.estim, borderDash: [6, 4], pointRadius: 0, borderWidth: 2 },
    ] }, options: o, plugins: [mark] };
  }, [r, i]);

  return (
    <div className="card">
      <div className="afhead">
        <h2>Umbral de rentabilidad <small>punto en el que los ingresos cubren todos los gastos</small></h2>
        <div className="subtabs">{r.y.map((y, j) => <button key={y} type="button" aria-pressed={j === i} onClick={() => setI(j)}>{y}</button>)}</div>
      </div>
      <div className="grid k4">
        <div className="kpi"><div className="lbl">Umbral de rentabilidad</div><div className="val">{afE(r.umbral[i])}</div><div className="sub">gastos fijos / margen de contribución</div></div>
        <div className="kpi"><div className="lbl">Sobre la producción</div><div className="val">{afP(r.umbralFr[i] * 100)}</div><div className="sub">producción {afE(r.prod[i])}</div></div>
        <div className="kpi"><div className="lbl">Se alcanza el</div><div className="val" style={{ fontSize: 22 }}>{fecha ? `${fecha.getUTCDate()} de ${MS[fecha.getUTCMonth()]}` : fin(r.umbralDia[i]) && r.umbralDia[i] > dias ? 'No se alcanza' : '—'}</div><div className="sub">día {fin(r.umbralDia[i]) ? Math.ceil(r.umbralDia[i]) : '—'} del año</div></div>
        <div className="kpi"><div className="lbl">Margen de seguridad</div><div className={`val ${cls(seg)}`}>{afP(seg)}</div><div className="sub">cuánto podría caer la producción sin pérdidas</div></div>
      </div>
      <Legend items={[['Producción acumulada', C.cobro], ['Gastos totales', C.pago], ['Gastos fijos (estructura)', C.estim]]} />
      <ChartCanvas config={chart} className="chart tall" />
      <Note>Gastos fijos = gastos de estructura. Margen de contribución = (gastos de estructura + resultado de actividades ordinarias) / producción. Gastos variables = producción × (1 − margen de contribución).</Note>
    </div>
  );
}

export function GraficosTab({ r }: { r: AfResult }) {
  const cfgs = useMemo(() => {
    const k = (a: number[]) => a.map((v) => v / 1000);
    const kf = (v: number) => compact(v * 1000);
    const ko = (o: AnyOpts) => {
      o.scales.y.ticks.callback = (v: number | string) => kf(Number(v));
      o.plugins.tooltip.callbacks.label = (c: { dataset: { label: string }; parsed: { y: number } }) => ` ${c.dataset.label}: ${kf(c.parsed.y)}`;
    };
    const ix = (a: number[]) => a.map((v) => (a[0] ? v / a[0] : NaN));
    const pp = (a: number[]) => a.map((v, i) => (r.prod[i] ? (v / r.prod[i]) * 100 : NaN));
    return {
      g1: barCfg(r, [['Activo', k(r.H), C.accent], ['Deuda a largo', k(r.g('deuda_lp')), C.estim], ['Deuda a corto', k(r.G), C.pago]], ko),
      g2: barCfg(r, [['Realizable + disponible', k(r.C), C.cobro], ['Deuda a corto', k(r.G), C.pago]], ko),
      g3: barCfg(r, [['Cifra de negocio', k(r.g('cn')), C.cS], ['Clientes', k(r.g('clientes')), C.cobro], ['Deuda a corto', k(r.G), C.pago]], ko),
      g4: lineCfg(r, [['Cifra de negocio', ix(r.g('cn')), C.cS], ['Clientes', ix(r.g('clientes')), C.cobro], ['Deuda a corto', ix(r.G), C.pago]], afN2),
      g5: barCfg(r, [['Producción', k(r.prod), C.cS], ['Compras', k(r.g('compras')), C.ajuste], ['Gastos de estructura', k(r.gestr), C.cG], ['Gastos de funcionamiento', k(r.gfunc), C.estim], ['Resultado act. ordinarias', k(r.rao), C.cobro]], ko),
      g6: lineCfg(r, [['Compras', pp(r.g('compras')), C.ajuste], ['Gastos de estructura', pp(r.gestr), C.cG], ['Gastos de funcionamiento', pp(r.gfunc), C.estim], ['Resultado act. ordinarias', pp(r.rao), C.cobro]], afP),
    };
  }, [r]);
  return (
    <div className="grid k2">
      <div className="card"><h2>Activo y deuda <small>miles de euros</small></h2><Legend items={[['Activo', C.accent], ['Deuda a largo', C.estim], ['Deuda a corto', C.pago]]} /><ChartCanvas config={cfgs.g1} /></div>
      <div className="card"><h2>Realizable + disponible frente a deuda a corto <small>miles de euros</small></h2><Legend items={[['Realizable + disponible', C.cobro], ['Deuda a corto', C.pago]]} /><ChartCanvas config={cfgs.g2} /></div>
      <div className="card"><h2>Cifra de negocio, clientes y deuda a corto <small>miles de euros</small></h2><Legend items={[['Cifra de negocio', C.cS], ['Clientes', C.cobro], ['Deuda a corto', C.pago]]} /><ChartCanvas config={cfgs.g3} /></div>
      <div className="card"><h2>Índices de evolución <small>primer año = 1</small></h2><Legend items={[['Cifra de negocio', C.cS, true], ['Clientes', C.cobro, true], ['Deuda a corto', C.pago, true]]} /><ChartCanvas config={cfgs.g4} /></div>
      <div className="card"><h2>Producción y gastos <small>miles de euros</small></h2><Legend items={[['Producción', C.cS], ['Compras', C.ajuste], ['Gastos de estructura', C.cG], ['Gastos de funcionamiento', C.estim], ['Resultado act. ordinarias', C.cobro]]} /><ChartCanvas config={cfgs.g5} /></div>
      <div className="card"><h2>Peso sobre la producción <small>%</small></h2><Legend items={[['Compras', C.ajuste, true], ['Gastos de estructura', C.cG, true], ['Gastos de funcionamiento', C.estim, true], ['Resultado act. ordinarias', C.cobro, true]]} /><ChartCanvas config={cfgs.g6} /></div>
    </div>
  );
}

export function CuentasTab({ r, unmapped }: { r: AfResult; unmapped: AccountingUnmapped[] }) {
  return (
    <>
      <div className="card">
        <h2>Comprobaciones <small>como en la portada de la plantilla: deben salir a 0</small></h2>
        <Tbl name="Comprobaciones" className="tbl">
          <table className="aft">
            <thead><tr><th>Comprobación</th>{r.y.map((y) => <th key={y} className="n">{y}</th>)}</tr></thead>
            <tbody>
              {([['Activo − pasivo', r.chkBal], ['Resultado del balance − resultado neto de explotación', r.chkRes]] as [string, Triple][]).map(([l, a]) => (
                <tr key={l}><td className="lbl">{l}</td>{a.map((v, i) => <td key={i} className={`n ${Math.abs(v) > 1 ? 'neg' : 'pos'}`}>{Math.abs(v) > 1 ? afE(v) : 'Cuadra'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </Tbl>
      </div>
      <div className="card">
        <h2>Cuentas sin clasificar <small>su código no encaja en ninguna partida; se han sumado a la indicada para que el balance cuadre</small></h2>
        {unmapped.length === 0 ? <div className="afempty">Todas las cuentas con saldo están clasificadas.</div> : (
          <Tbl name="Cuentas sin clasificar" className="tbl scroll">
            <table className="aft">
              <thead><tr><th>Ejercicio</th><th>Cuenta</th><th>Sumada a</th><th className="n">Saldo</th></tr></thead>
              <tbody>
                {unmapped.map((u, i) => (
                  <tr key={i}><td className="muted">{u.year}</td><td className="w"><span className="code" style={{ fontFamily: 'var(--font-num)', color: 'var(--muted)', marginRight: 8 }}>{u.code}</span>{u.name}</td><td>{AF_LBL[u.to]?.[0] ?? u.to}</td><td className="n">{afE(u.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </Tbl>
        )}
        <Note>Saldo con el signo contable de Odoo (deudor +, acreedor −). Si una cuenta debería ir a otra partida, se añade su prefijo a la clasificación.</Note>
      </div>
    </>
  );
}
