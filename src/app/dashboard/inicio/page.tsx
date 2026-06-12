'use client';

import { useRouter } from 'next/navigation';
import { getPartnerInfo } from '@/lib/auth';

export default function InicioPage() {
  const router = useRouter();
  const partner = getPartnerInfo() as { name?: string } | null;
  const name = partner?.name ?? 'Usuario';

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-lg w-full text-center">
        {/* Icono */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center">
          <svg className="w-10 h-10 text-brand-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        {/* Saludo */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Bienvenido, {name}!
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Has iniciado sesión en el Portal Soltec. Accede al panel de control para consultar el estado de tus obras, albaranes y resultados.
        </p>

        {/* Logo Soltec */}
        <div className="mb-8 text-xs text-gray-300 uppercase tracking-widest font-semibold">
          Portal Soltec
        </div>

        {/* Botón ir al Dashboard */}
        <button
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-3 rounded-xl shadow transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Ir al Dashboard
        </button>
      </div>
    </div>
  );
}
