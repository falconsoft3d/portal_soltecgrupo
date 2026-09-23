'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiProjects, apiPurchases, PortalProject, PurchaseItem } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { formatCurrency, formatDate, purchaseStateBadge, receiptStatusBadge } from './utils';

const STATE_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'draft', label: 'Petición presupuesto' },
  { value: 'sent', label: 'Petición enviada' },
  { value: 'to approve', label: 'Para aprobar' },
  { value: 'purchase', label: 'Pedido de compra' },
  { value: 'done', label: 'Bloqueado' },
  { value: 'cancel', label: 'Cancelado' },
];

export default function ComprasPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [projectId, setProjectId] = useState<number | 'all'>('all');
  const [state, setState] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PurchaseItem[]>([]);
  const [totals, setTotals] = useState({ records: 0, untaxed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Solo obras donde el usuario es responsable de ejecución
  const managedProjects = useMemo(() => projects.filter((p) => p.is_manager), [projects]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiProjects(token).then((res) => {
      if (res.success) setProjects(res.projects || []);
    });
  }, []);

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
    apiPurchases(token, projectId, state, search || undefined)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setError('');
          setRows(res.purchases || []);
          setTotals({
            records: res.total_records ?? 0,
            untaxed: res.total_untaxed ?? 0,
            total: res.total_amount ?? 0,
          });
        } else {
          setRows([]);
          setError(res.error || 'No se pudieron cargar las compras.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Error de conexión al cargar las compras.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, state, search]);

  return (
    <div className="p-4 md:p-6 text-slate-800">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Compras</h1>
            <p className="text-xs text-slate-500">Pedidos de compra de las obras donde eres responsable de ejecución.</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{totals.records}</span> registros · Base{' '}
            <span className="font-semibold text-slate-700">{formatCurrency(totals.untaxed)}</span> · Total{' '}
            <span className="font-semibold text-slate-700">{formatCurrency(totals.total)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por referencia, proveedor o ref. proveedor..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
          />
          <select
            value={projectId}
            onChange={(e) => {
              setLoading(true);
              setProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value));
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none md:w-80"
          >
            <option value="all">Todas mis obras</option>
            {managedProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
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
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Referencia</th>
              <th className="px-3 py-2">Proveedor</th>
              <th className="px-3 py-2">Proyecto</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Comprador</th>
              <th className="px-3 py-2">Estado entrega</th>
              <th className="px-3 py-2 text-right">Base imponible</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  Cargando compras...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  No hay compras para el filtro actual.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/dashboard/compras/${row.id}`)}
                  className="cursor-pointer border-t border-slate-100 text-slate-700 hover:bg-blue-50/50"
                >
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{row.name}</td>
                  <td className="px-3 py-2">{row.partner_name || '—'}</td>
                  <td className="px-3 py-2">{row.project_name || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.date_order)}</td>
                  <td className="px-3 py-2">{row.user_name || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.receipt_status_label ? (
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${receiptStatusBadge(row.receipt_status)}`}>
                        {row.receipt_status_label}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(row.amount_untaxed)}</td>
                  <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatCurrency(row.amount_total)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${purchaseStateBadge(row.state)}`}>
                      {row.state_label}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
