'use client';

import { NewPaidstateLine, ProjectBudgetItem } from '@/lib/api';

export interface DraftPaidstateLine {
  key: number;
  /** id de bim.paidstate.line si ya existe en Odoo */
  id?: number;
  budget_id: number | '';
  name: string;
  quantity: string;
  price_unit: string;
  certification_factor: string;
}

let paidstateLineSeq = 0;
export function emptyPaidstateLine(): DraftPaidstateLine {
  return { key: ++paidstateLineSeq, budget_id: '', name: '', quantity: '1', price_unit: '', certification_factor: '' };
}

export function draftFromLine(line: {
  id: number;
  budget_id: number | false;
  name: string;
  quantity: number;
  price_unit: number;
  certification_factor: number;
}): DraftPaidstateLine {
  return {
    key: ++paidstateLineSeq,
    id: line.id,
    budget_id: line.budget_id || '',
    name: line.name,
    quantity: String(line.quantity),
    price_unit: String(line.price_unit).replace('.', ','),
    certification_factor: line.certification_factor ? String(line.certification_factor).replace('.', ',') : '',
  };
}

/** Acepta "1.234,56" y "1234.56"; vacío = 0. */
export function parseNum(value: string): number {
  const raw = value.trim();
  if (!raw) return 0;
  return Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
}

/** Mismo cálculo que bim.paidstate.line: neto = cant * precio; importe = neto * factor (si factor > 0). */
export function lineAmount(line: DraftPaidstateLine): { net: number; total: number } {
  const net = Math.trunc(parseNum(line.quantity) || 0) * (parseNum(line.price_unit) || 0);
  const factor = parseNum(line.certification_factor) || 0;
  return { net, total: factor > 0 ? net * factor : net };
}

export function linesTotal(lines: DraftPaidstateLine[]): number {
  return lines.reduce((sum, l) => sum + lineAmount(l).total, 0);
}

/** Valida en cliente. Devuelve el mensaje de error o null. */
export function validatePaidstateLines(lines: DraftPaidstateLine[]): string | null {
  if (lines.length === 0) return 'Añade al menos una línea.';
  for (const [i, l] of lines.entries()) {
    if (!l.budget_id) return `Línea ${i + 1}: selecciona un presupuesto.`;
    if (!Number.isFinite(parseNum(l.quantity)) || !Number.isFinite(parseNum(l.price_unit))) {
      return `Línea ${i + 1}: cantidad y precio deben ser números.`;
    }
  }
  return null;
}

export function toPaidstateLines(lines: DraftPaidstateLine[]): (NewPaidstateLine & { id?: number })[] {
  return lines.map((l) => ({
    ...(l.id ? { id: l.id } : {}),
    budget_id: l.budget_id as number,
    name: l.name.trim(),
    quantity: Math.trunc(parseNum(l.quantity)),
    price_unit: parseNum(l.price_unit),
    certification_factor: parseNum(l.certification_factor) || 0,
  }));
}

export function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(value).toFixed(2).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${intFormatted},${decPart} €`;
}

interface Props {
  lines: DraftPaidstateLine[];
  budgets: ProjectBudgetItem[];
  onChange: (lines: DraftPaidstateLine[]) => void;
  /** false = solo lectura */
  editable?: boolean;
  /** Texto del selector de presupuesto cuando aún no hay proyecto */
  budgetsPlaceholder?: string;
}

export default function PaidstateLinesTable({
  lines,
  budgets,
  onChange,
  editable = true,
  budgetsPlaceholder = 'Selecciona...',
}: Props) {
  function updateLine(key: number, patch: Partial<DraftPaidstateLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onBudgetChange(line: DraftPaidstateLine, value: string) {
    const budgetId = value ? Number(value) : '';
    const previous = budgets.find((b) => b.id === line.budget_id);
    const next = budgets.find((b) => b.id === budgetId);
    // Como en Odoo: la descripción se rellena con el presupuesto si no se ha tocado
    const keepName = line.name && line.name !== previous?.display_name && line.name !== previous?.name;
    updateLine(line.key, { budget_id: budgetId, name: keepName ? line.name : next?.display_name ?? '' });
  }

  const inputClass =
    'rounded border border-gray-300 bg-white text-gray-800 placeholder:text-gray-400 px-2 py-1.5 text-sm outline-none focus:border-brand-400';
  const noBudgets = budgets.length === 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white text-gray-800">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2">Presupuesto</th>
            <th className="px-3 py-2">Descripción</th>
            <th className="px-3 py-2 text-right">Cantidad</th>
            <th className="px-3 py-2 text-right">Precio</th>
            <th className="px-3 py-2 text-right">Neto</th>
            <th className="px-3 py-2 text-right">Importe</th>
            {editable && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={editable ? 7 : 6} className="px-3 py-4 text-center text-gray-400">
                Sin líneas.
              </td>
            </tr>
          )}
          {lines.map((line) => {
            const { net, total } = lineAmount(line);
            const budget = budgets.find((b) => b.id === line.budget_id);
            return (
              <tr key={line.key} className="border-t border-gray-100 align-middle">
                <td className="px-2 py-2">
                  {editable ? (
                    <select
                      value={line.budget_id === '' ? '' : String(line.budget_id)}
                      onChange={(e) => onBudgetChange(line, e.target.value)}
                      disabled={noBudgets}
                      className={`w-64 ${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
                    >
                      <option value="">{noBudgets ? budgetsPlaceholder : 'Selecciona...'}</option>
                      {budgets.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.display_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="px-1">{budget?.display_name ?? '—'}</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {editable ? (
                    <input
                      type="text"
                      value={line.name}
                      onChange={(e) => updateLine(line.key, { name: e.target.value })}
                      className={`w-64 ${inputClass}`}
                    />
                  ) : (
                    <span className="px-1">{line.name}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {editable ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      className={`w-16 text-right ${inputClass}`}
                    />
                  ) : (
                    line.quantity
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {editable ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.price_unit}
                      onChange={(e) => updateLine(line.key, { price_unit: e.target.value })}
                      placeholder="0,00"
                      className={`w-28 text-right ${inputClass}`}
                    />
                  ) : (
                    formatCurrency(parseNum(line.price_unit))
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-gray-600">{formatCurrency(net)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{formatCurrency(total)}</td>
                {editable && (
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
                      className="rounded px-2 py-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Eliminar línea"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50">
            <td colSpan={5} className="px-3 py-2">
              {editable && (
                <button
                  type="button"
                  onClick={() => onChange([...lines, emptyPaidstateLine()])}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  + Añadir una línea
                </button>
              )}
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap font-bold">{formatCurrency(linesTotal(lines))}</td>
            {editable && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
