import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const ODOO_URL = process.env.ODOO_URL ?? 'http://localhost:8069';
const PLANNER_JWT_SECRET = process.env.PLANNER_JWT_SECRET ?? '';

function verifyHS256(jwt: string, secret: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const signingInput = `${header}.${payload}`;

  const expected = createHmac('sha256', secret).update(signingInput).digest();
  const received = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!PLANNER_JWT_SECRET) {
    console.error('[SSO-in] PLANNER_JWT_SECRET no configurado.');
    return Response.json({ success: false, error: 'Configuración incompleta.' }, { status: 500 });
  }

  let body: { token?: string };
  try {
    body = (await req.json()) as { token?: string };
  } catch {
    return Response.json({ success: false, error: 'Cuerpo de petición inválido.' }, { status: 400 });
  }

  const { token: jwtToken } = body;
  if (!jwtToken) {
    return Response.json({ success: false, error: 'Token JWT no proporcionado.' }, { status: 400 });
  }

  const claims = verifyHS256(jwtToken, PLANNER_JWT_SECRET);
  if (!claims) {
    console.warn('[SSO-in] JWT con firma inválida recibido.');
    return Response.json({ success: false, error: 'Token inválido.' }, { status: 401 });
  }

  console.log('[SSO-in] Claims recibidos:', JSON.stringify(claims));

  const now = Math.floor(Date.now() / 1000);

  if (typeof claims.exp === 'number' && claims.exp < now) {
    console.warn('[SSO-in] JWT expirado (exp=%d, now=%d)', claims.exp, now);
    return Response.json({ success: false, error: 'Token expirado.' }, { status: 401 });
  }
  if (typeof claims.nbf === 'number' && claims.nbf > now + 30) {
    return Response.json({ success: false, error: 'Token aún no válido.' }, { status: 401 });
  }
  if (claims.iss !== 'planner') {
    console.warn('[SSO-in] iss inesperado:', claims.iss);
    return Response.json({ success: false, error: 'Emisor no reconocido.' }, { status: 401 });
  }
  if (claims.aud !== 'soltec_portal') {
    console.warn('[SSO-in] aud inesperado:', claims.aud);
    return Response.json({ success: false, error: 'Audiencia incorrecta.' }, { status: 401 });
  }

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email) {
    return Response.json({ success: false, error: 'Email no presente en el token.' }, { status: 401 });
  }

  // Generar HMAC de corta duración para que Odoo confíe en esta llamada
  const ts = now;
  const sig = createHmac('sha256', PLANNER_JWT_SECRET)
    .update(`${email}:${ts}`)
    .digest('hex');

  console.log('[SSO-in] Solicitando sesión Odoo para email=%s', email);

  let odooData: { success?: boolean; token?: string; partner?: unknown; error?: string };
  try {
    const odooRes = await fetch(`${ODOO_URL}/portal/soltec/sso-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { email, ts, sig } }),
    });
    const odooJson = (await odooRes.json()) as { result?: typeof odooData; error?: unknown };
    console.log('[SSO-in] Respuesta Odoo sso-login:', JSON.stringify(odooJson?.result ?? odooJson?.error));
    odooData = (odooJson?.result ?? {}) as typeof odooData;
  } catch (err) {
    console.error('[SSO-in] Error al contactar Odoo:', err);
    return Response.json({ success: false, error: 'Error de autenticación.' }, { status: 502 });
  }

  if (!odooData.success || !odooData.token) {
    return Response.json({ success: false, error: odooData.error ?? 'Error de autenticación.' }, { status: 401 });
  }

  console.log('[SSO-in] Sesión creada para email=%s', email);
  return Response.json({ success: true, token: odooData.token, partner: odooData.partner });
}
