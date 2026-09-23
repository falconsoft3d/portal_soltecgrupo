'use client';

import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  apiCreatePaidstate,
  apiDeletePaidstate,
  apiPaidstates,
  apiProjectBudgets,
  apiProjects,
  apiSetPaidstateState,
  apiUpdatePaidstatePrice,
  apiUpdatePaidstateDate,
  PaidstateItem,
  PortalProject,
  ProjectBudgetItem,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import PaidstateLinesTable, {
  DraftPaidstateLine,
  emptyPaidstateLine,
  linesTotal as computeLinesTotal,
  toPaidstateLines,
  validatePaidstateLines,
} from './PaidstateLinesTable';

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
  const sign = value < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(value).toFixed(2).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${intFormatted},${decPart} €`;
}

const MONTH_NAMES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

function monthKeyFromDate(value: string | false): string {
  if (!value) return 'unknown';
  const str = String(value);
  const match = str.match(/^(\d{4})-(\d{2})/);
  if (!match) return 'unknown';
  return `${match[1]}-${match[2]}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES[idx] ?? month} ${year}`;
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
  const searchParams = useSearchParams();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [budgets, setBudgets] = useState<ProjectBudgetItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [projSearchQ, setProjSearchQ] = useState('');
  const [projDropOpen, setProjDropOpen] = useState(false);
  const [lines, setLines] = useState<DraftPaidstateLine[]>(() => [emptyPaidstateLine()]);
  const [date, setDate] = useState<string>(toIsoDate(new Date()));
  const [paidstates, setPaidstates] = useState<PaidstateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isChangingStateId, setIsChangingStateId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  // Edición inline de precio
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const editPriceInputRef = useRef<HTMLInputElement>(null);
  const [editingDateId, setEditingDateId] = useState<number | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>('');
  const [isSavingDate, setIsSavingDate] = useState(false);
  const editDateInputRef = useRef<HTMLInputElement>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const monthsInitialized = useRef(false);
  const statesInitialized = useRef(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const deepLinkHandled = useRef(false);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return '—';
    return projects.find((project) => project.id === selectedProjectId)?.display_name || '—';
  }, [projects, selectedProjectId]);

  const linesTotal = computeLinesTotal(lines);

  function resetCreateForm() {
    setSelectedProjectId('');
    setBudgets([]);
    setLines([emptyPaidstateLine()]);
    setDate(toIsoDate(new Date()));
  }

  const groupedPaidstates = useMemo(() => {
    const monthMap = new Map<string, PaidstateItem[]>();
    for (const a of paidstates) {
      const key = monthKeyFromDate(a.date);
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(a);
    }
    const monthKeys = [...monthMap.keys()].sort((a, b) => b.localeCompare(a));
    return monthKeys.map((key) => {
      const monthItems = monthMap.get(key)!;
      const stateMap = new Map<string, PaidstateItem[]>();
      for (const a of monthItems) {
        const sk = a.project_state || 'Sin estado';
        if (!stateMap.has(sk)) stateMap.set(sk, []);
        stateMap.get(sk)!.push(a);
      }
      const stateGroups = [...stateMap.keys()].sort().map((sk) => ({
        stateKey: sk,
        stateLbl: sk,
        items: stateMap.get(sk)!,
        subtotal: stateMap.get(sk)!.reduce((s, a) => s + (a.amount_total || 0), 0),
      }));
      return {
        key,
        label: monthLabel(key),
        subtotal: monthItems.reduce((s, a) => s + (a.amount_total || 0), 0),
        totalCount: monthItems.length,
        stateGroups,
      };
    });
  }, [paidstates]);

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleState(comboKey: string) {
    setExpandedStates((prev) => {
      const next = new Set(prev);
      if (next.has(comboKey)) next.delete(comboKey);
      else next.add(comboKey);
      return next;
    });
  }

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

  useEffect(() => {
    if (!monthsInitialized.current && groupedPaidstates.length > 0) {
      monthsInitialized.current = true;
      setExpandedMonths(new Set([groupedPaidstates[0].key]));
    }
  }, [groupedPaidstates]);

  useEffect(() => {
    if (!statesInitialized.current && groupedPaidstates.length > 0 && groupedPaidstates[0].stateGroups.length > 0) {
      statesInitialized.current = true;
      const firstMonth = groupedPaidstates[0].key;
      const firstState = groupedPaidstates[0].stateGroups[0].stateKey;
      setExpandedStates(new Set([`${firstMonth}::${firstState}`]));
    }
  }, [groupedPaidstates]);

  useEffect(() => {
    const paidstateIdParam = searchParams.get('paidstate_id');
    if (deepLinkHandled.current || !paidstateIdParam || groupedPaidstates.length === 0) return;
    const targetId = Number(paidstateIdParam);
    for (const month of groupedPaidstates) {
      for (const stateGroup of month.stateGroups) {
        if (stateGroup.items.some((item) => item.id === targetId)) {
          deepLinkHandled.current = true;
          setExpandedMonths((prev) => new Set(prev).add(month.key));
          setExpandedStates((prev) => new Set(prev).add(`${month.key}::${stateGroup.stateKey}`));
          setHighlightId(targetId);
          setTimeout(() => {
            document.getElementById(`paidstate-row-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
          return;
        }
      }
    }
  }, [searchParams, groupedPaidstates]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedProjectId) {
      setError('Debes seleccionar un proyecto.');
      return;
    }

    const linesError = validatePaidstateLines(lines);
    if (linesError) {
      setError(linesError);
      return;
    }

    const token = getToken();
    if (!token) {
      setError('Sesion no valida.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await apiCreatePaidstate(
        token,
        selectedProjectId,
        toPaidstateLines(lines),
        date,
      );
      if (!res.success || !res.paidstate) {
        setError(errorToText(res.error, 'No se pudo crear el estado de pago.'));
        return;
      }

      await loadPaidstates('all');
      setSuccess(`Estado de pago ${res.paidstate.name} creado correctamente.`);
      setShowCreateForm(false);
      resetCreateForm();
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

  function startEditPrice(item: PaidstateItem) {
    setEditingPriceId(item.id);
    setEditingPriceValue(String(item.price ?? 0));
    setTimeout(() => editPriceInputRef.current?.select(), 0);
  }

  function startEditDate(item: PaidstateItem) {
    setEditingDateId(item.id);
    setEditingDateValue(typeof item.date === 'string' ? item.date : toIsoDate(new Date()));
    setTimeout(() => editDateInputRef.current?.focus(), 0);
  }

  async function handleSaveDate(item: PaidstateItem) {
    const token = getToken();
    if (!token) return;

    if (!editingDateValue) {
      setError('Fecha no válida.');
      return;
    }

    setIsSavingDate(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiUpdatePaidstateDate(token, item.id, editingDateValue);
      if (!res.success || !res.paidstate) {
        setError(errorToText(res.error, 'No se pudo actualizar la fecha.'));
        return;
      }
      setPaidstates((current) => current.map((row) => (row.id === item.id ? res.paidstate as PaidstateItem : row)));
      setSuccess(`Fecha actualizada en ${item.name}.`);
    } catch {
      setError('Error actualizando la fecha.');
    } finally {
      setIsSavingDate(false);
      setEditingDateId(null);
    }
  }

  async function handleSavePrice(item: PaidstateItem) {
    const token = getToken();
    if (!token) return;

    const newPrice = parseFloat(editingPriceValue.replace(',', '.'));
    if (Number.isNaN(newPrice)) {
      setError('Precio no válido.');
      return;
    }

    setIsSavingPrice(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiUpdatePaidstatePrice(token, item.id, newPrice);
      if (!res.success || !res.paidstate) {
        setError(errorToText(res.error, 'No se pudo actualizar el precio.'));
        return;
      }
      setPaidstates((current) => current.map((row) => (row.id === item.id ? res.paidstate as PaidstateItem : row)));
      setSuccess(`Precio actualizado en ${item.name}.`);
    } catch {
      setError('Error actualizando el precio.');
    } finally {
      setIsSavingPrice(false);
      setEditingPriceId(null);
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
            <p className="text-sm text-gray-500">Elige el proyecto y añade las líneas por presupuesto.</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Proyecto
                <div className="relative mt-1">
                  <button type="button" onClick={() => { setProjDropOpen((o) => !o); setProjSearchQ(''); }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm flex items-center justify-between gap-2 bg-white focus:border-brand-400 outline-none">
                    <span className={selectedProjectId ? 'text-gray-800' : 'text-gray-400'}>
                      {selectedProjectId ? (projects.find((p) => p.id === selectedProjectId)?.display_name ?? 'Selecciona un proyecto...') : 'Selecciona un proyecto...'}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{projDropOpen ? '▲' : '▼'}</span>
                  </button>
                  {projDropOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                      <div className="p-2 border-b border-gray-100">
                        <input autoFocus type="text" value={projSearchQ} onChange={(e) => setProjSearchQ(e.target.value)}
                          placeholder="Buscar por código o nombre..." className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-400 placeholder:text-gray-500" />
                      </div>
                      <ul className="max-h-60 overflow-y-auto py-1">
                        {projects.filter((p) => { const q = projSearchQ.toLowerCase(); return !q || p.display_name.toLowerCase().includes(q); }).map((project) => (
                          <li key={project.id}>
                            <button type="button" onClick={async () => {
                              const id = project.id;
                              setSelectedProjectId(id); setProjDropOpen(false);
                              setLines((prev) => prev.map((l) => ({ ...l, budget_id: '', name: '' })));
                              try { await loadBudgets(id); } catch { setBudgets([]); }
                            }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedProjectId === project.id ? 'font-semibold text-brand-700 bg-brand-50' : 'text-gray-700'}`}>
                              {project.is_manager ? '👑 ' : ''}{project.display_name}
                              {project.state_name && <span className="ml-1 text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{project.state_name}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {projDropOpen && <div className="fixed inset-0 z-40" onClick={() => setProjDropOpen(false)} />}
                </div>
                <input type="text" required value={selectedProjectId || ''} onChange={() => {}} className="sr-only" tabIndex={-1} />
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

            <PaidstateLinesTable
              lines={lines}
              budgets={budgets}
              onChange={setLines}
              budgetsPlaceholder={selectedProjectId ? 'Sin presupuestos certificables' : 'Elige un proyecto'}
            />

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <p><span className="font-semibold">Proyecto:</span> {selectedProjectName}</p>
              <p><span className="font-semibold">Líneas:</span> {lines.length}</p>
              <p><span className="font-semibold">Importe:</span> {formatCurrency(linesTotal)}</p>
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
                  groupedPaidstates.map(({ key, label, subtotal, totalCount, stateGroups }) => (
                    <React.Fragment key={key}>
                      <tr
                        className="cursor-pointer select-none bg-gray-100 hover:bg-gray-200"
                        onClick={() => toggleMonth(key)}
                      >
                        <td colSpan={5} className="px-3 py-2 font-bold text-gray-700 text-sm">
                          <span className="mr-2 text-gray-400">{expandedMonths.has(key) ? '▾' : '▸'}</span>
                          {label}
                          <span className="ml-3 text-xs font-normal text-gray-500">({totalCount} registros)</span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-700 text-sm whitespace-nowrap">
                          {formatCurrency(subtotal)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                      {expandedMonths.has(key) && stateGroups.map(({ stateKey, stateLbl, subtotal: stateSubtotal, items: stateItems }) => {
                        const comboKey = `${key}::${stateKey}`;
                        return (
                          <React.Fragment key={comboKey}>
                            <tr
                              className="cursor-pointer select-none bg-blue-50 hover:bg-blue-100"
                              onClick={(e) => { e.stopPropagation(); toggleState(comboKey); }}
                            >
                              <td colSpan={5} className="pl-7 pr-3 py-1.5 text-xs font-bold text-blue-700">
                                <span className="mr-2 text-blue-400">{expandedStates.has(comboKey) ? '▾' : '▸'}</span>
                                {stateLbl}
                                <span className="ml-3 font-normal text-blue-500">({stateItems.length} registros)</span>
                              </td>
                              <td className="px-3 py-1.5 text-right text-xs font-bold text-blue-700 whitespace-nowrap">
                                {formatCurrency(stateSubtotal)}
                              </td>
                              <td colSpan={2} />
                            </tr>
                            {expandedStates.has(comboKey) && stateItems.map((item) => (
                    <tr
                      key={item.id}
                      id={`paidstate-row-${item.id}`}
                      className={`border-t border-gray-100 text-gray-700 ${highlightId === item.id ? 'bg-yellow-100' : ''}`}
                    >
                      <td className="px-3 py-2 font-semibold">
                        <Link
                          href={`/dashboard/estados-pago/${item.id}`}
                          className="text-brand-700 underline decoration-dotted hover:text-brand-600"
                          title="Abrir estado de pago"
                        >
                          {item.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{item.project_name || '—'}</td>
                      <td className="px-3 py-2">{item.budget_name || '—'}</td>
                      <td className="px-3 py-2">
                        {editingDateId === item.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              ref={editDateInputRef}
                              type="date"
                              value={editingDateValue}
                              onChange={(e) => setEditingDateValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveDate(item);
                                if (e.key === 'Escape') setEditingDateId(null);
                              }}
                              className="rounded border border-brand-400 px-1.5 py-0.5 text-sm outline-none"
                              disabled={isSavingDate}
                            />
                            <button
                              type="button"
                              disabled={isSavingDate}
                              onClick={() => handleSaveDate(item)}
                              className="rounded bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                            >
                              {isSavingDate ? '…' : '✓'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDateId(null)}
                              className="rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <span
                            className={item.state === 'draft' ? 'cursor-pointer underline decoration-dotted hover:text-brand-600' : ''}
                            title={item.state === 'draft' ? 'Haz clic para editar la fecha' : undefined}
                            onClick={() => item.state === 'draft' && startEditDate(item)}
                          >
                            {formatDate(item.date)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {editingPriceId === item.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              ref={editPriceInputRef}
                              type="number"
                              step="0.01"
                              value={editingPriceValue}
                              onChange={(e) => setEditingPriceValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePrice(item);
                                if (e.key === 'Escape') setEditingPriceId(null);
                              }}
                              className="w-28 rounded border border-brand-400 px-1.5 py-0.5 text-right text-sm outline-none"
                              disabled={isSavingPrice}
                            />
                            <button
                              type="button"
                              disabled={isSavingPrice}
                              onClick={() => handleSavePrice(item)}
                              className="rounded bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                            >
                              {isSavingPrice ? '…' : '✓'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPriceId(null)}
                              className="rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <span
                            className={item.state === 'draft' && (item.line_count ?? 1) <= 1 ? 'cursor-pointer underline decoration-dotted hover:text-brand-600' : ''}
                            title={item.state === 'draft' && (item.line_count ?? 1) <= 1 ? 'Haz clic para editar el precio' : undefined}
                            onClick={() => item.state === 'draft' && (item.line_count ?? 1) <= 1 && startEditPrice(item)}
                          >
                            {(item.line_count ?? 1) > 1 ? (
                              <span className="text-gray-500">{item.line_count} líneas</span>
                            ) : (
                              formatCurrency(item.price || 0)
                            )}
                          </span>
                        )}
                      </td>
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
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
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
