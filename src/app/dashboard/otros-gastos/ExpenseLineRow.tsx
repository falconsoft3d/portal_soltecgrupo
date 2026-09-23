'use client';

import { ExpenseProductOption, ExpenseProjectOption, NewExpenseLine } from '@/lib/api';
import { formatCurrency, formatNumber } from './utils';

export interface DraftLine {
  key: number;
  product_id: number | '';
  project_id: number | '';
  name: string;
  qty: string;
}

let lineSeq = 0;
export const emptyLine = (): DraftLine => ({ key: ++lineSeq, product_id: '', project_id: '', name: '', qty: '' });

export function parseQty(value: string): number {
  const n = parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Valida las líneas en cliente (las obras ya vienen filtradas por compañía). Devuelve el error o null. */
export function validateDraftLines(lines: DraftLine[]): string | null {
  if (lines.length === 0) return 'Añade al menos una línea.';
  for (const [i, l] of lines.entries()) {
    if (!l.product_id || !l.project_id || parseQty(l.qty) <= 0) {
      return `Línea ${i + 1}: completa producto, obra y una cantidad mayor que 0.`;
    }
  }
  return null;
}

export function toNewExpenseLines(lines: DraftLine[]): NewExpenseLine[] {
  return lines.map((l) => ({
    product_id: l.product_id as number,
    project_id: l.project_id as number,
    name: l.name.trim(),
    qty: parseQty(l.qty),
  }));
}

export function draftLinesTotal(lines: DraftLine[], products: ExpenseProductOption[]): number {
  return lines.reduce((sum, l) => {
    const product = products.find((p) => p.id === l.product_id);
    return sum + (product ? product.price_unit * parseQty(l.qty) : 0);
  }, 0);
}

interface Props {
  line: DraftLine;
  products: ExpenseProductOption[];
  projects: ExpenseProjectOption[];
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
}

export default function ExpenseLineRow({ line, products, projects, onChange, onRemove }: Props) {
  const product = products.find((p) => p.id === line.product_id);
  const qty = parseQty(line.qty);

  function onProductChange(value: string) {
    const productId = value ? Number(value) : '';
    const next = products.find((p) => p.id === productId);
    // Si la descripción no se ha tocado, se rellena con el nombre del producto
    const keepName = line.name && line.name !== product?.name;
    onChange({ product_id: productId, name: keepName ? line.name : next?.name ?? '' });
  }

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-2 py-2">
        <select
          value={line.product_id}
          onChange={(e) => onProductChange(e.target.value)}
          className="w-56 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
        >
          <option value="">Seleccionar...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={line.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ej.: KMS MALVARROSA 25/AGO"
          className="w-64 rounded border border-slate-300 px-2 py-1.5 text-sm outline-none placeholder:text-slate-400"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={line.project_id}
          onChange={(e) => onChange({ project_id: e.target.value ? Number(e.target.value) : '' })}
          className="w-72 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none"
        >
          <option value="">Seleccionar obra...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
              {p.state_name ? ` (${p.state_name})` : ''}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={line.qty}
          onChange={(e) => onChange({ qty: e.target.value })}
          placeholder="0"
          className="w-24 rounded border border-slate-300 px-2 py-1.5 text-right text-sm outline-none"
        />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600">
        {product ? formatNumber(product.price_unit, 4) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
        {product ? formatCurrency(product.price_unit * qty) : '—'}
      </td>
      <td className="px-2 py-2 text-right">
        <button
          type="button"
          onClick={onRemove}
          className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Eliminar línea"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
