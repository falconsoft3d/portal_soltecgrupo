'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiPaidstateDetail, apiSavePaidstate, apiSetPaidstateState, PaidstateDetail } from '@/lib/api';
import { getToken } from '@/lib/auth';
import PaidstateLinesTable, {
  DraftPaidstateLine,
  draftFromLine,
  formatCurrency,
  linesTotal,
  toPaidstateLines,
  validatePaidstateLines,
} from '../PaidstateLinesTable';

const STATE_STEPS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'validated', label: 'Validado' },
  { value: 'invoiced', label: 'Facturado' },
];

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-2 py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800">{value || '—'}</span>
    </div>
  );
}

function formatDay(value: string | false): string {
  const match = value ? String(value).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}

/** Huella de lo editable, para saber si hay cambios sin guardar. */
function snapshot(date: string, lines: DraftPaidstateLine[]): string {
  return JSON.stringify({ date, lines: toPaidstateLines(lines) });
}

export default function EstadoPagoDetallePage() {
  const params = useParams<{ id: string }>();
  const paidstateId = Number(params.id);
  const validId = Number.isInteger(paidstateId) && paidstateId > 0;

  const [paidstate, setPaidstate] = useState<PaidstateDetail | null>(null);
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState(validId ? '' : 'Estado de pago inválido.');

  const [date, setDate] = useState('');
  const [lines, setLines] = useState<DraftPaidstateLine[]>([]);
  const [baseline, setBaseline] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');

  function loadForm(ps: PaidstateDetail) {
    const nextDate = ps.date || '';
    const nextLines = ps.lines.map(draftFromLine);
    setPaidstate(ps);
    setDate(nextDate);
    setLines(nextLines);
    setBaseline(snapshot(nextDate, nextLines));
  }

  useEffect(() => {
    const token = getToken();
    if (!token || !validId) return;
    apiPaidstateDetail(token, paidstateId)
      .then((res) => {
        if (res.success && res.paidstate) loadForm(res.paidstate);
        else setError(res.error || 'No se pudo cargar el estado de pago.');
      })
      .catch(() => setError('Error de conexión al cargar el estado de pago.'))
      .finally(() => setLoading(false));
  }, [paidstateId, validId]);

  const editable = !!paidstate?.editable;
  const dirty = editable && snapshot(date, lines) !== baseline;

  async function handleSave() {
    const token = getToken();
    if (!token || !paidstate) return;
    const linesError = validatePaidstateLines(lines);
    if (linesError) {
      setActionError(linesError);
      return;
    }
    if (!date) {
      setActionError('Indica una fecha.');
      return;
    }
    setBusy(true);
    setActionError('');
    setMessage('');
    try {
      const res = await apiSavePaidstate(token, paidstate.id, date, toPaidstateLines(lines));
      if (res.success && res.paidstate) {
        loadForm(res.paidstate);
        setMessage('Cambios guardados.');
      } else {
        setActionError(res.error || 'No se pudo guardar el estado de pago.');
      }
    } catch {
      setActionError('Error de conexión al guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function changeState(target: 'draft' | 'validated') {
    const token = getToken();
    if (!token || !paidstate) return;
    setBusy(true);
    setActionError('');
    setMessage('');
    try {
      const res = await apiSetPaidstateState(token, paidstate.id, target);
      if (!res.success) {
        setActionError(res.error || 'No se pudo cambiar el estado.');
        return;
      }
      // Recargar el detalle completo (líneas y si sigue siendo editable)
      const detail = await apiPaidstateDetail(token, paidstate.id);
      if (detail.success && detail.paidstate) loadForm(detail.paidstate);
    } catch {
      setActionError('Error de conexión al cambiar el estado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4 text-gray-800 md:p-6">
      <Link href="/dashboard/estados-pago" className="text-sm text-brand-700 hover:underline">
        ← Volver a estados de pago
      </Link>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando estado de pago...</p>
      ) : error || !paidstate ? (
        <p className="text-sm text-rose-600">{error || 'Estado de pago no encontrado.'}</p>
      ) : (
        <>
          {/* Barra de acciones, como el header del formulario de Odoo */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {paidstate.state === 'draft' && (
                <button
                  type="button"
                  disabled={busy || dirty}
                  title={dirty ? 'Guarda o descarta los cambios primero' : undefined}
                  onClick={() => changeState('validated')}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  Validar
                </button>
              )}
              {paidstate.state === 'validated' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeState('draft')}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  Volver a borrador
                </button>
              )}
            </div>
            <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-semibold">
              {STATE_STEPS.map((step) => (
                <span
                  key={step.value}
                  className={`px-3 py-1.5 ${
                    paidstate.state === step.value ? 'bg-brand-600 text-white' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Estado de pago</p>
            <h1 className="text-2xl font-bold text-gray-800">{paidstate.name}</h1>
            <div className="mt-4 grid gap-x-8 md:grid-cols-2">
              <div>
                <Field label="Proyecto" value={paidstate.project_name} />
                <Field label="Objeto" value={paidstate.object_name} />
                <Field label="Tipo" value={paidstate.type === 'certification' ? 'Por certificación' : 'Manual'} />
              </div>
              <div>
                <Field
                  label="Fecha"
                  value={
                    editable ? (
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        disabled={busy}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none focus:border-brand-400"
                      />
                    ) : (
                      formatDay(paidstate.date)
                    )
                  }
                />
                <Field label="Compañía" value={paidstate.company_name} />
                <Field label="Importe total" value={formatCurrency(paidstate.amount_total)} />
              </div>
            </div>
          </div>

          <PaidstateLinesTable
            lines={lines}
            budgets={paidstate.budgets}
            onChange={setLines}
            editable={editable}
            budgetsPlaceholder="Sin presupuestos certificables"
          />

          {actionError && <p className="text-sm text-rose-600">{actionError}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}

          {editable && (
            <div className="flex items-center justify-end gap-3">
              {dirty && (
                <span className="text-sm text-gray-500">
                  Importe con cambios: <span className="font-semibold">{formatCurrency(linesTotal(lines))}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => loadForm(paidstate)}
                disabled={busy || !dirty}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy || !dirty}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
