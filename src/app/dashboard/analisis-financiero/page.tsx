'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiAccountingAnalysis, AccountingAnalysisResponse } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { afCalc, Triple } from '@/lib/financialAnalysis';
import { CompanyFilter, useCompanySelection } from '../components/AccountingUi';
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
  // Nº de empleados por compañías + año (no está en la contabilidad)
  const [employeesStore, setEmployeesStore] = useState<Record<string, number>>(() => readJson(EMP_KEY, {}));

  const setTab = (t: TabKey) => { setTabState(t); writeJson(TAB_KEY, t); };

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    apiAccountingAnalysis(token, selected, endYear)
      .then((res) => {
        if (cancelled) return;
        if (res.success) { setData(res); setError(''); }
        else { setError(res.error || 'No se pudieron cargar los datos.'); setData(res.companies ? res : null); }
      })
      .catch(() => { if (!cancelled) setError('Error de conexión.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected, endYear]);

  const changeCompanies = (ids: number[]) => { setLoading(true); setSelected(ids); };
  const changeYear = (y: number) => { setLoading(true); setEndYear(y); };

  const companyKey = (data?.selected_company_ids ?? []).slice().sort((a, b) => a - b).join('-');
  const empKey = (year: number) => `${companyKey}|${year}`;
  const employees: Triple = useMemo(() => {
    const years = data?.years ?? [];
    return [0, 1, 2].map((i) => {
      const stored = employeesStore[`${companyKey}|${years[i]}`];
      // Sin dato guardado, el año en curso o el último toma la plantilla actual de Odoo
      if (stored === undefined && i === 2) return data?.employees_now ?? 0;
      return stored ?? 0;
    }) as Triple;
  }, [data, employeesStore, companyKey]);

  const setEmployees = (i: number, v: number) => {
    const y = data?.years?.[i];
    if (y === undefined) return;
    const next = { ...employeesStore, [empKey(y)]: v };
    setEmployeesStore(next);
    writeJson(EMP_KEY, next);
  };

  const r = useMemo(() => {
    if (!data?.success || !data.years || !data.values) return null;
    return afCalc(data.years, data.days ?? [365, 365, 365], { ...data.values, empleados: employees });
  }, [data, employees]);

  const unbalanced = r ? r.chkBal.some((v) => Math.abs(v) > 1) || r.chkRes.some((v) => Math.abs(v) > 1) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análisis económico-financiero</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Balance, explotación, ratios y umbral de rentabilidad de tres ejercicios, calculados desde la contabilidad de Odoo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data?.available_years && data.years && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Último ejercicio
              <select
                value={data.years[2]}
                onChange={(e) => changeYear(Number(e.target.value))}
                className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {data.available_years.map((y) => <option key={y} value={y}>{y}{y === new Date().getFullYear() ? ' (en curso)' : ''}</option>)}
              </select>
            </label>
          )}
          {data?.companies && <CompanyFilter companies={data.companies} selected={selected} onChange={changeCompanies} />}
        </div>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-3">{error}</div>}

      {loading && !data ? (
        <div className="py-16 text-center text-gray-400 text-sm">Calculando…</div>
      ) : r && data ? (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {data.partial_last_year && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-sm px-4 py-3">
              {data.years![2]} está en curso: sus cifras van del 1 de enero a hoy ({data.days![2]} días) y los ratios usan esos días.
            </div>
          )}
          {unbalanced && (
            <button type="button" onClick={() => setTab('cuentas')} className="w-full text-left rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-3">
              Hay descuadres entre balance y explotación. Revisa la pestaña «Cuentas y cuadre».
            </button>
          )}

          <nav className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
            {TABS.map(([k, label]) => (
              <button
                key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`whitespace-nowrap text-sm px-3.5 py-2 rounded-xl transition-colors ${tab === k ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50'}`}
              >
                {label}
                {k === 'cuentas' && (data.unmapped?.length ?? 0) > 0 && (
                  <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 ${tab === k ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>{data.unmapped!.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="space-y-6">
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
