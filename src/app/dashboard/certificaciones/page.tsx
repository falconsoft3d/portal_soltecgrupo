'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  apiCertifications,
  apiCertificationLines,
  apiCertifyCertification,
  apiCreateCertification,
  apiProjectBudgets,
  apiProjects,
  apiUpdateCertificationLine,
  apiValidateCertification,
  CertificationItem,
  CertificationLineItem,
  PortalProject,
  ProjectBudgetItem,
} from '@/lib/api';
import { getToken } from '@/lib/auth';

function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(value || 0).toFixed(2).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${intFormatted},${decPart} €`;
}

function formatQty(value: number): string {
  return (value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function errorToText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') {
    const maybeError = value as { message?: unknown };
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) return maybeError.message;
  }
  return fallback;
}

const STATE_LABELS: Record<string, string> = {
  draft: 'Borrador',
  loaded: 'Cargado',
  ready: 'Validado',
  done: 'Certificado',
  cancelled: 'Cancelado',
};

function stateBadge(state: string): string {
  if (state === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (state === 'ready') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (state === 'loaded') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (state === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

export default function CertificacionesPage() {
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [budgets, setBudgets] = useState<ProjectBudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | ''>('');
  const [isCreating, setIsCreating] = useState(false);

  const [openCertification, setOpenCertification] = useState<CertificationItem | null>(null);
  const [lines, setLines] = useState<CertificationLineItem[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [savingLineId, setSavingLineId] = useState<number | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCertifying, setIsCertifying] = useState(false);

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return '—';
    return projects.find((p) => p.id === selectedProjectId)?.display_name || '—';
  }, [projects, selectedProjectId]);

  async function loadCertifications() {
    const token = getToken();
    if (!token) return;
    const res = await apiCertifications(token, 'all');
    if (!res.success) {
      throw new Error(errorToText(res.error, 'No se pudieron cargar las certificaciones.'));
    }
    setCertifications(res.certifications || []);
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([apiProjects(token), apiCertifications(token, 'all')])
      .then(([projectsRes, certificationsRes]) => {
        if (projectsRes.success && projectsRes.projects) {
          setProjects(projectsRes.projects);
        }
        if (certificationsRes.success) {
          setCertifications(certificationsRes.certifications || []);
        } else {
          setError(errorToText(certificationsRes.error, 'No se pudieron cargar las certificaciones.'));
        }
      })
      .catch(() => setError('No se pudo cargar la información inicial.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setBudgets([]);
      setSelectedBudgetId('');
      return;
    }
    const token = getToken();
    if (!token) return;
    apiProjectBudgets(token, selectedProjectId).then((res) => {
      if (res.success) setBudgets(res.budgets || []);
    });
  }, [selectedProjectId]);

  async function openLines(certification: CertificationItem) {
    setError('');
    setSuccess('');
    setOpenCertification(certification);
    setIsLoadingLines(true);
    try {
      const token = getToken();
      if (!token) return;
      const res = await apiCertificationLines(token, certification.id);
      if (!res.success) {
        setError(errorToText(res.error, 'No se pudieron cargar las líneas de la certificación.'));
        return;
      }
      setLines(res.lines || []);
      if (res.certification) setOpenCertification(res.certification);
    } finally {
      setIsLoadingLines(false);
    }
  }

  function closeLines() {
    setOpenCertification(null);
    setLines([]);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedProjectId || !selectedBudgetId) {
      setError('Debes seleccionar un proyecto y un presupuesto.');
      return;
    }

    const token = getToken();
    if (!token) return;

    setIsCreating(true);
    try {
      const res = await apiCreateCertification(token, selectedProjectId, selectedBudgetId);
      if (!res.success || !res.certification) {
        setError(errorToText(res.error, 'No se pudo crear la certificación.'));
        return;
      }
      await loadCertifications();
      setSuccess(`Certificación ${res.certification.name} creada correctamente.`);
      setShowCreateForm(false);
      setSelectedProjectId('');
      setSelectedBudgetId('');
      await openLines(res.certification);
    } catch {
      setError('Error creando la certificación.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveQuantity(line: CertificationLineItem, value: string) {
    const qty = parseFloat(value.replace(',', '.'));
    if (Number.isNaN(qty)) {
      setError('Cantidad no válida.');
      return;
    }
    const token = getToken();
    if (!token) return;

    setSavingLineId(line.id);
    setError('');
    try {
      const res = await apiUpdateCertificationLine(token, line.id, qty);
      if (!res.success || !res.line) {
        setError(errorToText(res.error, 'No se pudo actualizar la línea.'));
        return;
      }
      setLines((current) => current.map((l) => (l.id === line.id ? res.line as CertificationLineItem : l)));
      if (res.certification) setOpenCertification(res.certification);
    } finally {
      setSavingLineId(null);
    }
  }

  async function handleValidate() {
    if (!openCertification) return;
    const token = getToken();
    if (!token) return;

    setIsValidating(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiValidateCertification(token, openCertification.id);
      if (!res.success || !res.certification) {
        setError(errorToText(res.error, 'No se pudo validar la certificación.'));
        return;
      }
      setOpenCertification(res.certification);
      await loadCertifications();
      setSuccess('Certificación validada correctamente.');
    } finally {
      setIsValidating(false);
    }
  }

  async function handleCertify() {
    if (!openCertification) return;
    const token = getToken();
    if (!token) return;

    setIsCertifying(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiCertifyCertification(token, openCertification.id);
      if (!res.success || !res.certification) {
        setError(errorToText(res.error, 'No se pudo certificar.'));
        return;
      }
      setOpenCertification(res.certification);
      await loadCertifications();
      setSuccess(
        res.paidstate
          ? `Certificación certificada. Se ha creado el Estado de Pago ${res.paidstate.name}.`
          : 'Certificación certificada correctamente.',
      );
    } finally {
      setIsCertifying(false);
    }
  }

  if (isLoading) {
    return <div className="p-6 text-gray-500">Cargando certificaciones...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Certificaciones</h1>
          <p className="text-sm text-gray-500">Gestiona las certificaciones de tus obras hasta generar el estado de pago.</p>
        </div>
        {!openCertification && (
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="px-4 py-2 rounded-md bg-purple-800 text-white text-sm font-medium hover:bg-purple-900"
          >
            {showCreateForm ? 'Cancelar' : 'Nueva certificación'}
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 rounded-md bg-rose-50 text-rose-700 text-sm border border-rose-200">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-md bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">{success}</div>}

      {!openCertification && showCreateForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 rounded-lg border border-gray-200 bg-white shadow-sm space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Proyecto</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Selecciona un proyecto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Presupuesto</label>
            <select
              value={selectedBudgetId}
              onChange={(e) => setSelectedBudgetId(e.target.value ? Number(e.target.value) : '')}
              disabled={!selectedProjectId}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            >
              <option value="">Selecciona un presupuesto</option>
              {budgets.map((budget) => (
                <option key={budget.id} value={budget.id}>{budget.display_name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400">Proyecto: {selectedProjectName}. Las líneas de la etapa actual se cargarán automáticamente.</p>
          <button
            type="submit"
            disabled={isCreating}
            className="px-4 py-2 rounded-md bg-purple-800 text-white text-sm font-medium hover:bg-purple-900 disabled:opacity-50"
          >
            {isCreating ? 'Creando...' : 'Crear certificación'}
          </button>
        </form>
      )}

      {!openCertification && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Proyecto</th>
                <th className="px-4 py-2 text-left">Presupuesto</th>
                <th className="px-4 py-2 text-left">Etapa</th>
                <th className="px-4 py-2 text-right">% Certif.</th>
                <th className="px-4 py-2 text-right">Total Certif.</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {certifications.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">No hay certificaciones todavía.</td>
                </tr>
              )}
              {certifications.map((cert) => (
                <tr key={cert.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{cert.name}</td>
                  <td className="px-4 py-2 text-gray-600">{cert.project_name}</td>
                  <td className="px-4 py-2 text-gray-600">{cert.budget_name}</td>
                  <td className="px-4 py-2 text-gray-600">{cert.stage_name || '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{formatQty(cert.percent_certif)}%</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(cert.total_certif)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${stateBadge(cert.state)}`}>
                      {STATE_LABELS[cert.state] || cert.state}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => openLines(cert)} className="text-purple-800 text-xs font-medium hover:underline">
                      Ver / Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openCertification && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div>
              <button onClick={closeLines} className="text-xs text-gray-500 hover:underline mb-1">← Volver al listado</button>
              <h2 className="text-lg font-semibold text-gray-900">{openCertification.name}</h2>
              <p className="text-sm text-gray-500">{openCertification.project_name} · {openCertification.budget_name} · {openCertification.stage_name || 'Sin etapa'}</p>
            </div>
            <div className="text-right">
              <span className={`px-2 py-0.5 rounded-full text-xs border ${stateBadge(openCertification.state)}`}>
                {STATE_LABELS[openCertification.state] || openCertification.state}
              </span>
              <p className="text-sm text-gray-900 mt-1">Total: {formatCurrency(openCertification.total_certif)}</p>
            </div>
          </div>

          <div className="p-4 overflow-x-auto">
            {isLoadingLines ? (
              <div className="text-gray-500 text-sm">Cargando líneas...</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Capítulo</th>
                    <th className="px-3 py-2 text-left">Partida</th>
                    <th className="px-3 py-2 text-right">Cant. Presup.</th>
                    <th className="px-3 py-2 text-right">Cant. Anterior</th>
                    <th className="px-3 py-2 text-right">Imp. Anterior</th>
                    <th className="px-3 py-2 text-right">Cant. Actual</th>
                    <th className="px-3 py-2 text-right">Imp. Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-400">Sin líneas cargadas.</td>
                    </tr>
                  )}
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 text-gray-600">{line.chapter}</td>
                      <td className="px-3 py-2 text-gray-900">{line.concept}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.budget_qty)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.qty_acc)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(line.imp_ant)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={line.quantity_to_cert}
                          disabled={savingLineId === line.id || !['draft', 'loaded'].includes(openCertification.state)}
                          onBlur={(e) => {
                            if (e.target.value !== String(line.quantity_to_cert)) {
                              handleSaveQuantity(line, e.target.value);
                            }
                          }}
                          className="w-24 text-right border border-gray-300 rounded-md px-2 py-1 text-sm disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 font-medium">{formatCurrency(line.amount_certif)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3">
            {['draft', 'loaded'].includes(openCertification.state) && (
              <button
                onClick={handleValidate}
                disabled={isValidating}
                className="px-4 py-2 rounded-md bg-sky-700 text-white text-sm font-medium hover:bg-sky-800 disabled:opacity-50"
              >
                {isValidating ? 'Validando...' : 'Validar'}
              </button>
            )}
            {openCertification.state === 'ready' && (
              <button
                onClick={handleCertify}
                disabled={isCertifying}
                className="px-4 py-2 rounded-md bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
              >
                {isCertifying ? 'Certificando...' : 'Certificar'}
              </button>
            )}
            {openCertification.state === 'done' && (
              <span className="text-sm text-emerald-700">
                Certificación completada{openCertification.paid_state_id ? '. Ya está disponible en Estados de pago.' : '.'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
