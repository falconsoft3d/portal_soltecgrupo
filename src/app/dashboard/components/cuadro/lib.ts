/**
 * Utilidades del "Cuadro financiero": paleta, formatos y opciones de Chart.js
 * (mismas que el artefacto Cuadro Financiero Soltec, paleta clara).
 */
import type { Plugin } from 'chart.js';

export const C = {
  bg: '#eef2f4', surface: '#ffffff', surface2: '#f3f6f8', ink: '#13232b', muted: '#5d6d75', line: '#dbe2e6',
  cS: '#0e8a7e', cG: '#6d4bc3', accent: '#0e8a7e',
  cobro: '#1f9d55', pago: '#e0583a', ajuste: '#d99a1e', estim: '#7a8fa0',
  pos: '#1b8a4b', neg: '#c73a2b', warn: '#b97800',
};

/** Color por compañía (por posición en la lista del contacto): teal, violeta, … */
export const COMPANY_COLORS = ['#0e8a7e', '#6d4bc3', '#d99a1e', '#2f62c4', '#c73a2b', '#5f9f2a', '#8a46a3', '#1386c6'];
export const companyColor = (index: number) => COMPANY_COLORS[(index < 0 ? 0 : index) % COMPANY_COLORS.length];

/** Colores por entidad bancaria (igual que el artefacto). */
export const ENT: Record<string, string> = {
  santander: '#d43a2f', bbva: '#2f62c4', bankinter: '#e27a1f', cajamar: '#2f8f45', caixa: '#1386c6', liberbank: '#8a46a3',
  revolut: '#6b7686', wise: '#5f9f2a', cash: '#b08a2e', sabadell: '#1f6fb2', unicaja: '#3a8d3e', ibercaja: '#2a6fb0',
  kutxa: '#c4262e', abanca: '#2d7dd2', openbank: '#e2001a', deutsche: '#0018a8', other: '#5d6d75',
};
export const entColor = (e: string) => ENT[e] ?? ENT.other;

/* ------------------------------------------------------------------ */
/*  Formatos                                                            */
/* ------------------------------------------------------------------ */

const nf0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
export const e0 = (n: number) => (Number.isFinite(n) ? nf0.format(Math.round(n)) : '—');
export const e2 = (n: number) => (Number.isFinite(n) ? nf2.format(n) : '—');
export const compact = (n: number) => {
  const a = Math.abs(n);
  return a >= 1e6 ? `${(n / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 2 })} M€`
    : a >= 1e3 ? `${(n / 1e3).toLocaleString('es-ES', { maximumFractionDigits: 0 })} k€`
      : `${Math.round(n)} €`;
};
export const pct = (n: number) => (Number.isFinite(n) ? `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` : '—');
export const cls = (n: number) => (n < 0 ? 'neg' : '');
export const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fM = (k: string) => { const [y, m] = k.split('-'); return `${MES[Number(m) - 1]} ${y.slice(2)}`; };
export const fD = (iso: string | null | undefined) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

export function rgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

/* Fechas en UTC con claves YYYY-MM-DD */
export const DAY = 86_400_000;
export const toTime = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
export const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
export function addMonthsIso(iso: string, n: number) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, d = Number(iso.slice(8, 10));
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return toIso(Date.UTC(y, m, Math.min(d, last)));
}

/* ------------------------------------------------------------------ */
/*  Chart.js                                                            */
/* ------------------------------------------------------------------ */

let FONT_UI = 'Manrope, system-ui, sans-serif';
let FONT_NUM = '"IBM Plex Mono", ui-monospace, monospace';
export function setChartFonts(ui: string, num: string) { FONT_UI = ui; FONT_NUM = num; }
export const fonts = () => ({ ui: FONT_UI, num: FONT_NUM });

/** Opciones de Chart.js como objeto mutable (mismo estilo que el artefacto). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyOpts = any;

export function tipOpts(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    backgroundColor: C.surface, titleColor: C.ink, bodyColor: C.ink, borderColor: C.line, borderWidth: 1, padding: 10, boxPadding: 4,
    titleFont: { family: FONT_UI, weight: '800' }, bodyFont: { family: FONT_NUM },
    callbacks: {
      label: (c: { dataset: { label?: string }; parsed: { y?: number } | number }) => {
        const v = typeof c.parsed === 'number' ? c.parsed : (c.parsed.y ?? 0);
        return ` ${c.dataset.label ? `${c.dataset.label}: ` : ''}${e0(v)}`;
      },
    },
  };
}

export function baseOpts(): AnyOpts {
  return {
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: tipOpts() },
    scales: {
      x: { ticks: { color: C.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { family: FONT_UI, size: 11, weight: 600 } }, grid: { display: false }, border: { color: C.line } },
      y: { ticks: { color: C.muted, callback: (v: number | string) => compact(Number(v)), font: { family: FONT_NUM, size: 11 } }, grid: { color: C.line }, border: { display: false } },
    },
  } as AnyOpts;
}

/** Opciones para barras horizontales (etiquetas en el eje Y). */
export function hbarOpts(maxLabel = 26): AnyOpts {
  const o = baseOpts();
  o.indexAxis = 'y';
  o.scales.x.grid = { color: C.line };
  o.scales.y.grid = { display: false };
  o.scales.y.ticks.callback = function (this: { getLabelForValue: (v: number) => string }, v: number | string) {
    const s = this.getLabelForValue(Number(v));
    return s.length > maxLabel ? `${s.slice(0, maxLabel - 1)}…` : s;
  };
  o.scales.y.ticks.font = { family: FONT_UI, size: 11, weight: 600 };
  return o;
}

/** Línea discontinua roja en y = 0. */
export const zeroLine: Plugin = {
  id: 'zero',
  afterDraw(c) {
    const y = c.scales.y;
    if (!y || y.min > 0 || y.max < 0) return;
    const p = y.getPixelForValue(0), x = c.chartArea, g = c.ctx;
    g.save(); g.strokeStyle = C.neg; g.setLineDash([5, 4]); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x.left, p); g.lineTo(x.right, p); g.stroke(); g.restore();
  },
};

/** Configuración de un donut con el total en el centro. */
export function donutConfig(labels: string[], data: number[], colors: string[]) {
  const total = data.reduce((a, b) => a + b, 0);
  const center: Plugin = {
    id: 'center',
    afterDraw(c) {
      const { ctx, chartArea: a } = c;
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.ink;
      ctx.font = `600 17px ${FONT_NUM}`; ctx.fillText(compact(total), (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 2);
      ctx.fillStyle = C.muted; ctx.font = `700 10.5px ${FONT_UI}`; ctx.fillText('TOTAL', (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 18);
      ctx.restore();
    },
  };
  return {
    type: 'doughnut' as const,
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: C.surface, borderWidth: 2, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '64%', animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: { ...tipOpts(), callbacks: { label: (c: { label: string; parsed: number }) => ` ${c.label}: ${e0(c.parsed)} (${pct((c.parsed / (total || 1)) * 100)})` } },
      },
    },
    plugins: [center],
  };
}

/** Relleno degradado vertical para líneas con área. */
export function gradientFill(color: string) {
  return (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
    const a = ctx.chart.chartArea;
    if (!a) return undefined;
    const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
    g.addColorStop(0, rgba(color, 0.35)); g.addColorStop(1, rgba(color, 0.02));
    return g;
  };
}
