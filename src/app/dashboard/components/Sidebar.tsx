'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { getToken } from '@/lib/auth';

const NAV_ITEMS = [
  {
    href: '/dashboard/inicio',
    label: 'Inicio',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/dashboard/analisis-albaran',
    label: 'Analisis albaran',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M8 6h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/objetivos',
    label: 'Objetivos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/mano-de-obra',
    label: 'Mano de Obra',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.656-3.657M9 20H4v-2a4 4 0 015.656-3.657M15 11a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/presupuestos',
    label: 'Presupuestos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h16.5M3.75 12h16.5M8.25 18h12M3.75 18h.01M6 12V6" />
      </svg>
    ),
  },
  {
    href: '/dashboard/certificaciones',
    label: 'Certificaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/estados-pago',
    label: 'Estados de pago',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/estados-resultados',
    label: 'Estados de resultados',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V9m4 8V5M3 21h18" />
      </svg>
    ),
  },
  {
    href: '/dashboard/compras',
    label: 'Compras',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/proyectos',
    label: 'Proyectos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    href: '/dashboard/otros-gastos',
    label: 'Otros Gastos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/perfil',
    label: 'Perfil',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

// Menús sueltos arriba (en este orden); el resto va dentro del grupo "Producción".
const TOP_HREFS = ['/dashboard/inicio', '/dashboard/perfil'];
const TOP_ITEMS = TOP_HREFS.map((h) => NAV_ITEMS.find((i) => i.href === h)!);
const PRODUCTION_ITEMS = NAV_ITEMS.filter((i) => !TOP_HREFS.includes(i.href));

const ACCOUNTING_ITEMS = [
  {
    href: '/dashboard/analisis-financiero',
    label: 'Análisis económico-financiero',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v9l6.4 6.4" />
      </svg>
    ),
  },
  {
    href: '/dashboard/contabilidad-deuda',
    label: 'Contabilidad y deuda',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    ),
  },
  {
    href: '/dashboard/prevision-tesoreria',
    label: 'Previsión de tesorería',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l5-5 4 4 8-9M15 7h5v5" />
      </svg>
    ),
  },
  {
    href: '/dashboard/bancos',
    label: 'Bancos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18" />
      </svg>
    ),
  },
  {
    href: '/dashboard/apuntes',
    label: 'Apuntes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h7M17 15l2 2 3-4" />
      </svg>
    ),
  },
];

const PRODUCTION_ICON = (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
  </svg>
);

const ACCOUNTING_ICON = (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
  </svg>
);

type NavItem = { href: string; label: string; icon: React.ReactNode };

function NavGroup({ label, icon, items, pathname, children }: { label: string; icon: React.ReactNode; items: NavItem[]; pathname: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const groupActive = items.some((i) => isActive(pathname, i.href));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full
          ${groupActive && !open ? 'text-brand-700 bg-brand-50' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
      >
        {icon}
        <span className="flex-1">{label}</span>
        <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="flex flex-col gap-1">
          {items.map(({ href, label: l, icon: ic }) => (
            <NavLink key={href} href={href} label={l} icon={ic} active={isActive(pathname, href)} nested />
          ))}
          {children}
        </div>
      )}
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
}

function NavLink({ href, label, icon, active, nested = false }: { href: string; label: string; icon: React.ReactNode; active: boolean; nested?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 ${nested ? 'pl-6 pr-3 py-2' : 'px-3 py-2.5'} rounded-xl text-sm font-medium transition-colors
        ${active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function Sidebar({ open = true, showProduction = false, showAccounting = false }: {
  open?: boolean; showProduction?: boolean; showAccounting?: boolean;
}) {
  const pathname = usePathname();
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [altaLoading, setAltaLoading] = useState(false);

  async function handleSsoClick(
    apiPath: string,
    label: string,
    setLoading: (v: boolean) => void,
    openInNewTab = false,
  ) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) {
        if (openInNewTab) {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = data.url;
        }
      } else {
        console.error(`[${label} SSO] Error del servidor:`, data.error);
      }
    } catch (err) {
      console.error(`[${label} SSO] Error de red:`, err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className={`fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-56 flex flex-col bg-white border-r border-gray-200 shadow-sm z-20 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <nav className="flex flex-col p-3 gap-1 mt-2 overflow-y-auto">
        {TOP_ITEMS.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} active={isActive(pathname, href)} />
        ))}

        {/* Grupos desplegables según los checks del contacto */}
        {showProduction && (
          <NavGroup label="Producción" icon={PRODUCTION_ICON} items={PRODUCTION_ITEMS} pathname={pathname}>
            {/* Planner — redirige a app externa via SSO JWT */}
            <button
              onClick={() => handleSsoClick('/api/planner/sso', 'Planner', setPlannerLoading, true)}
              disabled={plannerLoading}
              className="flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 disabled:cursor-wait text-left w-full"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              {plannerLoading ? 'Abriendo...' : 'Planner'}
            </button>

            {/* Alta Odoo — redirige via SSO JWT con iss=soltec_portal, aud=soltec_alta */}
            <button
              onClick={() => handleSsoClick('/api/alta/sso', 'Alta', setAltaLoading)}
              disabled={altaLoading}
              className="flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 disabled:cursor-wait text-left w-full"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {altaLoading ? 'Abriendo...' : 'Alta Odoo'}
            </button>
          </NavGroup>
        )}
        {showAccounting && <NavGroup label="Contabilidad" icon={ACCOUNTING_ICON} items={ACCOUNTING_ITEMS} pathname={pathname} />}
      </nav>
    </aside>
  );
}
