'use client';

import { Fragment, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  apiResultTables,
  apiResultTableDetail,
  apiCreateResultTable,
  apiUpdateAndCalcResultTable,
  apiUpdateResultTableTitle,
  apiDeleteResultTable,
  apiProjects,
  apiPortalPartners,
  apiMe,
  ResultTableItem,
  ResultTableDetailItem,
  ResultTableLineItem,
  PortalProject,
  PortalPartner,
} from '@/lib/api';
import * as XLSX from 'xlsx';
import { getToken } from '@/lib/auth';

// ─── Definición de columnas (orden idéntico a Odoo back-office) ───────────────
type ColKey = keyof ResultTableLineItem;
interface ColDef {
  key: ColKey;
  label: string;
  align: 'left' | 'center' | 'right';
  defaultVisible: boolean;
  isResult?: boolean;
  isPct?: boolean;
}

const COLUMNS: ColDef[] = [
  { key: 'state_project',        label: 'Estado',             align: 'left',   defaultVisible: true  },
  { key: 'nexecution_manager',   label: 'Jefe de Obra',       align: 'left',   defaultVisible: false },
  { key: 'project_name',         label: 'Proyecto',           align: 'left',   defaultVisible: true  },
  { key: 'year',                 label: 'A',                  align: 'center', defaultVisible: true  },
  { key: 'month',                label: 'M',                  align: 'center', defaultVisible: true  },
  { key: 'contracted_sale',      label: 'Cto. Venta',         align: 'right',  defaultVisible: false },
  { key: 'expansion_contract',   label: 'Expansión',          align: 'right',  defaultVisible: false },
  { key: 'contracted_cost',      label: 'Cto. Coste',         align: 'right',  defaultVisible: false },
  { key: 'contracted_coefficient',label: 'Coef. Cto.',        align: 'right',  defaultVisible: false },
  { key: 'pending_execution',    label: 'Pendiente',          align: 'right',  defaultVisible: false },
  { key: 'fdo_orig',             label: 'FdO orig',           align: 'right',  defaultVisible: true  },
  { key: 'cte_orig',             label: 'Cte orig.',          align: 'right',  defaultVisible: true  },
  { key: 'o_mat',                label: 'O.Mat.',             align: 'right',  defaultVisible: false },
  { key: 'o_partner',            label: 'O.Partner.',         align: 'right',  defaultVisible: false },
  { key: 'o_asist',              label: 'O.Asist.',           align: 'right',  defaultVisible: false },
  { key: 'o_viajes',             label: 'O.Viajes',           align: 'right',  defaultVisible: false },
  { key: 'o_otros',              label: 'O.Otros',            align: 'right',  defaultVisible: false },
  { key: 'fdo_year',             label: 'FdO-A',              align: 'right',  defaultVisible: true  },
  { key: 'cte_year',             label: 'Cte-A',              align: 'right',  defaultVisible: true  },
  { key: 'cte_year_mat',         label: 'A.Mat.',             align: 'right',  defaultVisible: false },
  { key: 'cte_year_partner',     label: 'A.Partner.',         align: 'right',  defaultVisible: false },
  { key: 'cte_year_asist',       label: 'A.Asist.',           align: 'right',  defaultVisible: false },
  { key: 'cte_year_viajes',      label: 'A.Viajes',           align: 'right',  defaultVisible: false },
  { key: 'cte_year_otros',       label: 'A.Otros',            align: 'right',  defaultVisible: false },
  { key: 'fdo_mon',              label: 'FdO-M',              align: 'right',  defaultVisible: true  },
  { key: 'cte_mes',              label: 'Cte-M',              align: 'right',  defaultVisible: true  },
  { key: 'mat',                  label: 'Mat.',               align: 'right',  defaultVisible: false },
  { key: 'partner',              label: 'Partner.',           align: 'right',  defaultVisible: false },
  { key: 'asist',                label: 'Asist.',             align: 'right',  defaultVisible: false },
  { key: 'viajes',               label: 'Viajes',             align: 'right',  defaultVisible: false },
  { key: 'otros',                label: 'Otros',              align: 'right',  defaultVisible: false },
  { key: 'ap_year',              label: 'A/P-A',              align: 'right',  defaultVisible: true  },
  { key: 'ap_mon',               label: 'A/P-M',              align: 'right',  defaultVisible: true  },
  { key: 'result_orig',          label: 'R-Orig',             align: 'right',  defaultVisible: true,  isResult: true },
  { key: 'result_year',          label: 'R-A',                align: 'right',  defaultVisible: true,  isResult: true },
  { key: 'mbrut_orig',           label: '%MBrut orig',        align: 'right',  defaultVisible: false, isPct: true },
  { key: 'mbrut_year',           label: '%MBrut-A',           align: 'right',  defaultVisible: false, isPct: true },
  { key: 'mnet_orig',            label: '%MNet orig',         align: 'right',  defaultVisible: true,  isPct: true },
  { key: 'mmnet_year',           label: '%MNet-A',            align: 'right',  defaultVisible: true,  isPct: true },
];

function exportDetailToXlsx(detail: ResultTableDetailItem) {
  const rows = detail.lines.map((l) => {
    const row: Record<string, string | number> = {};
    for (const col of COLUMNS) {
      row[col.label] = l[col.key] as string | number;
    }
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Líneas');
  XLSX.writeFile(wb, `${detail.name}_${detail.title.replace(/\s+/g, '_')}.xlsx`);
}

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

function formatNumber(value: number): string {
  if (value === 0) return '0,00';
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value < 0 ? '-' : ''}${intFormatted},${decPart}`;
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
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return fallback;
}

export default function EstadosResultadosPage() {
  const today = new Date();
  const firstDay = toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDay = toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const [tables, setTables] = useState<ResultTableItem[]>([]);
  const [detail, setDetail] = useState<ResultTableDetailItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Formulario crear
  const [title, setTitle] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(firstDay);
  const [toDate, setToDate] = useState<string>(lastDay);

  // Detalle: filtros editables
  const [detailFromDate, setDetailFromDate] = useState<string>('');
  const [detailToDate, setDetailToDate] = useState<string>('');
  const [allowedProjects, setAllowedProjects] = useState<PortalProject[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [detailError, setDetailError] = useState<string>('');
  const [detailSuccess, setDetailSuccess] = useState<string>('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showAllObras, setShowAllObras] = useState(false);
  const OBRAS_VISIBLE_LIMIT = 6;

  // Managers (solo si portal_all_projects)
  const [isAdmin, setIsAdmin] = useState(false);
  const [portalPartners, setPortalPartners] = useState<PortalPartner[]>([]);
  const [selectedManagerIds, setSelectedManagerIds] = useState<number[]>([]);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const managerPickerRef = useRef<HTMLDivElement>(null);

  // Visibilidad de columnas
  const defaultVisible = new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(defaultVisible);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // Ordenación de líneas
  const [sortCol, setSortCol] = useState<ColKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Agrupación por estado de proyecto
  const [groupByState, setGroupByState] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Edición de título y eliminación (vista de lista)
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  function handleSort(key: ColKey) {
    setSortCol((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([
      apiResultTables(token),
      apiMe(token),
    ]).then(([tablesRes, meRes]) => {
      if (tablesRes.success) {
        setTables(tablesRes.result_tables || []);
      } else {
        setError(errorToText(tablesRes.error, 'No se pudieron cargar los estados de resultados.'));
      }
      if (meRes.success && meRes.partner?.portal_all_projects) {
        setIsAdmin(true);
      }
    })
      .catch(() => setError('No se pudo cargar la información.'))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleViewDetail(tableId: number) {
    const token = getToken();
    if (!token) return;
    setError('');
    setDetailError('');
    setDetailSuccess('');
    setShowProjectPicker(false);
    setShowManagerPicker(false);
    setIsLoadingDetail(true);
    try {
      const calls: Promise<unknown>[] = [
        apiResultTableDetail(token, tableId),
        apiProjects(token),
      ];
      if (isAdmin) calls.push(apiPortalPartners(token));

      const [detailRes, projectsRes, partnersRes] = await Promise.all(calls) as [
        Awaited<ReturnType<typeof apiResultTableDetail>>,
        Awaited<ReturnType<typeof apiProjects>>,
        Awaited<ReturnType<typeof apiPortalPartners>> | undefined,
      ];

      if (detailRes.success && detailRes.result_table) {
        const t = detailRes.result_table;
        setDetail(t);
        setDetailFromDate(typeof t.from_date === 'string' ? t.from_date : firstDay);
        setDetailToDate(typeof t.to_date === 'string' ? t.to_date : lastDay);
        setSelectedProjectIds((t.project_ids ?? []).map((p) => p.id));
        setSelectedManagerIds((t.managers ?? []).map((m) => m.id));
      } else {
        setError(errorToText(detailRes.error, 'No se pudo cargar el detalle.'));
      }

      if (projectsRes.success && projectsRes.projects) {
        setAllowedProjects(projectsRes.projects);
      }
      if (partnersRes?.success && partnersRes.portal_partners) {
        setPortalPartners(partnersRes.portal_partners);
      }
    } catch {
      setError('Error al cargar el detalle.');
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function toggleProject(id: number) {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // Agrupación por estado
  const sortedLines = useMemo(() => {
    if (!detail) return [];
    if (!sortCol) return detail.lines;
    return [...detail.lines].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const cmp =
        typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv, 'es', { sensitivity: 'base' })
          : ((av as number) || 0) - ((bv as number) || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [detail, sortCol, sortDir]);

  const groupedLines = useMemo(() => {
    const map = new Map<string, typeof sortedLines>();
    for (const line of sortedLines) {
      const key = (line.state_project as string) || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(line);
    }
    return Array.from(map.entries()).map(([state, lines]) => ({ state, lines }));
  }, [sortedLines]);

  // Auto-expand all groups when detail loads
  useEffect(() => {
    if (!detail) return;
    const states = new Set(detail.lines.map((l) => (l.state_project as string) || '—'));
    setExpandedGroups(states);
  }, [detail?.id]);

  function toggleGroup(state: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  }

  async function handleCalcular() {
    if (!detail) return;
    const token = getToken();
    if (!token) return;

    if (!detailFromDate || !detailToDate) {
      setDetailError('Las fechas son requeridas.');
      return;
    }
    if (detailFromDate > detailToDate) {
      setDetailError('La fecha desde debe ser anterior o igual a la fecha hasta.');
      return;
    }

    setDetailError('');
    setDetailSuccess('');
    setIsCalculating(true);
    try {
      const res = await apiUpdateAndCalcResultTable(
        token,
        detail.id,
        detailFromDate,
        detailToDate,
        selectedProjectIds,
        isAdmin ? selectedManagerIds : undefined,
      );
      if (res.success && res.result_table) {
        setDetail(res.result_table);
        setDetailSuccess('Cálculo completado correctamente.');
        setShowProjectPicker(false);
      } else {
        setDetailError(errorToText(res.error, 'No se pudo calcular.'));
      }
    } catch {
      setDetailError('Error al calcular.');
    } finally {
      setIsCalculating(false);
    }
  }

  async function handleSaveTitle(tableId: number) {
    const title = editingTitleValue.trim();
    if (!title) return;
    const token = getToken();
    if (!token) return;
    setIsSavingTitle(true);
    try {
      const res = await apiUpdateResultTableTitle(token, tableId, title);
      if (res.success && res.result_table) {
        setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, title: res.result_table!.title } : t));
        setEditingTitleId(null);
      } else {
        setError(errorToText(res.error, 'No se pudo actualizar el título.'));
      }
    } catch {
      setError('Error al guardar el título.');
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function handleDelete(tableId: number) {
    const token = getToken();
    if (!token) return;
    setIsDeletingId(tableId);
    try {
      const res = await apiDeleteResultTable(token, tableId);
      if (res.success) {
        setTables((prev) => prev.filter((t) => t.id !== tableId));
        setConfirmDeleteId(null);
      } else {
        setError(errorToText(res.error, 'No se pudo eliminar.'));
      }
    } catch {
      setError('Error al eliminar.');
    } finally {
      setIsDeletingId(null);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim()) {
      setError('El título es requerido.');
      return;
    }
    if (!fromDate || !toDate) {
      setError('Las fechas son requeridas.');
      return;
    }
    if (fromDate > toDate) {
      setError('La fecha desde debe ser anterior o igual a la fecha hasta.');
      return;
    }

    const token = getToken();
    if (!token) return;

    setIsCreating(true);
    try {
      const res = await apiCreateResultTable(token, title.trim(), fromDate, toDate);
      if (res.success && res.result_table) {
        setTables((prev) => [res.result_table!, ...prev]);
        setSuccess(`Estado de resultados "${res.result_table.name}" creado correctamente.`);
        setShowCreateForm(false);
        setTitle('');
        setFromDate(firstDay);
        setToDate(lastDay);
      } else {
        setError(errorToText(res.error, 'No se pudo crear el estado de resultados.'));
      }
    } catch {
      setError('Error al crear el estado de resultados.');
    } finally {
      setIsCreating(false);
    }
  }

  // Vista de detalle
  if (detail) {
    const selectedNames = allowedProjects
      .filter((p) => selectedProjectIds.includes(p.id))
      .map((p) => p.display_name);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setDetail(null); setDetailError(''); setDetailSuccess(''); }}
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a la lista
          </button>

        </div>

        {/* Cabecera */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{detail.name}</h1>
              <p className="text-gray-500 mt-1">{detail.title}</p>
            </div>
            <div className="text-right text-sm text-gray-600 space-y-1">
              <div>
                <span className="font-medium">Estados:</span>{' '}
                {detail.states.length > 0 ? detail.states.join(', ') : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Panel de filtros + Calcular */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Filtros de cálculo</h2>

          {detailError && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
              {detailError}
            </div>
          )}
          {detailSuccess && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
              {detailSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
              <input
                type="date"
                value={detailFromDate}
                onChange={(e) => setDetailFromDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
              <input
                type="date"
                value={detailToDate}
                onChange={(e) => setDetailToDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Selector de responsables (solo admin) */}
          {isAdmin && (
            <div className="mb-5" ref={managerPickerRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsables</label>
              <button
                type="button"
                onClick={() => setShowManagerPicker((v) => !v)}
                className="w-full sm:w-auto text-left border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {selectedManagerIds.length === 0
                  ? 'Seleccionar responsables'
                  : `${selectedManagerIds.length} responsable${selectedManagerIds.length !== 1 ? 's' : ''} seleccionado${selectedManagerIds.length !== 1 ? 's' : ''}`}
              </button>

              {showManagerPicker && (
                <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-lg max-h-64 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Socios con acceso al portal</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedManagerIds(portalPartners.map((p) => p.id))}
                        className="text-xs text-brand-600 hover:text-brand-800"
                      >
                        Todos
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedManagerIds([])}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Ninguno
                      </button>
                    </div>
                  </div>
                  {portalPartners.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-400">No hay responsables disponibles.</div>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {portalPartners.map((partner) => {
                        const checked = selectedManagerIds.includes(partner.id);
                        return (
                          <li key={partner.id}>
                            <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-brand-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedManagerIds((prev) =>
                                    prev.includes(partner.id)
                                      ? prev.filter((x) => x !== partner.id)
                                      : [...prev, partner.id],
                                  )
                                }
                                className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                              />
                              <span className="text-sm text-gray-700">{partner.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Tags de responsables seleccionados */}
              {selectedManagerIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedManagerIds.map((id) => {
                    const mgr = portalPartners.find((p) => p.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs rounded-full px-2.5 py-1"
                      >
                        {mgr?.name ?? `ID ${id}`}
                        <button
                          type="button"
                          onClick={() => setSelectedManagerIds((prev) => prev.filter((x) => x !== id))}
                          className="hover:text-indigo-900 ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selector de obras */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Obras{' '}
              <span className="text-gray-400 font-normal text-xs">(vacío = todas las tuyas)</span>
            </label>
            <button
              type="button"
              onClick={() => setShowProjectPicker((v) => !v)}
              className="w-full sm:w-auto text-left border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {selectedProjectIds.length === 0
                ? 'Seleccionar obras (opcional)'
                : `${selectedProjectIds.length} obra${selectedProjectIds.length !== 1 ? 's' : ''} seleccionada${selectedProjectIds.length !== 1 ? 's' : ''}`}
            </button>

            {showProjectPicker && (
              <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Tus obras como responsable</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProjectIds(allowedProjects.map((p) => p.id))}
                      className="text-xs text-brand-600 hover:text-brand-800"
                    >
                      Todas
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectIds([])}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Ninguna
                    </button>
                  </div>
                </div>
                {allowedProjects.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">No hay obras disponibles.</div>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {allowedProjects.map((project) => {
                      const checked = selectedProjectIds.includes(project.id);
                      return (
                        <li key={project.id}>
                          <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-brand-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProject(project.id)}
                              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                            />
                            <span className="text-sm text-gray-700">
                              {project.is_manager ? '👑 ' : ''}{project.display_name}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Tags de obras seleccionadas */}
            {selectedProjectIds.length > 0 && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1.5">
                  {(showAllObras ? selectedNames : selectedNames.slice(0, OBRAS_VISIBLE_LIMIT)).map((name, i) => (
                    <span
                      key={selectedProjectIds[i]}
                      className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 text-xs rounded-full px-2.5 py-1"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => toggleProject(selectedProjectIds[i])}
                        className="hover:text-brand-900 ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {selectedNames.length > OBRAS_VISIBLE_LIMIT && (
                    <button
                      type="button"
                      onClick={() => setShowAllObras((v) => !v)}
                      className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs rounded-full px-2.5 py-1 hover:bg-gray-200 transition-colors"
                    >
                      {showAllObras
                        ? 'Ver menos'
                        : `+${selectedNames.length - OBRAS_VISIBLE_LIMIT} más...`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleCalcular}
            disabled={isCalculating}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-sm transition-colors"
          >
            {isCalculating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Calculando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                </svg>
                Calcular
              </>
            )}
          </button>
        </div>

        {/* Líneas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-semibold text-gray-800">
                Líneas
                <span className="ml-2 text-xs text-gray-400 font-normal">({detail.lines.length} registros)</span>
              </h2>
              <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-full px-3 py-1">
                <span className="text-indigo-400 font-normal">Objetivo %MNet-A</span>
                10,00 %
              </span>
              <button
                type="button"
                onClick={() => setGroupByState((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 border transition-colors ${
                  groupByState
                    ? 'bg-brand-50 border-brand-300 text-brand-700'
                    : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                </svg>
                {groupByState ? 'Agrupado por estado' : 'Sin agrupar'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Selector de columnas */}
              <div className="relative" ref={colPickerRef}>
                <button
                  onClick={() => setShowColPicker((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  Columnas
                </button>
                {showColPicker && (
                  <div className="absolute right-0 top-9 z-30 bg-white border border-gray-200 rounded-xl shadow-xl w-56 max-h-96 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Mostrar / ocultar columnas</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setVisibleCols(new Set(COLUMNS.map((c) => c.key)))} className="text-xs text-brand-600 hover:text-brand-800">Todas</button>
                        <span className="text-gray-300">|</span>
                        <button type="button" onClick={() => setVisibleCols(new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)))} className="text-xs text-gray-500 hover:text-gray-700">Defecto</button>
                      </div>
                    </div>
                    <ul className="divide-y divide-gray-50 py-1">
                      {COLUMNS.map((col) => (
                        <li key={col.key}>
                          <label className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-brand-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={visibleCols.has(col.key)}
                              onChange={() => setVisibleCols((prev) => {
                                const next = new Set(prev);
                                if (next.has(col.key)) next.delete(col.key); else next.add(col.key);
                                return next;
                              })}
                              className="w-3.5 h-3.5 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                            />
                            <span className="text-xs text-gray-700">{col.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {detail.lines.length > 0 && (
                <button
                  onClick={() => exportDetailToXlsx(detail)}
                  className="flex items-center gap-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
                  </svg>
                  Exportar XLSX
                </button>
              )}
            </div>
          </div>
          {detail.lines.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              Este estado de resultados no tiene líneas calculadas aún.
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
              <table className="w-full text-xs text-gray-700 whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b-2 border-gray-300 bg-gray-50 font-semibold text-gray-800 shadow-sm">
                    {(() => {
                      const totalFdo = detail.lines.reduce((s, l) => s + ((l.fdo_year as number) || 0), 0);
                      const totalCte = detail.lines.reduce((s, l) => s + ((l.cte_year as number) || 0), 0);
                      const totalAp  = detail.lines.reduce((s, l) => s + ((l.ap_year  as number) || 0), 0);
                      const mbrut = totalFdo !== 0 ? ((totalFdo - totalCte + totalAp) / totalFdo) * 100 : 0;
                      const mnet  = mbrut - 10;
                      return COLUMNS.filter((c) => visibleCols.has(c.key)).map((col, idx) => {
                        const isStr = col.key === 'state_project' || col.key === 'nexecution_manager' || col.key === 'project_name' || col.key === 'year' || col.key === 'month';
                        if (isStr) {
                          return (
                            <th key={col.key} className="px-3 py-2 text-xs text-gray-500 font-semibold text-left">
                              {idx === 0 ? 'TOTAL' : ''}
                            </th>
                          );
                        }
                        if (col.key === 'mbrut_year') {
                          const colored = mbrut >= 0 ? 'text-emerald-700' : 'text-rose-700';
                          return (
                            <th key={col.key} className={`px-3 py-2 text-right font-mono text-xs font-semibold ${colored}`}>
                              {formatNumber(mbrut)} %
                            </th>
                          );
                        }
                        if (col.key === 'mmnet_year') {
                          const colored = mnet >= 0 ? 'text-emerald-700' : 'text-rose-700';
                          return (
                            <th key={col.key} className={`px-3 py-2 text-right font-mono text-xs font-semibold ${colored}`}>
                              {formatNumber(mnet)} %
                            </th>
                          );
                        }
                        if (col.isPct) {
                          return <th key={col.key} className="px-3 py-2" />;
                        }
                        const total = detail.lines.reduce((sum, line) => sum + ((line[col.key] as number) || 0), 0);
                        const colored = col.isResult ? (total >= 0 ? 'text-emerald-700' : 'text-rose-700') : '';
                        return (
                          <th key={col.key} className={`px-3 py-2 text-right font-mono text-xs font-semibold ${colored}`}>
                            {formatNumber(total)}
                          </th>
                        );
                      });
                    })()}
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 uppercase tracking-wide">
                    {COLUMNS.filter((c) => visibleCols.has(c.key)).map((col) => {
                      const isActive = sortCol === col.key;
                      const arrow = isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
                      return (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className={`px-3 py-3 font-medium cursor-pointer select-none hover:bg-gray-100 transition-colors ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          } ${isActive ? 'text-brand-600' : ''}`}
                        >
                          {col.label}{arrow}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {groupByState ? (
                    groupedLines.map(({ state, lines: groupLines }) => {
                      const isOpen = expandedGroups.has(state);
                      const visibleColsList = COLUMNS.filter((c) => visibleCols.has(c.key));
                      const totalFdoG = groupLines.reduce((s, l) => s + ((l.fdo_year as number) || 0), 0);
                      const totalCteG = groupLines.reduce((s, l) => s + ((l.cte_year as number) || 0), 0);
                      const totalApG  = groupLines.reduce((s, l) => s + ((l.ap_year  as number) || 0), 0);
                      const mbrutG = totalFdoG !== 0 ? ((totalFdoG - totalCteG + totalApG) / totalFdoG) * 100 : 0;
                      const mnetG  = mbrutG - 10;
                      return (
                        <Fragment key={state}>
                          {/* Cabecera de grupo */}
                          <tr
                            onClick={() => toggleGroup(state)}
                            className="cursor-pointer bg-slate-100 hover:bg-slate-200 transition-colors border-t border-slate-200"
                          >
                            {visibleColsList.map((col, idx) => {
                              if (idx === 0) return (
                                <td key={col.key} colSpan={1} className="px-3 py-2 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                  <span className="text-slate-400">{isOpen ? '▼' : '▶'}</span>
                                  {state}
                                  <span className="ml-1 text-slate-400 font-normal">({groupLines.length})</span>
                                </td>
                              );
                              const isStr = col.key === 'state_project' || col.key === 'nexecution_manager' || col.key === 'project_name' || col.key === 'year' || col.key === 'month';
                              if (isStr) return <td key={col.key} className="px-3 py-2" />;
                              if (col.key === 'mbrut_year') {
                                const c = mbrutG >= 0 ? 'text-emerald-700' : 'text-rose-700';
                                return <td key={col.key} className={`px-3 py-2 text-right font-mono text-xs font-semibold ${c}`}>{formatNumber(mbrutG)} %</td>;
                              }
                              if (col.key === 'mmnet_year') {
                                const c = mnetG < 10 ? 'text-rose-700' : mnetG <= 20 ? 'text-orange-500' : 'text-emerald-700';
                                return <td key={col.key} className={`px-3 py-2 text-right font-mono text-xs font-semibold ${c}`}>{formatNumber(mnetG)} %</td>;
                              }
                              if (col.isPct) return <td key={col.key} className="px-3 py-2" />;
                              const tot = groupLines.reduce((s, l) => s + ((l[col.key] as number) || 0), 0);
                              const c = col.isResult ? (tot >= 0 ? 'text-emerald-700' : 'text-rose-700') : '';
                              return <td key={col.key} className={`px-3 py-2 text-right font-mono text-xs font-semibold ${c}`}>{formatNumber(tot)}</td>;
                            })}
                          </tr>
                          {/* Filas del grupo */}
                          {isOpen && groupLines.map((line) => (
                            <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                              {visibleColsList.map((col) => {
                                const val = line[col.key];
                                const isStr = typeof val === 'string' || col.key === 'year' || col.key === 'month';
                                if (isStr) return (
                                  <td key={col.key} className={`px-3 py-2 ${col.align === 'center' ? 'text-center' : ''} ${col.key === 'project_name' ? 'max-w-40 truncate' : ''} ${col.key === 'nexecution_manager' ? 'max-w-32 truncate' : ''}`}>
                                    {(val as string) || '—'}
                                  </td>
                                );
                                const num = val as number;
                                let colored = col.isResult ? (num >= 0 ? 'text-emerald-600' : 'text-rose-600') : '';
                                if (col.key === 'mmnet_year') colored = num < 10 ? 'text-rose-600 font-semibold' : num <= 20 ? 'text-orange-500 font-semibold' : 'text-emerald-600 font-semibold';
                                const fmt = col.isPct ? `${formatNumber(num)} %` : formatNumber(num);
                                return (
                                  <td key={col.key} className={`px-3 py-2 text-right font-mono ${col.isResult ? 'font-semibold ' : ''}${colored}`}>{fmt}</td>
                                );
                              })}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })
                  ) : (
                    sortedLines.map((line) => (
                      <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                        {COLUMNS.filter((c) => visibleCols.has(c.key)).map((col) => {
                          const val = line[col.key];
                          const isStr = typeof val === 'string' || col.key === 'year' || col.key === 'month';
                          if (isStr) return (
                            <td key={col.key} className={`px-3 py-2 ${col.align === 'center' ? 'text-center' : ''} ${col.key === 'project_name' ? 'max-w-40 truncate' : ''} ${col.key === 'nexecution_manager' ? 'max-w-32 truncate' : ''}`}>
                              {(val as string) || '—'}
                            </td>
                          );
                          const num = val as number;
                          let colored = col.isResult ? (num >= 0 ? 'text-emerald-600' : 'text-rose-600') : '';
                          if (col.key === 'mmnet_year') colored = num < 10 ? 'text-rose-600 font-semibold' : num <= 20 ? 'text-orange-500 font-semibold' : 'text-emerald-600 font-semibold';
                          const fmt = col.isPct ? `${formatNumber(num)} %` : formatNumber(num);
                          return (
                            <td key={col.key} className={`px-3 py-2 text-right font-mono ${col.isResult ? 'font-semibold ' : ''}${colored}`}>{fmt}</td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista de lista
  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estados de Resultados</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestiona tus tablas de resultados BIM desde el portal.
          </p>
        </div>
        <button
          onClick={() => { setShowCreateForm(true); setError(''); setSuccess(''); }}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo estado
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
          {success}
        </div>
      )}

      {/* Formulario de creación */}
      {showCreateForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Nuevo estado de resultados</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Cierre mes MAYO_26"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha desde <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha hasta <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Información fija */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-brand-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                </svg>
                <span>El responsable se asignará automáticamente a tu usuario.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-brand-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                </svg>
                <span>Los estados de proyecto aplicados serán: <strong>Ejecución, Garantía, Finalizado</strong>.</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isCreating}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
              >
                {isCreating ? 'Creando...' : 'Crear estado'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setError(''); }}
                className="text-gray-600 hover:text-gray-800 text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de estados */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">
            Mis estados de resultados
            {!isLoading && (
              <span className="ml-2 text-xs text-gray-400 font-normal">{tables.length} registros</span>
            )}
          </h2>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">Cargando...</div>
        ) : tables.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            No tienes estados de resultados asignados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-medium">Código</th>
                  <th className="px-4 py-3 text-left font-medium">Título</th>
                  <th className="px-4 py-3 text-left font-medium">Desde</th>
                  <th className="px-4 py-3 text-left font-medium">Hasta</th>
                  <th className="px-4 py-3 text-center font-medium">Líneas</th>
                  <th className="px-4 py-3 text-left font-medium">Estados</th>
                  <th className="px-4 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tables.map((table) => (
                  <tr
                    key={table.id}
                    onClick={() => !isLoadingDetail && editingTitleId !== table.id && confirmDeleteId !== table.id && handleViewDetail(table.id)}
                    className={`hover:bg-brand-50 transition-colors ${isLoadingDetail || editingTitleId === table.id || confirmDeleteId === table.id ? 'opacity-100' : 'cursor-pointer'}`}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-gray-700">{table.name}</td>
                    <td className="px-4 py-3 text-gray-800 max-w-55" onClick={(e) => e.stopPropagation()}>
                      {editingTitleId === table.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingTitleValue}
                            onChange={(e) => setEditingTitleValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTitle(table.id);
                              if (e.key === 'Escape') setEditingTitleId(null);
                            }}
                            autoFocus
                            className="flex-1 border border-brand-400 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-0"
                          />
                          <button
                            onClick={() => handleSaveTitle(table.id)}
                            disabled={isSavingTitle}
                            className="text-emerald-600 hover:text-emerald-800 text-xs px-1 disabled:opacity-50"
                          >✓</button>
                          <button
                            onClick={() => setEditingTitleId(null)}
                            className="text-gray-400 hover:text-gray-600 text-xs px-1"
                          >✕</button>
                        </div>
                      ) : (
                        <span className="truncate block">{table.title}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(table.from_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(table.to_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                        {table.line_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {table.states.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {table.states.map((s) => (
                            <span key={s} className="inline-block bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {confirmDeleteId === table.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs text-gray-500 mr-1">¿Eliminar?</span>
                          <button
                            onClick={() => handleDelete(table.id)}
                            disabled={isDeletingId === table.id}
                            className="text-xs text-rose-600 hover:text-rose-800 font-medium disabled:opacity-50"
                          >{isDeletingId === table.id ? '...' : 'Sí'}</button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                          >No</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            title="Editar título"
                            onClick={() => { setEditingTitleId(table.id); setEditingTitleValue(table.title); }}
                            className="text-gray-400 hover:text-brand-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
                            </svg>
                          </button>
                          <button
                            title="Eliminar"
                            onClick={() => setConfirmDeleteId(table.id)}
                            className="text-gray-400 hover:text-rose-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a2 2 0 00-2-2H9a2 2 0 00-2 2m10 0H5" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
