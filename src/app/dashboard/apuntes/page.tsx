'use client';

import { CSSProperties, Fragment, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiAccountingMoveLines, AccountingDrillSpec, AccountingMoveLine, AccountingMoveLinesResponse } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useCompanySelection } from '../components/AccountingUi';
import Shell from '../components/cuadro/Shell';
import { APUNTES_PATH, parseSpec } from '../components/cuadro/drill';
import { e2, fD } from '../components/cuadro/lib';

const PAGE = 100;

type Free = Extract<AccountingDrillSpec, { t: 'free' }>;
type GroupDetail = { lines: AccountingMoveLine[]; count: number; loading: boolean };
const GROUPED_KEY = 'portal_cf_apuntes_grouped_v1';

/** Fila de un apunte. */
function LineRow({ l, isDebt, odoo, nested = false }: { l: AccountingMoveLine; isDebt: boolean; odoo: string; nested?: boolean }) {
  return (
    <tr className={nested ? 'ml-sub' : ''}>
      <td style={nested ? { paddingLeft: 30 } : undefined}>{fD(l.date)}</td>
      <td>
        {odoo && l.move_id ? <a href={`${odoo}/web#id=${l.move_id}&model=account.move&view_type=form`} target="_blank" rel="noopener noreferrer" className="drill" title="Abrir el asiento en Odoo">{l.move}</a> : l.move}
        {l.state === 'draft' && <> <span className="st-draft">Borrador</span></>}
      </td>
      <td className="muted">{l.journal}</td>
      <td>{l.account}</td>
      <td>{l.partner}</td>
      <td className="w" style={{ maxWidth: 320 }}>{l.label}{l.ref && l.ref !== l.label ? <span className="muted"> · {l.ref}</span> : null}</td>
      {isDebt && <td>{fD(l.date_maturity)}</td>}
      <td className="n">{l.debit ? e2(l.debit) : ''}</td>
      <td className="n">{l.credit ? e2(l.credit) : ''}</td>
      <td className={`n ${l.balance < 0 ? 'neg' : ''}`}>{e2(l.balance)}</td>
      {isDebt && <td className={`n ${l.residual < 0 ? 'neg' : ''}`}>{e2(l.residual)}</td>}
    </tr>
  );
}

function yearStart(today: string) { return `${today.slice(0, 4)}-01-01`; }

function csvCell(v: string | number) {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ApuntesInner() {
  const params = useSearchParams();
  const drill = useMemo(() => parseSpec(params.get('spec')), [params]);
  const [selected, setSelected] = useCompanySelection();
  const todayIso = new Date().toISOString().slice(0, 10);

  // Búsqueda libre (cuando se entra desde el menú)
  const [form, setForm] = useState<Free>({ t: 'free', from: yearStart(todayIso), to: todayIso, account: '', partner: '', text: '', draft: false });
  const [free, setFree] = useState<Free>(form);
  const spec: AccountingDrillSpec = drill ?? free;

  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AccountingMoveLinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  // Vista agrupada por compañía (por defecto) y grupos desplegados
  const [grouped, setGroupedState] = useState<boolean>(() => {
    try { return typeof window === 'undefined' || localStorage.getItem(GROUPED_KEY) !== 'false'; } catch { return true; }
  });
  const setGrouped = (v: boolean) => { setGroupedState(v); try { localStorage.setItem(GROUPED_KEY, String(v)); } catch { /* sin almacenamiento */ } };
  const [expanded, setExpanded] = useState<{ qk: string; map: Record<number, GroupDetail> }>({ qk: '', map: {} });

  const specKey = JSON.stringify(spec);
  const qk = `${specKey}|${selected.join(',')}`;
  const expMap = expanded.qk === qk ? expanded.map : {};

  const loadGroup = async (companyId: number, more = false) => {
    const token = getToken();
    if (!token) return;
    const prev = expMap[companyId];
    const from = more && prev ? prev.lines.length : 0;
    setExpanded((e) => {
      const map = e.qk === qk ? { ...e.map } : {};
      map[companyId] = { lines: more && prev ? prev.lines : [], count: prev?.count ?? 0, loading: true };
      return { qk, map };
    });
    const res = await apiAccountingMoveLines(token, spec, drill ? [] : selected, from, PAGE, companyId);
    setExpanded((e) => {
      const map = e.qk === qk ? { ...e.map } : {};
      const base = more && map[companyId] ? map[companyId].lines : [];
      map[companyId] = { lines: [...base, ...(res.lines ?? [])], count: res.count ?? 0, loading: false };
      return { qk, map };
    });
  };
  const toggleGroup = (companyId: number) => {
    if (expMap[companyId]) {
      setExpanded((e) => { const map = { ...(e.qk === qk ? e.map : {}) }; delete map[companyId]; return { qk, map }; });
    } else {
      void loadGroup(companyId);
    }
  };
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    apiAccountingMoveLines(token, spec, drill ? [] : selected, offset, PAGE)
      .then((res) => {
        if (cancelled) return;
        if (res.success) { setData(res); setError(''); }
        else { setError(res.error || 'No se pudieron cargar los apuntes.'); setData(res.companies ? res : null); }
      })
      .catch(() => { if (!cancelled) setError('Error de conexión.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey, selected, offset]);

  const changeCompanies = (ids: number[]) => { setLoading(true); setOffset(0); setSelected(ids); };
  const search = () => { setLoading(true); setOffset(0); setFree({ ...form }); };
  const page = (o: number) => { setLoading(true); setOffset(o); };

  const isDebt = spec.t === 'debt';
  const count = data?.count ?? 0;
  const lines = data?.lines ?? [];
  const totals = data?.totals;
  const odoo = (data?.odoo_url ?? '').replace(/\/$/, '');
  const companyName = (id: number | false) => data?.companies?.find((c) => c.id === id)?.short ?? '';
  const companyFull = (id: number) => data?.companies?.find((c) => c.id === id)?.name ?? `Compañía ${id}`;
  const groups = data?.groups ?? [];
  const multi = (data?.selected_company_ids ?? []).length > 1;

  const exportCsv = async () => {
    const token = getToken();
    if (!token || !data) return;
    setExporting(true);
    try {
      const all = [];
      for (let o = 0; o < Math.min(count, 5000); o += 500) {
        const res = await apiAccountingMoveLines(token, spec, drill ? [] : selected, o, 500);
        if (!res.success) break;
        all.push(...(res.lines ?? []));
      }
      const head = ['Fecha', 'Asiento', 'Diario', 'Cuenta', 'Contacto', 'Etiqueta', 'Referencia', 'Vencimiento', 'Debe', 'Haber', 'Saldo', 'Pendiente', 'Estado'];
      const num = (n: number) => n.toFixed(2).replace('.', ',');
      const rows = all.map((l) => [l.date ?? '', l.move, l.journal, l.account, l.partner, l.label, l.ref, l.date_maturity ?? '', num(l.debit), num(l.credit), num(l.balance), num(l.residual), l.state === 'draft' ? 'Borrador' : 'Publicado']);
      const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `apuntes-${todayIso}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Shell
      today={data?.today}
      companies={drill ? undefined : data?.companies}
      selected={selected}
      onCompanies={changeCompanies}
      loading={loading && !!data}
      error={error}
    >
      <section className="panel">
        {drill ? (
          <div className="ml-banner">
            <span className="sp">Revisando: <b>{drill.l || 'importe del cuadro'}</b>{multi ? ` · ${(data?.selected_company_ids ?? []).map(companyName).join(', ')}` : ''}</span>
            <button type="button" className="btn" onClick={() => history.back()}>← Volver</button>
            <Link className="btn" href={APUNTES_PATH}>Buscar otros apuntes</Link>
          </div>
        ) : (
          <div className="card" style={{ gap: 10 }}>
            <div className="ml-filters">
              <label>Desde<input type="date" value={form.from ?? ''} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
              <label>Hasta<input type="date" value={form.to ?? ''} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
              <label>Cuenta (empieza por)<input inputMode="numeric" placeholder="p. ej. 430, 57, 6" value={form.account ?? ''} onChange={(e) => setForm({ ...form, account: e.target.value.replace(/[^0-9]/g, '') })} /></label>
              <label>Diario
                <select value={form.journal ?? ''} onChange={(e) => setForm({ ...form, journal: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Todos</option>
                  {(data?.journals ?? []).map((j) => <option key={j.id} value={j.id}>{j.name}{multi ? ` · ${companyName(j.company_id)}` : ''}</option>)}
                </select>
              </label>
              <label>Contacto<input placeholder="Nombre" value={form.partner ?? ''} onChange={(e) => setForm({ ...form, partner: e.target.value })} /></label>
              <label>Texto<input placeholder="Asiento, etiqueta o referencia" value={form.text ?? ''} onChange={(e) => setForm({ ...form, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} /></label>
              <label className="chk"><input type="checkbox" checked={!!form.draft} onChange={(e) => setForm({ ...form, draft: e.target.checked })} />Incluir borradores</label>
              <button type="button" className="btn pri" onClick={search}>Buscar</button>
            </div>
            <div className="note">Consejo: en cualquier página de Contabilidad puedes pulsar un importe para ver aquí los apuntes que lo forman.</div>
          </div>
        )}

        {loading && !data ? <div className="empty">Cargando…</div> : data?.success && (
          <>
            <div className="grid k4">
              <div className="card kpi"><div className="lbl">Apuntes</div><div className="val">{count.toLocaleString('es-ES')}</div><div className="sub">{grouped ? 'despliega una compañía para ver el detalle' : count > PAGE ? `se muestran de ${PAGE} en ${PAGE}` : 'todos en esta página'}</div></div>
              <div className="card kpi"><div className="lbl">Debe</div><div className="val">{e2(totals?.debit ?? 0)}</div></div>
              <div className="card kpi"><div className="lbl">Haber</div><div className="val">{e2(totals?.credit ?? 0)}</div></div>
              <div className="card kpi">
                <div className="lbl">{isDebt ? 'Pendiente' : 'Saldo (debe − haber)'}</div>
                <div className="val"><span className={(isDebt ? totals?.residual ?? 0 : totals?.balance ?? 0) < 0 ? 'neg' : ''}>{e2(isDebt ? totals?.residual ?? 0 : totals?.balance ?? 0)}</span></div>
                <div className="sub">En pasivo, ingresos o patrimonio el saldo sale negativo aunque el cuadro lo muestre en positivo.</div>
              </div>
            </div>

            <div className="card">
              <div className="afhead">
                <h2>Apuntes contables <small>{!count ? 'sin resultados'
                  : grouped ? `${groups.length} ${groups.length === 1 ? 'compañía' : 'compañías'} · ${count.toLocaleString('es-ES')} apuntes`
                    : `${offset + 1}–${Math.min(offset + PAGE, count)} de ${count.toLocaleString('es-ES')}`}</small></h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="tg" style={{ '--c': 'var(--accent)' } as CSSProperties}>
                    <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
                    <span className="sw" />Agrupar por compañía
                  </label>
                  <button type="button" className="btn" disabled={!count || exporting} onClick={exportCsv}>{exporting ? 'Preparando…' : 'Descargar CSV'}</button>
                </div>
              </div>
              <div className="tbl scroll" style={{ maxHeight: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Asiento</th><th>Diario</th><th>Cuenta</th><th>Contacto</th><th>Etiqueta</th>
                      {isDebt && <th>Vencimiento</th>}
                      <th className="n">Debe</th><th className="n">Haber</th><th className="n">Saldo</th>{isDebt && <th className="n">Pendiente</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {count === 0 && <tr><td colSpan={isDebt ? 11 : 9} className="muted">No hay apuntes con este filtro.</td></tr>}
                    {grouped ? groups.map((g) => {
                      const det = expMap[g.company_id];
                      const open = !!det;
                      return (
                        <Fragment key={g.company_id}>
                          <tr className="ml-grp" onClick={() => toggleGroup(g.company_id)} aria-expanded={open}>
                            <td colSpan={isDebt ? 7 : 6}>
                              <span className="ml-caret">{open ? '▼' : '▶'}</span>
                              <b>{companyFull(g.company_id)}</b>
                              <span className="muted"> · {g.count.toLocaleString('es-ES')} apuntes</span>
                            </td>
                            <td className="n">{e2(g.debit)}</td>
                            <td className="n">{e2(g.credit)}</td>
                            <td className={`n ${g.balance < 0 ? 'neg' : ''}`}><b>{e2(g.balance)}</b></td>
                            {isDebt && <td className={`n ${g.residual < 0 ? 'neg' : ''}`}><b>{e2(g.residual)}</b></td>}
                          </tr>
                          {open && det.lines.map((l) => <LineRow key={l.id} l={l} isDebt={isDebt} odoo={odoo} nested />)}
                          {open && (det.loading || det.lines.length < det.count) && (
                            <tr className="ml-sub">
                              <td colSpan={isDebt ? 11 : 9} style={{ paddingLeft: 30 }}>
                                {det.loading ? <span className="muted">Cargando…</span> : (
                                  <button type="button" className="btn" onClick={() => void loadGroup(g.company_id, true)}>
                                    Cargar más ({det.lines.length.toLocaleString('es-ES')} de {det.count.toLocaleString('es-ES')})
                                  </button>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    }) : lines.map((l) => <LineRow key={l.id} l={l} isDebt={isDebt} odoo={odoo} />)}
                  </tbody>
                </table>
              </div>
              {!grouped && count > PAGE && (
                <div className="pager">
                  <button type="button" className="btn" disabled={offset === 0} onClick={() => page(Math.max(0, offset - PAGE))}>← Anteriores</button>
                  <span>Página {Math.floor(offset / PAGE) + 1} de {Math.ceil(count / PAGE)}</span>
                  <button type="button" className="btn" disabled={offset + PAGE >= count} onClick={() => page(offset + PAGE)}>Siguientes →</button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </Shell>
  );
}

export default function ApuntesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Cargando…</div>}>
      <ApuntesInner />
    </Suspense>
  );
}

