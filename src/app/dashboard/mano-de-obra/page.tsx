'use client';

import { useEffect, useState } from 'react';
import {
  apiBudgets,
  apiBudgetLabor,
  apiBudgetLaborCompute,
  BudgetItem,
  LaborLineItem,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import { apiProjects, PortalProject } from '@/lib/api';

function esNum(value: number, decimals = 2): string {
  const sign = value < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(value).toFixed(decimals).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${sign}${intFormatted},${decPart}` : `${sign}${intFormatted}`;
}

export default function ManoDeObraPage() {
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | ''>('');
  const [projSearchQ, setProjSearchQ] = useState('');
  const [projDropOpen, setProjDropOpen] = useState(false);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | ''>('');
  const [budgetSearchQ, setBudgetSearchQ] = useState('');
  const [budgetDropOpen, setBudgetDropOpen] = useState(false);
  const [lines, setLines] = useState<LaborLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiProjects(token).then(res => {
      if (res.success) setProjects(res.projects || []);
    });
  }, []);

  async function onProjectChange(pid: number | '') {
    setSelectedProject(pid);
    setSelectedBudget('');
    setLines([]);
    setBudgets([]);
    if (!pid) return;
    const token = getToken();
    if (!token) return;
    const res = await apiBudgets(token, pid as number);
    if (res.success) setBudgets(res.budgets || []);
  }

  async function loadLabor(bid: number) {
    setLoading(true);
    const token = getToken();
    if (!token) return;
    const res = await apiBudgetLabor(token, bid);
    if (res.success) {
      setLines(res.lines || []);
    }
    setLoading(false);
  }

  async function onBudgetChange(bid: number | '') {
    setSelectedBudget(bid);
    setLines([]);
    if (!bid) return;
    await loadLabor(bid as number);
  }

  async function handleCompute() {
    if (!selectedBudget) return;
    setComputing(true);
    setMsg('');
    const token = getToken();
    if (!token) return;
    const res = await apiBudgetLaborCompute(token, selectedBudget as number);
    setComputing(false);
    if (res.success) {
      setLines(res.lines || []);
      setMsg('Actualizado correctamente.');
    } else {
      setMsg(res.error || 'Error al actualizar.');
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto text-slate-800">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Mano de Obra</h1>

      {/* Selectores */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">Obra</label>
          <div className="relative">
            <button type="button" onClick={() => { setProjDropOpen((o) => !o); setProjSearchQ(''); }}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-left flex items-center justify-between gap-2 outline-none">
              <span className={selectedProject ? 'text-slate-800' : 'text-slate-400'}>
                {selectedProject ? (projects.find((p) => p.id === selectedProject)?.display_name ?? 'Seleccionar obra...') : 'Seleccionar obra...'}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{projDropOpen ? '▲' : '▼'}</span>
            </button>
            {projDropOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="p-2 border-b border-slate-100">
                  <input autoFocus type="text" value={projSearchQ} onChange={(e) => setProjSearchQ(e.target.value)}
                    placeholder="Buscar por código o nombre..." className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none placeholder:text-slate-500" />
                </div>
                <ul className="max-h-60 overflow-y-auto py-1">
                  {projects.filter((p) => { const q = projSearchQ.toLowerCase(); return !q || p.display_name.toLowerCase().includes(q); }).map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => { onProjectChange(p.id); setProjDropOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${selectedProject === p.id ? 'font-semibold text-blue-700 bg-blue-50' : 'text-slate-700'}`}>
                        {p.display_name}
                        {p.state_name && <span className="ml-1 text-xs text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">{p.state_name}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {projDropOpen && <div className="fixed inset-0 z-40" onClick={() => setProjDropOpen(false)} />}
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">Presupuesto</label>
          <div className="relative">
            <button type="button" onClick={() => { if (selectedProject) { setBudgetDropOpen((o) => !o); setBudgetSearchQ(''); } }}
              disabled={!selectedProject}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-left flex items-center justify-between gap-2 outline-none disabled:opacity-50">
              <span className={selectedBudget ? 'text-slate-800' : 'text-slate-400'}>
                {selectedBudget ? (budgets.find((b) => b.id === selectedBudget)?.display_name ?? 'Seleccionar presupuesto...') : 'Seleccionar presupuesto...'}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{budgetDropOpen ? '▲' : '▼'}</span>
            </button>
            {budgetDropOpen && selectedProject && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="p-2 border-b border-slate-100">
                  <input autoFocus type="text" value={budgetSearchQ} onChange={(e) => setBudgetSearchQ(e.target.value)}
                    placeholder="Buscar presupuesto..." className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none placeholder:text-slate-500" />
                </div>
                <ul className="max-h-60 overflow-y-auto py-1">
                  {budgets.filter((b) => { const q = budgetSearchQ.toLowerCase(); return !q || b.display_name.toLowerCase().includes(q); }).map((b) => (
                    <li key={b.id}>
                      <button type="button" onClick={() => { onBudgetChange(b.id); setBudgetDropOpen(false); setBudgetSearchQ(''); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-1.5 ${selectedBudget === b.id ? 'font-semibold text-blue-700 bg-blue-50' : 'text-slate-700'}`}>
                        {b.display_name}
                        {b.state_name && <span className="ml-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">{b.state_name}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {budgetDropOpen && selectedProject && <div className="fixed inset-0 z-40" onClick={() => setBudgetDropOpen(false)} />}
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando...</p>}

      {selectedBudget && !loading && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={handleCompute} disabled={computing}
              className="flex items-center gap-2 rounded bg-slate-700 hover:bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <svg className={`w-4 h-4 ${computing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {computing ? 'Actualizando...' : 'ACTUALIZAR'}
            </button>
            {msg && <span className={`text-sm ${msg.includes('Error') ? 'text-rose-600' : 'text-emerald-600'}`}>{msg}</span>}
          </div>

          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="min-w-full text-sm table-fixed">
              <thead className="bg-slate-100 text-slate-600 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right" style={{ width: 110 }}>H. Presupuesto</th>
                  <th className="px-3 py-2 text-right" style={{ width: 110 }}>H. Imputadas</th>
                  <th className="px-3 py-2 text-right" style={{ width: 110 }}>Resultado</th>
                  <th className="px-3 py-2 text-right" style={{ width: 90 }}>Desvío %</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-slate-200">
                    <td className="px-3 py-1.5 text-slate-700">{l.product_name}</td>
                    <td className="px-3 py-1.5 text-right text-slate-700">{esNum(l.h_presupuesto)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-700">{esNum(l.h_imputadas)}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${l.resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {esNum(l.resultado)}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${l.desvio > 0 ? 'text-rose-600' : l.desvio < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {esNum(l.desvio)}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400 text-sm">Sin datos. Pulsa ACTUALIZAR para calcular.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
