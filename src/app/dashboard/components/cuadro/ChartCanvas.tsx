'use client';

import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';
import { fonts } from './lib';

/** Lienzo de Chart.js. `config` debe venir memoizado: cada cambio recrea el gráfico. */
export default function ChartCanvas({ config, className = 'chart' }: {
  config: ChartConfiguration | Record<string, unknown> | null;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current || !config) return;
    Chart.defaults.font.family = fonts().ui;
    const chart = new Chart(ref.current, config as ChartConfiguration);
    return () => chart.destroy();
  }, [config]);
  return <div className={className}><canvas ref={ref} /></div>;
}
