export { formatCurrency, formatNumber, monthLabel } from '../compras/utils';

/** Fecha simple de Odoo ("YYYY-MM-DD") a "DD/MM/YYYY", sin conversión de zona horaria. */
export function formatDay(value: string | false): string {
  if (!value) return '—';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}

export function expenseStateBadge(state: string): string {
  if (state === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (state === 'cancel') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

/** Clave "YYYY-MM" de una fecha simple de Odoo. */
export function dayMonthKey(value: string | false): string {
  const match = value ? String(value).match(/^(\d{4})-(\d{2})/) : null;
  return match ? `${match[1]}-${match[2]}` : 'none';
}
