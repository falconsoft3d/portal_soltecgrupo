'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiMe, PartnerInfo } from '@/lib/api';
import { getToken } from '@/lib/auth';

export default function DashboardPage() {
  const [partner, setPartner] = useState<PartnerInfo | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiMe(token).then((res) => {
      if (res.success && res.partner) setPartner(res.partner);
    });
  }, []);

  return (
    <div className="space-y-5">
      {/* Bienvenida */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Bienvenido{partner ? `, ${partner.name}` : ''}
        </h2>
        {partner && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Usuario
              </span>
              {partner.login}
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Correo
              </span>
              {partner.email || '—'}
            </div>
          </div>
        )}
      </div>

      {/* Acceso rápido */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-base font-semibold text-gray-700 mb-4">Acceso rápido</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/perfil"
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition group"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Mi Perfil</p>
              <p className="text-xs text-gray-400">Cambiar contraseña</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
