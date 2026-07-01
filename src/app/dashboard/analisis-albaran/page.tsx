'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  apiCreatePickingAnalysis,
  apiDeletePickingAnalysis,
  apiPickingAnalyses,
  apiProjects,
  apiUpdatePickingAnalysis,
  PickingAnalysisFormLine,
  PickingAnalysisItem,
  PortalProject,
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

function formatDateTime(value: string | false): string { // eslint-disable-line @typescript-eslint/no-unused-vars
  if (!value) return '—';
  // Odoo devuelve UTC sin 'Z'; añadimos 'Z' para que JS lo interprete como UTC
  // y lo convierta a la hora local del navegador (p. ej. UTC+2 → +2 h)
  const normalized = value.replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(value).toFixed(2).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${intFormatted},${decPart} €`;
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

const EMPTY_LINE = (): PickingAnalysisFormLine => ({ note: '', product_cost: 0, assets_qty: 1, oenc: false });

export default function AnalisisAlbaranPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [endDate, setEndDate] = useState<string>(toIsoDate(new Date()));
  const [formLines, setFormLines] = useState<PickingAnalysisFormLine[]>([EMPTY_LINE()]);
  const [analyses, setAnalyses] = useState<PickingAnalysisItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showZero, setShowZero] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [editingAnalysisId, setEditingAnalysisId] = useState<number | null>(null);
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [editLines, setEditLines] = useState<{ id: number; note: string; product_cost: number; oenc: boolean }[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return '—';
    return projects.find((project) => project.id === selectedProjectId)?.display_name || '—';
  }, [projects, selectedProjectId]);

  async function loadAnalyses(projectId: number | 'all' = 'all') {
    const token = getToken();
    if (!token) return;

    const res = await apiPickingAnalyses(token, projectId);
    if (!res.success) {
      throw new Error(errorToText(res.error, 'No se pudo cargar los analisis de albaran.'));
    }
    setAnalyses(res.analyses || []);
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([apiProjects(token), apiPickingAnalyses(token, 'all')])
      .then(([projectsRes, analysesRes]) => {
        if (projectsRes.success && projectsRes.projects) {
          setProjects(projectsRes.projects);
        }
        if (analysesRes.success) {
          setAnalyses(analysesRes.analyses || []);
        } else {
          setError(errorToText(analysesRes.error, 'No se pudo cargar los analisis de albaran.'));
        }
      })
      .catch(() => {
        setError('No se pudo cargar la informacion.');
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

    if (formLines.length === 0) {
      setError('Debes incluir al menos una línea.');
      return;
    }

    if (formLines.some((l) => l.assets_qty < 0)) {
      setError('La cantidad de activos no puede ser negativa.');
      return;
    }

    const token = getToken();
    if (!token) {
      setError('Sesion no valida.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await apiCreatePickingAnalysis(token, selectedProjectId, endDate, formLines, 'all');
      if (!res.success || !res.analysis) {
        setError(errorToText(res.error, 'No se pudo crear el analisis.'));
        return;
      }

      await loadAnalyses('all');
      const warningText = res.warning ? ` (aviso: ${errorToText(res.warning, 'Error en carga de líneas')})` : '';
      setSuccess(`Analisis ${res.analysis.name} creado en Odoo correctamente${warningText}.`);
      setShowCreateForm(false);
      setFormLines([EMPTY_LINE()]);
    } catch {
      setError('Error creando el analisis de albaran.');
    } finally {
      setIsCreating(false);
    }
  }

  function startEdit(analysis: PickingAnalysisItem) {
    setEditingAnalysisId(analysis.id);
    setEditEndDate(typeof analysis.end_date === 'string' ? analysis.end_date : toIsoDate(new Date()));
    setEditLines((analysis.lines ?? []).map((l) => ({ id: l.id, note: l.note, product_cost: l.product_cost, oenc: l.oenc })));
    setError('');
    setSuccess('');
  }

  async function handleSaveEdit(analysis: PickingAnalysisItem) {
    const token = getToken();
    if (!token) return;
    setIsSavingEdit(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiUpdatePickingAnalysis(token, analysis.id, editEndDate, editLines);
      if (!res.success || !res.analysis) {
        setError(errorToText(res.error, 'No se pudo guardar los cambios.'));
        return;
      }
      setAnalyses((current) => current.map((a) => a.id === analysis.id ? res.analysis as PickingAnalysisItem : a));
      setSuccess(`Análisis ${analysis.name} actualizado correctamente.`);
      setEditingAnalysisId(null);
    } catch {
      setError('Error guardando los cambios.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(analysis: PickingAnalysisItem) {
    const confirmed = window.confirm(`¿Eliminar el análisis ${analysis.name}?`);
    if (!confirmed) return;

    setError('');
    setSuccess('');

    const token = getToken();
    if (!token) {
      setError('Sesion no valida.');
      return;
    }

    try {
      const res = await apiDeletePickingAnalysis(token, analysis.id);
      if (!res.success) {
        setError(errorToText(res.error, 'No se pudo eliminar el analisis.'));
        return;
      }

      setAnalyses((current) => current.filter((item) => item.id !== analysis.id));
      setSuccess(`Analisis ${analysis.name} eliminado correctamente.`);
    } catch {
      setError('Error eliminando el analisis de albaran.');
    }
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Analisis de albaran</h1>
            <p className="mt-1 text-sm text-gray-500">Vista de lista. Pulsa en Nuevo para crear un análisis en Odoo.</p>
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
            Nuevo analisis
          </button>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        {success && <p className="mt-3 text-sm font-medium text-emerald-600">{success}</p>}
      </article>

      {showCreateForm && (
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 border-b border-gray-200 pb-3">
            <h2 className="text-lg font-semibold text-gray-800">Nuevo análisis de albarán</h2>
            <p className="text-sm text-gray-500">Formulario de creación estilo ficha, similar a Odoo.</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Proyecto
                <select
                  value={selectedProjectId === '' ? '' : String(selectedProjectId)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedProjectId(value ? Number(value) : '');
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
                Fecha fin
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-400"
                  required
                />
              </label>
            </div>

            {/* Tabla de líneas */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Líneas</span>
                <button
                  type="button"
                  onClick={() => setFormLines((prev) => [...prev, EMPTY_LINE()])}
                  className="rounded-md border border-brand-400 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                >
                  + Añadir línea
                </button>
              </div>
              <div className="overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Nota</th>
                      <th className="px-3 py-2 text-right">Costo producto</th>
                      <th className="px-3 py-2 text-right">Cant. activos</th>
                      <th className="px-3 py-2 text-center">OENC</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formLines.map((line, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={line.note}
                            onChange={(e) => setFormLines((prev) => prev.map((l, i) => i === idx ? { ...l, note: e.target.value } : l))}
                            placeholder="Nota de la línea"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand-400"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={line.product_cost}
                            onChange={(e) => setFormLines((prev) => prev.map((l, i) => i === idx ? { ...l, product_cost: Number(e.target.value || 0) } : l))}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm outline-none focus:border-brand-400"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.assets_qty}
                            onChange={(e) => setFormLines((prev) => prev.map((l, i) => i === idx ? { ...l, assets_qty: Number(e.target.value || 0) } : l))}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-right text-sm outline-none focus:border-brand-400"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={line.oenc}
                            onChange={(e) => setFormLines((prev) => prev.map((l, i) => i === idx ? { ...l, oenc: e.target.checked } : l))}
                            className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                            title="Obra en ejecución no certificada"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {formLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormLines((prev) => prev.filter((_, i) => i !== idx))}
                              className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Mis analisis</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowZero((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                showZero
                  ? 'border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
              }`}
            >
              {showZero ? 'Ocultar en 0' : 'Mostrar en 0'}
            </button>
            <span className="text-sm text-gray-500">{analyses.length} registros</span>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Cargando analisis...</p>
        ) : (
          <div className="overflow-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2">Codigo</th>
                  <th className="px-3 py-2">Proyecto</th>
                  <th className="px-3 py-2">Fecha fin</th>
                  <th className="px-3 py-2">Creado</th>
                  <th className="px-3 py-2">Fecha creacion</th>
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2 text-center">OENC</th>
                  <th className="px-3 py-2 text-right">Cant. Activo</th>
                  <th className="px-3 py-2 text-right">Costo unit.</th>
                  <th className="px-3 py-2 text-right">Total parcial</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {analyses.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-4 text-center text-sm text-gray-500">
                      No hay analisis de albaran creados.
                    </td>
                  </tr>
                ) : (
                  analyses
                    .filter((a) => showZero || a.subtotal !== 0)
                    .map((analysis) => {
                    const lines = analysis.lines ?? [];
                    const isEditing = editingAnalysisId === analysis.id;
                    const rowSpan = lines.length > 0 ? lines.length + (isEditing ? 1 : 0) : undefined;
                    return lines.length > 0 ? (
                      <React.Fragment key={analysis.id}>
                        {lines.map((line, idx) => (
                          <tr key={`${analysis.id}-${idx}`} className="border-t border-gray-100 text-gray-700">
                            {idx === 0 ? (
                              <>
                                <td className="px-3 py-2 font-semibold align-top" rowSpan={rowSpan}>{analysis.name}</td>
                                <td className="px-3 py-2 align-top" rowSpan={rowSpan}>{analysis.project_name || '—'}</td>
                                <td className="px-3 py-2 align-top" rowSpan={rowSpan}>{formatDate(analysis.end_date)}</td>
                                <td className="px-3 py-2 align-top" rowSpan={rowSpan}>{analysis.created_by || '—'}</td>
                                <td className="px-3 py-2 align-top" rowSpan={rowSpan}>{formatDateTime(analysis.create_date)}</td>
                              </>
                            ) : null}
                            <td className="px-3 py-2">{line.note || '—'}</td>
                            <td className="px-3 py-2 text-center">{line.oenc ? <span title="Obra en ejecución no certificada" className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700">OENC</span> : null}</td>
                            <td className="px-3 py-2 text-right">{line.assets_qty}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(line.product_cost)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(line.subtotal)}</td>
                            {idx === 0 ? (
                              <td className="px-3 py-2 text-right align-top" rowSpan={rowSpan}>
                                <div className="flex flex-col items-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => isEditing ? setEditingAnalysisId(null) : startEdit(analysis)}
                                    className="rounded-md border border-brand-300 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                                  >
                                    {isEditing ? 'Cancelar' : 'Editar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(analysis)}
                                    className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                        {isEditing && (
                          <tr className="border-t-2 border-brand-200 bg-brand-50/40">
                            <td colSpan={11} className="px-4 py-3">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-4">
                                  <label className="text-xs font-semibold text-gray-600">
                                    Fecha fin
                                    <input
                                      type="date"
                                      value={editEndDate}
                                      onChange={(e) => setEditEndDate(e.target.value)}
                                      className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand-400"
                                    />
                                  </label>
                                </div>
                                <table className="w-full text-sm">
                                  <thead className="text-xs font-bold uppercase text-gray-500">
                                    <tr>
                                      <th className="pb-1 text-left">Nota</th>
                                      <th className="pb-1 text-right">Costo producto</th>
                                      <th className="pb-1 text-center">OENC</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {editLines.map((el, i) => (
                                      <tr key={el.id}>
                                        <td className="pr-3 py-1">
                                          <input
                                            type="text"
                                            value={el.note}
                                            onChange={(e) => setEditLines((prev) => prev.map((r, j) => j === i ? { ...r, note: e.target.value } : r))}
                                            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none focus:border-brand-400"
                                          />
                                        </td>
                                        <td className="py-1 w-36">
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={el.product_cost}
                                            onChange={(e) => setEditLines((prev) => prev.map((r, j) => j === i ? { ...r, product_cost: Number(e.target.value || 0) } : r))}
                                            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-800 outline-none focus:border-brand-400"
                                          />
                                        </td>
                                        <td className="py-1 w-16 text-center">
                                          <input
                                            type="checkbox"
                                            checked={el.oenc}
                                            onChange={(e) => setEditLines((prev) => prev.map((r, j) => j === i ? { ...r, oenc: e.target.checked } : r))}
                                            className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                                            title="Obra en ejecución no certificada"
                                          />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingAnalysisId(null)}
                                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSavingEdit}
                                    onClick={() => handleSaveEdit(analysis)}
                                    className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                                  >
                                    {isSavingEdit ? 'Guardando...' : 'Guardar'}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ) : (
                      <React.Fragment key={analysis.id}>
                        <tr className="border-t border-gray-100 text-gray-700">
                          <td className="px-3 py-2 font-semibold">{analysis.name}</td>
                          <td className="px-3 py-2">{analysis.project_name || '—'}</td>
                          <td className="px-3 py-2">{formatDate(analysis.end_date)}</td>
                          <td className="px-3 py-2">{analysis.created_by || '—'}</td>
                          <td className="px-3 py-2">{formatDateTime(analysis.create_date)}</td>
                          <td className="px-3 py-2">—</td>
                          <td className="px-3 py-2 text-center">—</td>
                          <td className="px-3 py-2 text-right">—</td>
                          <td className="px-3 py-2 text-right">—</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(analysis.subtotal)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <button
                                type="button"
                                onClick={() => editingAnalysisId === analysis.id ? setEditingAnalysisId(null) : startEdit(analysis)}
                                className="rounded-md border border-brand-300 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                              >
                                {editingAnalysisId === analysis.id ? 'Cancelar' : 'Editar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(analysis)}
                                className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editingAnalysisId === analysis.id && (
                          <tr className="border-t-2 border-brand-200 bg-brand-50/40">
                            <td colSpan={11} className="px-4 py-3">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-4">
                                  <label className="text-xs font-semibold text-gray-600">
                                    Fecha fin
                                    <input
                                      type="date"
                                      value={editEndDate}
                                      onChange={(e) => setEditEndDate(e.target.value)}
                                      className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none focus:border-brand-400"
                                    />
                                  </label>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingAnalysisId(null)}
                                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSavingEdit}
                                    onClick={() => handleSaveEdit(analysis)}
                                    className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                                  >
                                    {isSavingEdit ? 'Guardando...' : 'Guardar'}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
