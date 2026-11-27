'use client';

import { usePathname } from 'next/navigation';
import { Manrope, IBM_Plex_Mono } from 'next/font/google';
import { ReactNode, useEffect, useRef, useState } from 'react';
import type { AccountingCompany } from '@/lib/api';
import { companyColor, fD, setChartFonts } from './lib';
import { Icon } from './icons';
import './cuadro.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['400', '500', '600', '700', '800'] });
const plex = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-plex-mono', weight: ['400', '500', '600'] });
setChartFonts(manrope.style.fontFamily, plex.style.fontFamily);

const TABS = [
  { href: '/dashboard/contabilidad-deuda', label: 'Contabilidad y deuda', icon: Icon.conta },
  { href: '/dashboard/prevision-tesoreria', label: 'Previsión de tesorería', icon: Icon.teso },
  { href: '/dashboard/bancos', label: 'Bancos', icon: Icon.bancos },
  { href: '/dashboard/analisis-financiero', label: 'Análisis económico-financiero', icon: Icon.afin },
];

export const HORIZONS = [3, 6, 12, 24];
const HORIZON_KEY = 'portal_cf_horizon_v1';

/** Horizonte de previsión compartido entre páginas (se recuerda en el navegador). */
export function useHorizon(): [number, (h: number) => void] {
  const [h, setH] = useState<number>(() => {
    try {
      const v = Number(typeof window !== 'undefined' ? localStorage.getItem(HORIZON_KEY) : NaN);
      return HORIZONS.includes(v) ? v : 12;
    } catch { return 12; }
  });
  const update = (v: number) => { setH(v); try { localStorage.setItem(HORIZON_KEY, String(v)); } catch { /* sin almacenamiento */ } };
  return [h, update];
}

export interface MultiOption { id: number; label: string; color?: string; group?: string; hint?: string }

/**
 * Desplegable de selección múltiple con casillas.
 * `selected` vacío = todas las opciones. Si se desmarcan todas (o se marcan todas) vuelve a «todas».
 */
export function MultiSelect({ options, selected, onChange, allLabel, unit, title }: {
  options: MultiOption[]; selected: number[]; onChange: (ids: number[]) => void;
  allLabel: string; unit: [string, string]; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (options.length <= 1) return options[0] ? <span className="cfdd-static">{options[0].label}</span> : null;
  const valid = selected.filter((id) => options.some((o) => o.id === id));
  const all = valid.length === 0;
  const label = all ? allLabel
    : valid.length === 1 ? (options.find((o) => o.id === valid[0])?.label ?? `1 ${unit[0]}`) : `${valid.length} ${unit[1]}`;
  const toggle = (id: number) => {
    const current = all ? options.map((o) => o.id) : valid;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange(next.length === 0 || next.length === options.length ? [] : next);
  };
  const shown = (all ? options : options.filter((o) => valid.includes(o.id))).filter((o) => o.color).slice(0, 4);
  const headers = options.map((o, i) => (o.group && (i === 0 || options[i - 1].group !== o.group) ? o.group : null));
  return (
    <div className="cfdd" ref={ref}>
      <button type="button" className="cfdd-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} title={title}>
        {shown.length > 0 && <span className="cfdd-dots">{shown.map((o) => <span key={o.id} className="dot" style={{ background: o.color }} />)}</span>}
        <span className="cfdd-lbl">{label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className={open ? 'rot' : ''}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="cfdd-menu" role="listbox" aria-multiselectable="true">
          <label className="cfdd-opt head">
            <input type="checkbox" checked={all} onChange={() => onChange([])} />
            {allLabel}
          </label>
          {options.map((o, i) => {
            const header = headers[i];
            return (
              <div key={o.id}>
                {header && <div className="cfdd-group">{header}</div>}
                <label className="cfdd-opt">
                  <input type="checkbox" checked={all || valid.includes(o.id)} onChange={() => toggle(o.id)} />
                  {o.color && <span className="dot" style={{ background: o.color }} />}
                  <span className="nm" title={o.label}>{o.label}</span>
                  {o.hint && <span className="hint">{o.hint}</span>}
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompanyDropdown({ companies, selected, onChange }: {
  companies: AccountingCompany[]; selected: number[]; onChange: (ids: number[]) => void;
}) {
  return (
    <MultiSelect
      options={companies.map((c, i) => ({ id: c.id, label: c.name, color: companyColor(i) }))}
      selected={selected} onChange={onChange}
      allLabel="Grupo · todas las compañías" unit={['compañía', 'compañías']}
    />
  );
}

export default function Shell({
  today, companies, selected, onCompanies, horizon, onHorizon, children, loading = false, error = '', extraControls,
}: {
  extraControls?: ReactNode;
  today?: string;
  companies?: AccountingCompany[];
  selected: number[];
  onCompanies: (ids: number[]) => void;
  horizon?: number;
  onHorizon?: (h: number) => void;
  children: ReactNode;
  loading?: boolean;
  error?: string;
}) {
  const pathname = usePathname();
  const title = TABS.find((t) => t.href === pathname)?.label ?? 'Contabilidad';
  return (
    <div className={`cf ${manrope.variable} ${plex.variable} -mx-1 -mt-2 min-h-[calc(100vh-3.5rem)]`}>
      <div className="gut cf-main">
        <div className={`in ${loading ? 'cf-loading' : ''}`}>
          {/* Solo filtros: la navegación entre páginas la hace el menú lateral */}
          <div className="cf-toolbar">
            <div className="cf-title">
              <h1>{title}</h1>
              {today && <p>Datos a <b>{fD(today)}</b></p>}
            </div>
            <div className="ctrls">
              {companies && <CompanyDropdown companies={companies} selected={selected} onChange={onCompanies} />}
              {extraControls}
              {horizon !== undefined && onHorizon && (
                <select className="cf-select" value={horizon} onChange={(e) => onHorizon(Number(e.target.value))} aria-label="Horizonte de previsión">
                  {HORIZONS.map((h) => <option key={h} value={h}>Horizonte {h} meses</option>)}
                </select>
              )}
            </div>
          </div>
          {error && <div className="alert bad">{Icon.warn}<span>{error}</span></div>}
          {children}
        </div>
      </div>
    </div>
  );
}
