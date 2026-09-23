'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiPurchaseDetail, PurchaseDetail } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { formatCurrency, formatDate, formatNumber, purchaseStateBadge } from '../utils';

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{value || '—'}</span>
    </div>
  );
}

export default function CompraDetallePage() {
  const params = useParams<{ id: string }>();
  const purchaseId = Number(params.id);
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const validId = Number.isInteger(purchaseId) && purchaseId > 0;
  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState(validId ? '' : 'Compra inválida.');

  useEffect(() => {
    const token = getToken();
    if (!token || !validId) return;
    apiPurchaseDetail(token, purchaseId)
      .then((res) => {
        if (res.success && res.purchase) setPurchase(res.purchase);
        else setError(res.error || 'No se pudo cargar la compra.');
      })
      .catch(() => setError('Error de conexión al cargar la compra.'))
      .finally(() => setLoading(false));
  }, [purchaseId, validId]);

  return (
    <div className="p-4 md:p-6 text-slate-800">
      <Link href="/dashboard/compras" className="text-sm text-blue-700 hover:underline">
        ← Volver a compras
      </Link>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Cargando compra...</p>
      ) : error || !purchase ? (
        <p className="mt-6 text-sm text-red-600">{error || 'Compra no encontrada.'}</p>
      ) : (
        <>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Orden de compra</p>
                <h1 className="text-2xl font-bold text-slate-800">{purchase.name}</h1>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${purchaseStateBadge(purchase.state)}`}>
                {purchase.state_label}
              </span>
            </div>

            <div className="mt-4 grid gap-x-8 md:grid-cols-2">
              <div>
                <Field label="Proveedor" value={purchase.partner_name} />
                <Field label="NIF" value={purchase.partner_vat} />
                <Field label="Ref. proveedor" value={purchase.partner_ref} />
                <Field label="Proyecto" value={purchase.project_name} />
                <Field label="Documento origen" value={purchase.origin} />
                <Field label="Moneda" value={purchase.currency_name} />
              </div>
              <div>
                <Field label="Fecha pedido" value={formatDate(purchase.date_order, true)} />
                <Field label="Fecha confirmación" value={formatDate(purchase.date_approve, true)} />
                <Field label="Entrega esperada" value={formatDate(purchase.date_planned, true)} />
                <Field label="Entregar a" value={purchase.picking_type_name} />
                <Field label="Comprador" value={purchase.user_name} />
                <Field label="Término de pago" value={purchase.payment_term_name} />
                <Field label="Estado entrega" value={purchase.receipt_status_label} />
                <Field label="Estado facturación" value={purchase.invoice_status_label} />
                <Field
                  label="Facturas"
                  value={purchase.invoices.length ? purchase.invoices.map((i) => i.name).join(', ') : ''}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Recibido</th>
                  <th className="px-3 py-2 text-right">Facturado</th>
                  <th className="px-3 py-2">UdM</th>
                  <th className="px-3 py-2 text-right">Precio unit.</th>
                  <th className="px-3 py-2">Impuestos</th>
                  <th className="px-3 py-2 text-right">Desc. %</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {purchase.lines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
                      Sin líneas.
                    </td>
                  </tr>
                ) : (
                  purchase.lines.map((line) =>
                    line.display_type ? (
                      <tr key={line.id} className="border-t border-slate-100 bg-slate-50/60">
                        <td
                          colSpan={10}
                          className={`px-3 py-2 ${line.display_type === 'line_section' ? 'font-semibold text-slate-700' : 'italic text-slate-500'}`}
                        >
                          {line.name}
                        </td>
                      </tr>
                    ) : (
                      <tr key={line.id} className="border-t border-slate-100 text-slate-700">
                        <td className="px-3 py-2">{line.product_name || '—'}</td>
                        <td className="px-3 py-2 whitespace-pre-line">{line.name}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(line.product_qty ?? 0)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(line.qty_received ?? 0)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(line.qty_invoiced ?? 0)}</td>
                        <td className="px-3 py-2">{line.uom_name}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{formatNumber(line.price_unit ?? 0, 4)}</td>
                        <td className="px-3 py-2 text-xs">{line.taxes || '—'}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(line.discount ?? 0)}</td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                          {formatCurrency(line.price_subtotal ?? 0)}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Términos y condiciones</p>
              {purchase.notes ? (
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: purchase.notes }} />
              ) : (
                <p className="text-slate-400">—</p>
              )}
            </div>
            <div className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm md:w-72">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Importe base</span>
                <span className="font-semibold">{formatCurrency(purchase.amount_untaxed)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Impuestos</span>
                <span className="font-semibold">{formatCurrency(purchase.amount_tax)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 text-base">
                <span className="font-semibold text-slate-700">Total</span>
                <span className="font-bold">{formatCurrency(purchase.amount_total)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
