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
import { formatCurrency, formatNumber } from '../utils';

interface DraftLine {
  key: number;
  product_id: number | '';
  project_id: number | '';
  name: string;
  qty: string;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let lineSeq = 0;
const emptyLine = (): DraftLine => ({ key: ++lineSeq, product_id: '', project_id: '', name: '', qty: '' });

function parseQty(value: string): number {
  const n = parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
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

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiMyExpenseOptions(token)
      .then((res) => {
        if (res.success) {
          setPartnerName(res.partner_name || '');
          setProducts(res.products || []);
          setProjects(res.projects || []);
        } else {
          setError(res.error || 'No se pudieron cargar los datos del formulario.');
        }
      })
      .catch(() => setError('Error de conexión.'))
      .finally(() => setLoadingOptions(false));
  }, []);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const total = lines.reduce((sum, l) => {
    const product = l.product_id ? productById.get(l.product_id) : undefined;
    return sum + (product ? product.price_unit * parseQty(l.qty) : 0);
  }, 0);

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onProductChange(line: DraftLine, value: string) {
    const productId = value ? Number(value) : '';
    const previous = line.product_id ? productById.get(line.product_id) : undefined;
    const next = productId ? productById.get(productId) : undefined;
    // Si la descripción no se ha tocado, se rellena con el nombre del producto
    const keepName = line.name && line.name !== previous?.name;
    updateLine(line.key, { product_id: productId, name: keepName ? line.name : next?.name ?? '' });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (lines.length === 0) {
      setError('Añade al menos una línea.');
      return;
    }
    for (const [i, l] of lines.entries()) {
      if (!l.product_id || !l.project_id || parseQty(l.qty) <= 0) {
        setError(`Línea ${i + 1}: completa producto, obra y una cantidad mayor que 0.`);
        return;
      }
    }
    const companies = new Set(lines.map((l) => projectById.get(l.project_id as number)?.company_id));
    if (companies.size > 1) {
      setError('Todas las obras del gasto deben ser de la misma compañía.');
      return;
    }

    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await apiCreateMyExpense(
        token,
        date,
        lines.map((l) => ({
          product_id: l.product_id as number,
          project_id: l.project_id as number,
          name: l.name.trim(),
          qty: parseQty(l.qty),
        })),
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
                lines.map((line) => {
                  const product = line.product_id ? productById.get(line.product_id) : undefined;
                  const qty = parseQty(line.qty);
                  return (
                    <tr key={line.key} className="border-t border-slate-100 align-top">
                      <td className="px-2 py-2">
                        <select
                          value={line.product_id}
                          onChange={(e) => onProductChange(line, e.target.value)}
                          className="w-56 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
                        >
                          <option value="">Seleccionar...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.display_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={line.name}
                          onChange={(e) => updateLine(line.key, { name: e.target.value })}
                          placeholder="Ej.: KMS MALVARROSA 25/AGO"
                          className="w-64 rounded border border-slate-300 px-2 py-1.5 text-sm outline-none placeholder:text-slate-400"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={line.project_id}
                          onChange={(e) => updateLine(line.key, { project_id: e.target.value ? Number(e.target.value) : '' })}
                          className="w-72 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
                        >
                          <option value="">Seleccionar obra...</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.display_name}
                              {p.state_name ? ` (${p.state_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.qty}
                          onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                          placeholder="0"
                          className="w-24 rounded border border-slate-300 px-2 py-1.5 text-right text-sm outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600">
                        {product ? formatNumber(product.price_unit, 4) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                        {product ? formatCurrency(product.price_unit * qty) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                          className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Eliminar línea"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
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
