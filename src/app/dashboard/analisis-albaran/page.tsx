'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  apiCreatePickingAnalysis,
  apiDeletePickingAnalysis,
  apiPickingAnalyses,
  apiProjects,
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

export default function AnalisisAlbaranPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [endDate, setEndDate] = useState<string>(toIsoDate(new Date()));
  const [lineNote, setLineNote] = useState<string>('');
  const [lineCost, setLineCost] = useState<number>(0);
  const [assetsQty, setAssetsQty] = useState<number>(1);
  const [analyses, setAnalyses] = useState<PickingAnalysisItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showZero, setShowZero] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

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

    if (assetsQty < 0) {
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
      const res = await apiCreatePickingAnalysis(token, selectedProjectId, endDate, lineNote, lineCost, assetsQty, 'all');
      if (!res.success || !res.analysis) {
        setError(errorToText(res.error, 'No se pudo crear el analisis.'));
        return;
      }

      await loadAnalyses('all');
      const warningText = res.warning ? ` (aviso: ${errorToText(res.warning, 'Error en carga de líneas')})` : '';
      setSuccess(`Analisis ${res.analysis.name} creado en Odoo correctamente${warningText}.`);
      setShowCreateForm(false);
      setLineNote('');
      setLineCost(0);
      setAssetsQty(1);
    } catch {
      setError('Error creando el analisis de albaran.');
    } finally {
      setIsCreating(false);
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
                      {project.display_name}
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

              <label className="text-sm font-medium text-gray-700">
                Nota (línea)
                <input
                  type="text"
                  value={lineNote}
                  onChange={(event) => setLineNote(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-400"
                  required
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Costo del producto
                <input
                  type="number"
                  step="0.01"
                  value={lineCost}
                  onChange={(event) => setLineCost(Number(event.target.value || 0))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-400"
                  required
                />
              </label>

              <label className="text-sm font-medium text-gray-700">
                Cnt de activos
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={assetsQty}
                  onChange={(event) => setAssetsQty(Number(event.target.value || 0))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-400"
                  required
                />
              </label>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <p><span className="font-semibold">Proyecto:</span> {selectedProjectName}</p>
              <p><span className="font-semibold">Fecha fin:</span> {endDate || '—'}</p>
              <p><span className="font-semibold">Nota:</span> {lineNote || '—'}</p>
              <p><span className="font-semibold">Costo:</span> {formatCurrency(lineCost || 0)}</p>
              <p><span className="font-semibold">Cnt activos:</span> {assetsQty}</p>
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
                  <th className="px-3 py-2 text-right">Cant. Activo</th>
                  <th className="px-3 py-2 text-right">Costo unit.</th>
                  <th className="px-3 py-2 text-right">Total parcial</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {analyses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-4 text-center text-sm text-gray-500">
                      No hay analisis de albaran creados.
                    </td>
                  </tr>
                ) : (
                  analyses
                    .filter((a) => showZero || a.subtotal !== 0)
                    .map((analysis) =>
                    (analysis.lines ?? []).length > 0 ? (
                      (analysis.lines ?? []).map((line, idx) => (
                        <tr key={`${analysis.id}-${idx}`} className="border-t border-gray-100 text-gray-700">
                          {idx === 0 ? (
                            <>
                              <td className="px-3 py-2 font-semibold" rowSpan={(analysis.lines ?? []).length}>{analysis.name}</td>
                              <td className="px-3 py-2" rowSpan={(analysis.lines ?? []).length}>{analysis.project_name || '—'}</td>
                              <td className="px-3 py-2" rowSpan={(analysis.lines ?? []).length}>{formatDate(analysis.end_date)}</td>
                              <td className="px-3 py-2" rowSpan={(analysis.lines ?? []).length}>{analysis.created_by || '—'}</td>
                              <td className="px-3 py-2" rowSpan={(analysis.lines ?? []).length}>{formatDateTime(analysis.create_date)}</td>
                            </>
                          ) : null}
                          <td className="px-3 py-2">{line.note || '—'}</td>
                          <td className="px-3 py-2 text-right">{line.assets_qty}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(line.product_cost)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(line.subtotal)}</td>
                          {idx === 0 ? (
                            <td className="px-3 py-2 text-right" rowSpan={(analysis.lines ?? []).length}>
                              <button
                                type="button"
                                onClick={() => handleDelete(analysis)}
                                className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                              >
                                Eliminar
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr key={analysis.id} className="border-t border-gray-100 text-gray-700">
                        <td className="px-3 py-2 font-semibold">{analysis.name}</td>
                        <td className="px-3 py-2">{analysis.project_name || '—'}</td>
                        <td className="px-3 py-2">{formatDate(analysis.end_date)}</td>
                        <td className="px-3 py-2">{analysis.created_by || '—'}</td>
                        <td className="px-3 py-2">{formatDateTime(analysis.create_date)}</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(analysis.subtotal)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(analysis)}
                            className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
