'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  apiBudgets,
  apiBudgetEditor,
  apiBudgetEditorCreate,
  apiBudgetEditorDelete,
  apiBudgetEditorMove,
  apiBudgetEditorRecalculate,
  apiBudgetEditorUpdate,
  apiProjects,
  BudgetEditorInfo,
  BudgetEditorResponse,
  BudgetItem,
  BudgetNode,
  BudgetNodeValues,
  PortalProject,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import { readSavedFilter, saveFilter } from '@/lib/savedFilter';

const FILTER_STORAGE_KEY = 'presupuestos_filter';

// ------------------------------------------------------------------ //
//  Formato numérico (es-ES)                                           //
// ------------------------------------------------------------------ //

function fmt(value: number, decimals = 2): string {
  return (value || 0).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Acepta "1.234,56", "1234,56" o "1234.56". Devuelve null si no es un número. */
function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/\s|€|%/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ------------------------------------------------------------------ //
//  Celda editable: muestra el valor y guarda al salir o con Enter     //
// ------------------------------------------------------------------ //

interface EditableCellProps {
  value: string | number;
  kind: 'text' | 'number';
  decimals?: number;
  suffix?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  align?: 'left' | 'right';
  className?: string;
  /** Devuelve false si el servidor rechazó el cambio */
  onCommit: (value: string | number) => Promise<boolean> | void;
}

function EditableCell({
  value, kind, decimals = 2, suffix, disabled, autoFocus, align = 'left', className = '', onCommit,
}: EditableCellProps) {
  const display = kind === 'number' ? fmt(Number(value), decimals) : String(value);
  const [draft, setDraft] = useState(display);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // Valor recién guardado: se muestra hasta que llega la respuesta del servidor (sin parpadeo)
  const [optimistic, setOptimistic] = useState<{ shown: string; base: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const shown = editing ? draft : (optimistic && optimistic.base === display ? optimistic.shown : display);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  function save(shownValue: string, newValue: string | number) {
    setOptimistic({ shown: shownValue, base: display });
    Promise.resolve(onCommit(newValue)).then((ok) => {
      if (ok === false) setOptimistic(null);
    });
  }

  function commit() {
    setEditing(false);
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    if (kind === 'number') {
      const n = parseNumber(draft);
      if (n === null) {
        setInvalid(true);
        setTimeout(() => setInvalid(false), 1500);
        return;
      }
      if (Math.abs(n - Number(value)) > 1e-9) {
        save(fmt(n, decimals), n);
      }
    } else {
      const t = draft.trim();
      if (t && t !== String(value)) {
        save(t, t);
      }
    }
  }

  if (disabled) {
    return (
      <span className={`block px-1.5 py-1 ${align === 'right' ? 'text-right' : ''} ${className}`}>
        {display}{suffix && <span className="text-slate-400"> {suffix}</span>}
      </span>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode={kind === 'number' ? 'decimal' : 'text'}
        value={shown}
        onFocus={(e) => { setDraft(shown); setEditing(true); e.currentTarget.select(); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { cancelRef.current = true; e.currentTarget.blur(); }
        }}
        className={`w-full rounded border px-1.5 py-1 outline-none transition-colors
          ${align === 'right' ? 'text-right' : ''}
          ${suffix ? 'pr-5' : ''}
          ${invalid ? 'border-rose-400 bg-rose-50' : 'border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100'}
          ${className}`}
      />
      {suffix && <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ //
//  Árbol                                                              //
// ------------------------------------------------------------------ //

interface TreeRow {
  node: BudgetNode;
  depth: number;
  hasChildren: boolean;
  isFirst: boolean;
  isLast: boolean;
}

function buildRows(nodes: BudgetNode[], expanded: Set<number>): TreeRow[] {
  const byParent = new Map<number | false, BudgetNode[]>();
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    const key = n.parent_id && ids.has(n.parent_id) ? n.parent_id : false;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }
  const rows: TreeRow[] = [];
  const walk = (parent: number | false, depth: number) => {
    const children = byParent.get(parent) || [];
    children.forEach((node, i) => {
      const hasChildren = (byParent.get(node.id) || []).length > 0;
      rows.push({ node, depth, hasChildren, isFirst: i === 0, isLast: i === children.length - 1 });
      if (hasChildren && expanded.has(node.id)) walk(node.id, depth + 1);
    });
  };
  walk(false, 0);
  return rows;
}

function IconButton({ title, onClick, disabled, children, danger }: {
  title: string; onClick: () => void; disabled?: boolean; children: ReactNode; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded p-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed
        ${danger ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ //
//  Página                                                             //
// ------------------------------------------------------------------ //

export default function PresupuestosPage() {
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | ''>('');
  const [projSearchQ, setProjSearchQ] = useState('');
  const [projDropOpen, setProjDropOpen] = useState(false);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | ''>('');
  const [budgetSearchQ, setBudgetSearchQ] = useState('');
  const [budgetDropOpen, setBudgetDropOpen] = useState(false);

  const [info, setInfo] = useState<BudgetEditorInfo | null>(null);
  const [nodes, setNodes] = useState<BudgetNode[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [focusId, setFocusId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(0);
  const busy = pending > 0;
  // Las operaciones se encadenan para que ediciones rápidas seguidas no se pierdan
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BudgetNode | null>(null);

  const rows = useMemo(() => buildRows(nodes, expanded), [nodes, expanded]);
  const readOnly = !!info?.locked;

  // ---------------- carga inicial ----------------
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    (async () => {
      const pr = await apiProjects(token);
      if (cancelled || !pr.success) return;
      const loadedProjects = pr.projects || [];
      setProjects(loadedProjects);
      const saved = readSavedFilter(FILTER_STORAGE_KEY);
      if (!saved?.project || !loadedProjects.some((p) => p.id === saved.project)) return;
      setSelectedProject(saved.project);
      const br = await apiBudgets(token, saved.project);
      if (cancelled || !br.success) return;
      const loadedBudgets = br.budgets || [];
      setBudgets(loadedBudgets);
      if (!saved.budget || !loadedBudgets.some((b) => b.id === saved.budget)) return;
      setSelectedBudget(saved.budget);
      await loadBudget(saved.budget, true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!msg || msg.error) return;
    const t = setTimeout(() => setMsg(null), 2500);
    return () => clearTimeout(t);
  }, [msg]);

  function applyResponse(res: BudgetEditorResponse, okText?: string): boolean {
    if (!res.success) {
      setMsg({ text: res.error || 'Error al guardar.', error: true });
      return false;
    }
    if (res.budget) setInfo(res.budget);
    if (res.nodes) setNodes(res.nodes);
    if (okText) setMsg({ text: okText, error: false });
    return true;
  }

  async function loadBudget(bid: number, expandAll = false) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setMsg(null);
    const res = await apiBudgetEditor(token, bid);
    setLoading(false);
    if (applyResponse(res) && expandAll) {
      setExpanded(new Set((res.nodes || []).filter((n) => n.type === 'chapter').map((n) => n.id)));
    }
  }

  function clearFilter() {
    saveFilter(FILTER_STORAGE_KEY, null);
    setSelectedProject('');
    setSelectedBudget('');
    setBudgets([]);
    setNodes([]);
    setInfo(null);
    setMsg(null);
  }

  async function onProjectChange(pid: number | '') {
    saveFilter(FILTER_STORAGE_KEY, { project: pid, budget: '' });
    setSelectedProject(pid);
    setSelectedBudget('');
    setNodes([]);
    setInfo(null);
    setBudgets([]);
    if (!pid) return;
    const token = getToken();
    if (!token) return;
    const res = await apiBudgets(token, pid as number);
    if (res.success) setBudgets(res.budgets || []);
  }

  async function onBudgetChange(bid: number | '') {
    saveFilter(FILTER_STORAGE_KEY, { project: selectedProject, budget: bid });
    setSelectedBudget(bid);
    setNodes([]);
    setInfo(null);
    if (bid) await loadBudget(bid as number, true);
  }

  // ---------------- acciones ----------------
  function run(
    fn: (token: string, bid: number) => Promise<BudgetEditorResponse>,
    okText?: string,
  ): Promise<BudgetEditorResponse | null> {
    const token = getToken();
    if (!token || !selectedBudget) return Promise.resolve(null);
    const bid = selectedBudget as number;
    setPending((n) => n + 1);
    const job = queueRef.current.then(async () => {
      try {
        const res = await fn(token, bid);
        return applyResponse(res, okText) ? res : null;
      } catch {
        setMsg({ text: 'Error de conexión.', error: true });
        return null;
      } finally {
        setPending((n) => n - 1);
      }
    });
    queueRef.current = job.catch(() => null);
    return job;
  }

  async function addNode(type: 'chapter' | 'departure', parentId: number | false) {
    const res = await run((t, b) => apiBudgetEditorCreate(t, b, type, parentId),
      type === 'chapter' ? 'Capítulo creado.' : 'Partida creada.');
    if (res?.created_id) {
      const created = res.created_id;
      setExpanded((prev) => {
        const next = new Set(prev);
        if (parentId) next.add(parentId);
        if (type === 'chapter') next.add(created);
        return next;
      });
      setSelectedId(created);
      setFocusId(created);
    }
  }

  async function updateNode(node: BudgetNode, values: BudgetNodeValues): Promise<boolean> {
    setFocusId(null);
    const res = await run((t, b) => apiBudgetEditorUpdate(t, b, node.id, values), 'Guardado.');
    return !!res;
  }

  async function moveNode(node: BudgetNode, direction: 'up' | 'down') {
    await run((t, b) => apiBudgetEditorMove(t, b, node.id, direction));
  }

  async function deleteNode(node: BudgetNode) {
    setConfirmDelete(null);
    const ok = await run((t, b) => apiBudgetEditorDelete(t, b, node.id),
      node.type === 'chapter' ? 'Capítulo eliminado.' : 'Partida eliminada.');
    if (ok && selectedId === node.id) setSelectedId(null);
  }

  async function recalculate() {
    await run((t, b) => apiBudgetEditorRecalculate(t, b), 'Presupuesto recalculado.');
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const chapterIds = nodes.filter((n) => n.type === 'chapter').map((n) => n.id);
  const childCount = (id: number) => nodes.filter((n) => n.parent_id === id).length;

  // ---------------- render ----------------
  return (
    <div className="p-6 max-w-[1400px] mx-auto text-slate-800">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Presupuestos</h1>
          <p className="text-sm text-slate-500">Crea capítulos y partidas manuales, y edita cantidad, coste y margen.</p>
        </div>
        {selectedProject && (
          <button type="button" onClick={clearFilter}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Limpiar filtro
          </button>
        )}
      </div>

      {/* Selectores */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">Obra</label>
          <div className="relative">
            <button type="button" onClick={() => { setProjDropOpen((o) => !o); setProjSearchQ(''); }}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-left flex items-center justify-between gap-2 outline-none">
              <span className={selectedProject ? 'text-slate-800' : 'text-slate-400'}>
                {selectedProject ? (projects.find((p) => p.id === selectedProject)?.display_name ?? 'Seleccionar obra...') : 'Seleccionar obra...'}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{projDropOpen ? '▲' : '▼'}</span>
            </button>
            {projDropOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="p-2 border-b border-slate-100">
                  <input autoFocus type="text" value={projSearchQ} onChange={(e) => setProjSearchQ(e.target.value)}
                    placeholder="Buscar por código o nombre..." className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none placeholder:text-slate-500" />
                </div>
                <ul className="max-h-60 overflow-y-auto py-1">
                  {projects.filter((p) => { const q = projSearchQ.toLowerCase(); return !q || p.display_name.toLowerCase().includes(q); }).map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => { onProjectChange(p.id); setProjDropOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${selectedProject === p.id ? 'font-semibold text-blue-700 bg-blue-50' : 'text-slate-700'}`}>
                        {p.display_name}
                        {p.state_name && <span className="ml-1 text-xs text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">{p.state_name}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {projDropOpen && <div className="fixed inset-0 z-40" onClick={() => setProjDropOpen(false)} />}
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">Presupuesto</label>
          <div className="relative">
            <button type="button" onClick={() => { if (selectedProject) { setBudgetDropOpen((o) => !o); setBudgetSearchQ(''); } }}
              disabled={!selectedProject}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-left flex items-center justify-between gap-2 outline-none disabled:opacity-50">
              <span className={selectedBudget ? 'text-slate-800' : 'text-slate-400'}>
                {selectedBudget ? (budgets.find((b) => b.id === selectedBudget)?.display_name ?? 'Seleccionar presupuesto...') : 'Seleccionar presupuesto...'}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{budgetDropOpen ? '▲' : '▼'}</span>
            </button>
            {budgetDropOpen && selectedProject && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="p-2 border-b border-slate-100">
                  <input autoFocus type="text" value={budgetSearchQ} onChange={(e) => setBudgetSearchQ(e.target.value)}
                    placeholder="Buscar presupuesto..." className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none placeholder:text-slate-500" />
                </div>
                <ul className="max-h-60 overflow-y-auto py-1">
                  {budgets.filter((b) => { const q = budgetSearchQ.toLowerCase(); return !q || b.display_name.toLowerCase().includes(q); }).map((b) => (
                    <li key={b.id}>
                      <button type="button" onClick={() => { onBudgetChange(b.id); setBudgetDropOpen(false); setBudgetSearchQ(''); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${selectedBudget === b.id ? 'font-semibold text-blue-700 bg-blue-50' : 'text-slate-700'}`}>
                        {b.display_name}
                      </button>
                    </li>
                  ))}
                  {budgets.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Sin presupuestos.</li>}
                </ul>
              </div>
            )}
            {budgetDropOpen && selectedProject && <div className="fixed inset-0 z-40" onClick={() => setBudgetDropOpen(false)} />}
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando...</p>}

      {selectedBudget && info && !loading && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Coste total</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{fmt(info.total_cost)} €</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Importe venta</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-brand-600">{fmt(info.total_sale)} €</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Margen medio</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{fmt(info.total_margin)} %</p>
            </div>
          </div>

          {readOnly && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              El presupuesto está bloqueado en el estado <strong>{info.state_name}</strong>. Solo se puede consultar.
            </div>
          )}

          {/* Barra de herramientas */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {!readOnly && (
              <button type="button" onClick={() => addNode('chapter', false)} disabled={busy}
                className="rounded bg-brand-600 hover:bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                + Capítulo
              </button>
            )}
            <button type="button" onClick={() => setExpanded(new Set(chapterIds))}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Expandir todo
            </button>
            <button type="button" onClick={() => setExpanded(new Set())}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Contraer todo
            </button>
            {!readOnly && (
              <button type="button" onClick={recalculate} disabled={busy}
                title="Recalcula el presupuesto completo en Odoo"
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Recalcular
              </button>
            )}
            <div className="ml-auto flex items-center gap-2 text-sm min-h-[1.5rem]">
              {busy && <span className="text-slate-500">Guardando...</span>}
              {!busy && msg && (
                <span className={msg.error ? 'text-rose-600' : 'text-emerald-600'}>
                  {msg.text}
                  {msg.error && <button type="button" onClick={() => setMsg(null)} className="ml-2 text-rose-400 hover:text-rose-600">✕</button>}
                </span>
              )}
            </div>
          </div>

          {/* Tabla en árbol */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left w-[130px]">Código</th>
                  <th className="px-3 py-2 text-left min-w-[280px]">Nombre</th>
                  <th className="px-3 py-2 text-right w-[110px]">Cantidad</th>
                  <th className="px-3 py-2 text-right w-[120px]">Coste</th>
                  <th className="px-3 py-2 text-right w-[120px]">Importe</th>
                  <th className="px-3 py-2 text-right w-[100px]">Margen</th>
                  <th className="px-3 py-2 text-right w-[120px]">Precio</th>
                  <th className="px-3 py-2 text-right w-[130px]">Importe venta</th>
                  <th className="px-3 py-2 w-[150px]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ node, depth, hasChildren, isFirst, isLast }) => {
                  const isChapter = node.type === 'chapter';
                  const open = expanded.has(node.id);
                  const editableNumbers = !readOnly && !isChapter;
                  const selected = selectedId === node.id;
                  return (
                    <tr key={node.id}
                      onClick={() => setSelectedId(node.id)}
                      className={`group border-t border-slate-100 ${isChapter ? (depth === 0 ? 'bg-brand-50/60 font-semibold' : 'bg-slate-50/70 font-medium') : ''} ${selected ? 'outline outline-1 -outline-offset-1 outline-brand-300' : ''}`}>
                      {/* Código + árbol */}
                      <td className="px-3 py-1">
                        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 18 }}>
                          {isChapter ? (
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
                              disabled={!hasChildren}
                              aria-label={open ? 'Contraer' : 'Expandir'}
                              className="w-5 h-5 shrink-0 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30">
                              <svg className={`w-3 h-3 transition-transform ${open && hasChildren ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                <path d="M7 4l6 6-6 6V4z" />
                              </svg>
                            </button>
                          ) : (
                            <span className="w-5 shrink-0 flex justify-center text-slate-300">•</span>
                          )}
                          <div className="flex-1 min-w-[60px]">
                            <EditableCell kind="text" value={node.code} disabled={readOnly}
                              className="font-mono text-xs"
                              onCommit={(v) => updateNode(node, { code: String(v) })} />
                          </div>
                        </div>
                      </td>
                      {/* Nombre */}
                      <td className="px-3 py-1">
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide
                            ${isChapter ? 'bg-brand-100 text-brand-700' : node.is_manual ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {isChapter ? 'Capítulo' : node.is_manual ? 'Partida' : 'Calculada'}
                          </span>
                          <div className="flex-1">
                            <EditableCell kind="text" value={node.name} disabled={readOnly}
                              autoFocus={focusId === node.id}
                              onCommit={(v) => updateNode(node, { name: String(v) })} />
                          </div>
                          {isChapter && !open && hasChildren && (
                            <span className="shrink-0 text-xs font-normal text-slate-400">{childCount(node.id)} elem.</span>
                          )}
                        </div>
                      </td>
                      {/* Cantidad */}
                      <td className="px-3 py-1 tabular-nums">
                        <EditableCell kind="number" align="right" value={node.quantity} decimals={2}
                          disabled={!editableNumbers}
                          onCommit={(v) => updateNode(node, { quantity: Number(v) })} />
                      </td>
                      {/* Coste */}
                      <td className="px-3 py-1 tabular-nums">
                        <EditableCell kind="number" align="right" value={node.cost} decimals={2}
                          disabled={!editableNumbers || !node.is_manual}
                          onCommit={(v) => updateNode(node, { cost: Number(v) })} />
                      </td>
                      {/* Importe */}
                      <td className="px-3 py-1 text-right tabular-nums text-slate-700">
                        <span className="px-1.5">{fmt(node.amount)}</span>
                      </td>
                      {/* Margen */}
                      <td className="px-3 py-1 tabular-nums">
                        <EditableCell kind="number" align="right" value={node.margin} decimals={2} suffix="%"
                          disabled={!editableNumbers}
                          onCommit={(v) => updateNode(node, { margin: Number(v) })} />
                      </td>
                      {/* Precio */}
                      <td className="px-3 py-1 text-right tabular-nums text-slate-700">
                        <span className="px-1.5">{fmt(node.sale_price)}</span>
                      </td>
                      {/* Importe venta */}
                      <td className="px-3 py-1 text-right tabular-nums font-semibold">
                        <span className="px-1.5">{fmt(node.sale_amount)}</span>
                      </td>
                      {/* Acciones */}
                      <td className="px-2 py-1">
                        {!readOnly && (
                          <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            {isChapter && (
                              <>
                                <button type="button" disabled={busy}
                                  onClick={(e) => { e.stopPropagation(); addNode('departure', node.id); }}
                                  className="rounded px-1.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                                  title="Añadir partida en este capítulo">
                                  + Partida
                                </button>
                                <IconButton title="Añadir subcapítulo" disabled={busy}
                                  onClick={() => addNode('chapter', node.id)}>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                  </svg>
                                </IconButton>
                              </>
                            )}
                            <IconButton title="Subir" disabled={busy || isFirst} onClick={() => moveNode(node, 'up')}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                            </IconButton>
                            <IconButton title="Bajar" disabled={busy || isLast} onClick={() => moveNode(node, 'down')}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </IconButton>
                            <IconButton title="Eliminar" danger disabled={busy} onClick={() => setConfirmDelete(node)}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </IconButton>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-400">
                      Este presupuesto aún no tiene capítulos.
                      {!readOnly && (
                        <button type="button" onClick={() => addNode('chapter', false)} disabled={busy}
                          className="ml-2 font-medium text-brand-600 hover:underline">
                          Crear el primer capítulo
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold tabular-nums">
                  <tr>
                    <td className="px-3 py-2" colSpan={4}>Total presupuesto</td>
                    <td className="px-3 py-2 text-right"><span className="px-1.5">{fmt(info.total_cost)}</span></td>
                    <td className="px-3 py-2 text-right"><span className="px-1.5">{fmt(info.total_margin)} %</span></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right"><span className="px-1.5">{fmt(info.total_sale)}</span></td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Haz clic en cualquier valor para editarlo; se guarda al pulsar Enter o al salir de la celda (Esc cancela).
            Las partidas nuevas son siempre de precio manual. Las marcadas como «Calculada» vienen de Odoo con recursos y su coste no se edita aquí.
          </p>
        </>
      )}

      {/* Confirmación de borrado */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-800">
              Eliminar {confirmDelete.type === 'chapter' ? 'capítulo' : 'partida'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              ¿Seguro que quieres eliminar <strong>[{confirmDelete.code}] {confirmDelete.name}</strong>?
              {confirmDelete.type === 'chapter' && childCount(confirmDelete.id) > 0 && (
                <> Se eliminarán también sus {childCount(confirmDelete.id)} elementos.</>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" onClick={() => deleteNode(confirmDelete)}
                className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
