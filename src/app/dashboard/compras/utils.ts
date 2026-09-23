export function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(value).toFixed(2).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${intFormatted},${decPart} €`;
}

export function formatNumber(value: number, decimals = 2): string {
  const sign = value < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(value).toFixed(decimals).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${sign}${intFormatted},${decPart}` : `${sign}${intFormatted}`;
}

/** Odoo devuelve los datetime en UTC con formato "YYYY-MM-DD HH:MM:SS". */
export function formatDate(value: string | false, withTime = false): string {
  if (!value) return '—';
  const date = new Date(`${String(value).replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const base = `${d}/${m}/${date.getFullYear()}`;
  if (!withTime) return base;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${base} ${hh}:${mm}`;
}

export function purchaseStateBadge(state: string): string {
  if (state === 'purchase' || state === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (state === 'cancel') return 'bg-red-50 text-red-700 border-red-200';
  if (state === 'to approve') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
}

export function receiptStatusBadge(status: string): string {
  if (status === 'full') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}
