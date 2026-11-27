'use client';

import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiAccountingOverview, AccountingDrillSpec, AccountingOverviewResponse } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useCompanySelection } from '../components/AccountingUi';
import Shell from '../components/cuadro/Shell';
import ChartCanvas from '../components/cuadro/ChartCanvas';
import { Icon } from '../components/cuadro/icons';
import { Drill, chartDrill } from '../components/cuadro/drill';
import { Tbl } from '../components/cuadro/xlsx';
import {
  C, baseOpts, compact, companyColor, donutConfig, e0, entColor, fM, fonts, hbarOpts, pct, rgba, zeroLine,
} from '../components/cuadro/lib';

type State = 'ok' | 'warn' | 'bad';
const PILL: Record<State, string> = { ok: 'Correcto', warn: 'Vigilar', bad: 'Riesgo' };
const ZONE = { pos: C.pos, warn: C.warn, neg: C.neg };

/** Indicador de aguja (semicírculo con zonas de color), igual que el artefacto. */
function Gauge({ v, min, max, zones, name, valTxt, formula, state }: {
  v: number; min: number; max: number; zones: [number, keyof typeof ZONE][]; name: string; valTxt: string; formula: string; state: State;
}) {
  const cx = 85, cy = 88, r = 66, sw = 14;
  const ang = (x: number) => Math.PI * (1 - (Math.min(max, Math.max(min, Number.isFinite(x) ? x : min)) - min) / (max - min));
  const pt = (a: number, rr: number) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  const arcs = zones.map(([to, col], i) => {
    const from = i === 0 ? min : zones[i - 1][0];
    const [x0, y0] = pt(ang(from), r), [x1, y1] = pt(ang(to), r);
    return <path key={to} d={`M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`} stroke={ZONE[col]} strokeWidth={sw} fill="none" opacity={0.85} />;
  });
  const [nx, ny] = pt(ang(v), r - 4);
  return (
    <div className="gauge">
      <svg viewBox="0 0 170 100" aria-hidden="true">
        {arcs}
        <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill={C.ink} />
      </svg>
      <div className="gv">{valTxt}</div>
      <div className="gn">{name}</div>
      <span className={`pill ${state}`}>{PILL[state]}</span>
      <div className="gf">{formula}</div>
    </div>
  );
}

const st = (v: number, a: number, b: number, inv = false): State =>
  !Number.isFinite(v) ? 'bad' : inv ? (v <= a ? 'ok' : v <= b ? 'warn' : 'bad') : (v >= a ? 'ok' : v >= b ? 'warn' : 'bad');
const R2 = (n: number) => (Number.isFinite(n) ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');

/** Colores de métodos de pago (como el artefacto) y reserva para el resto. */
function methodColor(name: string, i: number) {
  const n = name.toLowerCase();
  if (n.includes('pagar')) return C.cS;
  if (n.includes('confirming')) return C.cG;
  if (n.includes('transfer')) return C.ajuste;
  if (n.includes('manual')) return C.estim;
  if (n.includes('giro') || n.includes('recibo') || n.includes('remesa') || n.includes('sepa')) return C.pago;
  return ['#2f62c4', '#5f9f2a', '#8a46a3', '#1386c6', '#b08a2e'][i % 5];
}

function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((it) => <span key={it.label} className={it.line ? 'ln' : ''} style={{ '--c': it.color } as CSSProperties}>{it.label}</span>)}
    </div>
  );
}

export default function ContabilidadDeudaPage() {
  const router = useRouter();
  const [selected, setSelected] = useCompanySelection();
  const [data, setData] = useState<AccountingOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    apiAccountingOverview(token, selected)
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
  const ok = !!(data?.success && data.debt);
  const companies = useMemo(() => data?.companies ?? [], [data]);
  const colorOfShort = (short: string) => companyColor(companies.findIndex((c) => (c.short ?? c.name) === short));

  /* ---------------- gráficos ---------------- */
  const charts = useMemo(() => {
    if (!data?.success || !data.debt) return null;
    const dc = data.debt_companies ?? [];
    const { ui } = fonts();
    const sel = data.selected_company_ids ?? [];
    const go = (href: string) => router.push(href);

    // Deuda por compañía (barras horizontales apiladas)
    const lbl: string[] = [], d1: number[] = [], d2: number[] = [], d3: number[] = [], d4: number[] = [];
    for (const c of dc) { lbl.push(`Clientes · ${c.short}`); d1.push(c.customers.total - c.customers.overdue); d2.push(c.customers.overdue); d3.push(0); d4.push(0); }
    for (const c of dc) { lbl.push(`Proveedores · ${c.short}`); d1.push(0); d2.push(0); d3.push(c.suppliers.total - c.suppliers.overdue); d4.push(c.suppliers.overdue); }
    const o = baseOpts();
    o.indexAxis = 'y'; o.scales.x.stacked = true; o.scales.y.stacked = true;
    o.scales.x.ticks.callback = (v: number | string) => compact(Number(v)); o.scales.x.grid = { color: C.line };
    o.scales.y.ticks.callback = function (this: { getLabelForValue: (v: number) => string }, v: number | string) { return this.getLabelForValue(Number(v)); };
    o.scales.y.grid = { display: false }; o.scales.y.ticks.font = { family: ui, size: 11.5, weight: 700 };
    o.plugins.tooltip.callbacks.label = (c: { parsed: { x: number }; dataset: { label: string } }) => (c.parsed.x ? ` ${c.dataset.label}: ${e0(c.parsed.x)}` : null);
    o.interaction = { mode: 'nearest', intersect: true, axis: 'y' };
    Object.assign(o, chartDrill(go, (ds, i): AccountingDrillSpec | null => {
      const n = dc.length;
      const customers = i < n;
      const comp = dc[customers ? i : i - n];
      if (!comp || (customers ? ds > 1 : ds < 2)) return null;
      const overdue = ds === 1 || ds === 3;
      return { t: 'debt', side: customers ? 'customers' : 'suppliers', overdue, c: [comp.id], l: `${customers ? 'Clientes' : 'Proveedores'} ${overdue ? 'atrasado' : 'al día'} · ${comp.short}` };
    }));
    const deuda = { type: 'bar', data: { labels: lbl, datasets: [
      { label: 'Clientes al día', data: d1, backgroundColor: C.cobro, borderRadius: 4, barThickness: 26 },
      { label: 'Clientes atrasado', data: d2, backgroundColor: C.neg, borderRadius: 4, barThickness: 26 },
      { label: 'Proveedores al día', data: d3, backgroundColor: C.pago, borderRadius: 4, barThickness: 26 },
      { label: 'Proveedores atrasado', data: d4, backgroundColor: C.warn, borderRadius: 4, barThickness: 26 },
    ] }, options: o };

    // Dónde está la tesorería (donut, 7 diarios + otros)
    const bpos = (data.treasury ?? []).filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);
    const top = bpos.slice(0, 7), rest = bpos.slice(7).reduce((s, b) => s + b.balance, 0);
    const tLabels = top.map((b) => b.name).concat(rest ? ['Otros diarios'] : []);
    const tColors = top.map((b) => entColor(b.entity)).map((c, i, a) => (a.indexOf(c) < i ? rgba(c, 0.6) : c)).concat(rest ? [C.estim] : []);
    const tData = top.map((b) => b.balance).concat(rest ? [rest] : []);
    const teso = donutConfig(tLabels, tData, tColors);
    Object.assign(teso.options, chartDrill(go, (_ds, i): AccountingDrillSpec => (
      top[i] ? { t: 'treasury', j: [top[i].id], c: sel, l: `Saldo contable · ${top[i].name}` }
        : { t: 'treasury', j: bpos.slice(7).map((b) => b.id), c: sel, l: 'Saldo contable · otros diarios' }
    )));

    // Cobros y pagos por mes (barras + neto)
    const m = data.monthly ?? [];
    const oh = baseOpts(); oh.scales.x.stacked = true; oh.scales.y.stacked = false;
    oh.interaction = { mode: 'nearest', intersect: true };
    Object.assign(oh, chartDrill(go, (ds, i): AccountingDrillSpec | null => (
      ds === 1 ? { t: 'pay', dir: 'in', month: m[i].month, c: sel, l: `Cobros de clientes · ${fM(m[i].month)}` }
        : ds === 2 ? { t: 'pay', dir: 'out', month: m[i].month, c: sel, l: `Pagos a proveedores · ${fM(m[i].month)}` } : null
    )));
    const hist = { data: { labels: m.map((x) => fM(x.month)), datasets: [
      { type: 'line', label: 'Neto', data: m.map((x) => x.net), borderColor: C.ink, backgroundColor: C.ink, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, tension: 0.3, order: 0 },
      { type: 'bar', label: 'Cobros', data: m.map((x) => x.in), backgroundColor: C.cobro, borderRadius: 4, maxBarThickness: 26, order: 1 },
      { type: 'bar', label: 'Pagos', data: m.map((x) => -x.out), backgroundColor: C.pago, borderRadius: 4, maxBarThickness: 26, order: 1 },
    ] }, options: oh, plugins: [zeroLine] };

    // Top 10 (barras horizontales con degradado)
    const hbar = (rows: { id?: number; name: string; amount: number }[], col: string, dir: 'in' | 'out') => {
      const ob = hbarOpts(26);
      Object.assign(ob, chartDrill(go, (_ds, i): AccountingDrillSpec | null => (
        rows[i] ? { t: 'pay', dir, partner: rows[i].id ?? 0, c: sel, l: `${dir === 'in' ? 'Cobros de' : 'Pagos a'} ${rows[i].name} · 12 meses` } : null
      )));
      ob.scales.x.ticks.callback = (v: number | string) => compact(Number(v));
      ob.plugins.tooltip.callbacks.label = (c: { parsed: { x: number } }) => ` ${e0(c.parsed.x)}`;
      return { type: 'bar', data: { labels: rows.map((r) => r.name), datasets: [{ data: rows.map((r) => r.amount), backgroundColor: rows.map((_, i) => rgba(col, 1 - i * 0.065)), borderRadius: 5, barThickness: 18 }] }, options: ob };
    };

    const mi = data.methods_in ?? [], mo = data.methods_out ?? [];
    return {
      deuda, teso, tLegend: tLabels.map((l, i) => ({ label: `${l} · ${compact(tData[i])}`, color: tColors[i] })),
      hist,
      topC: hbar(data.top_customers ?? [], C.cobro, 'in'), topP: hbar(data.top_suppliers ?? [], C.pago, 'out'),
      metC: donutConfig(mi.map((r) => r.name), mi.map((r) => r.amount), mi.map((r, i) => methodColor(r.name, i))),
      metP: donutConfig(mo.map((r) => r.name), mo.map((r) => r.amount), mo.map((r, i) => methodColor(r.name, i))),
      legC: mi.map((r, i) => ({ label: `${r.name} · ${compact(r.amount)}`, color: methodColor(r.name, i) })),
      legP: mo.map((r, i) => ({ label: `${r.name} · ${compact(r.amount)}`, color: methodColor(r.name, i) })),
    };
  }, [data, router]);

  /* ---------------- KPIs e indicadores ---------------- */
  let body = null;
  if (ok && data && charts) {
    const debt = data.debt!;
    const teso = data.treasury_total ?? 0, liq = data.treasury_liquid ?? 0;
    const cli = debt.customers.total, cliA = debt.customers.overdue, pro = debt.suppliers.total, proA = debt.suppliers.overdue;
    const cob12 = data.payments_in_12m ?? 0, pag12 = data.payments_out_12m ?? 0, ajMes = data.adjustments_monthly_out ?? 0;
    const pos = teso + cli - pro;
    const sel = data.selected_company_ids ?? [];
    const pmc = (cli / cob12) * 365, pmp = (pro / pag12) * 365, cob = (teso + cli) / pro, disp = liq / pro, mor = (cliA / cli) * 100, meses = liq / (pag12 / 12 + ajMes);
    const w = (a: number, b: number) => `${b ? Math.max(0, (a / b) * 100) : 0}%`;
    const projects = data.top_projects ?? [];
    const pmax = projects.length ? projects[0].amount : 1;

    body = (
      <section className="panel">
        <div className="grid k4">
          <div className="card kpi">
            <div className="head"><span className="ic" style={{ background: 'var(--accent-soft)', color: C.accent }}>{Icon.bank}</span><span className="lbl">Tesorería total</span></div>
            <div className="val"><Drill spec={{ t: 'treasury', c: sel, l: 'Tesorería total (bancos y caja)' }}>{e0(teso)}</Drill></div>
            <div className="bar"><i style={{ width: w(liq, teso), background: C.accent }} /><i style={{ width: w(teso - liq, teso), background: C.cG }} /></div>
            <div className="sub">{e0(liq)} líquido · {e0(teso - liq)} en cartera</div>
          </div>
          <div className="card kpi">
            <div className="head"><span className="ic" style={{ background: 'var(--pos-bg)', color: C.cobro }}>{Icon.in}</span><span className="lbl">Pendiente de cobro</span></div>
            <div className="val"><Drill spec={{ t: 'debt', side: 'customers', c: sel, l: 'Pendiente de cobro (clientes)' }}>{e0(cli)}</Drill></div>
            <div className="bar"><i style={{ width: w(cli - cliA, cli), background: C.cobro }} /><i style={{ width: w(cliA, cli), background: C.neg }} /></div>
            <div className="sub"><Drill spec={{ t: 'debt', side: 'customers', overdue: true, c: sel, l: 'Pendiente de cobro atrasado' }}><b className="neg">{e0(cliA)}</b></Drill> atrasado ({pct((cliA / cli) * 100)}) · {debt.customers.count} facturas</div>
          </div>
          <div className="card kpi">
            <div className="head"><span className="ic" style={{ background: 'var(--neg-bg)', color: C.pago }}>{Icon.out}</span><span className="lbl">Pendiente de pago</span></div>
            <div className="val"><Drill spec={{ t: 'debt', side: 'suppliers', c: sel, l: 'Pendiente de pago (proveedores)' }}>{e0(pro)}</Drill></div>
            <div className="bar"><i style={{ width: w(pro - proA, pro), background: C.pago }} /><i style={{ width: w(proA, pro), background: C.warn }} /></div>
            <div className="sub"><Drill spec={{ t: 'debt', side: 'suppliers', overdue: true, c: sel, l: 'Pendiente de pago atrasado' }}><b className="neg">{e0(proA)}</b></Drill> atrasado ({pct((proA / pro) * 100)}) · {debt.suppliers.count} facturas</div>
          </div>
          <div className="card kpi">
            <div className="head"><span className="ic" style={{ background: 'var(--cG-soft)', color: C.cG }}>{Icon.scale}</span><span className="lbl">Posición neta</span></div>
            <div className="val"><span className={pos < 0 ? 'neg' : ''}>{e0(pos)}</span></div>
            <div className="sub">Tesorería + pendiente de cobro − pendiente de pago</div>
          </div>
        </div>

        <div className="gauges">
          <Gauge v={cob} min={0} max={4} zones={[[1, 'neg'], [1.5, 'warn'], [4, 'pos']]} name="Cobertura de proveedores" valTxt={R2(cob)} formula="(Tesorería + cobros pendientes) / pagos pendientes" state={st(cob, 1.5, 1)} />
          <Gauge v={disp} min={0} max={1.5} zones={[[0.3, 'neg'], [0.6, 'warn'], [1.5, 'pos']]} name="Disponibilidad" valTxt={R2(disp)} formula="Tesorería líquida / pagos pendientes" state={st(disp, 0.6, 0.3)} />
          <Gauge v={meses} min={0} max={6} zones={[[1, 'neg'], [2, 'warn'], [6, 'pos']]} name="Meses de cobertura" valTxt={R2(meses)} formula="Tesorería líquida / salida media mensual (pagos + ajustes)" state={st(meses, 2, 1)} />
          <Gauge v={mor} min={0} max={100} zones={[[10, 'pos'], [25, 'warn'], [100, 'neg']]} name="Morosidad clientes" valTxt={pct(mor)} formula="Atrasado / pendiente de cobro" state={st(mor, 10, 25, true)} />
          <Gauge v={pmc} min={0} max={180} zones={[[60, 'pos'], [90, 'warn'], [180, 'neg']]} name="Periodo medio de cobro" valTxt={Number.isFinite(pmc) ? `${Math.round(pmc)} d` : '—'} formula="Pendiente de cobro / cobros 12 m × 365" state={st(pmc, 60, 90, true)} />
          <Gauge v={pmp} min={0} max={180} zones={[[60, 'pos'], [75, 'warn'], [180, 'neg']]} name="Periodo medio de pago" valTxt={Number.isFinite(pmp) ? `${Math.round(pmp)} d` : '—'} formula="Pendiente de pago / pagos 12 m × 365 · límite legal 60 días" state={st(pmp, 60, 75, true)} />
        </div>

        <div className="grid k2">
          <div className="card">
            <h2><span className="ic" style={{ background: 'var(--pos-bg)', color: C.pos }}>⇅</span>Deuda de clientes y con proveedores <small>al día frente a atrasado</small></h2>
            <Legend items={[{ label: 'Clientes al día', color: C.cobro }, { label: 'Clientes atrasado', color: C.neg }, { label: 'Proveedores al día', color: C.pago }, { label: 'Proveedores atrasado', color: C.warn }]} />
            <ChartCanvas config={charts.deuda} />
            <div className="badges">
              {(data.debt_companies ?? []).map((c) => (
                <span key={c.id} style={{ display: 'contents' }}>
                  {c.draft_bills_count > 0 && <span className="bdg w">{c.short}: {c.draft_bills_count} facturas de proveedor a validar ({e0(c.draft_bills_amount)})</span>}
                  {c.to_check_count > 0 && <span className="bdg">{c.short}: {c.to_check_count} por revisar</span>}
                </span>
              ))}
            </div>
          </div>
          <div className="card">
            <h2><span className="ic" style={{ background: 'var(--accent-soft)', color: C.accent }}>◔</span>Dónde está la tesorería <small>saldo por diario</small></h2>
            <ChartCanvas config={charts.teso} className="chart donut" />
            <Legend items={charts.tLegend} />
          </div>
        </div>

        <div className="card">
          <h2><span className="ic" style={{ background: 'var(--accent-soft)', color: C.accent }}>▥</span>Cobros y pagos registrados por mes <small>últimos 24 meses · pagos publicados en Odoo</small></h2>
          <Legend items={[{ label: 'Cobros de clientes', color: C.cobro }, { label: 'Pagos a proveedores', color: C.pago }, { label: 'Neto del mes', color: C.ink, line: true }]} />
          <ChartCanvas config={charts.hist} className="chart tall" />
        </div>

        <div className="grid k2">
          <div className="card">
            <h2><span className="ic" style={{ background: 'var(--pos-bg)', color: C.cobro }}>↓</span>Top 10 clientes <small>cobrado en 12 meses</small></h2>
            <ChartCanvas config={charts.topC} className="chart tall" />
          </div>
          <div className="card">
            <h2><span className="ic" style={{ background: 'var(--neg-bg)', color: C.pago }}>↑</span>Top 10 proveedores <small>pagado en 12 meses</small></h2>
            <ChartCanvas config={charts.topP} className="chart tall" />
          </div>
        </div>

        <div className="grid k3">
          <div className="card"><h2>Cómo cobramos <small>12 meses</small></h2><ChartCanvas config={charts.metC} className="chart donut" /><Legend items={charts.legC} /></div>
          <div className="card"><h2>Cómo pagamos <small>12 meses</small></h2><ChartCanvas config={charts.metP} className="chart donut" /><Legend items={charts.legP} /></div>
          <div className="card">
            <h2>Proyectos con más cobros <small>12 meses</small></h2>
            <Tbl name="Proyectos con más cobros" className="tbl scroll" style={{ maxHeight: 300 }}>
              <table>
                <thead><tr><th>Proyecto</th><th className="n">Cobrado</th></tr></thead>
                <tbody>
                  {projects.length === 0 && <tr><td colSpan={2} className="muted">Sin cobros con proyecto en 12 meses.</td></tr>}
                  {projects.map((p) => {
                    const col = colorOfShort(p.company_short);
                    return (
                      <tr key={`${p.name}-${p.company_short}`}>
                        <td className="w">
                          <span className="ctag" style={{ '--tagbg': rgba(col, 0.13), '--tagc': col } as CSSProperties}>{p.company_short}</span> {p.name}
                          <div className="bar" style={{ height: 5, marginTop: 5 }}><i style={{ width: `${(p.amount / pmax) * 100}%`, background: col }} /></div>
                        </td>
                        <td className="n">{e0(p.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Tbl>
          </div>
        </div>
      </section>
    );
  }

  return (
    <Shell today={data?.today} companies={data?.companies} selected={selected} onCompanies={changeCompanies} loading={loading && !!data} error={error}>
      {loading && !data ? <div className="empty">Cargando…</div> : body}
    </Shell>
  );
}
