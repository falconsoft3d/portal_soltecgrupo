'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  apiCreatePaidstate,
  apiDeletePaidstate,
  apiPaidstates,
  apiProjectBudgets,
  apiProjects,
  apiSetPaidstateState,
  PaidstateItem,
  PortalProject,
  ProjectBudgetItem,
} from '@/lib/api';
import { getToken } from '@/lib/auth';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(value: string | false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatCurrency(value: number): string {
  return `${value.toFixed(2)} €`;
}

function errorToText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') {
    const maybeError = value as { message?: unknown; data?: unknown };
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) return maybeError.message;
    if (maybeError.data && typeof maybeError.data === 'object') {
      const maybeData = maybeError.data as { message?: unknown };
      if (typeof maybeData.message === 'string' && maybeData.message.trim()) return maybeData.message;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function stateBadge(state: string): string {
  if (state === 'validated') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (state === 'draft') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (state === 'invoiced') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (state === 'cancel') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

export default function EstadosPagoPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [budgets, setBudgets] = useState<ProjectBudgetItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | ''>('');
  const [price, setPrice] = useState<number>(0);
  const [date, setDate] = useState<string>(toIsoDate(new Date()));
  const [paidstates, setPaidstates] = useState<PaidstateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isChangingStateId, setIsChangingStateId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return '—';
    return projects.find((project) => project.id === selectedProjectId)?.display_name || '—';
  }, [projects, selectedProjectId]);

  const selectedBudgetName = useMemo(() => {
    if (!selectedBudgetId) return '—';
    return budgets.find((budget) => budget.id === selectedBudgetId)?.display_name || '—';
  }, [budgets, selectedBudgetId]);

  async function loadPaidstates(projectId: number | 'all' = 'all') {
    const token = getToken();
    if (!token) return;

    const res = await apiPaidstates(token, projectId);
    if (!res.success) {
      throw new Error(errorToText(res.error, 'No se pudieron cargar los estados de pago.'));
    }
    setPaidstates(res.paidstates || []);
  }

  async function loadBudgets(projectId: number) {
    const token = getToken();
    if (!token) return;

    const res = await apiProjectBudgets(token, projectId);
    if (!res.success) {
      throw new Error(errorToText(res.error, 'No se pudieron cargar los presupuestos del proyecto.'));
    }

    setBudgets(res.budgets || []);
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([apiProjects(token), apiPaidstates(token, 'all')])
      .then(([projectsRes, paidstatesRes]) => {
        if (projectsRes.success && projectsRes.projects) {
          setProjects(projectsRes.projects);
        }

        if (paidstatesRes.success) {
          setPaidstates(paidstatesRes.paidstates || []);
        } else {
          setError(errorToText(paidstatesRes.error, 'No se pudieron cargar los estados de pago.'));
        }
      })
      .catch(() => {
        setError('No se pudo cargar la informacion inicial.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedProjectId) {
      setError('Debes seleccionar un proyecto.');
      return;
    }

    if (!selectedBudgetId) {
      setError('Debes seleccionar un presupuesto.');
      return;
    }

    const token = getToken();
    if (!token) {
      setError('Sesion no valida.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await apiCreatePaidstate(token, selectedProjectId, selectedBudgetId, price, date);
      if (!res.success || !res.paidstate) {
        setError(errorToText(res.error, 'No se pudo crear el estado de pago.'));
        return;
      }

      await loadPaidstates('all');
      setSuccess(`Estado de pago ${res.paidstate.name} creado correctamente.`);
      setShowCreateForm(false);
      setSelectedProjectId('');
      setSelectedBudgetId('');
      setPrice(0);
      setDate(toIsoDate(new Date()));
    } catch {
      setError('Error creando el estado de pago.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSetState(item: PaidstateItem, targetState: 'draft' | 'validated') {
    const token = getToken();
    if (!token) {
      setError('Sesion no valida.');
      return;
    }

    setError('');
    setSuccess('');
    setIsChangingStateId(item.id);

    try {
      const res = await apiSetPaidstateState(token, item.id, targetState);
      if (!res.success || !res.paidstate) {
        setError(errorToText(res.error, 'No se pudo actualizar el estado.'));
        return;
      }

      setPaidstates((current) => current.map((row) => (row.id === item.id ? res.paidstate as PaidstateItem : row)));
      setSuccess(`Estado de pago ${item.name} actualizado a ${targetState === 'validated' ? 'validado' : 'borrador'}.`);
    } catch {
      setError('Error cambiando el estado.');
    } finally {
      setIsChangingStateId(null);
    }
  }

  async function handleDelete(item: PaidstateItem) {
    const confirmed = window.confirm(`¿Eliminar el estado de pago ${item.name}?`);
    if (!confirmed) return;

    const token = getToken();
    if (!token) {
      setError('Sesion no valida.');
      return;
    }

    setError('');
    setSuccess('');
    setIsChangingStateId(item.id);

    try {
      const res = await apiDeletePaidstate(token, item.id);
      if (!res.success) {
        setError(errorToText(res.error, 'No se pudo eliminar el estado de pago.'));
        return;
      }

      setPaidstates((current) => current.filter((row) => row.id !== item.id));
      setSuccess(`Estado de pago ${item.name} eliminado correctamente.`);
    } catch {
      setError('Error eliminando el estado de pago.');
    } finally {
      setIsChangingStateId(null);
    }
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Estados de pago</h1>
            <p className="mt-1 text-sm text-gray-500">Gestiona tus estados de pago BIM desde el portal.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError('');
              setSuccess('');
              setShowCreateForm(true);
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Nuevo estado
          </button>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        {success && <p className="mt-3 text-sm font-medium text-emerald-600">{success}</p>}
      </article>

      {showCreateForm && (
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 border-b border-gray-200 pb-3">
            <h2 className="text-lg font-semibold text-gray-800">Nuevo estado de pago</h2>
            <p className="text-sm text-gray-500">Completa Proyecto, Presupuesto y Precio.</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Proyecto
                <select
                  value={selectedProjectId === '' ? '' : String(selectedProjectId)}
                  onChange={async (event) => {
                    const value = event.target.value;
                    const nextProjectId = value ? Number(value) : '';
                    setSelectedProjectId(nextProjectId);
                    setSelectedBudgetId('');

                    if (!nextProjectId) {
                      setBudgets([]);
                      return;
                    }

                    try {
                      await loadBudgets(nextProjectId);
                    } catch {
                      setBudgets([]);
                      setError('No se pudieron cargar los presupuestos para el proyecto seleccionado.');
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-400"
                  required
                >
                  <option value="">Selecciona un proyecto...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.is_manager ? '👑 ' : ''}{project.display_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Presupuesto
                <select
                  value={selectedBudgetId === '' ? '' : String(selectedBudgetId)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedBudgetId(value ? Number(value) : '');
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-400"
                  required
                  disabled={!selectedProjectId}
                >
                  <option value="">Selecciona un presupuesto...</option>
                  {budgets.map((budget) => (
                    <option key={budget.id} value={budget.id}>
                      {budget.display_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Precio
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(Number(event.target.value || 0))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-400"
                  required
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Fecha
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-400"
                  required
                />
              </label>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <p><span className="font-semibold">Proyecto:</span> {selectedProjectName}</p>
              <p><span className="font-semibold">Presupuesto:</span> {selectedBudgetName}</p>
              <p><span className="font-semibold">Precio:</span> {formatCurrency(price || 0)}</p>
              <p><span className="font-semibold">Fecha:</span> {date || '—'}</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </article>
      )}

      <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Mis estados de pago</h2>
          <span className="text-sm text-gray-500">{paidstates.length} registros</span>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Cargando estados de pago...</p>
        ) : (
          <div className="overflow-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2">Codigo</th>
                  <th className="px-3 py-2">Proyecto</th>
                  <th className="px-3 py-2">Presupuesto</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2 text-right">Precio</th>
                  <th className="px-3 py-2 text-right">Importe</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paidstates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">
                      No hay estados de pago creados.
                    </td>
                  </tr>
                ) : (
                  paidstates.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100 text-gray-700">
                      <td className="px-3 py-2 font-semibold">{item.name}</td>
                      <td className="px-3 py-2">{item.project_name || '—'}</td>
                      <td className="px-3 py-2">{item.budget_name || '—'}</td>
                      <td className="px-3 py-2">{formatDate(item.date)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(item.price || 0)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(item.amount_total || 0)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stateBadge(item.state)}`}>
                          {item.state}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          {item.state !== 'validated' && item.state !== 'invoiced' && (
                            <button
                              type="button"
                              disabled={isChangingStateId === item.id}
                              onClick={() => handleSetState(item, 'validated')}
                              className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Validar
                            </button>
                          )}
                          {item.state !== 'draft' && item.state !== 'invoiced' && (
                            <button
                              type="button"
                              disabled={isChangingStateId === item.id}
                              onClick={() => handleSetState(item, 'draft')}
                              className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Borrador
                            </button>
                          )}
                          {item.state === 'draft' && (
                            <button
                              type="button"
                              disabled={isChangingStateId === item.id}
                              onClick={() => handleDelete(item)}
                              className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
