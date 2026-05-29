/**
 * Proxy helper: reenvía la llamada a Odoo desde el servidor (sin CORS).
 * El navegador solo llama a /api/*, nunca directamente a Odoo.
 */

const ODOO_URL = process.env.ODOO_URL || 'http://localhost:8069';

export async function odooProxy(
  endpoint: string,
  params: Record<string, unknown>,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const odooRes = await fetch(`${ODOO_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params }),
  });

  const json = await odooRes.json();
  // Odoo envuelve la respuesta en json.result
  const result = json.result ?? json;

  return Response.json(result, { status: odooRes.ok ? 200 : 502 });
}
