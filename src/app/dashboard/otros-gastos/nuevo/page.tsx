'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  apiCreateMyExpense,
  apiMyExpenseOptions,
  ExpenseProductOption,
  ExpenseProjectOption,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import { formatCurrency } from '../utils';
import ExpenseLineRow, {
  DraftLine,
  draftLinesTotal,
  emptyLine,
  toNewExpenseLines,
  validateDraftLines,
} from '../ExpenseLineRow';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NuevoOtroGastoPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ExpenseProductOption[]>([]);
  const [projects, setProjects] = useState<ExpenseProjectOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [date, setDate] = useState(todayIso);
  const [lines, setLines] = useState<DraftLine[]>(() => [emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [companyId, setCompanyId] = useState<number | ''>('');

  // Solo obras de la compañía elegida (donde el usuario es responsable)
  const companyProjects = useMemo(
    () => (companyId ? projects.filter((p) => p.company_id === companyId) : []),
    [projects, companyId],
  );

  function onCompanyChange(value: string) {
    const next = value ? Number(value) : '';
    setCompanyId(next);
    // Las obras elegidas de otra compañía dejan de ser válidas
    setLines((prev) =>
      prev.map((l) =>
        l.project_id && projects.find((p) => p.id === l.project_id)?.company_id !== next ? { ...l, project_id: '' } : l,
      ),
    );
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiMyExpenseOptions(token)
      .then((res) => {
        if (res.success) {
          setPartnerName(res.partner_name || '');
          setCompanies(res.companies || []);
          setCompanyId(res.default_company_id || res.companies?.[0]?.id || '');
          setProducts(res.products || []);
          setProjects(res.projects || []);
        } else {
          setError(res.error || 'No se pudieron cargar los datos del formulario.');
        }
      })
      .catch(() => setError('Error de conexión.'))
      .finally(() => setLoadingOptions(false));
  }, []);

  const total = draftLinesTotal(lines, products);

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!companyId) {
      setError('Selecciona una compañía.');
      return;
    }
    const validationError = validateDraftLines(lines);
    if (validationError) {
      setError(validationError);
      return;
    }

    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await apiCreateMyExpense(
        token,
        date,
        companyId,
        toNewExpenseLines(lines),
      );
      if (res.success && res.expense) {
        router.push(`/dashboard/otros-gastos/${res.expense.id}`);
      } else {
        setError(res.error || 'No se pudo crear el gasto.');
        setSaving(false);
      }
    } catch {
      setError('Error de conexión al crear el gasto.');
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 text-slate-800">
      <Link href="/dashboard/otros-gastos" className="text-sm text-blue-700 hover:underline">
        ← Volver a otros gastos
      </Link>

      <form onSubmit={handleSubmit} className="mt-3 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-800">Nuevo gasto</h1>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Proveedor</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {partnerName || '—'}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Fecha</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-600">Compañía</label>
              <select
                required
                value={companyId}
                onChange={(e) => onCompanyChange(e.target.value)}
                disabled={loadingOptions}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 md:w-1/2"
              >
                <option value="">Seleccionar compañía...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {companyId && !loadingOptions && companyProjects.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">No eres responsable de ninguna obra de esta compañía.</p>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Obra</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-right">Precio unit.</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loadingOptions ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                    Cargando...
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <ExpenseLineRow
                    key={line.key}
                    line={line}
                    products={products}
                    projects={companyProjects}
                    onChange={(patch) => updateLine(line.key, patch)}
                    onRemove={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  />
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={5} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, emptyLine()])}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    + Agregar línea
                  </button>
                </td>
                <td className="px-3 py-2 text-right font-bold whitespace-nowrap">{formatCurrency(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Link
            href="/dashboard/otros-gastos"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving || loadingOptions}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
