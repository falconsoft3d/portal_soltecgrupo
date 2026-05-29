'use client';

import { useEffect, useState } from 'react';
import { apiMe, PartnerInfo } from '@/lib/api';
import { getToken } from '@/lib/auth';
import ChangePasswordForm from '../components/ChangePasswordForm';

export default function PerfilPage() {
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
      {/* Datos del perfil */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Mi Perfil</h2>
        {partner ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Nombre
              </span>
              {partner.name}
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Usuario
              </span>
              {partner.login}
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 sm:col-span-2">
              <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Correo electrónico
              </span>
              {partner.email || '—'}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Cargando...</p>
        )}
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Cambiar contraseña</h3>
        <p className="text-sm text-gray-500 mb-5">
          Ingresa tu contraseña actual y define una nueva.
        </p>
        <div className="max-w-md">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
