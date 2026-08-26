import { NextRequest } from 'next/server';
import { createHmac, randomUUID } from 'crypto';

const ODOO_URL = process.env.ODOO_URL ?? 'http://localhost:8069';
const PLANNER_JWT_SECRET = process.env.PLANNER_JWT_SECRET ?? '';
const PLANNER_REDIRECT_BASE = 'https://planner.soltecgrupo.es/auth/sso/soltec';

function base64url(data: Buffer | string): string {
  const b64 = Buffer.from(data as never).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signHS256(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(signingInput).digest();
  return `${signingInput}.${base64url(sig)}`;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';

  if (!token) {
    console.warn('[Planner SSO] Petición sin token de autorización.');
    return Response.json({ success: false, error: 'No autenticado.' }, { status: 401 });
  }

  if (!PLANNER_JWT_SECRET) {
    console.error('[Planner SSO] PLANNER_JWT_SECRET no está configurado.');
    return Response.json({ success: false, error: 'Configuración incompleta del servidor.' }, { status: 500 });
  }

  // Obtener datos del usuario desde Odoo para extraer el email real
  let email: string;
  try {
    const odooRes = await fetch(`${ODOO_URL}/portal/soltec/me`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} }),
    });

    const odooJson = (await odooRes.json()) as {
      result?: { success?: boolean; partner?: { email?: string } };
      error?: unknown;
    };

    console.log('[Planner SSO] Respuesta Odoo /me:', JSON.stringify(odooJson?.result ?? odooJson?.error));

    const partner = odooJson?.result?.partner;
    if (!partner?.email) {
      console.warn('[Planner SSO] Email no encontrado en la respuesta de Odoo.');
      return Response.json({ success: false, error: 'No se pudo obtener el email del usuario.' }, { status: 401 });
    }
    email = partner.email;
  } catch (err) {
    console.error('[Planner SSO] Error al contactar con Odoo:', err);
    return Response.json({ success: false, error: 'Error de autenticación.' }, { status: 502 });
  }

  const now = Math.floor(Date.now() / 1000);
  const jti = randomUUID();

  const payload: Record<string, unknown> = {
    iss: 'soltec_satellite',
    aud: 'planner',
    tenant: 'soltec',
    email,
    jti,
    iat: now,
    nbf: now,
    exp: now + 60,
  };

  console.log('[Planner SSO] Enviando claims:', JSON.stringify({ ...payload }));

  const jwt = signHS256(payload, PLANNER_JWT_SECRET);
  const redirectUrl = `${PLANNER_REDIRECT_BASE}?t=${jwt}`;

  console.log(`[Planner SSO] Token generado (jti=${jti}, email=${email}), redirigiendo a ${PLANNER_REDIRECT_BASE}`);

  return Response.json({ success: true, url: redirectUrl });
}
