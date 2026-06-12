'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiMe, apiLogout, PartnerInfo } from '@/lib/api';
import { getToken, removeToken } from '@/lib/auth';
import Sidebar from './components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    apiMe(token)
      .then((res) => {
        if (res.success && res.partner) {
          setPartner(res.partner);
        } else {
          removeToken();
          router.replace('/login');
        }
      })
      .catch(() => {
        removeToken();
        router.replace('/login');
      })
      .finally(() => setChecking(false));
  }, [router]);

  async function handleLogout() {
    const token = getToken();
    if (token) await apiLogout(token);
    removeToken();
    router.replace('/login');
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500 text-sm">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Navbar fijo */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-brand-700 text-white shadow z-30">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition"
              aria-label="Alternar menú"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-bold text-lg tracking-wide">Portal Soltec</span>
          </div>
          <div className="flex items-center gap-4">
            {partner && (
              <span className="text-sm opacity-90 hidden sm:block">{partner.name}</span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} />

      {/* Contenido desplazado para no quedar bajo el sidebar ni el header */}
      <main className={`flex-1 pt-14 p-6 transition-all duration-300 ${sidebarOpen ? 'md:ml-56' : 'md:ml-0'}`}>{children}</main>
    </div>
  );
}
