'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  apiAddMyExpenseLines,
  apiDeleteMyExpense,
  apiMyExpenseDetail,
  apiMyExpenseOptions,
  apiSetMyExpenseState,
  apiUpdateMyExpense,
  ExpenseProductOption,
  ExpenseProjectOption,
  MyExpense,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import { expenseStateBadge, formatCurrency, formatDay, formatNumber } from '../utils';
import ExpenseLineRow, {
  DraftLine,
  draftLinesTotal,
  emptyLine,
  toNewExpenseLines,
  validateDraftLines,
} from '../ExpenseLineRow';

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{value || '—'}</span>
    </div>
  );
}

export default function OtroGastoDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const expenseId = Number(params.id);
  const validId = Number.isInteger(expenseId) && expenseId > 0;
  const [expense, setExpense] = useState<MyExpense | null>(null);
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState(validId ? '' : 'Gasto inválido.');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  // Líneas nuevas que se añaden al gasto ya guardado
  const [products, setProducts] = useState<ExpenseProductOption[]>([]);
  const [projects, setProjects] = useState<ExpenseProjectOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [newLines, setNewLines] = useState<DraftLine[]>([]);
  const [linesError, setLinesError] = useState('');
  const [savingLines, setSavingLines] = useState(false);

  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  // Edición de cabecera (solo en borrador)
  const [editDate, setEditDate] = useState('');
  const [editCompanyId, setEditCompanyId] = useState<number | ''>('');
  const [savingHeader, setSavingHeader] = useState(false);

  function resetHeaderForm(exp: MyExpense) {
    setEditDate(exp.date || '');
    setEditCompanyId(exp.company_id || '');
  }

  async function loadOptions(onError: (msg: string) => void) {
    if (optionsLoaded) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await apiMyExpenseOptions(token);
      if (res.success) {
        setProducts(res.products || []);
        setProjects(res.projects || []);
        setCompanies(res.companies || []);
        setOptionsLoaded(true);
      } else {
        onError(res.error || 'No se pudieron cargar productos, obras y compañías.');
      }
    } catch {
      onError('Error de conexión al cargar productos, obras y compañías.');
    }
  }

  async function addLine() {
    setNewLines((prev) => [...prev, emptyLine()]);
    await loadOptions(setLinesError);
  }

  const isDraft = expense?.state === 'draft';

  // En borrador hacen falta las compañías para poder cambiarla
  useEffect(() => {
    if (!isDraft || optionsLoaded) return;
    const token = getToken();
    if (!token) return;
    apiMyExpenseOptions(token)
      .then((res) => {
        if (res.success) {
          setProducts(res.products || []);
          setProjects(res.projects || []);
          setCompanies(res.companies || []);
          setOptionsLoaded(true);
        }
      })
      .catch(() => setActionError('Error de conexión al cargar las compañías.'));
  }, [isDraft, optionsLoaded]);
  const headerDirty =
    !!expense && (editDate !== (expense.date || '') || editCompanyId !== (expense.company_id || ''));

  async function saveHeader() {
    const token = getToken();
    if (!token || !expense || !headerDirty) return;
    if (!editDate) {
      setActionError('Indica una fecha.');
      return;
    }
    setSavingHeader(true);
    setActionError('');
    try {
      const res = await apiUpdateMyExpense(token, expense.id, {
        date: editDate,
        company_id: editCompanyId || undefined,
      });
      if (res.success && res.expense) {
        setExpense(res.expense);
        resetHeaderForm(res.expense);
      } else {
        setActionError(res.error || 'No se pudo guardar el gasto.');
      }
    } catch {
      setActionError('Error de conexión al guardar el gasto.');
    } finally {
      setSavingHeader(false);
    }
  }

  function updateNewLine(key: number, patch: Partial<DraftLine>) {
    setNewLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function saveNewLines() {
    const token = getToken();
    if (!token || !expense) return;
    const validationError = validateDraftLines(newLines);
    if (validationError) {
      setLinesError(validationError);
      return;
    }
    setSavingLines(true);
    setLinesError('');
    try {
      const res = await apiAddMyExpenseLines(token, expense.id, toNewExpenseLines(newLines));
      if (res.success && res.expense) {
        setExpense(res.expense);
        setNewLines([]);
      } else {
        setLinesError(res.error || 'No se pudieron guardar las líneas.');
      }
    } catch {
      setLinesError('Error de conexión al guardar las líneas.');
    } finally {
      setSavingLines(false);
    }
  }

  async function changeState(state: 'draft' | 'done') {
    const token = getToken();
    if (!token || !expense) return;
    setBusy(true);
    setActionError('');
    try {
      const res = await apiSetMyExpenseState(token, expense.id, state);
      if (res.success && res.expense) {
        setExpense(res.expense);
        resetHeaderForm(res.expense);
      } else setActionError(res.error || 'No se pudo cambiar el estado.');
    } catch {
      setActionError('Error de conexión al cambiar el estado.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const token = getToken();
    if (!token || !expense) return;
    if (!window.confirm(`¿Eliminar el gasto ${expense.name}? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    setActionError('');
    try {
      const res = await apiDeleteMyExpense(token, expense.id);
      if (res.success) {
        router.push('/dashboard/otros-gastos');
        return;
      }
      setActionError(res.error || 'No se pudo eliminar el gasto.');
    } catch {
      setActionError('Error de conexión al eliminar el gasto.');
    }
    setBusy(false);
  }

  useEffect(() => {
    const token = getToken();
    if (!token || !validId) return;
    apiMyExpenseDetail(token, expenseId)
      .then((res) => {
        if (res.success && res.expense) {
          setExpense(res.expense);
          resetHeaderForm(res.expense);
        } else setError(res.error || 'No se pudo cargar el gasto.');
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
          {/* Barra de acciones, como el header del formulario de Odoo */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {expense.state === 'draft' && (
                <>
                  <button
                    type="button"
                    disabled={busy || headerDirty}
                    title={headerDirty ? 'Guarda o descarta los cambios de fecha/compañía primero' : undefined}
                    onClick={() => changeState('done')}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                  >
                    Pasar a Hecho
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleDelete}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </>
              )}
              {expense.state === 'done' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeState('draft')}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  Pasar a Borrador
                </button>
              )}
            </div>
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
              {[
                { value: 'draft', label: 'Borrador' },
                { value: 'done', label: 'Hecho' },
              ].map((step) => (
                <span
                  key={step.value}
                  className={`px-3 py-1.5 ${
                    expense.state === step.value ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
          {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}

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
                {isDraft ? (
                  <Field
                    label="Fecha"
                    value={
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        disabled={savingHeader}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-400"
                      />
                    }
                  />
                ) : (
                  <Field label="Fecha" value={formatDay(expense.date)} />
                )}
              </div>
              <div>
                <Field label="Creado" value={expense.user_name} />
                {isDraft ? (
                  <Field
                    label="Compañía"
                    value={
                      <select
                        value={editCompanyId}
                        onChange={(e) => setEditCompanyId(e.target.value ? Number(e.target.value) : '')}
                        disabled={savingHeader}
                        className="w-full max-w-sm rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-400"
                      >
                        {!companies.some((c) => c.id === expense.company_id) && (
                          <option value={expense.company_id}>{expense.company_name}</option>
                        )}
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    }
                  />
                ) : (
                  <Field label="Compañía" value={expense.company_name} />
                )}
              </div>
            </div>
            {isDraft && headerDirty && (
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => resetHeaderForm(expense)}
                  disabled={savingHeader}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={saveHeader}
                  disabled={savingHeader}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingHeader ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}
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

          {expense.state !== 'cancel' && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              {newLines.length > 0 && (
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Producto (nueva línea)</th>
                      <th className="px-3 py-2">Descripción</th>
                      <th className="px-3 py-2">Obra</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">Precio unit.</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {newLines.map((line) => (
                      <ExpenseLineRow
                        key={line.key}
                        line={line}
                        products={products}
                        projects={projects.filter((p) => p.company_id === expense.company_id)}
                        onChange={(patch) => updateNewLine(line.key, patch)}
                        onRemove={() => setNewLines((prev) => prev.filter((l) => l.key !== line.key))}
                      />
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2">
                <button
                  type="button"
                  onClick={addLine}
                  disabled={savingLines}
                  className="text-sm font-medium text-blue-700 hover:underline disabled:opacity-50"
                >
                  + Agregar línea
                </button>
                {newLines.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">
                      Nuevas: <span className="font-semibold">{formatCurrency(draftLinesTotal(newLines, products))}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewLines([]);
                        setLinesError('');
                      }}
                      disabled={savingLines}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={saveNewLines}
                      disabled={savingLines}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                    >
                      {savingLines ? 'Guardando...' : 'Guardar líneas'}
                    </button>
                  </div>
                )}
              </div>
              {linesError && <p className="px-3 pb-2 text-sm text-red-600">{linesError}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
