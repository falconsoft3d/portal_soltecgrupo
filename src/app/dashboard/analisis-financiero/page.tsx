'use client';

import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { apiAccountingAnalysis, AccountingAnalysisResponse } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { afCalc, Triple } from '@/lib/financialAnalysis';
import { useCompanySelection } from '../components/AccountingUi';
import Shell from '../components/cuadro/Shell';
import { e0 } from '../components/cuadro/lib';
import {
  BalanceTab, CuentasTab, ExplotacionTab, GraficosTab, MasasTab, OriAplTab, Ratios1Tab, Ratios2Tab, ResumenTab,
  UmbralTab, ValorAnadidoTab,
} from './sections';

const TABS = [
  ['balance', 'Balance'], ['explotacion', 'Explotación'], ['masas', 'Masas patrimoniales'], ['resumen', 'Resumen'],
  ['ratios1', 'Ratios 1'], ['ratios2', 'Ratios 2'], ['oriapl', 'Orígenes y aplicaciones'], ['va', 'Valor añadido'],
  ['umbral', 'Umbral de rentabilidad'], ['graficos', 'Gráficos'], ['cuentas', 'Cuentas y cuadre'],
] as const;
type TabKey = (typeof TABS)[number][0];

const TAB_KEY = 'portal_af_tab_v1';
const EMP_KEY = 'portal_af_employees_v1';
const DRAFT_KEY = 'portal_af_include_draft_v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
}
const pad = (n: number) => String(n).padStart(2, '0');

export default function AnalisisFinancieroPage() {
  const [selected, setSelected] = useCompanySelection();
  const [endYear, setEndYear] = useState<number | undefined>(undefined);
  const [data, setData] = useState<AccountingAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTabState] = useState<TabKey>(() => {
    const t = readJson<string>(TAB_KEY, 'balance');
    return (TABS.some(([k]) => k === t) ? t : 'balance') as TabKey;
  });
  // Asientos en borrador: incluidos por defecto, se pueden desactivar
  const [includeDraft, setIncludeDraft] = useState<boolean>(() => readJson<boolean>(DRAFT_KEY, true) !== false);
  const [employeesStore, setEmployeesStore] = useState<Record<string, number>>(() => readJson(EMP_KEY, {}));
  const setTab = (t: TabKey) => { setTabState(t); writeJson(TAB_KEY, t); };

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    apiAccountingAnalysis(token, selected, endYear, includeDraft)
      .then((res) => {
        if (cancelled) return;
        if (res.success) { setData(res); setError(''); }
        else { setError(res.error || 'No se pudieron cargar los datos.'); setData(res.companies ? res : null); }
      })
      .catch(() => { if (!cancelled) setError('Error de conexión.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected, endYear, includeDraft]);

  const changeCompanies = (ids: number[]) => { setLoading(true); setSelected(ids); };
  const changeYear = (y: number) => { setLoading(true); setEndYear(y); };
  const toggleDraft = () => { setLoading(true); setIncludeDraft((v) => { writeJson(DRAFT_KEY, !v); return !v; }); };

  // Nº de empleados por compañías + año (no está en la contabilidad)
  const companyKey = (data?.selected_company_ids ?? []).slice().sort((a, b) => a - b).join('-');
  const employees: Triple = useMemo(() => {
    const years = data?.years ?? [];
    return [0, 1, 2].map((i) => {
      const stored = employeesStore[`${companyKey}|${years[i]}`];
      if (stored === undefined && i === 2) return data?.employees_now ?? 0;
      return stored ?? 0;
    }) as Triple;
  }, [data, employeesStore, companyKey]);
  const setEmployees = (i: number, v: number) => {
    const y = data?.years?.[i];
    if (y === undefined) return;
    const next = { ...employeesStore, [`${companyKey}|${y}`]: v };
    setEmployeesStore(next);
    writeJson(EMP_KEY, next);
  };

  const r = useMemo(() => {
    if (!data?.success || !data.years || !data.values) return null;
    return afCalc(data.years, data.days ?? [365, 365, 365], { ...data.values, empleados: employees });
  }, [data, employees]);

  const companies = data?.companies ?? [];
  const sel = data?.selected_company_ids ?? [];
  const compLabel = sel.length > 1
    ? `Grupo (suma de ${sel.length === companies.length ? 'todas las' : 'las'} ${sel.length} compañías)`
    : companies.find((c) => c.id === sel[0])?.name ?? '';
  const vacio = r ? r.y.map((_, i) => r.D[i] === 0 && r.prod[i] === 0) : [];

  return (
    <Shell today={data?.today} companies={data?.companies} selected={selected} onCompanies={changeCompanies} loading={loading && !!data} error={error}
      extraControls={
        <label className="tg" style={{ '--c': 'var(--accent)' } as CSSProperties} title="Si está activo, el análisis también suma los asientos contables en borrador">
          <input type="checkbox" checked={includeDraft} onChange={toggleDraft} />
          <span className="sw" />Incluir asientos en borrador
        </label>
      }>
      {loading && !data ? <div className="empty">Calculando…</div> : r && data && (
        <section className="panel">
          <div className="card" style={{ gap: 10 }}>
            <div className="afhead">
              <div>
                <h2 style={{ margin: 0 }}>Análisis económico-financiero · {compLabel}</h2>
                <div className="afstatus">Calculado desde la contabilidad de Odoo (cuentas del PGC){includeDraft ? ', con asientos publicados y en borrador' : ', solo con asientos publicados'}. Solo lectura.</div>
              </div>
              {data.available_years && (
                <label className="afstatus" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  Último ejercicio
                  <select className="afyear" style={{ width: 'auto' }} value={r.y[2]} onChange={(e) => changeYear(Number(e.target.value))}>
                    {data.available_years.map((y) => <option key={y} value={y}>{y}{data.today?.startsWith(String(y)) ? ' (en curso)' : ''}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="afchecks">
              {r.y.map((y, i) => !vacio[i] && (
                <span key={y} style={{ display: 'contents' }}>
                  <span className={`afchk ${Math.abs(r.chkBal[i]) < 1 ? 'ok' : 'bad'}`}>{y} · activo y pasivo {Math.abs(r.chkBal[i]) < 1 ? 'cuadran' : `NO cuadran (${e0(r.chkBal[i])})`}</span>
                  <span className={`afchk ${Math.abs(r.chkRes[i]) < 1 ? 'ok' : 'bad'}`}>{y} · resultado {Math.abs(r.chkRes[i]) < 1 ? 'cuadra' : `NO cuadra (${e0(r.chkRes[i])})`}</span>
                </span>
              ))}
            </div>
            <div className="subtabs" role="tablist">
              {TABS.map(([k, l], j) => (
                <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>
                  <span className="n">{pad(j + 1)}</span>{l}
                  {k === 'cuentas' && (data.unmapped?.length ?? 0) > 0 && ` (${data.unmapped!.length})`}
                </button>
              ))}
            </div>
          </div>

          {data.partial_last_year && (
            <div className="afbanner"><span className="sp"><b>Ejercicio en curso.</b> {r.y[2]} va del 1 de enero a hoy ({data.days![2]} días) y los ratios usan esos días.</span></div>
          )}
          {sel.length > 1 && (
            <div className="afbanner"><span className="sp"><b>Vista de grupo.</b> Suma simple de las compañías seleccionadas, sin eliminar operaciones entre ellas.</span></div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {vacio.every(Boolean) ? (
              <div className="card afempty">No hay apuntes contables en estos ejercicios para las compañías seleccionadas.</div>
            ) : (
              <>
                {tab === 'balance' && <BalanceTab r={r} />}
                {tab === 'explotacion' && <ExplotacionTab r={r} employees={employees} onEmployees={setEmployees} />}
                {tab === 'masas' && <MasasTab r={r} />}
                {tab === 'resumen' && <ResumenTab r={r} />}
                {tab === 'ratios1' && <Ratios1Tab r={r} />}
                {tab === 'ratios2' && <Ratios2Tab r={r} />}
                {tab === 'oriapl' && <OriAplTab r={r} />}
                {tab === 'va' && <ValorAnadidoTab r={r} />}
                {tab === 'umbral' && <UmbralTab r={r} />}
                {tab === 'graficos' && <GraficosTab r={r} />}
                {tab === 'cuentas' && <CuentasTab r={r} unmapped={data.unmapped ?? []} />}
              </>
            )}
          </div>
        </section>
      )}
    </Shell>
  );
}
