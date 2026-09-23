'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { apiCreateMyProject, apiMyProjects, MyProject } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { formatCurrency, formatNumber } from '../compras/utils';

function ReadOnly({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        {value || <span className="italic">{hint ?? 'Automático'}</span>}
      </div>
    </div>
  );
}

export default function ProyectosPage() {
  const [rows, setRows] = useState<MyProject[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [defaultCompanyId, setDefaultCompanyId] = useState<number | ''>('');
  const [partnerName, setPartnerName] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Formulario de alta
  const [showForm, setShowForm] = useState(false);
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [expansion, setExpansion] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');

  // Debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setLoading(true);
      setSearch(next);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    apiMyProjects(token, search || undefined)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setError('');
          setRows(res.projects || []);
          setCompanies(res.companies || []);
          setDefaultCompanyId(res.default_company_id || '');
          setPartnerName(res.partner_name || '');
        } else {
          setRows([]);
          setError(res.error || 'No se pudieron cargar los proyectos.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Error de conexión al cargar los proyectos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, reloadKey]);

  const selectedCompany = companies.find((c) => c.id === companyId);

  function openForm() {
    setCompanyId(defaultCompanyId);
    setName('');
    setExpansion('');
    setFormError('');
    setMessage('');
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!companyId) {
      setFormError('Selecciona una compañía.');
      return;
    }
    if (!name.trim()) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    // Acepta "1.234,56" (formato español) y "1234.56"
    const raw = expansion.trim();
    const expansionValue = !raw ? 0 : Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
    if (!Number.isFinite(expansionValue)) {
      setFormError('La expansión de contrato debe ser un número.');
      return;
    }

    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await apiCreateMyProject(token, {
        company_id: companyId,
        name: name.trim(),
        expansion_contract: expansionValue,
      });
      if (res.success && res.project) {
        setShowForm(false);
        setMessage(`Proyecto ${res.project.code} creado correctamente.`);
        setLoading(true);
        setReloadKey((k) => k + 1);
      } else {
        setFormError(res.error || 'No se pudo crear el proyecto.');
      }
    } catch {
      setFormError('Error de conexión al crear el proyecto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 text-slate-800">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Proyectos</h1>
            <p className="text-xs text-slate-500">Obras en las que eres responsable de ejecución.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{rows.length}</span> registros
            </span>
            {!showForm && (
              <button
                type="button"
                onClick={openForm}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Nuevo
              </button>
            )}
          </div>
        </div>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por código, nombre o cliente..."
          className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
        />
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Nuevo proyecto</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Compañía</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Seleccionar compañía...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <ReadOnly label="Código" value="" />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <ReadOnly label="Cliente" value={selectedCompany?.name} hint="La compañía" />
            <ReadOnly label="Responsable ejecución" value={partnerName} />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Expansión contrato (€)</label>
              <input
                type="text"
                inputMode="decimal"
                value={expansion}
                onChange={(e) => setExpansion(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-sm outline-none focus:border-blue-400"
              />
            </div>
            <ReadOnly label="Estado" value="" />
          </div>
          {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Creando...' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Compañía</th>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Responsable ejecución</th>
              <th className="px-3 py-2">Encargado de obra</th>
              <th className="px-3 py-2 text-right">T-desplazamiento</th>
              <th className="px-3 py-2 text-right">Contratado venta</th>
              <th className="px-3 py-2 text-right">Contratado coste</th>
              <th className="px-3 py-2 text-right">Coef. contratación</th>
              <th className="px-3 py-2 text-right">Expansión contrato</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
                  Cargando proyectos...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
                  No hay proyectos para el filtro actual.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 text-slate-700">
                  <td className="px-3 py-2">{p.company_name || '—'}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{p.code}</td>
                  <td className="px-3 py-2">{p.name || '—'}</td>
                  <td className="px-3 py-2">{p.customer_name || '—'}</td>
                  <td className="px-3 py-2">{p.manager_name || '—'}</td>
                  <td className="px-3 py-2">{p.foreman_name || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatNumber(p.t_desplazamiento)} h</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(p.contracted_sale)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(p.contracted_cost)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatNumber(p.contracted_coefficient)} %</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(p.expansion_contract)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.state_name ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                        {p.state_name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
