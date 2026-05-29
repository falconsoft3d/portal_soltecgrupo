/**
 * Cliente API del portal.
 * Todas las llamadas van a /api/* (Next.js API Routes),
 * que actúan como proxy hacia Odoo para evitar problemas de CORS.
 */

export interface PartnerInfo {
  id: number;
  name: string;
  email: string;
  login: string;
}

export interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  token?: string;
  partner?: PartnerInfo;
}

async function post(path: string, body: Record<string, unknown> = {}, token?: string): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  return res.json();
}

export const apiLogin = (login: string, password: string) =>
  post('/api/login', { login, password });

export const apiMe = (token: string) =>
  post('/api/me', {}, token);

export const apiChangePassword = (
  token: string,
  current_password: string,
  new_password: string,
  confirm_password: string,
) => post('/api/change-password', { current_password, new_password, confirm_password }, token);

export const apiLogout = (token: string) =>
  post('/api/logout', {}, token);

