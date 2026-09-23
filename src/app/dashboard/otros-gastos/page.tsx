'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiMyExpenses, MyExpense } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { dayMonthKey, expenseStateBadge, formatCurrency, formatDay, monthLabel } from './utils';

const STATE_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'draft', label: 'Borrador' },
  { value: 'done', label: 'Hecho' },
  { value: 'cancel', label: 'Cancelado' },
];

export default function OtrosGastosPage() {
  const router = useRouter();
  const [state, setState] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<MyExpense[]>([]);
  const [totals, setTotals] = useState({ records: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupByMonth, setGroupByMonth] = useState(true);
  // Los meses arrancan plegados; se despliegan al hacer clic
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; rows: MyExpense[]; total: number }>();
    for (const row of rows) {
      const key = dayMonthKey(row.date);
      let group = map.get(key);
      if (!group) {
        group = { key, rows: [], total: 0 };
        map.set(key, group);
      }
      group.rows.push(row);
      group.total += row.total;
    }
    return [...map.values()];
  }, [rows]);

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const renderRow = (row: MyExpense) => (
    <tr
      key={row.id}
      onClick={() => router.push(`/dashboard/otros-gastos/${row.id}`)}
      className="cursor-pointer border-t border-slate-100 text-slate-700 hover:bg-blue-50/50"
    >
      <td className="px-3 py-2 font-semibold whitespace-nowrap">{row.name}</td>
      <td className="px-3 py-2 whitespace-nowrap">{formatDay(row.date)}</td>
      <td className="px-3 py-2">{row.company_name || '—'}</td>
      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatCurrency(row.total)}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={`rounded-full border px-2 py-0.5 text-xs ${expenseStateBadge(row.state)}`}>
          {row.state_label}
        </span>
      </td>
    </tr>
  );

  // Debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setLoading(true);
      setSearch(next);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    apiMyExpenses(token, state, search || undefined)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setError('');
          setRows(res.expenses || []);
          setTotals({ records: res.total_records ?? 0, total: res.total_amount ?? 0 });
        } else {
          setRows([]);
          setError(res.error || 'No se pudieron cargar los gastos.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Error de conexión al cargar los gastos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state, search]);

  return (
    <div className="p-4 md:p-6 text-slate-800">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Otros Gastos</h1>
            <p className="text-xs text-slate-500">Gastos en los que figuras como proveedor.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{totals.records}</span> registros · Total{' '}
              <span className="font-semibold text-slate-700">{formatCurrency(totals.total)}</span>
            </div>
            <Link
              href="/dashboard/otros-gastos/nuevo"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Nuevo
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por código, descripción u obra..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
          />
          <select
            value={state}
            onChange={(e) => {
              setLoading(true);
              setState(e.target.value);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none md:w-56"
          >
            {STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setGroupByMonth((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-sm whitespace-nowrap ${
              groupByMonth
                ? 'border-blue-300 bg-blue-50 font-semibold text-blue-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Agrupar por mes
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Compañía</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Cargando gastos...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  No hay gastos para el filtro actual.
                </td>
              </tr>
            ) : (
              groupByMonth ? (
                groups.map((group) => {
                  const isOpen = expanded.has(group.key);
                  return (
                    <Fragment key={group.key}>
                      <tr
                        onClick={() => toggleGroup(group.key)}
                        className="cursor-pointer border-t border-slate-200 bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200/70"
                      >
                        <td colSpan={3} className="px-3 py-2">
                          <span className="mr-2 inline-block w-3 text-slate-500">{isOpen ? '▾' : '▸'}</span>
                          {monthLabel(group.key)}
                          <span className="ml-2 text-xs font-normal text-slate-500">({group.rows.length})</span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(group.total)}</td>
                        <td className="px-3 py-2" />
                      </tr>
                      {isOpen && group.rows.map(renderRow)}
                    </Fragment>
                  );
                })
              ) : (
                rows.map(renderRow)
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
