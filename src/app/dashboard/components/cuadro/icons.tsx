/* Iconos del cuadro financiero (mismos trazos que el artefacto). */
import type { ReactNode } from 'react';

const S = ({ children, stroke = 'currentColor', w = 2 }: { children: ReactNode; stroke?: string; w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

export const Icon = {
  logo: <S><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></S>,
  conta: <S><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></S>,
  teso: <S><path d="M3 17l5-5 4 4 8-9" /><path d="M15 7h5v5" /></S>,
  bancos: <S><path d="M3 10l9-6 9 6" /><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18" /></S>,
  afin: <S><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6.4 6.4" /><path d="M12 12H3" /></S>,
  bank: <S><path d="M3 10l9-6 9 6" /><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18" /></S>,
  in: <S><path d="M12 5v14M6 13l6 6 6-6" /></S>,
  out: <S><path d="M12 19V5M6 11l6-6 6 6" /></S>,
  scale: <S><path d="M12 3v18M5 7h14M5 7l-3 6a3 3 0 006 0L5 7zM19 7l-3 6a3 3 0 006 0l-3-6z" /></S>,
  chart: <S><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></S>,
  card: <S><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></S>,
  cash: <S><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></S>,
  phone: <S><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></S>,
  warn: <S><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18h.01" /></S>,
  ok: <S w={2.2}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></S>,
};

export const KIND_ICON: Record<string, ReactNode> = {
  banco: Icon.bank, cartera: Icon.chart, tarjeta: Icon.card, efectivo: Icon.cash, fintech: Icon.phone,
};
