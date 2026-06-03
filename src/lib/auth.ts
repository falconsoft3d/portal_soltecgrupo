export const TOKEN_KEY = 'portal_token';
const REMEMBERED_CREDENTIALS_KEY = 'portal_remembered_credentials_v1';
const REMEMBERED_SECRET_KEY = 'portal_remembered_secret_v1';

type RememberedCredentials = {
  login: string;
  password: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getOrCreateRememberSecret(): Uint8Array | null {
  if (typeof window === 'undefined') return null;

  const existing = localStorage.getItem(REMEMBERED_SECRET_KEY);
  if (existing) {
    return base64ToBytes(existing);
  }

  const raw = new Uint8Array(32);
  window.crypto.getRandomValues(raw);
  localStorage.setItem(REMEMBERED_SECRET_KEY, bytesToBase64(raw));
  return raw;
}

async function getRememberCryptoKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined') return null;
  const secret = getOrCreateRememberSecret();
  if (!secret) return null;

  return window.crypto.subtle.importKey('raw', secret, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function saveRememberedCredentials(login: string, password: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = await getRememberCryptoKey();
  if (!key) return;

  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);
  const encoder = new TextEncoder();
  const plain = encoder.encode(JSON.stringify({ login, password }));
  const cipherBuffer = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const cipher = new Uint8Array(cipherBuffer);

  localStorage.setItem(REMEMBERED_CREDENTIALS_KEY, JSON.stringify({
    iv: bytesToBase64(iv),
    data: bytesToBase64(cipher),
  }));
}

export async function getRememberedCredentials(): Promise<RememberedCredentials | null> {
  if (typeof window === 'undefined') return null;

  const rawPayload = localStorage.getItem(REMEMBERED_CREDENTIALS_KEY);
  if (!rawPayload) return null;

  try {
    const payload = JSON.parse(rawPayload) as { iv?: string; data?: string };
    if (!payload.iv || !payload.data) return null;

    const key = await getRememberCryptoKey();
    if (!key) return null;

    const iv = base64ToBytes(payload.iv);
    const cipher = base64ToBytes(payload.data);
    const plainBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    const decoder = new TextDecoder();
    const data = JSON.parse(decoder.decode(plainBuffer)) as RememberedCredentials;

    if (!data.login || !data.password) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearRememberedCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REMEMBERED_CREDENTIALS_KEY);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
