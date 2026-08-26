'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken, setPartnerInfo, getToken } from '@/lib/auth';
import { PartnerInfo } from '@/lib/api';

type SsoResponse = {
  success: boolean;
  token?: string;
  partner?: PartnerInfo;
  error?: string;
};

export default function SsoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    // Si ya hay sesión activa, ir directo al dashboard
    if (getToken()) {
      router.replace('/dashboard');
      return;
    }

    const jwtToken = params.get('t');
    if (!jwtToken) {
      setError('Token SSO no encontrado en la URL.');
      return;
    }

    fetch('/api/auth/sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: jwtToken }),
    })
      .then((res) => res.json() as Promise<SsoResponse>)
      .then((data) => {
        if (data.success && data.token && data.partner) {
          setToken(data.token);
          setPartnerInfo(data.partner as unknown as Record<string, unknown>);
          router.replace('/dashboard');
        } else {
          setError(data.error ?? 'Autenticación SSO fallida.');
        }
      })
      .catch(() => setError('Error de red al procesar el acceso SSO.'));
  }, [router, params]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <a href="/login" className="text-brand-700 underline text-sm">
            Ir al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-500 text-sm">Iniciando sesión...</p>
    </div>
  );
}
