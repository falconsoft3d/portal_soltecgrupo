'use client';

import { CSSProperties, Fragment, ReactNode, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiAccountingMoveLines, AccountingDrillSpec, AccountingMoveLine, AccountingMoveLineGroup, AccountingMoveLinesResponse, AccountingMoveLinesScope } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useCompanySelection } from '../components/AccountingUi';
import Shell from '../components/cuadro/Shell';
import { APUNTES_PATH, parseSpec } from '../components/cuadro/drill';
import { e2, fD } from '../components/cuadro/lib';
import { downloadXlsx } from '../components/cuadro/xlsx';
import { SaberMas } from '../components/cuadro/info';

const PAGE = 100;

type Free = Extract<AccountingDrillSpec, { t: 'free' }>;
/** Nodo desplegado del árbol compañía → cuenta → contacto: subgrupos o apuntes. */
type TreeNode = { loading: boolean; subs?: AccountingMoveLineGroup[]; lines?: AccountingMoveLine[]; count?: number };
type Totals = { count: number; debit: number; credit: number; balance: number; residual: number };

/** Fila de grupo (compañía, cuenta o contacto) con sus totales. */
function GroupRow({ level, label, t, open, isDebt, onClick }: {
  level: number; label: string; t: Totals; open: boolean; isDebt: boolean; onClick: () => void;
}) {
  return (
    <tr className={`ml-grp ml-l${level}`} onClick={onClick} aria-expanded={open}>
      <td colSpan={isDebt ? 7 : 6} style={{ paddingLeft: 11 + level * 22 }}>
        <span className="ml-caret">{open ? '▼' : '▶'}</span>
        {level === 0 ? <b>{label}</b> : label}
        <span className="muted"> · {t.count.toLocaleString('es-ES')} apuntes</span>
      </td>
      <td className="n">{e2(t.debit)}</td>
      <td className="n">{e2(t.credit)}</td>
      <td className={`n ${t.balance < 0 ? 'neg' : ''}`}><b>{e2(t.balance)}</b></td>
      {isDebt && <td className={`n ${t.residual < 0 ? 'neg' : ''}`}><b>{e2(t.residual)}</b></td>}
    </tr>
  );
}
const GROUPED_KEY = 'portal_cf_apuntes_grouped_v1';

/** Fila de un apunte. */
function LineRow({ l, isDebt, odoo, level = 0 }: { l: AccountingMoveLine; isDebt: boolean; odoo: string; level?: number }) {
  return (
    <tr className={level ? 'ml-sub' : ''}>
      <td style={level ? { paddingLeft: 11 + level * 22 } : undefined}>{fD(l.date)}</td>
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
  const [expanded, setExpanded] = useState<{ qk: string; map: Record<string, TreeNode> }>({ qk: '', map: {} });

  const specKey = JSON.stringify(spec);
  const qk = `${specKey}|${selected.join(',')}`;
  const expMap = expanded.qk === qk ? expanded.map : {};

  // Árbol: clave «c:ID», «c:ID|a:ID» o «c:ID|a:ID|p:ID»
  const setNode = (key: string, node: TreeNode | null) => setExpanded((e) => {
    const map = { ...(e.qk === qk ? e.map : {}) };
    if (node) map[key] = node; else delete map[key];
    return { qk, map };
  });
  const scopeOf = (key: string): AccountingMoveLinesScope => {
    const parts = Object.fromEntries(key.split('|').map((x) => x.split(':')));
    return { only_company: Number(parts.c), ...(parts.a ? { only_account: Number(parts.a) } : {}), ...(parts.p !== undefined ? { only_partner: Number(parts.p) } : {}) };
  };
  const loadNode = async (key: string, more = false) => {
    const token = getToken();
    if (!token) return;
    const depth = key.split('|').length; // 1 compañía, 2 cuenta, 3 contacto
    const prev = expMap[key];
    const scope = scopeOf(key);
    setNode(key, { ...(prev ?? {}), loading: true });
    if (depth < 3) {
      const res = await apiAccountingMoveLines(token, spec, drill ? [] : selected, 0, 0, { ...scope, group_by: depth === 1 ? 'account' : 'partner' });
      setNode(key, { loading: false, subs: res.subgroups ?? [] });
    } else {
      const from = more && prev?.lines ? prev.lines.length : 0;
      const res = await apiAccountingMoveLines(token, spec, drill ? [] : selected, from, PAGE, scope);
      setNode(key, { loading: false, lines: [...(more && prev?.lines ? prev.lines : []), ...(res.lines ?? [])], count: res.count ?? 0 });
    }
  };
  const toggleNode = (key: string) => {
    if (expMap[key]) {
      // al plegar se pliegan también sus hijos
      setExpanded((e) => {
        const map = Object.fromEntries(Object.entries(e.qk === qk ? e.map : {}).filter(([k]) => k !== key && !k.startsWith(`${key}|`)));
        return { qk, map };
      });
    } else {
      void loadNode(key);
    }
  };

  /** Filas desplegadas bajo un nodo del árbol. */
  const renderNode = (key: string, level: number): ReactNode => {
    const node = expMap[key];
    if (!node) return null;
    if (node.loading && !node.subs && !node.lines) {
      return <tr className="ml-sub"><td colSpan={isDebt ? 11 : 9} style={{ paddingLeft: 11 + level * 22 }} className="muted">Cargando…</td></tr>;
    }
    if (node.subs) {
      return node.subs.map((sg) => {
        const child = `${key}|${level === 1 ? 'a' : 'p'}:${sg.id}`;
        return (
          <Fragment key={child}>
            <GroupRow level={level} label={sg.name} t={sg} open={!!expMap[child]} isDebt={isDebt} onClick={() => toggleNode(child)} />
            {renderNode(child, level + 1)}
          </Fragment>
        );
      });
    }
    const ls = node.lines ?? [];
    return (
      <>
        {ls.map((l) => <LineRow key={l.id} l={l} isDebt={isDebt} odoo={odoo} level={level} />)}
        {(node.loading || ls.length < (node.count ?? 0)) && (
          <tr className="ml-sub">
            <td colSpan={isDebt ? 11 : 9} style={{ paddingLeft: 11 + level * 22 }}>
              {node.loading ? <span className="muted">Cargando…</span> : (
                <button type="button" className="btn" onClick={() => void loadNode(key, true)}>
                  Cargar más ({ls.length.toLocaleString('es-ES')} de {(node.count ?? 0).toLocaleString('es-ES')})
                </button>
              )}
            </td>
          </tr>
        )}
      </>
    );
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

  const exportXlsx = async () => {
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
      const head = ['Compañía', 'Fecha', 'Asiento', 'Diario', 'Cuenta', 'Contacto', 'Etiqueta', 'Referencia', 'Vencimiento', 'Debe', 'Haber', 'Saldo', 'Pendiente', 'Estado'];
      const eur = (n: number) => ({ v: n, t: 'n' as const, z: '#,##0.00 "€"' });
      const rows = all.map((l) => [
        companyFull(l.company_id as number), l.date ? fD(l.date) : '', l.move, l.journal, l.account, l.partner, l.label, l.ref, l.date_maturity ? fD(l.date_maturity) : '',
        eur(l.debit), eur(l.credit), eur(l.balance), eur(l.residual), l.state === 'draft' ? 'Borrador' : 'Publicado',
      ]);
      await downloadXlsx(drill?.l ? `Apuntes ${drill.l}` : 'Apuntes contables', [head, ...rows]);
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
              <div className="card kpi"><div className="lbl">Apuntes <SaberMas id="m_kpis" /></div><div className="val">{count.toLocaleString('es-ES')}</div><div className="sub">{grouped ? 'despliega compañía → cuenta → contacto' : count > PAGE ? `se muestran de ${PAGE} en ${PAGE}` : 'todos en esta página'}</div></div>
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
                <h2>Apuntes contables <SaberMas id="m_tabla" /> <small>{!count ? 'sin resultados'
                  : grouped ? `${groups.length} ${groups.length === 1 ? 'compañía' : 'compañías'} · ${count.toLocaleString('es-ES')} apuntes`
                    : `${offset + 1}–${Math.min(offset + PAGE, count)} de ${count.toLocaleString('es-ES')}`}</small></h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="tg" style={{ '--c': 'var(--accent)' } as CSSProperties}>
                    <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
                    <span className="sw" />Agrupar por compañía, cuenta y contacto
                  </label>
                  <button type="button" className="btn" disabled={!count || exporting} onClick={exportXlsx}>{exporting ? 'Preparando…' : 'Descargar Excel'}</button>
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
                      const key = `c:${g.company_id}`;
                      return (
                        <Fragment key={key}>
                          <GroupRow level={0} label={companyFull(g.company_id)} t={g} open={!!expMap[key]} isDebt={isDebt} onClick={() => toggleNode(key)} />
                          {renderNode(key, 1)}
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

