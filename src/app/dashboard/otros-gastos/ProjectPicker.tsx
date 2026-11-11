'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ExpenseProjectOption } from '@/lib/api';

/** Minúsculas y sin tildes, para buscar "critico" y encontrar "Crítico". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function label(p: ExpenseProjectOption): string {
  return p.state_name ? `${p.display_name} (${p.state_name})` : p.display_name;
}

interface Props {
  value: number | '';
  projects: ExpenseProjectOption[];
  onChange: (projectId: number | '') => void;
  className?: string;
}

interface PanelPos {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}

const PANEL_MAX_HEIGHT = 320;

/**
 * Selector de obra con buscador de texto.
 * El panel usa posición fija para que no lo recorten las tablas con overflow.
 */
export default function ProjectPicker({ value, projects, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = projects.find((p) => p.id === value);

  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return projects;
    return projects.filter((p) => {
      const haystack = normalize(label(p));
      return words.every((w) => haystack.includes(w));
    });
  }, [projects, query]);

  function computePos(): PanelPos | null {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(Math.max(rect.width, 420), window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < PANEL_MAX_HEIGHT + 60 && rect.top > spaceBelow) {
      return { left, width, bottom: window.innerHeight - rect.top + 4 };
    }
    return { left, width, top: rect.bottom + 4 };
  }

  function openPanel() {
    setQuery('');
    const idx = projects.findIndex((p) => p.id === value);
    setActive(idx >= 0 ? idx : 0);
    setPos(computePos());
    setOpen(true);
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function choose(p: ExpenseProjectOption | undefined) {
    if (!p) return;
    onChange(p.id);
    setOpen(false);
    buttonRef.current?.focus();
  }

  // Mientras está abierto, sigue al botón si la página o la tabla se desplazan
  useEffect(() => {
    if (!open) return;
    const reposition = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      setPos(computePos());
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // Mantiene visible la opción activa al moverse con el teclado
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(filtered[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            openPanel();
          }
        }}
        title={selected ? label(selected) : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-72 items-center justify-between gap-2 rounded border bg-white px-2 py-1.5 text-left text-sm outline-none
          ${open ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-300 hover:border-slate-400'} ${className}`}
      >
        <span className={`truncate ${selected ? 'text-slate-800' : 'text-slate-500'}`}>
          {selected ? label(selected) : 'Seleccionar obra...'}
        </span>
        <span className="shrink-0 text-xs text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="fixed z-50 flex flex-col rounded-lg border border-slate-200 bg-white shadow-xl"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: PANEL_MAX_HEIGHT + 52 }}
          >
            <div className="border-b border-slate-100 p-2">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                placeholder="Buscar obra por código, nombre o estado..."
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none placeholder:text-slate-500 focus:border-brand-400"
              />
            </div>
            <ul ref={listRef} role="listbox" className="overflow-y-auto py-1" style={{ maxHeight: PANEL_MAX_HEIGHT }}>
              {filtered.map((p, i) => (
                <li key={p.id} role="option" aria-selected={p.id === value}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(p)}
                    className={`w-full px-3 py-1.5 text-left text-sm
                      ${i === active ? 'bg-slate-100' : ''}
                      ${p.id === value ? 'font-semibold text-blue-700' : 'text-slate-700'}`}
                  >
                    {p.display_name}
                    {p.state_name && (
                      <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                        {p.state_name}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-400">Ninguna obra coincide con «{query}».</li>
              )}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
