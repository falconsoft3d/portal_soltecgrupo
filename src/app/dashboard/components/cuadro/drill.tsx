'use client';

/* Desglose de importes: cualquier cifra que salga de apuntes contables enlaza a la página «Apuntes». */
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { AccountingDrillSpec } from '@/lib/api';

export const APUNTES_PATH = '/dashboard/apuntes';

export const drillHref = (spec: AccountingDrillSpec) => `${APUNTES_PATH}?spec=${encodeURIComponent(JSON.stringify(spec))}`;

export function parseSpec(raw: string | null): AccountingDrillSpec | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && typeof v.t === 'string' ? (v as AccountingDrillSpec) : null;
  } catch {
    return null;
  }
}

/** Enlace a los apuntes que forman el importe. */
export function Drill({ spec, children, className = '' }: { spec: AccountingDrillSpec; children: ReactNode; className?: string }) {
  return (
    <Link href={drillHref(spec)} className={`drill ${className}`} title="Ver los apuntes que forman este importe">
      {children}
    </Link>
  );
}

/** Opciones de Chart.js para abrir el desglose al pulsar un elemento del gráfico. */
export function chartDrill(go: (href: string) => void, toSpec: (datasetIndex: number, index: number) => AccountingDrillSpec | null) {
  return {
    onClick: (_e: unknown, els: { datasetIndex: number; index: number }[]) => {
      const el = els[0];
      if (!el) return;
      const spec = toSpec(el.datasetIndex, el.index);
      if (spec) go(drillHref(spec));
    },
    onHover: (e: { native?: { target?: EventTarget | null } }, els: { datasetIndex: number; index: number }[]) => {
      const t = e.native?.target as HTMLElement | undefined;
      if (t) t.style.cursor = els.length && toSpec(els[0].datasetIndex, els[0].index) ? 'pointer' : 'default';
    },
  };
}
