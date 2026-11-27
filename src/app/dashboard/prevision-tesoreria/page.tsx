'use client';

import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { apiAccountingForecast, AccountingForecastResponse } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useCompanySelection } from '../components/AccountingUi';
import Shell, { useHorizon } from '../components/cuadro/Shell';
import ChartCanvas from '../components/cuadro/ChartCanvas';
import { Icon } from '../components/cuadro/icons';
import { ORIGIN_LABEL, horizonEnd, movimientos, selectedJournals, serie, useToggles } from '../components/cuadro/forecast';
import {
  C, DAY, MES, baseOpts, compact, companyColor, e0, e2, fD, fM, fonts, gradientFill, rgba, toIso, toTime, zeroLine,
} from '../components/cuadro/lib';

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function Toggle({ checked, onChange, label, color, radio = false }: { checked: boolean; onChange: () => void; label: string; color: string; radio?: boolean }) {
  return (
    <label className="tg" style={{ '--c': color } as CSSProperties}>
      <input type={radio ? 'radio' : 'checkbox'} checked={checked} onChange={onChange} />
      <span className="sw" />{label}
    </label>
  );
}

export default function PrevisionTesoreriaPage() {
  const [selected, setSelected] = useCompanySelection();
  const [horizon, setHorizon] = useHorizon();
  const [t, setT] = useToggles();
  const [data, setData] = useState<AccountingForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    if (!data?.success || !data.today) return null;
    const today = data.today, end = horizonEnd(today, horizon);
    const companies = data.companies ?? [];
    const sel = data.selected_company_ids ?? [];
    const movs = movimientos(data, t, end);
    const journals = selectedJournals(data, t);
    const T = serie(movs, journals, t, today, end);
    const tot = (o: string) => movs.filter((m) => m.origin === o).reduce((s, m) => s + m.amount, 0);
    const group = sel.length > 1;
    const title = group ? 'del grupo' : `de ${companies.find((c) => c.id === sel[0])?.short ?? ''}`;
    const mainColor = group ? C.accent : companyColor(companies.findIndex((c) => c.id === sel[0]));
    const { num } = fonts();

    // Cascada
    const steps: [string, number, string][] = [['Saldo hoy', T.ini, 'total'], ['Cobros', tot('cobro'), 'cobro'], ['Pagos', tot('pago'), 'pago'], ['Ajustes', tot('ajuste'), 'ajuste']];
    if (t.est) steps.push(['Estimación', tot('estim'), 'estim']);
    steps.push(['Saldo final', T.fin, 'total']);
    let run = 0;
    const wd: [number, number][] = [], wc: string[] = [];
    const catColor: Record<string, string> = { cobro: C.cobro, pago: C.pago, ajuste: C.ajuste, estim: C.estim };
    for (const [, v, k] of steps) {
      if (k === 'total') { wd.push([0, v]); run = v; wc.push(v < 0 ? C.neg : C.accent); }
      else { wd.push([run, run + v]); run += v; wc.push(catColor[k]); }
    }
    const ow = baseOpts();
    ow.interaction = { mode: 'nearest', intersect: true };
    ow.scales.x.ticks.maxTicksLimit = 20;
    ow.plugins.tooltip.callbacks.label = (c: { raw: [number, number]; dataIndex: number }) => {
      const s = steps[c.dataIndex];
      return ` ${s[2] === 'total' ? e0(c.raw[1]) : `${s[1] >= 0 ? '+' : ''}${e0(s[1])}`}`;
    };
    const water = { type: 'bar', data: { labels: steps.map((s) => s[0]), datasets: [{ data: wd, backgroundColor: wc, borderRadius: 5, barPercentage: 0.7 }] }, options: ow, plugins: [zeroLine] };

    // Calendario de calor (semanas en columnas, de lunes a domingo)
    const t0 = toTime(today);
    const startT = t0 - ((new Date(t0).getUTCDay() + 6) % 7) * DAY;
    const endHeat = toTime(horizonEnd(today, 6));
    const nets: { d: string; v: number | null }[] = [];
    for (let tt = startT; tt <= endHeat; tt += DAY) nets.push({ d: toIso(tt), v: tt < t0 ? null : (T.porDia.get(toIso(tt)) ?? 0) });
    const mxAbs = Math.max(1, ...nets.map((n) => Math.abs(n.v ?? 0)));
    const weeks = Math.ceil(nets.length / 7);
    const monthLabels: string[] = [];
    let lastM = -1;
    for (let w = 0; w < weeks; w++) { const m = Number(nets[w * 7].d.slice(5, 7)) - 1; monthLabels.push(m !== lastM ? MES[m] : ''); lastM = m; }
    const byDay = new Map<string, typeof movs>();
    movs.forEach((m) => { if (!byDay.has(m.date)) byDay.set(m.date, []); byDay.get(m.date)!.push(m); });

    // Saldo previsto diario (grupo + cada compañía)
    const ds: Record<string, unknown>[] = [{
      label: group ? 'Grupo' : companies.find((c) => c.id === sel[0])?.short ?? '', data: T.vals, borderColor: mainColor,
      backgroundColor: gradientFill(mainColor), fill: true, pointRadius: 0, borderWidth: 2.5, stepped: true,
    }];
    const lineLegend = [{ label: String(ds[0].label), color: mainColor }];
    if (group) {
      for (const cid of sel) {
        const idx = companies.findIndex((c) => c.id === cid);
        const sc = serie(movs.filter((m) => m.company_id === cid), selectedJournals(data, t, cid), t, today, end);
        ds.push({ label: companies[idx]?.short ?? '', data: sc.vals, borderColor: companyColor(idx), borderDash: [6, 4], fill: false, pointRadius: 0, borderWidth: 1.8, stepped: true });
        lineLegend.push({ label: companies[idx]?.name ?? '', color: companyColor(idx) });
      }
    }
    const line = { type: 'line', data: { labels: T.labels, datasets: ds }, options: baseOpts(), plugins: [zeroLine] };

    // Meses
    const months = new Map<string, { cobro: number; pago: number; ajuste: number; estim: number }>();
    for (let k = today.slice(0, 7); k <= end.slice(0, 7);) {
      months.set(k, { cobro: 0, pago: 0, ajuste: 0, estim: 0 });
      const y = Number(k.slice(0, 4)), m = Number(k.slice(5, 7));
      k = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
    movs.forEach((m) => { const r = months.get(m.date.slice(0, 7)); if (r) r[m.origin] += m.amount; });
    const mk = Array.from(months.keys());
    let sal = T.ini;
    const rows = mk.map((k) => { const r = months.get(k)!; const si = sal; sal += r.cobro + r.pago + r.ajuste + r.estim; return { k, ...r, si, sf: sal }; });
    const om = baseOpts(); om.scales.x.stacked = true; om.scales.y.stacked = true;
    om.scales.y2 = { position: 'right', ticks: { color: C.muted, callback: (v: number | string) => compact(Number(v)), font: { family: num, size: 11 } }, grid: { display: false }, border: { display: false } };
    const mes = { data: { labels: mk.map(fM), datasets: [
      { type: 'line', label: 'Saldo fin de mes', data: rows.map((r) => r.sf), yAxisID: 'y2', borderColor: C.ink, backgroundColor: C.ink, pointRadius: 3, borderWidth: 2, tension: 0.25, order: 0 },
      { type: 'bar', label: 'Cobros', data: rows.map((r) => r.cobro), backgroundColor: C.cobro, maxBarThickness: 30, borderRadius: 3, stack: 's', order: 1 },
      { type: 'bar', label: 'Estimación', data: rows.map((r) => r.estim), backgroundColor: C.estim, maxBarThickness: 30, borderRadius: 3, stack: 's', order: 1 },
      { type: 'bar', label: 'Pagos', data: rows.map((r) => r.pago), backgroundColor: C.pago, maxBarThickness: 30, borderRadius: 3, stack: 's', order: 1 },
      { type: 'bar', label: 'Ajustes', data: rows.map((r) => r.ajuste), backgroundColor: C.ajuste, maxBarThickness: 30, borderRadius: 3, stack: 's', order: 1 },
    ] }, options: om, plugins: [zeroLine] };

    // Próximos 30 días
    const lim = toIso(t0 + 30 * DAY);
    let acc = T.ini;
    const prox = movs.filter((m) => m.date <= lim && m.origin !== 'estim').map((m) => { acc += m.amount; return { ...m, acc }; });

    return {
      today, end, title, movs, journals, T, water, nets, mxAbs, weeks, monthLabels, byDay, line, lineLegend, mes, rows, prox,
      daysToNeg: T.neg ? Math.round((toTime(T.neg) - t0) / DAY) : 0,
    };
  }, [data, horizon, t]);

  const companies = data?.companies ?? [];
  const tagStyle = (cid: number) => { const col = companyColor(companies.findIndex((c) => c.id === cid)); return { '--tagbg': rgba(col, 0.13), '--tagc': col } as CSSProperties; };
  const shortOf = (cid: number) => companies.find((c) => c.id === cid)?.short ?? '';

  const heatColor = (v: number | null, mx: number) =>
    v == null || v === 0 ? undefined : rgba(v > 0 ? C.cobro : C.pago, 0.22 + 0.78 * Math.sqrt(Math.abs(v) / mx));

  return (
    <Shell today={data?.today} companies={data?.companies} selected={selected} onCompanies={changeCompanies}
      horizon={horizon} onHorizon={setHorizon} loading={loading && !!data} error={error}>
      {loading && !data ? <div className="empty">Cargando…</div> : calc && (
        <section className="panel">
          <div className="card" style={{ gap: 10 }}>
            <div className="toggles">
              <Toggle checked={t.adj} onChange={() => setT({ adj: !t.adj })} label="Ajustes de periodo" color={C.ajuste} />
              <Toggle checked={t.cob} onChange={() => setT({ cob: !t.cob })} label="Cobros programados" color={C.cobro} />
              <Toggle checked={t.pag} onChange={() => setT({ pag: !t.pag })} label="Pagos programados" color={C.pago} />
              <Toggle checked={t.est} onChange={() => setT({ est: !t.est })} label="Estimar cobro/pago de facturas pendientes no vencidas" color={C.estim} />
              <Toggle checked={t.cart} onChange={() => setT({ cart: !t.cart })} label="Incluir cuentas de cartera de inversión" color={C.accent} />
            </div>
            <div className="toggles">
              <Toggle radio checked={t.base === 'book'} onChange={() => setT({ base: 'book' })} label="Partir del saldo contable" color={C.ink} />
              <Toggle radio checked={t.base === 'statement'} onChange={() => setT({ base: 'statement' })} label="Partir del último estado de cuenta" color={C.ink} />
            </div>
            <div className="note">Cobros y pagos programados: pagos de Odoo con fecha igual o posterior a hoy (pagarés y confirming). Ajustes de periodo: asientos recurrentes de Odoo. La estimación reparte el importe pendiente no vencido de facturas a partes iguales en los días laborables de los próximos 60 días.</div>
          </div>

          {calc.T.neg ? (
            <div className="alert bad">{Icon.warn}<span>La tesorería {calc.title} pasa a negativo el <b>{fD(calc.T.neg)}</b>, dentro de {calc.daysToNeg} días. El saldo mínimo es {e0(calc.T.min)} el {fD(calc.T.minD)}.</span></div>
          ) : (
            <div className="alert ok">{Icon.ok}<span>La tesorería {calc.title} se mantiene en positivo hasta el {fD(calc.end)}. El saldo mínimo es {e0(calc.T.min)} el {fD(calc.T.minD)}.</span></div>
          )}

          <div className="grid k4">
            <div className="card kpi" style={{ borderTop: `4px solid ${C.accent}` }}><div className="lbl">Saldo de partida</div><div className="val">{e0(calc.T.ini)}</div><div className="sub">{calc.journals.length} diarios · {t.base === 'statement' ? 'último estado de cuenta' : 'saldo contable'}</div></div>
            <div className="card kpi" style={{ borderTop: `4px solid ${calc.T.fin < 0 ? C.neg : C.pos}` }}><div className="lbl">Saldo previsto al final</div><div className="val"><span className={calc.T.fin < 0 ? 'neg' : ''}>{e0(calc.T.fin)}</span></div><div className="sub">a {fD(calc.end)}</div></div>
            <div className="card kpi" style={{ borderTop: `4px solid ${calc.T.min < 0 ? C.neg : C.warn}` }}><div className="lbl">Saldo mínimo</div><div className="val"><span className={calc.T.min < 0 ? 'neg' : ''}>{e0(calc.T.min)}</span></div><div className="sub">el {fD(calc.T.minD)}</div></div>
            <div className="card kpi" style={{ borderTop: `4px solid ${C.cG}` }}><div className="lbl">Flujo neto del periodo</div><div className="val"><span className={calc.T.fin - calc.T.ini < 0 ? 'neg' : ''}>{e0(calc.T.fin - calc.T.ini)}</span></div><div className="sub">{calc.movs.length} movimientos previstos</div></div>
          </div>

          <div className="grid k2">
            <div className="card"><h2><span className="ic" style={{ background: 'var(--accent-soft)', color: C.accent }}>▤</span>De hoy al final del horizonte <small>cascada del saldo</small></h2><ChartCanvas config={calc.water} /></div>
            <div className="card">
              <h2><span className="ic" style={{ background: 'var(--accent-soft)', color: C.accent }}>▦</span>Calendario de movimientos <small>neto diario · próximos 6 meses</small></h2>
              <div className="heat">
                <div className="months">{calc.monthLabels.map((m, i) => <span key={i}>{m}</span>)}</div>
                <div className="body">
                  <div className="days"><span>L</span><span /><span>X</span><span /><span>V</span><span /><span>D</span></div>
                  <div className="cells">
                    {calc.nets.map(({ d, v }) => {
                      const ms = calc.byDay.get(d) ?? [];
                      const dow = DOW[new Date(toTime(d)).getUTCDay()];
                      const title = v == null ? undefined : [`${dow} ${fD(d)} · neto ${e0(v)}`, ...ms.slice(0, 6).map((m) => `${ORIGIN_LABEL[m.origin]} · ${m.concept.split(' · ')[0]} ${compact(m.amount)}`), ...(ms.length > 6 ? [`+${ms.length - 6} más`] : [])].join('\n');
                      return <i key={d} className={v == null ? 'x' : ''} style={{ background: heatColor(v, calc.mxAbs) }} title={title} />;
                    })}
                  </div>
                </div>
                <div className="scale">Pagos <i style={{ background: rgba(C.pago, 1) }} /><i style={{ background: rgba(C.pago, 0.45) }} /><i style={{ background: 'var(--surface-2)' }} /><i style={{ background: rgba(C.cobro, 0.45) }} /><i style={{ background: rgba(C.cobro, 1) }} /> Cobros <span style={{ marginLeft: 10 }}>· pasa el ratón para ver el detalle</span></div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2><span className="ic" style={{ background: 'var(--accent-soft)', color: C.accent }}>⟋</span>Saldo previsto de tesorería <small>diario</small></h2>
            <div className="legend">{calc.lineLegend.map((l) => <span key={l.label} className="ln" style={{ '--c': l.color } as CSSProperties}>{l.label}</span>)}</div>
            <ChartCanvas config={calc.line} className="chart tall" />
          </div>

          <div className="card">
            <h2>Entradas y salidas por mes</h2>
            <div className="legend">
              <span style={{ '--c': C.cobro } as CSSProperties}>Cobros</span><span style={{ '--c': C.pago } as CSSProperties}>Pagos</span>
              <span style={{ '--c': C.ajuste } as CSSProperties}>Ajustes de periodo</span><span style={{ '--c': C.estim } as CSSProperties}>Estimación</span>
              <span className="ln" style={{ '--c': C.ink } as CSSProperties}>Saldo a fin de mes</span>
            </div>
            <ChartCanvas config={calc.mes} />
          </div>

          <div className="grid k2">
            <div className="card">
              <h2>Resumen mensual</h2>
              <div className="tbl scroll">
                <table>
                  <thead><tr><th>Mes</th><th className="n">Saldo inicial</th><th className="n">Cobros</th><th className="n">Pagos</th><th className="n">Ajustes</th>{t.est && <th className="n">Estimación</th>}<th className="n">Saldo final</th></tr></thead>
                  <tbody>
                    {calc.rows.map((r) => (
                      <tr key={r.k}>
                        <td><b>{fM(r.k)}</b></td>
                        <td className={`n ${r.si < 0 ? 'neg' : ''}`}>{e0(r.si)}</td>
                        <td className="n pos">{e0(r.cobro)}</td><td className="n">{e0(r.pago)}</td><td className="n">{e0(r.ajuste)}</td>
                        {t.est && <td className="n">{e0(r.estim)}</td>}
                        <td className={`n ${r.sf < 0 ? 'neg' : ''}`}><b>{e0(r.sf)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <h2>Próximos movimientos <small>30 días</small></h2>
              <div className="tbl scroll">
                <table>
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Diario</th><th className="n">Importe</th><th className="n">Saldo</th></tr></thead>
                  <tbody>
                    {calc.prox.length === 0 && <tr><td colSpan={6} className="muted">Sin movimientos en los próximos 30 días.</td></tr>}
                    {calc.prox.map((m, i) => (
                      <tr key={i}>
                        <td>{fD(m.date)}</td><td><span className={`chip ${m.origin}`}>{ORIGIN_LABEL[m.origin]}</span></td>
                        <td>{m.concept}</td><td className="muted">{m.journal}</td>
                        <td className={`n ${m.amount < 0 ? 'neg' : ''}`}>{e2(m.amount)}</td>
                        <td className={`n ${m.acc < 0 ? 'neg' : ''}`}>{e0(m.acc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Ajustes de periodo <small>tal como están en Odoo (asientos recurrentes)</small></h2>
            <div className="tbl scroll">
              <table>
                <thead><tr><th>Compañía</th><th>Descripción</th><th>Diario</th><th>Inicio</th><th>Fin</th><th className="n">Importe</th><th className="n">Cada</th><th>Próximo cargo</th></tr></thead>
                <tbody>
                  {(data?.adjustments ?? []).length === 0 && <tr><td colSpan={8} className="muted">No hay asientos recurrentes que muevan bancos o caja.</td></tr>}
                  {(data?.adjustments ?? []).slice().sort((a, b) => a.amount - b.amount).map((a) => (
                    <tr key={a.id}>
                      <td><span className="ctag" style={tagStyle(a.company_id)}>{shortOf(a.company_id)}</span></td>
                      <td><b>{a.name}</b></td><td>{a.journal}</td><td>{fD(a.start)}</td><td>{a.until ? fD(a.until) : 'Sin fin'}</td>
                      <td className={`n ${a.amount < 0 ? 'neg' : 'pos'}`}>{e2(a.amount)}</td>
                      <td className="n">{a.months ? `${a.months} ${a.months > 1 ? 'meses' : 'mes'}` : 'Una vez'}</td>
                      <td>{fD(a.next_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </Shell>
  );
}
