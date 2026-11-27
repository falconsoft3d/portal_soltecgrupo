'use client';

/* Exportación a Excel (.xlsx) de cualquier tabla del cuadro financiero. */
import { CSSProperties, ReactNode, useRef, useState } from 'react';

type Cell = string | number | null;
type XlsxCell = { v: Cell; t: 's' | 'n'; z?: string };

/** Convierte un texto con formato español («1.234,56 €», «12,5 %», «45 días») en número. */
function parseNumber(text: string): XlsxCell | null {
  const t = text.replace(/ /g, ' ').trim();
  const m = t.match(/^([-−]?)\s*([\d.]+(?:,\d+)?)\s*(€|%|días|d|k€|M€)?$/);
  if (!m) return null;
  let n = Number(m[2].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (m[1]) n = -n;
  const unit = m[3];
  if (unit === 'k€') n *= 1e3;
  if (unit === 'M€') n *= 1e6;
  const decimals = (m[2].split(',')[1] ?? '').length;
  if (unit === '€' || unit === 'k€' || unit === 'M€') return { v: n, t: 'n', z: decimals ? '#,##0.00 "€"' : '#,##0 "€"' };
  if (unit === '%') return { v: n, t: 'n', z: '0.0 "%"' };
  if (unit === 'días' || unit === 'd') return { v: n, t: 'n', z: '0 "días"' };
  return { v: n, t: 'n', z: decimals ? '#,##0.00' : '#,##0' };
}

function cellText(td: Element): string {
  const input = td.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
  if (input) return input.value;
  return (td.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Lee una tabla HTML (respetando colspan) como filas de celdas. */
export function tableToRows(table: HTMLTableElement): XlsxCell[][] {
  const rows: XlsxCell[][] = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const row: XlsxCell[] = [];
    tr.querySelectorAll('th, td').forEach((c) => {
      const text = cellText(c);
      // Solo columnas numéricas (.n) o cifras con unidad: los códigos de cuenta se quedan como texto
      const numeric = c.tagName === 'TD' && (c.classList.contains('n') || /(€|%|días)\s*$/.test(text));
      const num = numeric ? parseNumber(text) : null;
      row.push(num ?? { v: text, t: 's' });
      const span = (c as HTMLTableCellElement).colSpan || 1;
      for (let i = 1; i < span; i++) row.push({ v: '', t: 's' });
    });
    if (row.some((x) => x.v !== '' && x.v !== null)) rows.push(row);
  });
  return rows;
}

const safeName = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Datos';
const fileName = (s: string) => `${s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'tabla'}-${new Date().toISOString().slice(0, 10)}.xlsx`;

/** Descarga un .xlsx con una hoja a partir de filas ya preparadas. */
export async function downloadXlsx(name: string, rows: (Cell | XlsxCell)[][]) {
  const XLSX = await import('xlsx');
  const norm = rows.map((r) => r.map((c) => (c !== null && typeof c === 'object' ? c : typeof c === 'number' ? { v: c, t: 'n' as const } : { v: c ?? '', t: 's' as const })));
  const ws = XLSX.utils.aoa_to_sheet(norm.map((r) => r.map((c) => c.v)));
  // tipos y formatos numéricos
  norm.forEach((r, ri) => r.forEach((c, ci) => {
    const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
    if (ws[ref] && c.t === 'n') { ws[ref].t = 'n'; if (c.z) ws[ref].z = c.z; }
  }));
  // ancho de columnas según el contenido
  const widths = norm[0]?.map((_, ci) => Math.min(60, Math.max(8, ...norm.map((r) => String(r[ci]?.v ?? '').length + 2)))) ?? [];
  ws['!cols'] = widths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeName(name));
  XLSX.writeFile(wb, fileName(name));
}

/** Botón «Excel» que exporta la tabla que tiene dentro el elemento indicado. */
export function ExcelButton({ name, target, label = 'Excel' }: { name: string; target: () => HTMLElement | null; label?: string }) {
  return (
    <button
      type="button" className="xls-btn" title={`Exportar «${name}» a Excel`}
      onClick={() => { const t = target()?.querySelector('table'); if (t) void downloadXlsx(name, tableToRows(t)); }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
      {label}
    </button>
  );
}

/** Contenedor de tabla (.tbl) con botón de exportación a Excel. */
export function Tbl({ name, className = 'tbl', style, children }: { name: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="tbl-wrap">
      <div className="tbl-tools"><ExcelButton name={name} target={() => ref.current} /></div>
      <div ref={ref} className={className} style={style}>{children}</div>
    </div>
  );
}

/** Exportación con estado «preparando…» para listados que hay que pedir enteros al servidor. */
export function useExcelExport() {
  const [busy, setBusy] = useState(false);
  const run = async (name: string, build: () => Promise<(Cell | XlsxCell)[][]>) => {
    setBusy(true);
    try { await downloadXlsx(name, await build()); } finally { setBusy(false); }
  };
  return { busy, run };
}
