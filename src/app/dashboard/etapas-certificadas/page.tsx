'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  apiCertificationStagesHistory,
  apiProjects,
  CertificationStageHistoryItem,
  PortalProject,
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

interface HistoryChapterNode {
  key: string;
  name: string;
  children: HistoryChapterNode[];
  lines: CertificationStageHistoryItem[];
  subtotalBudget: number;
  subtotalCertif: number;
}

function buildHistoryChapterTree(lines: CertificationStageHistoryItem[]): HistoryChapterNode[] {
  const roots: HistoryChapterNode[] = [];

  for (const line of lines) {
    const path = line.chapter_path && line.chapter_path.length ? line.chapter_path : [line.chapter || 'Sin capítulo'];
    let siblings = roots;
    let node: HistoryChapterNode | undefined;
    let keyPrefix = '';
    for (const name of path) {
      keyPrefix = `${keyPrefix}/${name}`;
      node = siblings.find((n) => n.key === keyPrefix);
      if (!node) {
        node = { key: keyPrefix, name, children: [], lines: [], subtotalBudget: 0, subtotalCertif: 0 };
        siblings.push(node);
      }
      siblings = node.children;
    }
    if (node) node.lines.push(line);
  }

  function computeSubtotals(node: HistoryChapterNode): [number, number] {
    let budget = node.lines.reduce((s, l) => s + (l.amount_budget || 0), 0);
    let certif = node.lines.reduce((s, l) => s + (l.amount_certif || 0), 0);
    for (const child of node.children) {
      const [b, c] = computeSubtotals(child);
      budget += b;
      certif += c;
    }
    node.subtotalBudget = budget;
    node.subtotalCertif = certif;
    return [budget, certif];
  }
  roots.forEach(computeSubtotals);

  return roots;
}

interface StageGroup {
  key: string;
  stageName: string;
  lines: CertificationStageHistoryItem[];
  tree: HistoryChapterNode[];
  subtotalBudget: number;
  subtotalCertif: number;
}

function buildStageGroups(lines: CertificationStageHistoryItem[]): StageGroup[] {
  const map = new Map<string, CertificationStageHistoryItem[]>();
  for (const line of lines) {
    const key = line.stage_name || 'Sin etapa';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(line);
  }
  return [...map.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((stageName) => {
      const stageLines = map.get(stageName)!;
      return {
        key: stageName,
        stageName,
        lines: stageLines,
        tree: buildHistoryChapterTree(stageLines),
        subtotalBudget: stageLines.reduce((s, l) => s + (l.amount_budget || 0), 0),
        subtotalCertif: stageLines.reduce((s, l) => s + (l.amount_certif || 0), 0),
      };
    });
}

export default function EtapasCertificadasPage() {
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [projSearchQ, setProjSearchQ] = useState('');
  const [projDropOpen, setProjDropOpen] = useState(false);
  const [lines, setLines] = useState<CertificationStageHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const stageGroups = useMemo(() => buildStageGroups(lines), [lines]);

  async function loadHistory(projectId: number | 'all') {
    const token = getToken();
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await apiCertificationStagesHistory(token, projectId);
      if (!res.success) {
        setError(errorToText(res.error, 'No se pudo cargar el histórico de etapas certificadas.'));
        return;
      }
      setLines(res.lines || []);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiProjects(token).then((res) => {
      if (res.success) setProjects(res.projects || []);
    });
    loadHistory('all');
  }, []);

  function toggleStage(key: string) {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleChapter(key: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function countLines(node: HistoryChapterNode): number {
    return node.lines.length + node.children.reduce((s, c) => s + countLines(c), 0);
  }

  function renderChapterNode(stageKey: string, node: HistoryChapterNode, depth: number) {
    const nodeKey = `${stageKey}::${node.key}`;
    const isOpen = expandedChapters.has(nodeKey);
    const indent = 12 + depth * 20;
    return (
      <React.Fragment key={nodeKey}>
        <tr onClick={() => toggleChapter(nodeKey)} className="bg-gray-50 cursor-pointer hover:bg-gray-100">
          <td className="py-2 font-semibold text-gray-800" style={{ paddingLeft: indent, paddingRight: 12 }}>
            <span className="inline-block w-4 text-gray-400">{isOpen ? '▼' : '▶'}</span>
            {node.name}
            <span className="ml-2 text-xs font-normal text-gray-400">({countLines(node)} partidas)</span>
          </td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(node.subtotalBudget)}</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right text-gray-400">—</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(node.subtotalCertif)}</td>
        </tr>
        {isOpen && node.children.map((child) => renderChapterNode(stageKey, child, depth + 1))}
        {isOpen && node.lines.map((line) => (
          <tr key={line.id}>
            <td className="py-2 text-gray-900" style={{ paddingLeft: indent + 20, paddingRight: 12 }}>{line.concept}</td>
            <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.budget_qty)}</td>
            <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(line.amount_budget)}</td>
            <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.certif_qty)}</td>
            <td className="px-3 py-2 text-right text-gray-600">{formatQty(line.certif_percent)}%</td>
            <td className="px-3 py-2 text-right text-gray-900 font-medium">{formatCurrency(line.amount_certif)}</td>
          </tr>
        ))}
      </React.Fragment>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-gray-500">Cargando etapas certificadas...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Etapas Certificadas</h1>
        <p className="text-sm text-gray-500">Histórico de todas las etapas ya certificadas en tus obras.</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-md bg-rose-50 text-rose-700 text-sm border border-rose-200">{error}</div>}

      <div className="mb-4 max-w-sm">
        <label className="block text-xs font-medium text-gray-500 mb-1">Proyecto</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setProjDropOpen((o) => !o); setProjSearchQ(''); }}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-left flex items-center justify-between gap-2 outline-none"
          >
            <span className={selectedProjectId ? 'text-gray-900' : 'text-gray-400'}>
              {selectedProjectId ? (projects.find((p) => p.id === selectedProjectId)?.display_name ?? 'Todos los proyectos') : 'Todos los proyectos'}
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
                <li>
                  <button
                    type="button"
                    onClick={() => { setSelectedProjectId(''); setProjDropOpen(false); loadHistory('all'); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!selectedProjectId ? 'font-semibold text-purple-800 bg-purple-50' : 'text-gray-700'}`}
                  >
                    Todos los proyectos
                  </button>
                </li>
                {projects
                  .filter((p) => {
                    const q = projSearchQ.toLowerCase();
                    return !q || p.display_name.toLowerCase().includes(q);
                  })
                  .map((project) => (
                    <li key={project.id}>
                      <button
                        type="button"
                        onClick={() => { setSelectedProjectId(project.id); setProjDropOpen(false); loadHistory(project.id); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedProjectId === project.id ? 'font-semibold text-purple-800 bg-purple-50' : 'text-gray-700'}`}
                      >
                        {project.display_name}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {projDropOpen && <div className="fixed inset-0 z-40" onClick={() => setProjDropOpen(false)} />}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Etapa / Capítulo / Partida</th>
              <th className="px-3 py-2 text-right">Cant. Presup.</th>
              <th className="px-3 py-2 text-right">Imp. Presup.</th>
              <th className="px-3 py-2 text-right">Cant. Certif.</th>
              <th className="px-3 py-2 text-right">% Certif.</th>
              <th className="px-3 py-2 text-right">Imp. Certif.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stageGroups.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">No hay etapas certificadas todavía.</td>
              </tr>
            )}
            {stageGroups.map((group) => {
              const isOpen = expandedStages.has(group.key);
              return (
                <React.Fragment key={group.key}>
                  <tr onClick={() => toggleStage(group.key)} className="bg-purple-50 cursor-pointer hover:bg-purple-100">
                    <td className="px-3 py-2 font-bold text-purple-900">
                      <span className="inline-block w-4 text-purple-400">{isOpen ? '▼' : '▶'}</span>
                      {group.stageName}
                      <span className="ml-2 text-xs font-normal text-purple-500">({group.lines.length} partidas)</span>
                    </td>
                    <td className="px-3 py-2 text-right text-purple-400">—</td>
                    <td className="px-3 py-2 text-right font-bold text-purple-900">{formatCurrency(group.subtotalBudget)}</td>
                    <td className="px-3 py-2 text-right text-purple-400">—</td>
                    <td className="px-3 py-2 text-right text-purple-400">—</td>
                    <td className="px-3 py-2 text-right font-bold text-purple-900">{formatCurrency(group.subtotalCertif)}</td>
                  </tr>
                  {isOpen && group.tree.map((node) => renderChapterNode(group.key, node, 1))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
