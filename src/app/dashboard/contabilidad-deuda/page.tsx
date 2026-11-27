'use client';

import { useEffect, useState } from 'react';
import { apiAccountingOverview, AccountingAging, AccountingOverviewResponse } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  CompanyFilter, Empty, HBarList, Kpi, MonthlyBars, Panel, StackedBar, eur, useCompanySelection,
} from '../components/AccountingUi';

const TYPE_LABEL: Record<string, string> = { bank: 'Banco', cash: 'Efectivo' };

function agingSegments(a: AccountingAging) {
  return [
    { label: 'Al día', value: a.current, color: 'bg-emerald-500' },
    { label: '1–30 días', value: a.d30, color: 'bg-amber-300' },
    { label: '31–60 días', value: a.d60, color: 'bg-amber-500' },
    { label: '61–90 días', value: a.d90, color: 'bg-orange-500' },
    { label: '+90 días', value: a.d90p, color: 'bg-rose-600' },
  ];
}

export default function ContabilidadDeudaPage() {
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

  const debt = data?.debt;
  const treasuryRows = (data?.treasury ?? [])
    .filter((t) => t.balance !== 0)
    .map((t) => ({ name: `${t.name} · ${TYPE_LABEL[t.type] ?? t.type}${(data?.companies?.length ?? 0) > 1 ? ` · ${t.company}` : ''}`, amount: t.balance }))
    .sort((a, b) => b.amount - a.amount);
  const last12 = (data?.monthly ?? []).slice(-12);
  const in12 = last12.reduce((s, m) => s + m.in, 0);
  const out12 = last12.reduce((s, m) => s + m.out, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contabilidad y deuda</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Deuda de clientes y proveedores, tesorería y cobros y pagos registrados en Odoo.
          </p>
        </div>
        {data?.companies && (
          <CompanyFilter companies={data.companies} selected={selected} onChange={changeCompanies} />
        )}
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-3">{error}</div>}

      {loading && !data ? (
        <div className="py-16 text-center text-gray-400 text-sm">Cargando…</div>
      ) : data?.success && debt ? (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Tesorería (bancos y caja)" value={eur(data.treasury_total)} tone={(data.treasury_total ?? 0) >= 0 ? 'good' : 'bad'} />
            <Kpi label="Clientes pendiente de cobro" value={eur(debt.customers.total)} hint={`Atrasado ${eur(debt.customers.overdue)}`} tone={debt.customers.overdue > 0 ? 'warn' : 'neutral'} />
            <Kpi label="Proveedores pendiente de pago" value={eur(debt.suppliers.total)} hint={`Atrasado ${eur(debt.suppliers.overdue)}`} tone={debt.suppliers.overdue > 0 ? 'warn' : 'neutral'} />
            <Kpi label="Neto cobros − pagos (12 meses)" value={eur(in12 - out12)} hint={`Cobros ${eur(in12)} · Pagos ${eur(out12)}`} tone={in12 - out12 >= 0 ? 'good' : 'bad'} />
          </div>

          {/* Deuda */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="Deuda de clientes" subtitle="Pendiente de cobro: al día frente a atrasado, por antigüedad del vencimiento">
              <StackedBar segments={agingSegments(debt.customers)} />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">Clientes con más deuda vencida</h3>
              <HBarList rows={data.overdue_customers ?? []} color="bg-amber-500" />
            </Panel>
            <Panel title="Deuda con proveedores" subtitle="Pendiente de pago: al día frente a atrasado, por antigüedad del vencimiento">
              <StackedBar segments={agingSegments(debt.suppliers)} />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">Proveedores con más deuda vencida</h3>
              <HBarList rows={data.overdue_suppliers ?? []} color="bg-amber-500" />
            </Panel>
          </div>

          {/* Tesorería + histórico */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Panel title="Dónde está la tesorería" subtitle="Saldo contable por diario de banco y caja">
              {treasuryRows.length ? <HBarList rows={treasuryRows} color="bg-brand-500" /> : <Empty />}
            </Panel>
            <Panel title="Cobros y pagos registrados por mes" subtitle="Últimos 24 meses · pagos publicados en Odoo" className="xl:col-span-2">
              <MonthlyBars data={data.monthly ?? []} />
            </Panel>
          </div>

          {/* Tops */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="Top 10 clientes" subtitle="Importe cobrado en los últimos 12 meses">
              <HBarList rows={data.top_customers ?? []} color="bg-emerald-500" />
            </Panel>
            <Panel title="Top 10 proveedores" subtitle="Importe pagado en los últimos 12 meses">
              <HBarList rows={data.top_suppliers ?? []} color="bg-rose-400" />
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel title="Cómo cobramos" subtitle="Por método de pago · 12 meses">
              <HBarList rows={data.methods_in ?? []} color="bg-emerald-500" />
            </Panel>
            <Panel title="Cómo pagamos" subtitle="Por método de pago · 12 meses">
              <HBarList rows={data.methods_out ?? []} color="bg-rose-400" />
            </Panel>
            <Panel title="Proyectos con más cobros" subtitle="Cobros con proyecto asignado · 12 meses">
              <HBarList rows={data.top_projects ?? []} color="bg-brand-500" />
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
