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

  let json: unknown;
  try {
    json = await odooRes.json();
  } catch {
    return Response.json(
      { success: false, error: `Odoo no respondió correctamente (HTTP ${odooRes.status}).` },
      { status: 502 },
    );
  }

  // Si Odoo devuelve un error JSON-RPC, extraer el mensaje real
  const rpcError = (json as { error?: { message?: string; data?: { message?: string } } }).error;
  if (rpcError) {
    const message =
      rpcError.data?.message || rpcError.message || 'Error del servidor.';
    return Response.json({ success: false, error: message }, { status: 200 });
  }

  // Odoo envuelve la respuesta en json.result
  const result = (json as { result?: unknown }).result ?? json;

  return Response.json(result, { status: odooRes.ok ? 200 : 502 });
}
