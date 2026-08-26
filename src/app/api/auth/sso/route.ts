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

  // Log del header/payload sin verificar para diagnóstico
  try {
    const [, rawPayload] = jwtToken.split('.');
    const preCheck = JSON.parse(Buffer.from(rawPayload, 'base64url').toString('utf8')) as Record<string, unknown>;
    console.log('[SSO-in] JWT recibido (sin verificar):', JSON.stringify(preCheck));
  } catch {
    console.warn('[SSO-in] JWT con formato inválido.');
  }

  const claims = verifyHS256(jwtToken, PLANNER_JWT_SECRET);
  if (!claims) {
    console.warn('[SSO-in] Verificación HS256 FALLIDA — firma inválida o secreto incorrecto.');
    return Response.json({ success: false, error: 'Firma del token inválida.' }, { status: 401 });
  }

  console.log('[SSO-in] Firma válida. Claims:', JSON.stringify(claims));

  const now = Math.floor(Date.now() / 1000);

  if (typeof claims.exp === 'number' && claims.exp < now) {
    console.warn('[SSO-in] JWT EXPIRADO (exp=%d, now=%d, desfase=%ds)', claims.exp, now, now - claims.exp);
    return Response.json({ success: false, error: 'Token expirado.' }, { status: 401 });
  }
  if (typeof claims.nbf === 'number' && claims.nbf > now + 30) {
    console.warn('[SSO-in] JWT aún no válido (nbf=%d, now=%d)', claims.nbf, now);
    return Response.json({ success: false, error: 'Token aún no válido.' }, { status: 401 });
  }
  if (claims.iss !== 'planner') {
    console.warn('[SSO-in] iss incorrecto: "%s" (esperado "planner")', claims.iss);
    return Response.json({ success: false, error: 'Emisor no reconocido.' }, { status: 401 });
  }

  // aud puede ser string o array según la librería JWT del emisor
  const aud = claims.aud;
  const audValid = aud === 'soltec_portal' || (Array.isArray(aud) && (aud as string[]).includes('soltec_portal'));
  if (!audValid) {
    console.warn('[SSO-in] aud incorrecto: %s (esperado "soltec_portal")', JSON.stringify(aud));
    return Response.json({ success: false, error: 'Audiencia incorrecta.' }, { status: 401 });
  }

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email) {
    console.warn('[SSO-in] Email vacío o ausente en claims.');
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
