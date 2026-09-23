'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiMyExpenseDetail, MyExpense } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { expenseStateBadge, formatCurrency, formatDay, formatNumber } from '../utils';

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{value || '—'}</span>
    </div>
  );
}

export default function OtroGastoDetallePage() {
  const params = useParams<{ id: string }>();
  const expenseId = Number(params.id);
  const validId = Number.isInteger(expenseId) && expenseId > 0;
  const [expense, setExpense] = useState<MyExpense | null>(null);
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState(validId ? '' : 'Gasto inválido.');

  useEffect(() => {
    const token = getToken();
    if (!token || !validId) return;
    apiMyExpenseDetail(token, expenseId)
      .then((res) => {
        if (res.success && res.expense) setExpense(res.expense);
        else setError(res.error || 'No se pudo cargar el gasto.');
      })
      .catch(() => setError('Error de conexión al cargar el gasto.'))
      .finally(() => setLoading(false));
  }, [expenseId, validId]);

  return (
    <div className="p-4 md:p-6 text-slate-800">
      <Link href="/dashboard/otros-gastos" className="text-sm text-blue-700 hover:underline">
        ← Volver a otros gastos
      </Link>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Cargando gasto...</p>
      ) : error || !expense ? (
        <p className="mt-6 text-sm text-red-600">{error || 'Gasto no encontrado.'}</p>
      ) : (
        <>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Otro gasto</p>
                <h1 className="text-2xl font-bold text-slate-800">{expense.name}</h1>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${expenseStateBadge(expense.state)}`}>
                {expense.state_label}
              </span>
            </div>
            <div className="mt-4 grid gap-x-8 md:grid-cols-2">
              <div>
                <Field label="Proveedor" value={expense.partner_name} />
                <Field label="Fecha" value={formatDay(expense.date)} />
              </div>
              <div>
                <Field label="Creado" value={expense.user_name} />
                <Field label="Compañía" value={expense.company_name} />
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2">Obra</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Precio unit.</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(expense.lines ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                      Sin líneas.
                    </td>
                  </tr>
                ) : (
                  (expense.lines ?? []).map((line) => (
                    <tr key={line.id} className="border-t border-slate-100 text-slate-700">
                      <td className="px-3 py-2">{line.product_name || '—'}</td>
                      <td className="px-3 py-2">{line.name}</td>
                      <td className="px-3 py-2">{line.project_name || '—'}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(line.qty)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatNumber(line.price_unit, 4)}</td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatCurrency(line.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-right text-slate-600">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(expense.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
