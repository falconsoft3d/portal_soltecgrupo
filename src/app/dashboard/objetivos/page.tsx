'use client';

import { useEffect, useState } from 'react';
import {
  apiBudgets,
  apiBudgetObjectives,
  apiBudgetObjectiveProducts,
  apiBudgetObjectivesSave,
  BudgetItem,
  ObjectiveItem,
  ProductOption,
} from '@/lib/api';
import { getToken } from '@/lib/auth';
import { apiProjects, PortalProject } from '@/lib/api';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export default function ObjetivosPage() {
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | ''>('');
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<number | ''>('');
  const [objectives, setObjectives] = useState<ObjectiveItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([apiProjects(token), apiBudgetObjectiveProducts(token)]).then(([pr, prod]) => {
      if (pr.success) setProjects(pr.projects || []);
      if (prod.success) setProducts(prod.products || []);
    });
  }, []);

  async function onProjectChange(pid: number | '') {
    setSelectedProject(pid);
    setSelectedBudget('');
    setObjectives([]);
    setBudgets([]);
    if (!pid) return;
    const token = getToken();
    if (!token) return;
    const res = await apiBudgets(token, pid as number);
    if (res.success) setBudgets(res.budgets || []);
  }

  async function onBudgetChange(bid: number | '') {
    setSelectedBudget(bid);
    setObjectives([]);
    if (!bid) return;
    setLoading(true);
    const token = getToken();
    if (!token) return;
    const res = await apiBudgetObjectives(token, bid as number);
    if (res.success) setObjectives(res.objectives || []);
    setLoading(false);
  }

  function addRow() {
    setObjectives([...objectives, { id: null, date_from: today(), date_to: today(), product_id: false, product_name: '', daily_units: 0 }]);
  }

  function removeRow(idx: number) {
    setObjectives(objectives.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, field: keyof ObjectiveItem, value: string | number | false) {
    setObjectives(objectives.map((o, i) => {
      if (i !== idx) return o;
      if (field === 'product_id') {
        const p = products.find(p => p.id === Number(value));
        return { ...o, product_id: Number(value) || false, product_name: p?.name || '' };
      }
      return { ...o, [field]: value };
    }));
  }

  async function handleSave() {
    if (!selectedBudget) return;
    setSaving(true);
    setMsg('');
    const token = getToken();
    if (!token) return;
    const res = await apiBudgetObjectivesSave(token, selectedBudget as number, objectives);
    setSaving(false);
    setMsg(res.success ? 'Guardado correctamente.' : (res.error || 'Error al guardar.'));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto text-slate-800">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Objetivos</h1>

      {/* Selectores */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">Obra</label>
          <select
            className="w-full rounded border border-slate-300 bg-white text-slate-800 px-3 py-2 text-sm"
            value={selectedProject}
            onChange={e => onProjectChange(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Seleccionar obra...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-600 mb-1">Presupuesto</label>
          <select
            className="w-full rounded border border-slate-300 bg-white text-slate-800 px-3 py-2 text-sm"
            value={selectedBudget}
            onChange={e => onBudgetChange(e.target.value ? Number(e.target.value) : '')}
            disabled={!selectedProject}
          >
            <option value="">Seleccionar presupuesto...</option>
            {budgets.map(b => (
              <option key={b.id} value={b.id}>{b.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando...</p>}

      {selectedBudget && !loading && (
        <>
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha de Inicio</th>
                  <th className="px-3 py-2 text-left">Fecha de Fin</th>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">UD Diarias</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {objectives.map((obj, idx) => (
                  <tr key={idx} className="border-t border-slate-200">
                    <td className="px-3 py-1.5">
                      <input type="date" value={obj.date_from} onChange={e => updateRow(idx, 'date_from', e.target.value)}
                        className="rounded border border-slate-300 bg-white text-slate-800 px-2 py-1 text-xs w-full" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="date" value={obj.date_to} onChange={e => updateRow(idx, 'date_to', e.target.value)}
                        className="rounded border border-slate-300 bg-white text-slate-800 px-2 py-1 text-xs w-full" />
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={obj.product_id || ''} onChange={e => updateRow(idx, 'product_id', e.target.value)}
                        className="rounded border border-slate-300 bg-white text-slate-800 px-2 py-1 text-xs w-full">
                        <option value="">Seleccionar...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="number" value={obj.daily_units} step="0.01"
                        onChange={e => updateRow(idx, 'daily_units', parseFloat(e.target.value) || 0)}
                        className="rounded border border-slate-300 bg-white text-slate-800 px-2 py-1 text-xs w-24 text-right" />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <button onClick={() => removeRow(idx)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold">✕</button>
                    </td>
                  </tr>
                ))}
                {objectives.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400 text-sm">Sin objetivos. Añade una línea.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button onClick={addRow}
              className="rounded bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
              + Añadir línea
            </button>
            <button onClick={handleSave} disabled={saving}
              className="rounded bg-brand-600 hover:bg-brand-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            {msg && <span className={`text-sm ${msg.includes('Error') ? 'text-rose-600' : 'text-emerald-600'}`}>{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
