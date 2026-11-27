'use client';

import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { apiAccountingForecast, AccountingForecastJournal, AccountingForecastResponse } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useCompanySelection } from '../components/AccountingUi';
import Shell, { useHorizon } from '../components/cuadro/Shell';
import ChartCanvas from '../components/cuadro/ChartCanvas';
import { KIND_ICON } from '../components/cuadro/icons';
import { Drill, chartDrill } from '../components/cuadro/drill';
import { useRouter } from 'next/navigation';
import { ORIGIN_LABEL, Serie, baseBalance, horizonEnd, movimientos, serie, useToggles } from '../components/cuadro/forecast';
import { C, baseOpts, companyColor, compact, e0, e2, entColor, fD, fonts, gradientFill, hbarOpts, rgba, zeroLine } from '../components/cuadro/lib';
import { Tbl } from '../components/cuadro/xlsx';
import { SaberMas } from '../components/cuadro/info';

/** Minigráfico de la tarjeta (mismo dibujo que el artefacto: línea + área hasta 0). */
function Spark({ vals, color }: { vals: number[]; color: string }) {
  const w = 200, h = 38;
  if (vals.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }} />;
  const mn = Math.min(0, ...vals), mx = Math.max(0, ...vals);
  const sy = (v: number) => h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 6);
  const c = vals[vals.length - 1] < 0 ? C.neg : color;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${sy(v).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }}>
      <line x1={0} x2={w} y1={sy(0)} y2={sy(0)} stroke={C.line} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <path d={`M${pts.join(' L')} L${w},${sy(0)} L0,${sy(0)} Z`} fill={rgba(c, 0.15)} />
      <path d={`M${pts.join(' L')}`} fill="none" stroke={c} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const shortName = (n: string) => n.replace(/^TARJETA /i, 'TARJ. ').replace(/^EFECTIVO/i, 'EFECT.');

export default function BancosPage() {
  const [selected, setSelected] = useCompanySelection();
  const [horizon, setHorizon] = useHorizon();
  const [t] = useToggles();
  const [data, setData] = useState<AccountingForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bankId, setBankId] = useState<number | null>(null);
  const router = useRouter();

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
    // En Bancos se ven todos los diarios (también los de cartera)
    const tb = { ...t, cart: true };
    const movs = movimientos(data, tb, end);
    const banks = data.journals ?? [];
    const ser = new Map<number, Serie>(banks.map((b) => [b.id, serie(movs.filter((m) => m.journal_id === b.id), [b], tb, today, end)]));
    const { ui } = fonts();

    const cb = banks.filter((b) => b.has_statement);
    const oc = baseOpts();
    oc.scales.x.ticks.maxTicksLimit = 30; oc.scales.x.ticks.autoSkip = false; oc.scales.x.ticks.maxRotation = 60;
    oc.scales.x.ticks.font = { family: ui, size: 10, weight: 700 };
    oc.interaction = { mode: 'nearest', intersect: true };
    Object.assign(oc, chartDrill((href) => router.push(href), (ds, i) => (
      ds === 0 && cb[i] ? { t: 'treasury', j: [cb[i].id], c: [cb[i].company_id], l: `Saldo contable · ${cb[i].name}` } : null
    )));
    const cmp = { type: 'bar', data: { labels: cb.map((b) => shortName(b.name)), datasets: [
      { label: 'Saldo contable', data: cb.map((b) => b.balance), backgroundColor: cb.map((b) => entColor(b.entity)), borderRadius: 4, maxBarThickness: 22 },
      { label: 'Último estado de cuenta', data: cb.map((b) => b.statement_balance), backgroundColor: cb.map((b) => rgba(entColor(b.entity), 0.35)), borderRadius: 4, maxBarThickness: 22 },
    ] }, options: oc };

    const cc = banks.filter((b) => b.pending_count).sort((a, b) => b.pending_count - a.pending_count);
    const oq = hbarOpts(40);
    oq.scales.x.ticks.callback = (v: number | string) => v;
    oq.scales.y.ticks.font = { family: ui, size: 11, weight: 700 };
    oq.plugins.tooltip.callbacks.label = (c: { parsed: { x: number } }) => ` ${c.parsed.x} artículos por conciliar`;
    const conc = { type: 'bar', data: { labels: cc.map((b) => b.name), datasets: [{ data: cc.map((b) => b.pending_count), backgroundColor: cc.map((b) => (b.pending_count >= 10 ? C.neg : b.pending_count >= 5 ? C.warn : C.pos)), borderRadius: 5, barThickness: 16 }] }, options: oq };

    return { today, end, tb, movs, banks, ser, cmp, conc, hasConc: cc.length > 0 };
  }, [data, horizon, t, router]);

  const companies = data?.companies ?? [];
  const current: AccountingForecastJournal | undefined = calc ? (calc.banks.find((b) => b.id === bankId) ?? calc.banks[0]) : undefined;

  const detail = useMemo(() => {
    if (!calc || !current) return null;
    const T = calc.ser.get(current.id)!;
    const col = entColor(current.entity);
    const line = { type: 'line', data: { labels: T.labels, datasets: [{ label: current.name, data: T.vals, borderColor: col, backgroundColor: gradientFill(col), fill: true, pointRadius: 0, borderWidth: 2.5, stepped: true }] }, options: baseOpts(), plugins: [zeroLine] };
    let acc = baseBalance(current, calc.tb);
    const moves = calc.movs.filter((m) => m.journal_id === current.id).map((m) => { acc += m.amount; return { ...m, acc }; });
    return { T, col, line, moves };
  }, [calc, current]);

  return (
    <Shell today={data?.today} companies={data?.companies} selected={selected} onCompanies={changeCompanies}
      horizon={horizon} onHorizon={setHorizon} loading={loading && !!data} error={error}>
      {loading && !data ? <div className="empty">Cargando…</div> : calc && (
        <section className="panel">
          <div className="grid k2">
            <div className="card">
              <h2>Saldo contable frente a último estado de cuenta <small>la diferencia suele ser lo pendiente de conciliar</small><SaberMas id="b_cmp" /></h2>
              <div className="legend"><span style={{ '--c': C.accent } as CSSProperties}>Saldo contable</span><span style={{ '--c': C.estim } as CSSProperties}>Último estado de cuenta</span></div>
              <ChartCanvas config={calc.cmp} className="chart tall" />
            </div>
            <div className="card">
              <h2>Pendiente de conciliar <small>artículos por diario</small><SaberMas id="b_conc" /></h2>
              {calc.hasConc ? <ChartCanvas config={calc.conc} className="chart tall" /> : <div className="empty">No hay movimientos de extracto pendientes de conciliar.</div>}
            </div>
          </div>

          <div className="cgroup" style={{ gap: 20 }}>
            {companies.filter((c) => calc.banks.some((b) => b.company_id === c.id)).map((c) => {
              const idx = companies.findIndex((x) => x.id === c.id);
              const col = companyColor(idx);
              const bs = calc.banks.filter((b) => b.company_id === c.id).sort((a, b) => b.balance - a.balance);
              return (
                <div key={c.id} className="cgroup">
                  <h3>
                    <span className="ctag" style={{ '--tagbg': rgba(col, 0.13), '--tagc': col } as CSSProperties}>{c.short}</span>{c.name}
                    <SaberMas id="b_tarjetas" />
                    <span className="tot">{e0(bs.reduce((s, b) => s + b.balance, 0))}</span>
                  </h3>
                  <div className="banks">
                    {bs.map((b) => {
                      const T = calc.ser.get(b.id)!;
                      const bc = entColor(b.entity);
                      return (
                        <div key={b.id} role="button" tabIndex={0} className="bank" style={{ '--bc': bc } as CSSProperties} aria-pressed={current?.id === b.id}
                          onClick={() => setBankId(b.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBankId(b.id); } }}>
                          <span className="t">
                            <span className="bi">{KIND_ICON[b.kind] ?? KIND_ICON.banco}</span>
                            <span><span className="d">{b.name}</span><br /><span className="c">{c.name}</span></span>
                          </span>
                          <span className={`s ${b.balance < 0 ? 'neg' : ''}`} onClick={(e) => e.stopPropagation()}>
                            <Drill spec={{ t: 'treasury', j: [b.id], c: [b.company_id], l: `Saldo contable · ${b.name}` }}>{e2(b.balance)}</Drill>
                          </span>
                          {b.has_statement && <span className="m"><span>Último extracto</span><span>{e2(b.statement_balance)}</span></span>}
                          <Spark vals={T.vals} color={bc} />
                          <span className="m"><span>Final {compact(T.fin)}</span><span className={T.min < 0 ? 'neg' : ''}>Mín. {compact(T.min)}</span></span>
                          <span className="badges">
                            {b.pending_count > 0 && <span className={`bdg ${b.pending_count >= 10 ? 'w' : ''}`}>{b.pending_count} por conciliar</span>}
                            {b.statement_date && <span className="bdg">Extracto a {fD(b.statement_date)}</span>}
                            {b.kind === 'cartera' && <span className="bdg">Cartera de inversión</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {current && detail && (
            <>
              <div className="card">
                <h2>
                  <span className="ic" style={{ background: detail.col, color: '#fff' }}>{KIND_ICON[current.kind] ?? KIND_ICON.banco}</span>
                  Previsión · {current.name} <small>{companies.find((c) => c.id === current.company_id)?.name}</small><SaberMas id="b_prevision" />
                </h2>
                <div className="grid k4">
                  <div className="kpi"><div className="lbl">Saldo de partida</div><div className="val" style={{ fontSize: 21 }}>{calc.tb.base === 'statement' && current.has_statement
                    ? e2(baseBalance(current, calc.tb))
                    : <Drill spec={{ t: 'treasury', j: [current.id], c: [current.company_id], l: `Saldo contable · ${current.name}` }}>{e2(baseBalance(current, calc.tb))}</Drill>}</div><div className="sub">{calc.tb.base === 'statement' && current.has_statement ? 'último estado de cuenta' : 'saldo contable'}</div></div>
                  <div className="kpi"><div className="lbl">Saldo previsto final</div><div className="val" style={{ fontSize: 21 }}><span className={detail.T.fin < 0 ? 'neg' : ''}>{e0(detail.T.fin)}</span></div><div className="sub">a {fD(calc.end)}</div></div>
                  <div className="kpi"><div className="lbl">Saldo mínimo</div><div className="val" style={{ fontSize: 21 }}><span className={detail.T.min < 0 ? 'neg' : ''}>{e0(detail.T.min)}</span></div><div className="sub">el {fD(detail.T.minD)}</div></div>
                  <div className="kpi"><div className="lbl">Primer descubierto</div><div className="val" style={{ fontSize: 21 }}>{detail.T.neg ? <span className="neg">{fD(detail.T.neg)}</span> : <span className="pos">No</span>}</div><div className="sub">{detail.T.neg ? 'conviene traspasar fondos antes' : 'sin descubierto en el horizonte'}</div></div>
                </div>
                <ChartCanvas config={detail.line} />
              </div>
              <div className="card">
                <h2>Movimientos previstos <small>{detail.moves.length} movimientos hasta {fD(calc.end)}</small><SaberMas id="b_mov" /></h2>
                <Tbl name="Movimientos previstos" className="tbl scroll">
                  <table>
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th className="n">Importe</th><th className="n">Saldo</th></tr></thead>
                    <tbody>
                      {detail.moves.length === 0 && <tr><td colSpan={5} className="muted">Sin movimientos previstos para este diario.</td></tr>}
                      {detail.moves.map((m, i) => (
                        <tr key={i}>
                          <td>{fD(m.date)}</td><td><span className={`chip ${m.origin}`}>{ORIGIN_LABEL[m.origin]}</span></td>
                          <td>{m.concept}</td>
                          <td className={`n ${m.amount < 0 ? 'neg' : ''}`}>{e2(m.amount)}</td>
                          <td className={`n ${m.acc < 0 ? 'neg' : ''}`}>{e2(m.acc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Tbl>
              </div>
            </>
          )}
        </section>
      )}
    </Shell>
  );
}
