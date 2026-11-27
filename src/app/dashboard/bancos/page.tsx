'use client';

import { useEffect, useState } from 'react';
import { apiAccountingBanks, AccountingBanksResponse } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { CompanyFilter, Empty, Kpi, Panel, eur, formatDay, useCompanySelection } from '../components/AccountingUi';

const TYPE_LABEL: Record<string, string> = { bank: 'Banco', cash: 'Efectivo' };

export default function BancosPage() {
  const [selected, setSelected] = useCompanySelection();
  const [data, setData] = useState<AccountingBanksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [journalId, setJournalId] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    apiAccountingBanks(token, selected)
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

  const journals = data?.journals ?? [];
  const multiCompany = (data?.companies?.length ?? 0) > 1;
  const totBalance = journals.reduce((s, j) => s + j.balance, 0);
  const totStatement = journals.reduce((s, j) => s + (j.statement_balance ?? 0), 0);
  const totPendingCount = journals.reduce((s, j) => s + j.pending_count, 0);
  const totPendingAmount = journals.reduce((s, j) => s + j.pending_amount, 0);
  const totForecast = journals.reduce((s, j) => s + j.forecast_balance, 0);
  const current = journals.find((j) => j.id === journalId) ?? journals.find((j) => j.future_moves.length) ?? journals[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bancos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Saldo contable frente a extracto, partidas pendientes de conciliar y movimientos previstos por diario.
          </p>
        </div>
        {data?.companies && (
          <CompanyFilter companies={data.companies} selected={selected} onChange={changeCompanies} />
        )}
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-3">{error}</div>}

      {loading && !data ? (
        <div className="py-16 text-center text-gray-400 text-sm">Cargando…</div>
      ) : data?.success ? (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Saldo contable" value={eur(totBalance)} tone={totBalance >= 0 ? 'good' : 'bad'} />
            <Kpi label="Último estado de cuenta" value={eur(totStatement)} hint={`Diferencia ${eur(totBalance - totStatement)}`} />
            <Kpi label="Pendiente de conciliar" value={`${totPendingCount.toLocaleString('es-ES')} partidas`} hint={eur(totPendingAmount)} tone={totPendingCount > 0 ? 'warn' : 'neutral'} />
            <Kpi label="Saldo previsto" value={eur(totForecast)} hint="Con los pagos y cobros con fecha futura" tone={totForecast >= 0 ? 'good' : 'bad'} />
          </div>

          <Panel title="Saldo contable frente a último estado de cuenta" subtitle="La diferencia suele ser lo que está pendiente de conciliar">
            {journals.length === 0 ? <Empty text="No hay diarios de banco o caja." /> : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-y border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="px-5 py-2.5 text-left font-medium">Diario</th>
                      {multiCompany && <th className="px-3 py-2.5 text-left font-medium">Compañía</th>}
                      <th className="px-3 py-2.5 text-right font-medium">Saldo contable</th>
                      <th className="px-3 py-2.5 text-right font-medium">Último extracto</th>
                      <th className="px-3 py-2.5 text-right font-medium">Diferencia</th>
                      <th className="px-3 py-2.5 text-right font-medium">Pdte. conciliar</th>
                      <th className="px-5 py-2.5 text-right font-medium">Saldo previsto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {journals.map((j) => {
                      const diff = j.statement_balance === null ? null : j.balance - j.statement_balance;
                      return (
                        <tr key={j.id} onClick={() => setJournalId(j.id)} className={`cursor-pointer hover:bg-brand-50 ${current?.id === j.id ? 'bg-brand-50/60' : ''}`}>
                          <td className="px-5 py-2.5">
                            <div className="font-medium text-gray-800">{j.name}</div>
                            <div className="text-xs text-gray-400">{TYPE_LABEL[j.type] ?? j.type}{j.bank_account ? ` · ${j.bank_account}` : ''}</div>
                          </td>
                          {multiCompany && <td className="px-3 py-2.5 text-gray-600">{j.company}</td>}
                          <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${j.balance < 0 ? 'text-rose-700' : 'text-gray-900'}`}>{eur(j.balance, 2)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                            {j.statement_balance === null ? '—' : eur(j.statement_balance, 2)}
                            {j.statement_date && <div className="text-xs text-gray-400">{formatDay(j.statement_date)}</div>}
                          </td>
                          <td className={`px-3 py-2.5 text-right tabular-nums ${diff && Math.abs(diff) >= 0.01 ? 'text-amber-600' : 'text-gray-400'}`}>{diff === null ? '—' : eur(diff, 2)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {j.pending_count > 0 ? (
                              <>
                                <span className="inline-block bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">{j.pending_count}</span>
                                <div className="text-xs text-gray-400">{eur(j.pending_amount, 2)}</div>
                              </>
                            ) : <span className="text-gray-300">0</span>}
                          </td>
                          <td className={`px-5 py-2.5 text-right tabular-nums ${j.forecast_balance < 0 ? 'text-rose-700' : 'text-gray-700'}`}>{eur(j.forecast_balance, 2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {current && (
            <Panel
              title={`Previsión del diario · ${current.name}`}
              subtitle="Pagos y cobros con fecha posterior a hoy (pagarés, confirming, remesas…) y saldo resultante. Haz clic en un diario de la tabla para cambiar."
              right={<span className="text-xs text-gray-500 whitespace-nowrap">{current.future_moves.length} movimientos</span>}
            >
              {current.future_moves.length === 0 ? <Empty text="No hay movimientos previstos en este diario." /> : (
                <div className="overflow-x-auto -mx-5 max-h-[28rem] overflow-y-auto">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-y border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="px-5 py-2.5 text-left font-medium">Fecha</th>
                        <th className="px-3 py-2.5 text-left font-medium">Contacto</th>
                        <th className="px-3 py-2.5 text-left font-medium">Referencia</th>
                        <th className="px-3 py-2.5 text-right font-medium">Importe</th>
                        <th className="px-5 py-2.5 text-right font-medium">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr className="text-xs text-gray-500">
                        <td className="px-5 py-2" colSpan={4}>Saldo contable actual</td>
                        <td className="px-5 py-2 text-right tabular-nums font-medium text-gray-700">{eur(current.balance, 2)}</td>
                      </tr>
                      {current.future_moves.map((m, i) => (
                        <tr key={i}>
                          <td className="px-5 py-2 text-gray-600">{formatDay(m.date)}{m.draft && <span className="ml-1.5 text-[10px] uppercase text-gray-400">borrador</span>}</td>
                          <td className="px-3 py-2 text-gray-800 max-w-64 truncate" title={m.partner}>{m.partner || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-56 truncate" title={m.ref}>{m.ref}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${m.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{eur(m.amount, 2)}</td>
                          <td className={`px-5 py-2 text-right tabular-nums ${m.balance < 0 ? 'text-rose-700' : 'text-gray-700'}`}>{eur(m.balance, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </div>
      ) : null}
    </div>
  );
}
