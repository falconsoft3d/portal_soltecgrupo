'use client';

import Link from 'next/link';
import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  apiCertifications,
  apiCertificationLines,
  apiCertifyCertification,
  apiCreateCertification,
  apiDeleteCertification,
  apiProjectBudgets,
  apiProjects,
  apiResetDraftCertification,
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

function formatRatio(quantity: number, hours: number): string {
  if (!hours) return '—';
  return formatQty(quantity / hours);
}

function formatCurrencyRatio(amount: number, hours: number): string {
  if (!hours) return '—';
  return formatCurrency(amount / hours);
}

function formatProjectedQty(periodHours: number, budgetQty: number, hoursPresup: number): string {
  if (!hoursPresup) return '—';
  return formatQty((budgetQty / hoursPresup) * periodHours);
}

function projectedAmountValue(periodHours: number, budgetQty: number, hoursPresup: number, price: number): number {
  if (!hoursPresup) return 0;
  return (budgetQty / hoursPresup) * periodHours * price;
}

function formatProjectedAmount(periodHours: number, budgetQty: number, hoursPresup: number, price: number): string {
  if (!hoursPresup) return '—';
  return formatCurrency(projectedAmountValue(periodHours, budgetQty, hoursPresup, price));
}

function formatProgressPercent(periodHours: number, budgetQty: number, hoursPresup: number): string {
  if (!hoursPresup || !budgetQty) return '—';
  const udT = (budgetQty / hoursPresup) * periodHours;
  return `${Math.round((udT / budgetQty) * 100)}%`;
}

function formatRealProgressPercent(periodQty: number, budgetQty: number): string {
  if (!budgetQty) return '—';
  return `${Math.round((periodQty / budgetQty) * 100)}%`;
}

function formatStageDate(value: string | false): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

const STAGE_STATE_LABELS: Record<string, string> = {
  draft: 'Pendiente',
  process: 'Actual',
  approved: 'Aprobada',
  cancel: 'Cancelada',
};

function stageStateBadge(state: string): string {
  if (state === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (state === 'process') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (state === 'cancel') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

function errorToText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') {
    const maybeError = value as { message?: unknown };
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) return maybeError.message;
  }
  return fallback;
}

interface ChapterNode {
  key: string;
  name: string;
  children: ChapterNode[];
  lines: CertificationLineItem[];
  subtotal: number;
  impPresupTotal: number;
  eurTAntTotal: number;
  impAntTotal: number;
  eurTOriTotal: number;
  impOriTotal: number;
  eurTActTotal: number;
  impActTotal: number;
  hasQuantity: boolean;
}

function buildChapterTree(lines: CertificationLineItem[]): ChapterNode[] {
  const roots: ChapterNode[] = [];

  for (const line of lines) {
    const path = line.chapter_path && line.chapter_path.length ? line.chapter_path : [line.chapter || 'Sin capítulo'];
    let siblings = roots;
    let node: ChapterNode | undefined;
    let keyPrefix = '';
    for (const name of path) {
      keyPrefix = `${keyPrefix}/${name}`;
      node = siblings.find((n) => n.key === keyPrefix);
      if (!node) {
        node = {
          key: keyPrefix,
          name,
          children: [],
          lines: [],
          subtotal: 0,
          impPresupTotal: 0,
          eurTAntTotal: 0,
          impAntTotal: 0,
          eurTOriTotal: 0,
          impOriTotal: 0,
          eurTActTotal: 0,
          impActTotal: 0,
          hasQuantity: false,
        };
        siblings.push(node);
      }
      siblings = node.children;
    }
    if (node) node.lines.push(line);
  }

  function computeSubtotal(node: ChapterNode): number {
    let impActTotal = node.lines.reduce((s, l) => s + (l.amount_certif || 0), 0);
    let impPresupTotal = node.lines.reduce((s, l) => s + (l.amount_budget || 0), 0);
    let impAntTotal = node.lines.reduce((s, l) => s + (l.imp_ant || 0), 0);
    let impOriTotal = node.lines.reduce((s, l) => s + (l.imp_orig || 0), 0);
    let eurTAntTotal = node.lines.reduce(
      (s, l) => s + projectedAmountValue(l.hours_ant, l.budget_qty, l.hours_presup, l.sale_price),
      0,
    );
    let eurTOriTotal = node.lines.reduce(
      (s, l) => s + projectedAmountValue(l.hours_ori, l.budget_qty, l.hours_presup, l.sale_price),
      0,
    );
    let eurTActTotal = node.lines.reduce(
      (s, l) => s + projectedAmountValue(l.hours_act, l.budget_qty, l.hours_presup, l.sale_price),
      0,
    );
    let hasQuantity = node.lines.some((l) => (l.quantity_to_cert || 0) > 0);
    for (const child of node.children) {
      computeSubtotal(child);
      impActTotal += child.impActTotal;
      impPresupTotal += child.impPresupTotal;
      impAntTotal += child.impAntTotal;
      impOriTotal += child.impOriTotal;
      eurTAntTotal += child.eurTAntTotal;
      eurTOriTotal += child.eurTOriTotal;
      eurTActTotal += child.eurTActTotal;
      hasQuantity = hasQuantity || child.hasQuantity;
    }
    node.impActTotal = impActTotal;
    node.impPresupTotal = impPresupTotal;
    node.impAntTotal = impAntTotal;
    node.impOriTotal = impOriTotal;
    node.eurTAntTotal = eurTAntTotal;
    node.eurTOriTotal = eurTOriTotal;
    node.eurTActTotal = eurTActTotal;
    node.subtotal = impActTotal;
    node.hasQuantity = hasQuantity;
    return impActTotal;
  }
  roots.forEach(computeSubtotal);

  return roots;
}

function collectChapterKeys(nodes: ChapterNode[]): string[] {
  let keys: string[] = [];
  for (const node of nodes) {
    keys.push(node.key);
    keys = keys.concat(collectChapterKeys(node.children));
  }
  return keys;
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
  const [projSearchQ, setProjSearchQ] = useState('');
  const [projDropOpen, setProjDropOpen] = useState(false);
  const [budgetSearchQ, setBudgetSearchQ] = useState('');
  const [budgetDropOpen, setBudgetDropOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [openCertification, setOpenCertification] = useState<CertificationItem | null>(null);
  const [lines, setLines] = useState<CertificationLineItem[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [savingLineId, setSavingLineId] = useState<number | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCertifying, setIsCertifying] = useState(false);
  const [isResettingDraft, setIsResettingDraft] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [onlyHoursAct, setOnlyHoursAct] = useState(false);

  const filteredLines = useMemo(
    () => (onlyHoursAct ? lines.filter((l) => l.hours_act > 0) : lines),
    [lines, onlyHoursAct],
  );
  const groupedLines = useMemo(() => buildChapterTree(filteredLines), [filteredLines]);

  const hoursTotals = useMemo(
    () =>
      filteredLines.reduce(
        (acc, l) => ({
          hours_presup: acc.hours_presup + (l.hours_presup || 0),
          hours_ant: acc.hours_ant + (l.hours_ant || 0),
          hours_ori: acc.hours_ori + (l.hours_ori || 0),
          hours_act: acc.hours_act + (l.hours_act || 0),
        }),
        { hours_presup: 0, hours_ant: 0, hours_ori: 0, hours_act: 0 },
      ),
    [filteredLines],
  );

  const allChapterKeys = useMemo(() => collectChapterKeys(groupedLines), [groupedLines]);
  const allChaptersExpanded = allChapterKeys.length > 0 && allChapterKeys.every((key) => expandedChapters.has(key));

  function toggleExpandAll() {
    setExpandedChapters(allChaptersExpanded ? new Set() : new Set(allChapterKeys));
  }

  function toggleChapter(chapter: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });
  }

  function countLines(node: ChapterNode): number {
    return node.lines.length + node.children.reduce((s, c) => s + countLines(c), 0);
  }

  function renderChapterNode(node: ChapterNode, depth: number) {
    const isOpen = onlyHoursAct || expandedChapters.has(node.key);
    const indent = 12 + depth * 20;
    const rowClass = node.hasQuantity
      ? 'bg-emerald-50 cursor-pointer hover:bg-emerald-100'
      : 'bg-gray-50 cursor-pointer hover:bg-gray-100';
    const nameClass = node.hasQuantity ? 'font-semibold text-emerald-700' : 'font-semibold text-gray-800';
    return (
      <React.Fragment key={node.key}>
        <tr onClick={() => toggleChapter(node.key)} className={rowClass}>
          <td className={`py-2 ${nameClass}`} style={{ paddingLeft: indent, paddingRight: 12 }}>
            <span className="inline-block w-4 text-gray-400">{isOpen ? '▼' : '▶'}</span>
            {node.name}
            <span className="ml-2 text-xs font-normal text-gray-400">({countLines(node)} partidas)</span>
          </td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(node.impPresupTotal)}</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(node.eurTAntTotal)}</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(node.impAntTotal)}</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(node.eurTOriTotal)}</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(node.impOriTotal)}</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(node.eurTActTotal)}</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(node.impActTotal)}</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
        </tr>
        {isOpen && node.children.map((child) => renderChapterNode(child, depth + 1))}
        {isOpen && node.lines.map((line) => (
          <React.Fragment key={line.id}>
            <tr>
              <td className="py-2 text-gray-900" style={{ paddingLeft: indent + 20, paddingRight: 12 }}>{line.concept}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.hours_presup)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatRatio(line.budget_qty, line.hours_presup)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatCurrencyRatio(line.amount_budget, line.hours_presup)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.budget_qty)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(line.sale_price)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(line.amount_budget)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.hours_ant)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatProjectedQty(line.hours_ant, line.budget_qty, line.hours_presup)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatProjectedAmount(line.hours_ant, line.budget_qty, line.hours_presup, line.sale_price)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatProgressPercent(line.hours_ant, line.budget_qty, line.hours_presup)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.qty_acc)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(line.imp_ant)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatRealProgressPercent(line.qty_acc, line.budget_qty)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.hours_ori)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatProjectedQty(line.hours_ori, line.budget_qty, line.hours_presup)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatProjectedAmount(line.hours_ori, line.budget_qty, line.hours_presup, line.sale_price)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatProgressPercent(line.hours_ori, line.budget_qty, line.hours_presup)}</td>
              <td className="px-3 py-2 text-right">
                <input
                  key={`canorig-${line.id}-${line.quantity_to_cert_o}`}
                  type="number"
                  step="0.01"
                  defaultValue={line.quantity_to_cert_o}
                  disabled={savingLineId === line.id || !openCertification || !['draft', 'loaded'].includes(openCertification.state)}
                  onBlur={(e) => {
                    if (e.target.value !== String(line.quantity_to_cert_o)) {
                      handleSaveQuantity(line, 'quantity_to_cert_o', e.target.value);
                    }
                  }}
                  className="w-24 text-right border border-gray-300 rounded-md px-2 py-1 text-sm bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </td>
              <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(line.imp_orig)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatRealProgressPercent(line.quantity_to_cert_o, line.budget_qty)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.hours_act)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatProjectedQty(line.hours_act, line.budget_qty, line.hours_presup)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatProjectedAmount(line.hours_act, line.budget_qty, line.hours_presup, line.sale_price)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatProgressPercent(line.hours_act, line.budget_qty, line.hours_presup)}</td>
              <td className="px-3 py-2 text-right">
                <input
                  key={`canact-${line.id}-${line.quantity_to_cert}`}
                  type="number"
                  step="0.01"
                  defaultValue={line.quantity_to_cert}
                  disabled={savingLineId === line.id || !openCertification || !['draft', 'loaded'].includes(openCertification.state)}
                  onBlur={(e) => {
                    if (e.target.value !== String(line.quantity_to_cert)) {
                      handleSaveQuantity(line, 'quantity_to_cert', e.target.value);
                    }
                  }}
                  className="w-24 text-right border border-gray-300 rounded-md px-2 py-1 text-sm bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </td>
              <td className="px-3 py-2 text-right text-gray-900 font-medium">{formatCurrency(line.amount_certif)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatRealProgressPercent(line.quantity_to_cert, line.budget_qty)}</td>
            </tr>
            {line.labor_resources.map((labor) => (
              <tr key={`labor-${labor.id}`} className="bg-sky-50/60">
                <td className="py-1.5 text-xs text-sky-800" style={{ paddingLeft: indent + 36, paddingRight: 12 }}>
                  ↳ {labor.name}
                </td>
                <td className="px-3 py-1.5 text-right text-sky-800 font-medium">{formatQty(labor.hours_presup)}</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-sky-800 font-medium">{formatQty(labor.hours_ant)}</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-sky-800 font-medium">{formatQty(labor.hours_ori)}</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-sky-800 font-medium">{formatQty(labor.hours_act)}</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
                <td className="px-3 py-1.5 text-right text-gray-400">—</td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </React.Fragment>
    );
  }


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
    setSelectedBudgetId('');
    if (!selectedProjectId) {
      setBudgets([]);
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
    setExpandedChapters(new Set());
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
    setExpandedChapters(new Set());
  }

  async function handleDeleteCertification(certification: CertificationItem) {
    if (!window.confirm(`¿Eliminar la certificación ${certification.name}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError('');
    setSuccess('');
    setDeletingId(certification.id);
    try {
      const token = getToken();
      if (!token) return;
      const res = await apiDeleteCertification(token, certification.id);
      if (!res.success) {
        setError(errorToText(res.error, 'No se pudo eliminar la certificación.'));
        return;
      }
      setCertifications((prev) => prev.filter((c) => c.id !== certification.id));
      setSuccess('Certificación eliminada correctamente.');
    } finally {
      setDeletingId(null);
    }
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

  async function handleSaveQuantity(line: CertificationLineItem, field: 'quantity_to_cert' | 'quantity_to_cert_o', value: string) {
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
      const res = await apiUpdateCertificationLine(token, line.id, field, qty);
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

  async function handleResetDraft() {
    if (!openCertification) return;
    if (!window.confirm('¿Volver esta certificación a Borrador? Podrás editar las cantidades de nuevo.')) {
      return;
    }
    const token = getToken();
    if (!token) return;

    setIsResettingDraft(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiResetDraftCertification(token, openCertification.id);
      if (!res.success || !res.certification) {
        setError(errorToText(res.error, 'No se pudo volver a borrador.'));
        return;
      }
      setOpenCertification(res.certification);
      await loadCertifications();
      setSuccess('Certificación devuelta a Borrador.');
    } finally {
      setIsResettingDraft(false);
    }
  }

  if (isLoading) {
    return <div className="p-6 text-gray-500">Cargando certificaciones...</div>;
  }

  return (
    <div className="p-6 w-full">
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
            <div className="relative">
              <button
                type="button"
                onClick={() => { setProjDropOpen((o) => !o); setProjSearchQ(''); }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-left flex items-center justify-between gap-2 outline-none"
              >
                <span className={selectedProjectId ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedProjectId ? (projects.find((p) => p.id === selectedProjectId)?.display_name ?? 'Selecciona un proyecto') : 'Selecciona un proyecto'}
                </span>
                <span className="shrink-0 text-xs text-gray-400">{projDropOpen ? '▲' : '▼'}</span>
              </button>
              {projDropOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      autoFocus
                      type="text"
                      value={projSearchQ}
                      onChange={(e) => setProjSearchQ(e.target.value)}
                      placeholder="Buscar por código o nombre..."
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-500"
                    />
                  </div>
                  <ul className="max-h-60 overflow-y-auto py-1">
                    {projects
                      .filter((p) => {
                        const q = projSearchQ.toLowerCase();
                        return !q || p.display_name.toLowerCase().includes(q);
                      })
                      .map((project) => (
                        <li key={project.id}>
                          <button
                            type="button"
                            onClick={() => { setSelectedProjectId(project.id); setProjDropOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedProjectId === project.id ? 'font-semibold text-purple-800 bg-purple-50' : 'text-gray-700'}`}
                          >
                            {project.display_name}
                            {project.state_name && <span className="ml-1 text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{project.state_name}</span>}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {projDropOpen && <div className="fixed inset-0 z-40" onClick={() => setProjDropOpen(false)} />}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Presupuesto</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { if (selectedProjectId) { setBudgetDropOpen((o) => !o); setBudgetSearchQ(''); } }}
                disabled={!selectedProjectId}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-left flex items-center justify-between gap-2 outline-none disabled:bg-gray-100"
              >
                <span className={selectedBudgetId ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedBudgetId ? (budgets.find((b) => b.id === selectedBudgetId)?.display_name ?? 'Selecciona un presupuesto') : 'Selecciona un presupuesto'}
                </span>
                <span className="shrink-0 text-xs text-gray-400">{budgetDropOpen ? '▲' : '▼'}</span>
              </button>
              {budgetDropOpen && selectedProjectId && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      autoFocus
                      type="text"
                      value={budgetSearchQ}
                      onChange={(e) => setBudgetSearchQ(e.target.value)}
                      placeholder="Buscar presupuesto..."
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-500"
                    />
                  </div>
                  <ul className="max-h-60 overflow-y-auto py-1">
                    {budgets
                      .filter((b) => {
                        const q = budgetSearchQ.toLowerCase();
                        return !q || b.display_name.toLowerCase().includes(q);
                      })
                      .map((budget) => (
                        <li key={budget.id}>
                          <button
                            type="button"
                            onClick={() => { setSelectedBudgetId(budget.id); setBudgetDropOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedBudgetId === budget.id ? 'font-semibold text-purple-800 bg-purple-50' : 'text-gray-700'}`}
                          >
                            {budget.display_name}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {budgetDropOpen && selectedProjectId && <div className="fixed inset-0 z-40" onClick={() => setBudgetDropOpen(false)} />}
            </div>
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
                <th className="px-4 py-2 text-left">Estado de Pago</th>
                <th className="px-4 py-2 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {certifications.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-400">No hay certificaciones todavía.</td>
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
                  <td className="px-4 py-2">
                    {cert.paid_state_id ? (
                      <Link
                        href={`/dashboard/estados-pago?paidstate_id=${cert.paid_state_id}`}
                        className="text-purple-800 text-xs font-medium hover:underline"
                      >
                        {cert.paid_state_name || 'Ver estado de pago'}
                      </Link>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => openLines(cert)} className="text-purple-800 text-xs font-medium hover:underline">
                      Ver / Editar
                    </button>
                    {cert.state === 'draft' && (
                      <button
                        onClick={() => handleDeleteCertification(cert)}
                        disabled={deletingId === cert.id}
                        className="ml-3 text-rose-600 text-xs font-medium hover:underline disabled:opacity-50"
                      >
                        {deletingId === cert.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    )}
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

          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-gray-700">Etapa:</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-medium">
                {openCertification.stage_name || 'Sin etapa'}
              </span>
              {openCertification.stage_id && (
                <>
                  <span className="text-gray-500">
                    Inicio: <span className="font-medium text-gray-700">{formatStageDate(openCertification.stage_date_start)}</span>
                  </span>
                  <span className="text-gray-500">
                    Fin: <span className="font-medium text-gray-700">{formatStageDate(openCertification.stage_date_stop)}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${stageStateBadge(openCertification.stage_state)}`}>
                    {STAGE_STATE_LABELS[openCertification.stage_state] || openCertification.stage_state}
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={toggleExpandAll}
                className="ml-auto px-3 py-1 rounded-full text-xs font-semibold border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition"
              >
                {allChaptersExpanded ? 'Recoger todo' : 'Desplegar todo'}
              </button>
              <button
                type="button"
                onClick={() => setOnlyHoursAct((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  onlyHoursAct
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-sky-700 border-sky-300 hover:bg-sky-50'
                }`}
              >
                {onlyHoursAct ? '✓ ' : ''}Solo partidas con H Act. {'>'} 0
              </button>
            </div>
            {isLoadingLines ? (
              <div className="text-gray-500 text-sm">Cargando líneas...</div>
            ) : (
              <div className="max-h-[70vh] overflow-auto rounded border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-20 bg-gray-50 text-gray-500 text-xs uppercase shadow-sm">
                  <tr className="border-b border-gray-200 bg-slate-100 normal-case">
                    <td className="px-3 py-1.5 text-left font-semibold text-slate-600">
                      Total horas ({filteredLines.length} partidas)
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold text-sky-700">{formatQty(hoursTotals.hours_presup)}</td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5 text-right font-bold text-sky-700">{formatQty(hoursTotals.hours_ant)}</td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5 text-right font-bold text-sky-700">{formatQty(hoursTotals.hours_ori)}</td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5 text-right font-bold text-sky-700">{formatQty(hoursTotals.hours_act)}</td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                    <td className="px-3 py-1.5"></td>
                  </tr>
                  <tr>
                    <th className="px-3 py-2 text-left">Capítulo / Partida</th>
                    <th className="px-3 py-2 text-right">H Presup.</th>
                    <th className="px-3 py-2 text-right">UD/H</th>
                    <th className="px-3 py-2 text-right">Eur/H</th>
                    <th className="px-3 py-2 text-right">Cant. Presup.</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Imp. Presup.</th>
                    <th className="px-3 py-2 text-right">H Ant.</th>
                    <th className="px-3 py-2 text-right">UD T.</th>
                    <th className="px-3 py-2 text-right">Eur T.</th>
                    <th className="px-3 py-2 text-right">Avance T.</th>
                    <th className="px-3 py-2 text-right">Cant. Ant.</th>
                    <th className="px-3 py-2 text-right">Imp. Ant.</th>
                    <th className="px-3 py-2 text-right">Avance R.</th>
                    <th className="px-3 py-2 text-right">H Ori.</th>
                    <th className="px-3 py-2 text-right">UD T.</th>
                    <th className="px-3 py-2 text-right">Eur T.</th>
                    <th className="px-3 py-2 text-right">Avance T.</th>
                    <th className="px-3 py-2 text-right">Cant. Ori.</th>
                    <th className="px-3 py-2 text-right">Imp. Ori.</th>
                    <th className="px-3 py-2 text-right">Avance R.</th>
                    <th className="px-3 py-2 text-right">H Act.</th>
                    <th className="px-3 py-2 text-right">UD T.</th>
                    <th className="px-3 py-2 text-right">Eur T.</th>
                    <th className="px-3 py-2 text-right">Avance T.</th>
                    <th className="px-3 py-2 text-right">Cant. Act.</th>
                    <th className="px-3 py-2 text-right">Imp. Act.</th>
                    <th className="px-3 py-2 text-right">Avance R.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedLines.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-gray-400">Sin líneas cargadas.</td>
                    </tr>
                  )}
                  {groupedLines.map((node) => renderChapterNode(node, 0))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3">
            {['loaded', 'ready'].includes(openCertification.state) && (
              <button
                onClick={handleResetDraft}
                disabled={isResettingDraft}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {isResettingDraft ? 'Volviendo a borrador...' : 'Volver a Borrador'}
              </button>
            )}
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
