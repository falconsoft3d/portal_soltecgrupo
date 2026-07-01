'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { utils, writeFileXLSX } from 'xlsx';
import {
  AttendanceItem,
  AttendanceSummaryItem,
  apiAttendances,
  apiInvoiced,
  apiMaterials,
  apiOtherExpenses,
  apiPickingAnalyses,
  apiPartnerAttendances,
  apiProjects,
  apiShipments,
  MaterialLineItem,
  OtherExpenseLineItem,
  PartnerAttendanceItem,
  PartnerAttendanceSummaryItem,
  PickingAnalysisItem,
  PortalProject,
  ShipmentItem,
  InvoicedInvoiceItem,
} from '@/lib/api';
import { getToken } from '@/lib/auth';

type Kpi = {
  title: string;
  value: string;
  subtitle: string;
  valueColor: string;
  tone: string;
};

type CostCenter = {
  name: string;
  amount: string;
  cte: string;
  fact: string;
  color: string;
};

const kpis: Kpi[] = [
  {
    title: 'FACTURADO',
    value: '€2.53M',
    subtitle: 'A origen',
    valueColor: 'text-sky-500',
    tone: 'bg-slate-100',
  },
  {
    title: 'COSTE TOTAL CC',
    value: '€1.81M',
    subtitle: 'Suma todos CC',
    valueColor: 'text-zinc-800',
    tone: 'bg-white',
  },
  {
    title: 'AAPP',
    value: '€0.0k',
    subtitle: 'Analisis albaran',
    valueColor: 'text-violet-700',
    tone: 'bg-violet-50',
  },
  {
    title: 'RESULTADO',
    value: '€722.2k',
    subtitle: 'Fact - Coste',
    valueColor: 'text-emerald-600',
    tone: 'bg-lime-100',
  },
  {
    title: 'MN %',
    value: '18.5%',
    subtitle: 'MB%− 10% ind. - umbral 10%',
    valueColor: 'text-teal-600',
    tone: 'bg-teal-100',
  },
];

const costCenters: CostCenter[] = [
  { name: 'MATERIALES', amount: '€865.0k', cte: '47.8%', fact: '34.2%', color: 'bg-sky-500' },
  { name: 'ASISTENCIAS', amount: '€473.0k', cte: '26.2%', fact: '18.7%', color: 'bg-emerald-500' },
  { name: 'ASIST. PARTNER', amount: '€305.0k', cte: '16.9%', fact: '12.1%', color: 'bg-rose-500' },
  { name: 'VIAJES', amount: '€43.0k', cte: '2.4%', fact: '1.7%', color: 'bg-amber-500' },
  { name: 'OTROS GASTOS', amount: '€121.8k', cte: '6.7%', fact: '4.8%', color: 'bg-zinc-400' },
];

const projectBarsFallback = [
  { name: 'Nuevo H. Belen', values: [180, 120, 80] },
  { name: 'Nuevo AZ Inver', values: [90, 65, 38] },
  { name: 'Comercial HCCCM', values: [260, 210, 115] },
  { name: 'Hotel Los Vientos', values: [130, 100, 70] },
  { name: 'Centro Sol Arraya', values: [50, 35, 22] },
  { name: 'IES San Miguel Ac...', values: [75, 60, 35] },
  { name: 'Anillo Sol Vientos', values: [18, 12, 6] },
];

const detailRows = [
  { name: 'Materiales', records: '16 líneas', amount: '€865.0k', color: 'text-sky-500', icon: '📦' },
  { name: 'Asistencias', records: '11 fichajes', amount: '€473.0k', color: 'text-emerald-500', icon: '👷' },
  { name: 'Asist. partner', records: '9 registros', amount: '€305.0k', color: 'text-rose-500', icon: '🤝' },
  { name: 'Viajes', records: '13 desplazamientos', amount: '€43.0k', color: 'text-amber-500', icon: '🚗' },
  { name: 'Otros gastos', records: '11 registros', amount: '€121.8k', color: 'text-zinc-500', icon: '📎' },
];

const monthOptions = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const projectOptionsFallback = [
  'Naves Merlin Betera - Clasica Urbana',
  'Comercial HCCCM - Rehabilitacion',
  'Hotel Los Vientos - Reforma',
  'Centro Sol Arraya - Obra nueva',
];

type AttendanceData = {
  rows: AttendanceItem[];
  summary: AttendanceSummaryItem[];
  totalRecords: number;
  totalHours: number;
  totalAmount: number;
};

type PartnerAttendanceData = {
  rows: PartnerAttendanceItem[];
  summary: PartnerAttendanceSummaryItem[];
  totalRecords: number;
  totalHours: number;
  totalAmount: number;
};

type ShipmentData = {
  rows: ShipmentItem[];
  totalRecords: number;
  totalAmount: number;
};

type OtherExpenseData = {
  rows: OtherExpenseLineItem[];
  totalRecords: number;
  totalAmount: number;
};

type MaterialData = {
  rows: MaterialLineItem[];
  totalRecords: number;
  totalAmount: number;
};

type InvoicedData = {
  rows: InvoicedInvoiceItem[];
  totalRecords: number;
  totalAmount: number;
};

type AappData = {
  rows: PickingAnalysisItem[];
  totalRecords: number;
  totalAmount: number;
  prevMonthTotal: number;
};

/** Formatea un número en formato español: punto de miles y coma decimal */
function esNum(value: number, decimals = 2): string {
  const sign = value < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(value).toFixed(decimals).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${sign}${intFormatted},${decPart}` : `${sign}${intFormatted}`;
}

function formatK(value: number): string {
  return `€${esNum(value / 1000, 1)}k`;
}

function formatCompactAmount(value: number): string {
  if (Math.abs(value) >= 1000) return formatK(value);
  return `€${esNum(value)}`;
}

function formatCurrency(value: number): string {
  return `${esNum(value)} €`;
}

function formatAxisAmount(value: number): string {
  if (Math.abs(value) >= 1000) return `${esNum(value / 1000, 1)}k`;
  return `${Math.round(value)}`;
}

function formatHours(value: number): string {
  return `${value.toFixed(0)} h`;
}

function formatFloatTime(value: number): string {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDateTime(value: string | false): string {
  if (!value) return '—';
  // Odoo devuelve UTC sin 'Z'; añadimos 'Z' para que JS lo interprete como UTC
  // y lo convierta a la hora local del navegador (p. ej. UTC+2 → +2 h)
  const normalized = value.replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatDate(value: string | false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

function extractProjectCode(nameRaw: string): string {
  const name = (nameRaw || '').trim();
  const bracketMatch = name.match(/\[([^\]]+)\]/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim();
  }
  const dashParts = name.split(' - ');
  if (dashParts[0]) {
    return dashParts[0].trim();
  }
  return name || 'S/N';
}

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();

  // ── Inicialización desde localStorage ───────────────────────────────
  const [filterMode, setFilterMode] = useState<'origin' | 'month'>(() => {
    if (typeof window === 'undefined') return 'origin';
    return (localStorage.getItem('dash_filterMode') as 'origin' | 'month') ?? 'origin';
  });
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 6;
    const v = localStorage.getItem('dash_monthIndex');
    return v !== null ? Number(v) : new Date().getMonth() + 1;
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (typeof window === 'undefined') return currentYear;
    const v = localStorage.getItem('dash_year');
    return v !== null ? Number(v) : currentYear;
  });
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>(() => {
    if (typeof window === 'undefined') return 'all';
    const v = localStorage.getItem('dash_projectId');
    if (!v || v === 'all') return 'all';
    return Number(v);
  });
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const v = localStorage.getItem('dash_companyIds');
      return v ? (JSON.parse(v) as number[]) : [];
    } catch { return []; }
  });
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

  // ── Persistencia en localStorage ────────────────────────────────────
  useEffect(() => { localStorage.setItem('dash_filterMode', filterMode); }, [filterMode]);
  useEffect(() => { localStorage.setItem('dash_monthIndex', String(selectedMonthIndex)); }, [selectedMonthIndex]);
  useEffect(() => { localStorage.setItem('dash_year', String(selectedYear)); }, [selectedYear]);
  useEffect(() => { localStorage.setItem('dash_projectId', String(selectedProjectId)); }, [selectedProjectId]);
  useEffect(() => { localStorage.setItem('dash_companyIds', JSON.stringify(selectedCompanyIds)); }, [selectedCompanyIds]);
  const [materialsExpanded, setMaterialsExpanded] = useState(false);
  const [selectedMaterialCategory, setSelectedMaterialCategory] = useState('Todas');
  const [materialsViewMode, setMaterialsViewMode] = useState<'individual' | 'grouped'>('individual');
  const [expandedMaterialGroups, setExpandedMaterialGroups] = useState<string[]>([]);
  const [attendanceExpanded, setAttendanceExpanded] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceData>({
    rows: [],
    summary: [],
    totalRecords: 0,
    totalHours: 0,
    totalAmount: 0,
  });
  const [partnerAttendanceExpanded, setPartnerAttendanceExpanded] = useState(false);
  const [partnerAttendanceData, setPartnerAttendanceData] = useState<PartnerAttendanceData>({
    rows: [],
    summary: [],
    totalRecords: 0,
    totalHours: 0,
    totalAmount: 0,
  });
  const [shipmentExpanded, setShipmentExpanded] = useState(false);
  const [shipmentData, setShipmentData] = useState<ShipmentData>({ rows: [], totalRecords: 0, totalAmount: 0 });
  const [otherExpenseExpanded, setOtherExpenseExpanded] = useState(false);
  const [otherExpenseData, setOtherExpenseData] = useState<OtherExpenseData>({ rows: [], totalRecords: 0, totalAmount: 0 });
  const [materialData, setMaterialData] = useState<MaterialData>({ rows: [], totalRecords: 0, totalAmount: 0 });
  const [invoicedExpanded, setInvoicedExpanded] = useState(false);
  const [invoicedData, setInvoicedData] = useState<InvoicedData>({ rows: [], totalRecords: 0, totalAmount: 0 });
  const [aappExpanded, setAappExpanded] = useState(false);
  const [aappData, setAappData] = useState<AappData>({ rows: [], totalRecords: 0, totalAmount: 0, prevMonthTotal: 0 });
  const [isRefreshingIndicators, setIsRefreshingIndicators] = useState(true);
  const [isExportingCenters, setIsExportingCenters] = useState(false);
  const refreshRequestRef = useRef(0);

  const selectedMonth = useMemo(() => monthOptions[selectedMonthIndex], [selectedMonthIndex]);
  const selectedMonthNumber = useMemo(() => selectedMonthIndex + 1, [selectedMonthIndex]);
  const requestMonth = useMemo(() => selectedMonthNumber, [selectedMonthNumber]);
  const yearOptions = useMemo(
    () => [currentYear - 2, currentYear - 1, currentYear, currentYear + 1],
    [currentYear],
  );

  // ── Compañías disponibles y proyectos filtrados ───────────────────────
  const companies = useMemo(() => {
    const seen = new Map<number, string>();
    projects.forEach((p) => {
      if (p.company_id && !seen.has(p.company_id)) {
        seen.set(p.company_id, p.company_name || `Compañía ${p.company_id}`);
      }
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const companyFilteredProjects = useMemo(() => {
    if (selectedCompanyIds.length === 0) return projects;
    return projects.filter((p) => p.company_id && selectedCompanyIds.includes(p.company_id));
  }, [projects, selectedCompanyIds]);

  // Si el proyecto seleccionado ya no está en los proyectos filtrados, resetear a 'all'
  useEffect(() => {
    if (projects.length === 0) return; // proyectos aún cargando
    if (selectedProjectId !== 'all' && !companyFilteredProjects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId('all');
    }
  }, [projects.length, companyFilteredProjects, selectedProjectId]);

  const activeCompanyIds = useMemo(
    () => (selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined),
    [selectedCompanyIds],
  );
  const totalCostAmount = useMemo(
    () =>
      materialData.totalAmount +
      attendanceData.totalAmount +
      partnerAttendanceData.totalAmount +
      shipmentData.totalAmount +
      otherExpenseData.totalAmount,
    [
      materialData.totalAmount,
      attendanceData.totalAmount,
      partnerAttendanceData.totalAmount,
      shipmentData.totalAmount,
      otherExpenseData.totalAmount,
    ],
  );

  const aappDisplayAmount = useMemo(
    () => filterMode === 'month' ? aappData.totalAmount - aappData.prevMonthTotal : aappData.totalAmount,
    [filterMode, aappData.totalAmount, aappData.prevMonthTotal],
  );

  const resultAmount = useMemo(
    () => invoicedData.totalAmount - totalCostAmount + aappDisplayAmount,
    [invoicedData.totalAmount, totalCostAmount, aappDisplayAmount],
  );

  const marginPercent = useMemo(() => {
    if (!invoicedData.totalAmount) return 0;
    return (resultAmount / invoicedData.totalAmount) * 100 - 10;
  }, [invoicedData.totalAmount, resultAmount]);

  const kpisView = useMemo(
    () =>
      kpis.map((kpi) =>
        kpi.title === 'FACTURADO'
          ? {
              ...kpi,
              value: formatCompactAmount(invoicedData.totalAmount),
              subtitle: filterMode === 'origin' ? 'A origen' : 'Mes/año seleccionado',
            }
          : kpi.title === 'COSTE TOTAL CC'
            ? {
                ...kpi,
                value: formatCompactAmount(totalCostAmount),
                subtitle: 'Suma 5 centros de coste',
              }
          : kpi.title === 'AAPP'
            ? {
                ...kpi,
                value: formatCompactAmount(aappDisplayAmount),
                subtitle: filterMode === 'month' ? 'Mes − mes anterior' : 'Acumulado mes',
              }
          : kpi.title === 'RESULTADO'
            ? {
                ...kpi,
                value: formatCompactAmount(resultAmount),
                subtitle: 'Fact - Coste',
                valueColor: resultAmount >= 0 ? 'text-emerald-600' : 'text-rose-600',
              }
          : kpi.title === 'MN %'
            ? {
                ...kpi,
                value: `${marginPercent.toFixed(1)}%`,
                subtitle: 'Margen sobre facturado',
                valueColor: marginPercent >= 0 ? 'text-teal-600' : 'text-rose-600',
              }
          : kpi,
      ),
    [filterMode, invoicedData.totalAmount, totalCostAmount, aappData.totalAmount, aappDisplayAmount, resultAmount, marginPercent],
  );

  const costCentersView = useMemo(
    () =>
      costCenters.map((center) =>
        center.name === 'MATERIALES'
          ? {
              ...center,
              amount: formatCompactAmount(materialData.totalAmount),
            }
          : center.name === 'ASISTENCIAS'
          ? {
              ...center,
              amount: formatCompactAmount(attendanceData.totalAmount),
            }
          : center.name === 'ASIST. PARTNER'
            ? {
                ...center,
                amount: formatCompactAmount(partnerAttendanceData.totalAmount),
              }
          : center.name === 'VIAJES'
            ? {
                ...center,
                amount: formatCompactAmount(shipmentData.totalAmount),
              }
          : center.name === 'OTROS GASTOS'
            ? {
                ...center,
                amount: formatCompactAmount(otherExpenseData.totalAmount),
              }
          : center,
      ),
    [
      attendanceData.totalAmount,
      partnerAttendanceData.totalAmount,
      shipmentData.totalAmount,
      otherExpenseData.totalAmount,
      materialData.totalAmount,
    ],
  );

  const donutData = useMemo(
    () => [
      { label: 'Materiales', value: materialData.totalAmount, color: '#38bdf8' },
      { label: 'Asistencias', value: attendanceData.totalAmount, color: '#10b981' },
      { label: 'Asist. partner', value: partnerAttendanceData.totalAmount, color: '#f43f5e' },
      { label: 'Viajes', value: shipmentData.totalAmount, color: '#f59e0b' },
      { label: 'Otros gastos', value: otherExpenseData.totalAmount, color: '#9ca3af' },
    ],
    [
      materialData.totalAmount,
      attendanceData.totalAmount,
      partnerAttendanceData.totalAmount,
      shipmentData.totalAmount,
      otherExpenseData.totalAmount,
    ],
  );

  const projectBars = useMemo(() => {
    const buckets = new Map<string, { name: string; material: number; attendance: number; partner: number; shipment: number; other: number }>();

    const addBucket = (nameRaw: string, key: 'material' | 'attendance' | 'partner' | 'shipment' | 'other', amount: number) => {
      const name = nameRaw || 'Sin proyecto';
      const current = buckets.get(name) || { name, material: 0, attendance: 0, partner: 0, shipment: 0, other: 0 };
      current[key] += amount;
      buckets.set(name, current);
    };

    materialData.rows.forEach((row) => addBucket(row.project_name, 'material', row.subtotal));
    attendanceData.rows.forEach((row) => addBucket(row.project_name, 'attendance', row.total));
    partnerAttendanceData.rows.forEach((row) => addBucket(row.project_name, 'partner', row.total));
    shipmentData.rows.forEach((row) => addBucket(row.destination_project || row.origin_project, 'shipment', row.total));
    otherExpenseData.rows.forEach((row) => addBucket(row.project_name, 'other', row.total));

    const dynamicBars = Array.from(buckets.values())
      .map((item) => ({ ...item, total: item.material + item.attendance + item.partner + item.shipment + item.other }))
      .sort((a, b) => b.total - a.total);

    if (dynamicBars.length > 0) return dynamicBars;

    return projectBarsFallback.map((item) => ({
      name: item.name,
      material: 0,
      attendance: item.values[0],
      partner: item.values[1],
      shipment: item.values[2],
      other: 0,
      total: item.values[0] + item.values[1] + item.values[2],
    }));
  }, [materialData.rows, attendanceData.rows, partnerAttendanceData.rows, shipmentData.rows, otherExpenseData.rows]);

  const maxProjectTotal = useMemo(() => {
    if (projectBars.length === 0) return 1;
    return Math.max(...projectBars.map((item) => item.total), 1);
  }, [projectBars]);

  const materialCategories = useMemo(() => {
    const summary = new Map<string, { category: string; total: number; count: number }>();
    materialData.rows.forEach((line) => {
      const category = line.category_name || 'Sin categoría';
      const current = summary.get(category) || { category, total: 0, count: 0 };
      current.total += line.subtotal;
      current.count += 1;
      summary.set(category, current);
    });
    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }, [materialData.rows]);

  const materialRowsView = useMemo(() => {
    if (selectedMaterialCategory === 'Todas') return materialData.rows;
    return materialData.rows.filter((line) => (line.category_name || 'Sin categoría') === selectedMaterialCategory);
  }, [materialData.rows, selectedMaterialCategory]);

  const materialTotalView = useMemo(() => {
    if (selectedMaterialCategory === 'Todas') return materialData.totalAmount;
    return materialRowsView.reduce((sum, line) => sum + line.subtotal, 0);
  }, [selectedMaterialCategory, materialData.totalAmount, materialRowsView]);

  const materialCountView = useMemo(() => {
    if (selectedMaterialCategory === 'Todas') return materialData.totalRecords;
    return materialRowsView.length;
  }, [selectedMaterialCategory, materialData.totalRecords, materialRowsView]);

  const groupedMaterialRows = useMemo(() => {
    const grouped = new Map<string, {
      key: string;
      category: string;
      product: string;
      qty: number;
      subtotal: number;
      lines: MaterialLineItem[];
    }>();

    materialRowsView.forEach((line) => {
      const category = line.category_name || 'Sin categoría';
      const product = line.product_name || 'Sin producto';
      const key = `${category}||${product}`;
      const current = grouped.get(key) || {
        key,
        category,
        product,
        qty: 0,
        subtotal: 0,
        lines: [],
      };
      current.qty += line.qty || 0;
      current.subtotal += line.subtotal || 0;
      current.lines.push(line);
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => b.subtotal - a.subtotal);
  }, [materialRowsView]);

  const groupedMaterialCountView = useMemo(() => groupedMaterialRows.length, [groupedMaterialRows]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    apiProjects(token).then((res) => {
      if (!res.success || !res.projects?.length) return;
      setProjects(res.projects);
    });
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const requestId = refreshRequestRef.current + 1;
    refreshRequestRef.current = requestId;

    Promise.all([
      apiInvoiced(token, selectedProjectId, requestMonth, filterMode, undefined, selectedYear, activeCompanyIds),
      apiMaterials(token, selectedProjectId, requestMonth, filterMode, undefined, selectedYear, activeCompanyIds),
      apiAttendances(token, selectedProjectId, requestMonth, filterMode, undefined, selectedYear, activeCompanyIds),
      apiPartnerAttendances(token, selectedProjectId, requestMonth, filterMode, undefined, selectedYear, activeCompanyIds),
      apiShipments(token, selectedProjectId, requestMonth, filterMode, undefined, selectedYear, activeCompanyIds),
      apiOtherExpenses(token, selectedProjectId, requestMonth, filterMode, undefined, selectedYear, activeCompanyIds),
    ])
      .then(([invoicedRes, materialsRes, attendanceRes, partnerAttendanceRes, shipmentsRes, otherExpensesRes]) => {
        if (refreshRequestRef.current !== requestId) return;

        setInvoicedData({
          rows: invoicedRes.success ? invoicedRes.invoices ?? [] : [],
          totalRecords: invoicedRes.success ? invoicedRes.total_records ?? 0 : 0,
          totalAmount: invoicedRes.success ? invoicedRes.total_amount ?? 0 : 0,
        });

        setMaterialData({
          rows: materialsRes.success ? materialsRes.lines ?? [] : [],
          totalRecords: materialsRes.success ? materialsRes.total_records ?? 0 : 0,
          totalAmount: materialsRes.success ? materialsRes.total_amount ?? 0 : 0,
        });

        setAttendanceData({
          rows: attendanceRes.success ? attendanceRes.attendances ?? [] : [],
          summary: attendanceRes.success ? attendanceRes.employee_summary ?? [] : [],
          totalRecords: attendanceRes.success ? attendanceRes.total_records ?? 0 : 0,
          totalHours: attendanceRes.success ? attendanceRes.total_hours ?? 0 : 0,
          totalAmount: attendanceRes.success ? attendanceRes.total_amount ?? 0 : 0,
        });

        setPartnerAttendanceData({
          rows: partnerAttendanceRes.success ? partnerAttendanceRes.partner_attendances ?? [] : [],
          summary: partnerAttendanceRes.success ? partnerAttendanceRes.partner_summary ?? [] : [],
          totalRecords: partnerAttendanceRes.success ? partnerAttendanceRes.total_records ?? 0 : 0,
          totalHours: partnerAttendanceRes.success ? partnerAttendanceRes.total_hours ?? 0 : 0,
          totalAmount: partnerAttendanceRes.success ? partnerAttendanceRes.total_amount ?? 0 : 0,
        });

        setShipmentData({
          rows: shipmentsRes.success ? shipmentsRes.shipments ?? [] : [],
          totalRecords: shipmentsRes.success ? shipmentsRes.total_records ?? 0 : 0,
          totalAmount: shipmentsRes.success ? shipmentsRes.total_amount ?? 0 : 0,
        });

        setOtherExpenseData({
          rows: otherExpensesRes.success ? otherExpensesRes.lines ?? [] : [],
          totalRecords: otherExpensesRes.success ? otherExpensesRes.total_records ?? 0 : 0,
          totalAmount: otherExpensesRes.success ? otherExpensesRes.total_amount ?? 0 : 0,
        });
      })
      .catch(() => {
        if (refreshRequestRef.current !== requestId) return;
        setInvoicedData({ rows: [], totalRecords: 0, totalAmount: 0 });
        setMaterialData({ rows: [], totalRecords: 0, totalAmount: 0 });
        setAttendanceData({ rows: [], summary: [], totalRecords: 0, totalHours: 0, totalAmount: 0 });
        setPartnerAttendanceData({ rows: [], summary: [], totalRecords: 0, totalHours: 0, totalAmount: 0 });
        setShipmentData({ rows: [], totalRecords: 0, totalAmount: 0 });
        setOtherExpenseData({ rows: [], totalRecords: 0, totalAmount: 0 });
      })
      .finally(() => {
        if (refreshRequestRef.current !== requestId) return;
        setIsRefreshingIndicators(false);
      });
  }, [selectedProjectId, requestMonth, filterMode, selectedYear, activeCompanyIds]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    apiPickingAnalyses(token, selectedProjectId, requestMonth, 'month', undefined, selectedYear, activeCompanyIds)
      .then((res) => {
        setAappData({
          rows: res.success ? res.analyses ?? [] : [],
          totalRecords: res.success ? res.total_records ?? 0 : 0,
          totalAmount: res.success ? res.total_amount ?? 0 : 0,
          prevMonthTotal: res.success ? res.prev_month_total ?? 0 : 0,
        });
      })
      .catch(() => {
        setAappData({ rows: [], totalRecords: 0, totalAmount: 0, prevMonthTotal: 0 });
      });
  }, [selectedProjectId, requestMonth, selectedYear, activeCompanyIds]);

  async function handleExportCostCentersXlsx() {
    const hasData =
      materialData.rows.length > 0 ||
      attendanceData.rows.length > 0 ||
      partnerAttendanceData.rows.length > 0 ||
      shipmentData.rows.length > 0 ||
      otherExpenseData.rows.length > 0;

    if (!hasData) return;

    setIsExportingCenters(true);
    try {
      const workbook = utils.book_new();

      const materialsRows = materialData.rows.map((line) => ({
        ID: line.id,
        Categoria: line.category_name || 'Sin categoría',
        Fecha: formatDateTime(line.date),
        Albaran: line.picking_name || '—',
        Referencia: line.reference || '—',
        Proyecto: line.project_name || '—',
        Producto: line.product_name || '—',
        Descripcion: line.description || '—',
        Cantidad: line.qty,
        Unidad: line.uom_name || '',
        Coste: line.unit_price,
        Subtotal: line.subtotal,
      }));

      const attendancesRows = attendanceData.rows.map((row) => ({
        ID: row.id,
        Empleado: row.employee_name || '—',
        Proyecto: row.project_name || '—',
        Entrada: formatDateTime(row.check_in),
        Salida: formatDateTime(row.check_out),
        Horas: row.hours,
        'EUR por hora': row.hour_cost,
        Total: row.total,
      }));

      const partnerAttendancesRows = partnerAttendanceData.rows.map((row) => ({
        ID: row.id,
        Partner: row.partner_name || '—',
        Proyecto: row.project_name || '—',
        Entrada: formatDateTime(row.check_in),
        Salida: formatDateTime(row.check_out),
        Horas: row.hours,
        'EUR por hora': row.hour_cost,
        Total: row.total,
      }));

      const shipmentsRows = shipmentData.rows.map((row) => ({
        ID: row.id,
        Codigo: row.name || `SHIP-${row.id}`,
        Fecha: formatDateTime(row.date),
        Origen: row.origin_project || '—',
        Destino: row.destination_project || '—',
        Total: row.total,
      }));

      const otherExpensesRows = otherExpenseData.rows.map((row) => ({
        ID: row.id,
        Gasto: row.expense_name || `OE-${row.expense_id}`,
        Fecha: formatDate(row.date),
        Proyecto: row.project_name || '—',
        Total: row.total,
      }));

      const summaryRows = [
        { Centro: 'Materiales', Registros: materialData.totalRecords, Importe: materialData.totalAmount },
        { Centro: 'Asistencias', Registros: attendanceData.totalRecords, Importe: attendanceData.totalAmount },
        { Centro: 'Asist. partner', Registros: partnerAttendanceData.totalRecords, Importe: partnerAttendanceData.totalAmount },
        { Centro: 'Viajes', Registros: shipmentData.totalRecords, Importe: shipmentData.totalAmount },
        { Centro: 'Otros gastos', Registros: otherExpenseData.totalRecords, Importe: otherExpenseData.totalAmount },
      ];

      utils.book_append_sheet(workbook, utils.json_to_sheet(summaryRows), 'Resumen');
      utils.book_append_sheet(workbook, utils.json_to_sheet(materialsRows), 'Materiales');
      utils.book_append_sheet(workbook, utils.json_to_sheet(attendancesRows), 'Asistencias');
      utils.book_append_sheet(workbook, utils.json_to_sheet(partnerAttendancesRows), 'Asist_partner');
      utils.book_append_sheet(workbook, utils.json_to_sheet(shipmentsRows), 'Viajes');
      utils.book_append_sheet(workbook, utils.json_to_sheet(otherExpensesRows), 'Otros_gastos');

      const projectName =
        selectedProjectId === 'all'
          ? 'todas-obras'
          : projects.find((project) => project.id === selectedProjectId)?.code || String(selectedProjectId);
      const periodLabel = filterMode === 'origin' ? `origen-m${selectedMonthNumber}` : `mes-${selectedMonthNumber}-${selectedYear}`;
      const filename = `centros-coste_${projectName}_${periodLabel}.xlsx`;

      writeFileXLSX(workbook, filename);
    } finally {
      setIsExportingCenters(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1360px] space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 text-slate-900 shadow-lg shadow-slate-200/70 md:p-5">
      <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-lg font-bold text-blue-700">
            <span className="inline-flex h-4 w-4 rounded-sm bg-slate-900" />
            <span>ObraControl</span>
          </div>

          {/* ── Selector de compañía ─────────────────────────────── */}
          {companies.length > 1 && (
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setCompanyDropdownOpen((open) => !open)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  selectedCompanyIds.length > 0
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                <span className="truncate">
                  {selectedCompanyIds.length === 0
                    ? 'Todas las compañías'
                    : selectedCompanyIds.length === 1
                      ? (companies.find((c) => c.id === selectedCompanyIds[0])?.name ?? 'Compañía')
                      : `${selectedCompanyIds.length} compañías`}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{companyDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {companyDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg">
                  <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Filtrar por compañía</span>
                    {selectedCompanyIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCompanyIds([]);
                          setIsRefreshingIndicators(true);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <ul className="max-h-60 overflow-y-auto py-1">
                    {companies.map((company) => {
                      const checked = selectedCompanyIds.includes(company.id);
                      return (
                        <li key={company.id}>
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setIsRefreshingIndicators(true);
                                setSelectedCompanyIds((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== company.id)
                                    : [...prev, company.id],
                                );
                              }}
                              className="h-4 w-4 rounded accent-blue-600"
                            />
                            <span className="truncate">{company.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {/* Overlay para cerrar al hacer click fuera */}
              {companyDropdownOpen && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setCompanyDropdownOpen(false)}
                />
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-bold text-slate-700">
              <span className="sr-only">Mes</span>
              <select
                translate="no"
                value={selectedMonthIndex}
                onChange={(event) => {
                  setIsRefreshingIndicators(true);
                  setSelectedMonthIndex(Number(event.target.value));
                }}
                className="bg-transparent px-2 py-1 outline-none"
              >
                {monthOptions.map((label, index) => (
                  <option translate="no" key={index} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-bold text-slate-700">
              <span className="sr-only">Año</span>
              <select
                value={selectedYear}
                onChange={(event) => {
                setIsRefreshingIndicators(true);
                setSelectedYear(Number(event.target.value));
              }}
                className="bg-transparent px-2 py-1 outline-none"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="sr-only">Obra</span>
            <select
              value={String(selectedProjectId)}
              onChange={(event) => {
                const value = event.target.value;
                setIsRefreshingIndicators(true);
                setSelectedProjectId(value === 'all' ? 'all' : Number(value));
              }}
              disabled={isRefreshingIndicators}
              className="w-full bg-transparent font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="all">Todas las obras</option>
              {(companyFilteredProjects.length ? companyFilteredProjects : []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.is_manager ? '👑 ' : ''}{project.display_name}{project.state_name ? ` (${project.state_name})` : ''}
                </option>
              ))}
              {companyFilteredProjects.length === 0 && (
                projectOptionsFallback.map((project) => (
                  <option key={project} value="">
                    {project}
                  </option>
                ))
              )}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setIsRefreshingIndicators(true);
              setFilterMode('origin');
              setSelectedMaterialCategory('Todas');
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-bold ${
              filterMode === 'origin'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            A origen
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRefreshingIndicators(true);
              setFilterMode('month');
              setSelectedMaterialCategory('Todas');
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-bold ${
              filterMode === 'month'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            Mes
          </button>
        </div>

      </article>

      <div className="relative">
        {isRefreshingIndicators && (
          <div className="absolute inset-0 z-30 flex items-start justify-center rounded-xl bg-white/70 pt-8 backdrop-blur-[1px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              Actualizando indicadores...
            </div>
          </div>
        )}

        <div className={`space-y-4 ${isRefreshingIndicators ? 'pointer-events-none' : ''}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpisView.map((kpi) =>
              kpi.title === 'FACTURADO' ? (
                <article key={kpi.title} className={`rounded-xl border border-slate-200 p-0 shadow-sm ${kpi.tone}`}>
                  <button
                    type="button"
                    onClick={() => setInvoicedExpanded((current) => !current)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="text-xs font-bold tracking-wide text-slate-500">{kpi.title}</p>
                      <p translate="no" className={`mt-1 text-3xl font-extrabold tracking-tight ${kpi.valueColor}`}>{kpi.value}</p>
                      <p className="text-sm font-medium text-slate-500">{kpi.subtitle}</p>
                    </div>
                    <span className="text-lg text-slate-400">{invoicedExpanded ? '⌄' : '›'}</span>
                  </button>
                </article>
              ) : kpi.title === 'AAPP' ? (
                <article key={kpi.title} className={`rounded-xl border border-slate-200 p-0 shadow-sm ${kpi.tone}`}>
                  <button
                    type="button"
                    onClick={() => setAappExpanded((current) => !current)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="text-xs font-bold tracking-wide text-slate-500">{kpi.title}</p>
                      <p translate="no" className={`mt-1 text-3xl font-extrabold tracking-tight ${kpi.valueColor}`}>{kpi.value}</p>
                      <p className="text-sm font-medium text-slate-500">{kpi.subtitle}</p>
                    </div>
                    <span className="text-lg text-slate-400">{aappExpanded ? '⌄' : '›'}</span>
                  </button>
                </article>
              ) : (
                <article key={kpi.title} className={`rounded-xl border border-slate-200 p-4 shadow-sm ${kpi.tone}`}>
                  <p className="text-xs font-bold tracking-wide text-slate-500">{kpi.title}</p>
                  <p translate="no" className={`mt-1 text-3xl font-extrabold tracking-tight ${kpi.valueColor}`}>{kpi.value}</p>
                  <p className="text-sm font-medium text-slate-500">{kpi.subtitle}</p>
                </article>
              ),
            )}
          </div>

          {invoicedExpanded && (
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Facturas de venta</h3>
                <p className="text-xs font-semibold text-slate-500">
                  {invoicedData.totalRecords} registros · {formatCurrency(invoicedData.totalAmount)}
                </p>
              </div>

              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Factura</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Proyecto</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Base imp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicedData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500">
                          No hay facturas para el filtro actual.
                        </td>
                      </tr>
                    ) : (
                      invoicedData.rows.map((invoice) => (
                        <tr key={invoice.id} className="border-t border-slate-100 text-slate-700">
                          <td className="px-3 py-2 font-semibold text-slate-700">{invoice.name || `INV-${invoice.id}`}</td>
                          <td className="px-3 py-2">{formatDate(invoice.date)}</td>
                          <td className="px-3 py-2">{invoice.customer_name || '—'}</td>
                          <td className="px-3 py-2">{invoice.project_name || '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatCurrency(invoice.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {aappExpanded && (
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Analisis de albaran (AAPP)</h3>
                <p className="text-xs font-semibold text-slate-500">
                  {aappData.totalRecords} registros · {formatCurrency(aappData.totalAmount)}
                </p>
              </div>

              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Proyecto</th>
                      <th className="px-3 py-2">Fecha fin</th>
                      <th className="px-3 py-2">Creado</th>
                      <th className="px-3 py-2">Fecha creación</th>
                      <th className="px-3 py-2">Nota</th>
                      <th className="px-3 py-2 text-right">Cant. Activo</th>
                      <th className="px-3 py-2 text-right">Costo unit.</th>
                      <th className="px-3 py-2 text-right">Total parcial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aappData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-4 text-center text-sm text-slate-500">
                          No hay análisis para el filtro actual.
                        </td>
                      </tr>
                    ) : (
                      aappData.rows.map((analysis) =>
                        (analysis.lines ?? []).length > 0 ? (
                          (analysis.lines ?? []).map((line, idx) => (
                            <tr key={`${analysis.id}-${idx}`} className="border-t border-slate-100 text-slate-700">
                              {idx === 0 ? (
                                <>
                                  <td className="px-3 py-2 font-semibold" rowSpan={(analysis.lines ?? []).length}>{analysis.name}</td>
                                  <td className="px-3 py-2" rowSpan={(analysis.lines ?? []).length}>{analysis.project_name || '—'}</td>
                                  <td className="px-3 py-2" rowSpan={(analysis.lines ?? []).length}>{formatDate(analysis.end_date)}</td>
                                  <td className="px-3 py-2" rowSpan={(analysis.lines ?? []).length}>{analysis.created_by || '—'}</td>
                                  <td className="px-3 py-2" rowSpan={(analysis.lines ?? []).length}>{formatDateTime(analysis.create_date)}</td>
                                </>
                              ) : null}
                              <td className="px-3 py-2">{line.note || '—'}</td>
                              <td className="px-3 py-2 text-right">{line.assets_qty}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(line.product_cost)}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(line.subtotal)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr key={analysis.id} className="border-t border-slate-100 text-slate-700">
                            <td className="px-3 py-2 font-semibold">{analysis.name}</td>
                            <td className="px-3 py-2">{analysis.project_name || '—'}</td>
                            <td className="px-3 py-2">{formatDate(analysis.end_date)}</td>
                            <td className="px-3 py-2">{analysis.created_by || '—'}</td>
                            <td className="px-3 py-2">{formatDateTime(analysis.create_date)}</td>
                            <td className="px-3 py-2">—</td>
                            <td className="px-3 py-2 text-right">—</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">—</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(analysis.subtotal)}</td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Centros de coste - {filterMode === 'origin' ? 'a origen' : 'mes seleccionado'} - clic para ver registros
              </p>
              <button
                type="button"
                onClick={handleExportCostCentersXlsx}
                disabled={isExportingCenters}
                className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                title="Exportar todas las líneas individuales de cada centro de coste"
              >
                <span>Exportar XLSX</span>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
              {costCentersView.map((center) => (
                <article key={center.name} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                  <p translate="no" className="text-xs font-bold text-slate-600">{center.name}</p>
                  <p translate="no" className={`mt-0.5 text-3xl font-extrabold ${center.color.replace('bg-', 'text-')}`}>{center.amount}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{center.cte} cte • {center.fact} fact.</p>
                  <div className="mt-1.5 h-0.5 overflow-hidden rounded bg-slate-200">
                    <div className={`h-full ${center.color}`} style={{ width: center.cte }} />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Distribución CC</h3>
              <div className="mt-4 flex justify-center pb-2">
                <div className="relative h-52 w-52">
                  <svg viewBox="0 0 200 200" className="h-52 w-52 -rotate-90">
                    {(() => {
                      const radius = 56;
                      const circumference = 2 * Math.PI * radius;
                      const total = Math.max(donutData.reduce((sum, item) => sum + item.value, 0), 1);
                      let offset = 0;

                      return donutData.map((item) => {
                        const segment = (item.value / total) * circumference;
                        const circle = (
                          <circle
                            key={item.label}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke={item.color}
                            strokeWidth="30"
                            strokeDasharray={`${segment} ${circumference}`}
                            strokeDashoffset={-offset}
                            style={{ transition: 'stroke-dasharray 700ms ease' }}
                          />
                        );
                        offset += segment;
                        return circle;
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-[34%] rounded-full border border-slate-200 bg-white" />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {donutData.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-slate-600">{item.label}</span>
                    </div>
                    <span className="font-semibold text-slate-700">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">CC origen por obra</h3>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" />Materiales</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />Asistencias</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" />Asist. partner</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />Viajes</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-400" />Otros gastos</span>
                </div>
              </div>
              <div className="mt-4 flex h-56 gap-2">
                <div className="flex w-10 flex-col justify-between py-2 text-right text-[10px] font-semibold text-slate-500">
                  <span>{formatAxisAmount(maxProjectTotal)}</span>
                  <span>{formatAxisAmount(maxProjectTotal * 0.75)}</span>
                  <span>{formatAxisAmount(maxProjectTotal * 0.5)}</span>
                  <span>{formatAxisAmount(maxProjectTotal * 0.25)}</span>
                  <span>0</span>
                </div>

                <div className="flex-1 overflow-x-auto rounded-lg border border-slate-200">
                  <div
                    className="h-full bg-[linear-gradient(to_right,rgba(148,163,184,0.25)_1px,transparent_1px),linear-gradient(to_top,rgba(148,163,184,0.25)_1px,transparent_1px)] bg-[size:40px_100%,100%_44px] p-3"
                    style={{ width: `${Math.max(projectBars.length * 92, 720)}px` }}
                  >
                  <div className="flex h-full items-end gap-2">
                    {projectBars.map((project, index) => (
                      <div key={project.name} className="flex h-full w-[84px] shrink-0 flex-col items-center justify-end gap-2">
                        <div className="flex h-full w-8 flex-col justify-end overflow-hidden rounded border border-slate-300/80 bg-white/50">
                          <div
                            className="bg-zinc-400"
                            style={{
                              height: `${(project.other / maxProjectTotal) * 100}%`,
                              transition: `height 600ms ease ${index * 45}ms`,
                            }}
                          />
                          <div
                            className="bg-amber-500"
                            style={{
                              height: `${(project.shipment / maxProjectTotal) * 100}%`,
                              transition: `height 600ms ease ${index * 45 + 40}ms`,
                            }}
                          />
                          <div
                            className="bg-rose-500"
                            style={{
                              height: `${(project.partner / maxProjectTotal) * 100}%`,
                              transition: `height 600ms ease ${index * 45 + 80}ms`,
                            }}
                          />
                          <div
                            className="bg-emerald-500"
                            style={{
                              height: `${(project.attendance / maxProjectTotal) * 100}%`,
                              transition: `height 600ms ease ${index * 45 + 120}ms`,
                            }}
                          />
                          <div
                            className="bg-sky-400"
                            style={{
                              height: `${(project.material / maxProjectTotal) * 100}%`,
                              transition: `height 600ms ease ${index * 45 + 160}ms`,
                            }}
                          />
                        </div>
                        <p className="w-full truncate text-center text-[10px] font-medium text-slate-500" title={project.name}>
                          {extractProjectCode(project.name)}
                        </p>
                      </div>
                    ))}
                  </div>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div className="space-y-2 pt-1">
        {detailRows.map((row) => {
          if (row.name === 'Materiales') {
            return (
              <article key={row.name} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setMaterialsExpanded((current) => !current)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm">{row.icon}</div>
                    <div>
                      <p translate="no" className="text-xl font-extrabold tracking-tight text-sky-500">Materiales</p>
                      <p className="text-sm font-semibold text-slate-600"><span translate="no">{materialData.totalRecords}</span> líneas</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <p translate="no" className="text-3xl font-extrabold text-sky-500">{formatCompactAmount(materialData.totalAmount)}</p>
                    <span className="text-slate-400">{materialsExpanded ? '⌄' : '›'}</span>
                  </div>
                </button>

                {materialsExpanded && (
                  <div className="border-t border-slate-200 px-4 pb-3 pt-2">
                    <p className="pb-2 text-sm font-semibold text-slate-600">
                      Resumen · {materialsViewMode === 'individual' ? `${materialCountView} líneas` : `${groupedMaterialCountView} grupos`} · {formatCurrency(materialTotalView)}
                    </p>

                    <div className="mb-2 overflow-x-auto">
                      <div className="inline-flex min-w-full gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedMaterialCategory('Todas')}
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            selectedMaterialCategory === 'Todas'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Todas {formatCurrency(materialData.totalAmount)}
                        </button>
                        {materialCategories.map((item) => (
                          <button
                            key={item.category}
                            type="button"
                            onClick={() => setSelectedMaterialCategory(item.category)}
                            className={`whitespace-nowrap rounded px-2 py-1 text-xs font-semibold ${
                              selectedMaterialCategory === item.category
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {item.category} {formatCurrency(item.total)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-2 flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-xs font-semibold text-slate-500">Vista:</span>
                        <button
                          type="button"
                          onClick={() => setMaterialsViewMode('individual')}
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${
                            materialsViewMode === 'individual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Individual
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaterialsViewMode('grouped')}
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${
                            materialsViewMode === 'grouped' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Agrupado
                        </button>
                      </div>
                      <p className="text-xs font-semibold text-slate-500">
                        {materialsViewMode === 'individual' ? `${materialCountView} líneas` : `${groupedMaterialCountView} grupos`} · {formatCurrency(materialTotalView)} total
                      </p>
                    </div>

                    <div className="overflow-x-auto rounded border border-slate-200">
                      {materialsViewMode === 'individual' ? (
                        <table className="min-w-full text-xs">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-2 py-1.5 text-left">Categoría</th>
                              <th className="px-2 py-1.5 text-left">Fecha</th>
                              <th className="px-2 py-1.5 text-left">Albarán</th>
                              <th className="px-2 py-1.5 text-left">Referencia</th>
                              <th className="px-2 py-1.5 text-left">Producto</th>
                              <th className="px-2 py-1.5 text-left">Descripción</th>
                              <th className="px-2 py-1.5 text-right">Cantidad</th>
                              <th className="px-2 py-1.5 text-right">Coste</th>
                              <th className="px-2 py-1.5 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {materialRowsView.map((line) => (
                              <tr key={line.id} className="border-t border-slate-200">
                                <td className="px-2 py-1.5 text-slate-600">{line.category_name || 'Sin categoría'}</td>
                                <td className="px-2 py-1.5 text-slate-600">{formatDateTime(line.date)}</td>
                                <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{line.picking_name || '—'}</td>
                                <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{line.reference || '—'}</td>
                                <td className="px-2 py-1.5 text-slate-700">{line.product_name || '—'}</td>
                                <td className="px-2 py-1.5 text-slate-600">{line.description || '—'}</td>
                                <td className={`px-2 py-1.5 text-right whitespace-nowrap ${line.qty < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{line.qty.toFixed(2)} {line.uom_name || ''}</td>
                                <td className="px-2 py-1.5 text-right text-slate-700 whitespace-nowrap">{formatCurrency(line.unit_price)}</td>
                                <td className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${line.subtotal < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                  {formatCurrency(line.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-slate-300 bg-slate-100">
                            <tr>
                              <td className="px-2 py-1.5 font-bold text-slate-700">TOTAL</td>
                              <td className="px-2 py-1.5" colSpan={7} />
                              <td className="px-2 py-1.5 text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(materialTotalView)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      ) : (
                        <table className="min-w-full text-xs">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-2 py-1.5 text-left">Categoría</th>
                              <th className="px-2 py-1.5 text-left">Producto</th>
                              <th className="px-2 py-1.5 text-right">Cantidad</th>
                              <th className="px-2 py-1.5 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedMaterialRows.map((group) => {
                              const expanded = expandedMaterialGroups.includes(group.key);
                              return (
                                <Fragment key={group.key}>
                                  <tr
                                    className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                                    onClick={() => {
                                      setExpandedMaterialGroups((current) =>
                                        current.includes(group.key)
                                          ? current.filter((key) => key !== group.key)
                                          : [...current, group.key],
                                      );
                                    }}
                                  >
                                    <td className="px-2 py-1.5 text-slate-600">{group.category}</td>
                                    <td className="px-2 py-1.5 font-semibold text-slate-700">{expanded ? '⌄' : '›'} {group.product}</td>
                                    <td className={`px-2 py-1.5 text-right ${group.qty < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{group.qty.toFixed(2)}</td>
                                    <td className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${group.subtotal < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                      {formatCurrency(group.subtotal)}
                                    </td>
                                  </tr>
                                  {expanded && (
                                    <tr className="border-t border-slate-100 bg-slate-50/80">
                                      <td colSpan={4} className="px-2 py-2">
                                        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                                          <table className="min-w-full text-xs">
                                            <thead className="bg-slate-100 text-slate-600">
                                              <tr>
                                                <th className="px-2 py-1 text-left">Fecha</th>
                                                <th className="px-2 py-1 text-left">Albarán</th>
                                                <th className="px-2 py-1 text-left">Referencia</th>
                                                <th className="px-2 py-1 text-left">Descripción</th>
                                                <th className="px-2 py-1 text-right">Cantidad</th>
                                                <th className="px-2 py-1 text-right">Coste</th>
                                                <th className="px-2 py-1 text-right">Subtotal</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {group.lines.map((line) => (
                                                <tr key={line.id} className="border-t border-slate-100">
                                                  <td className="px-2 py-1 text-slate-600">{formatDateTime(line.date)}</td>
                                                  <td className="px-2 py-1 text-slate-600 whitespace-nowrap">{line.picking_name || '—'}</td>
                                                  <td className="px-2 py-1 text-slate-600 whitespace-nowrap">{line.reference || '—'}</td>
                                                  <td className="px-2 py-1 text-slate-600">{line.description || '—'}</td>
                                                  <td className={`px-2 py-1 text-right whitespace-nowrap ${line.qty < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{line.qty.toFixed(2)} {line.uom_name || ''}</td>
                                                  <td className="px-2 py-1 text-right text-slate-700 whitespace-nowrap">{formatCurrency(line.unit_price)}</td>
                                                  <td className={`px-2 py-1 text-right font-semibold whitespace-nowrap ${line.subtotal < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                                    {formatCurrency(line.subtotal)}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                          <tfoot className="border-t border-slate-300 bg-slate-100">
                            <tr>
                              <td className="px-2 py-1.5 font-bold text-slate-700">TOTAL</td>
                              <td className="px-2 py-1.5" />
                              <td className="px-2 py-1.5 text-right font-bold text-slate-800">{groupedMaterialRows.reduce((sum, item) => sum + item.qty, 0).toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(materialTotalView)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          }

          if (row.name === 'Otros gastos') {
            return (
              <article key={row.name} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOtherExpenseExpanded((current) => !current)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm">{row.icon}</div>
                    <div>
                      <p translate="no" className="text-xl font-extrabold tracking-tight text-zinc-500">Otros gastos</p>
                      <p className="text-sm font-semibold text-slate-600"><span translate="no">{otherExpenseData.totalRecords}</span> registros</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <p translate="no" className="text-3xl font-extrabold text-zinc-500">{formatCompactAmount(otherExpenseData.totalAmount)}</p>
                    <span className="text-slate-400">{otherExpenseExpanded ? '⌄' : '›'}</span>
                  </div>
                </button>

                {otherExpenseExpanded && (
                  <div className="border-t border-slate-200 px-4 pb-3 pt-2">
                    <p className="pb-2 text-sm font-semibold text-slate-600">
                      Resumen · {otherExpenseData.totalRecords} registros · {formatCurrency(otherExpenseData.totalAmount)}
                    </p>

                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Gasto</th>
                            <th className="px-2 py-1.5 text-left">Fecha</th>
                            <th className="px-2 py-1.5 text-left">Proyecto</th>
                            <th className="px-2 py-1.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {otherExpenseData.rows.map((line) => (
                            <tr key={line.id} className="border-t border-slate-200">
                              <td className="px-2 py-1.5 text-slate-700">{line.expense_name || `OE-${line.expense_id}`}</td>
                              <td className="px-2 py-1.5 text-slate-600">{line.date || '—'}</td>
                              <td className="px-2 py-1.5 text-slate-600">{line.project_name || '—'}</td>
                              <td className="px-2 py-1.5 text-right font-semibold text-slate-800">{formatCurrency(line.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-300 bg-slate-100">
                          <tr>
                            <td className="px-2 py-1.5 font-bold text-slate-700">TOTAL</td>
                            <td className="px-2 py-1.5" colSpan={2} />
                            <td className="px-2 py-1.5 text-right font-bold text-slate-800">{formatCurrency(otherExpenseData.totalAmount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </article>
            );
          }

          if (row.name === 'Viajes') {
            return (
              <article key={row.name} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setShipmentExpanded((current) => !current)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm">{row.icon}</div>
                    <div>
                      <p translate="no" className="text-xl font-extrabold tracking-tight text-amber-500">Viajes</p>
                      <p className="text-sm font-semibold text-slate-600"><span translate="no">{shipmentData.totalRecords}</span> desplazamientos</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                      <p translate="no" className="text-3xl font-extrabold text-amber-500">{formatCompactAmount(shipmentData.totalAmount)}</p>
                    <span className="text-slate-400">{shipmentExpanded ? '⌄' : '›'}</span>
                  </div>
                </button>

                {shipmentExpanded && (
                  <div className="border-t border-slate-200 px-4 pb-3 pt-2">
                    <p className="pb-2 text-sm font-semibold text-slate-600">
                      Resumen · {shipmentData.totalRecords} desplazamientos · {formatCurrency(shipmentData.totalAmount)}
                    </p>

                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            <th className="px-1 py-1 text-left">Código</th>
                            <th className="px-1 py-1 text-left">Equipos</th>
                            <th className="px-1 py-1 text-left">Origen</th>
                            <th className="px-1 py-1 text-left">Partida destino</th>
                            <th className="px-1 py-1 text-left">Conductor</th>
                            <th className="px-1 py-1 text-right">Km inicial</th>
                            <th className="px-1 py-1 text-right">Km final</th>
                            <th className="px-1 py-1 text-right">Precio</th>
                            <th className="px-1 py-1 text-right">Cantidad</th>
                            <th className="px-1 py-1 text-right">Total</th>
                            <th className="px-1 py-1 text-left">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shipmentData.rows.map((shipment, idx) => (
                            <tr key={`${shipment.id}-${idx}`} className="border-t border-slate-200">
                              <td className="px-1 py-1 text-slate-700 font-mono">{shipment.name}</td>
                              <td className="px-1 py-1 text-slate-600">{shipment.vehicle || '—'}</td>
                              <td className="px-1 py-1 text-slate-600">{shipment.origin_project || '—'}</td>
                              <td className="px-1 py-1 text-slate-600">{shipment.destination_project || '—'}</td>
                              <td className="px-1 py-1 text-slate-600">{shipment.driver || '—'}</td>
                              <td className="px-1 py-1 text-right text-slate-600">{shipment.km_initial.toFixed(2)}</td>
                              <td className="px-1 py-1 text-right text-slate-600">{shipment.km_final.toFixed(2)}</td>
                              <td className="px-1 py-1 text-right text-slate-600">{shipment.price.toFixed(2)} €</td>
                              <td className="px-1 py-1 text-right text-slate-600">{shipment.qty.toFixed(2)}</td>
                              <td className="px-1 py-1 text-right font-semibold text-slate-800">{formatCurrency(shipment.total)}</td>
                              <td className="px-1 py-1 text-slate-600">{formatDateTime(shipment.date)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-300 bg-slate-100">
                          <tr>
                            <td className="px-1 py-1 font-bold text-slate-700" colSpan={9}>TOTAL</td>
                            <td className="px-1 py-1 text-right font-bold text-slate-800">{formatCurrency(shipmentData.totalAmount)}</td>
                            <td className="px-1 py-1" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </article>
            );
          }

          if (row.name !== 'Asistencias' && row.name !== 'Asist. partner') {
            const isShipmentRow = row.name === 'Viajes';
            const isOtherExpenseRow = row.name === 'Otros gastos';
            const isMaterialRow = row.name === 'Materiales';
            const rowRecords = isShipmentRow
              ? `${shipmentData.totalRecords} desplazamientos`
              : isOtherExpenseRow
                ? `${otherExpenseData.totalRecords} registros`
                : isMaterialRow
                  ? `${materialData.totalRecords} líneas`
                : row.records;
            const rowAmount = isShipmentRow
              ? formatCompactAmount(shipmentData.totalAmount)
              : isOtherExpenseRow
                ? formatCompactAmount(otherExpenseData.totalAmount)
                : isMaterialRow
                  ? formatCompactAmount(materialData.totalAmount)
                : row.amount;

            return (
              <button
                key={row.name}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm">{row.icon}</div>
                  <div>
                    <p className={`text-xl font-extrabold tracking-tight ${row.color}`}>{row.name}</p>
                    <p className="text-sm text-slate-500">{rowRecords}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <p className={`text-3xl font-extrabold ${row.color}`}>{rowAmount}</p>
                  <span className="text-slate-400">›</span>
                </div>
              </button>
            );
          }

          if (row.name === 'Asist. partner') {
            return (
              <article key={row.name} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setPartnerAttendanceExpanded((current) => !current)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm">{row.icon}</div>
                    <div>
                      <p translate="no" className="text-xl font-extrabold tracking-tight text-rose-500">Asist. partner</p>
                      <p className="text-sm font-semibold text-slate-600"><span translate="no">{partnerAttendanceData.totalRecords}</span> registros</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                      <p translate="no" className="text-3xl font-extrabold text-rose-500">{formatCompactAmount(partnerAttendanceData.totalAmount)}</p>
                    <span className="text-slate-400">{partnerAttendanceExpanded ? '⌄' : '›'}</span>
                  </div>
                </button>

                {partnerAttendanceExpanded && (
                  <div className="border-t border-slate-200 px-4 pb-3 pt-2">
                    <p className="pb-2 text-sm font-semibold text-slate-600">
                      Resumen · {partnerAttendanceData.totalRecords} registros · {formatCurrency(partnerAttendanceData.totalAmount)}
                    </p>

                    <div className="space-y-1 pb-2">
                      {partnerAttendanceData.summary.slice(0, 5).map((item) => (
                        <div key={item.partner_name} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
                          <span className="font-semibold text-slate-700">{item.partner_name}</span>
                          <span className="text-slate-600">{formatHours(item.hours)} · {formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Partner</th>
                            <th className="px-2 py-1.5 text-left">Proyecto</th>
                            <th className="px-2 py-1.5 text-left">Nº Contrato</th>
                            <th className="px-2 py-1.5 text-left">Entrada</th>
                            <th className="px-2 py-1.5 text-left">Salida</th>
                            <th className="px-2 py-1.5 text-right">H.Ent(C)</th>
                            <th className="px-2 py-1.5 text-right">H.Sal(C)</th>
                            <th className="px-2 py-1.5 text-left">Ent.Calc.</th>
                            <th className="px-2 py-1.5 text-left">Sal.Calc.</th>
                            <th className="px-2 py-1.5 text-right">€/H</th>
                            <th className="px-2 py-1.5 text-right">T.Total</th>
                            <th className="px-2 py-1.5 text-right">T.Calc.</th>
                            <th className="px-2 py-1.5 text-left">Notas</th>
                            <th className="px-2 py-1.5 text-right">Importe</th>
                            <th className="px-2 py-1.5 text-center">Imp.Calc</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partnerAttendanceData.rows.map((attendance) => (
                            <tr key={attendance.id} className="border-t border-slate-200">
                              <td className="px-2 py-1.5 text-slate-700">{attendance.partner_name}</td>
                              <td className="px-2 py-1.5 text-slate-600">{attendance.project_name || '—'}</td>
                              <td className="px-2 py-1.5 text-slate-600">{attendance.contract_name || '—'}</td>
                              <td className="px-2 py-1.5 text-slate-600">{formatDateTime(attendance.check_in)}</td>
                              <td className="px-2 py-1.5 text-slate-600">{formatDateTime(attendance.check_out)}</td>
                              <td className="px-2 py-1.5 text-right text-slate-600">{attendance.contract_check_in_time ? formatFloatTime(attendance.contract_check_in_time) : '—'}</td>
                              <td className="px-2 py-1.5 text-right text-slate-600">{attendance.contract_check_out_time ? formatFloatTime(attendance.contract_check_out_time) : '—'}</td>
                              <td className="px-2 py-1.5 text-slate-600">{formatDateTime(attendance.check_in_calculated)}</td>
                              <td className="px-2 py-1.5 text-slate-600">{formatDateTime(attendance.check_out_calculated)}</td>
                              <td className="px-2 py-1.5 text-right text-slate-700">{formatCurrency(attendance.hour_cost)}</td>
                              <td className="px-2 py-1.5 text-right text-slate-700">{attendance.tiempo_total.toFixed(2)} h</td>
                              <td className="px-2 py-1.5 text-right text-slate-700">{attendance.tiempo_total_calculado.toFixed(2)} h</td>
                              <td className="px-2 py-1.5 text-slate-600 max-w-35 truncate" title={attendance.note}>{attendance.note || '—'}</td>
                              <td className="px-2 py-1.5 text-right font-semibold text-slate-800">{formatCurrency(attendance.total)}</td>
                              <td className="px-2 py-1.5 text-center">{attendance.use_calculated_time ? <span className="inline-block h-3 w-3 rounded-sm bg-brand-500" title="Importe con tiempo calculado" /> : <span className="inline-block h-3 w-3 rounded-sm border border-slate-300" />}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-300 bg-slate-100">
                          <tr>
                            <td className="px-2 py-1.5 font-bold text-slate-700" colSpan={11}>TOTAL</td>
                            <td className="px-2 py-1.5 text-right font-bold text-slate-700">{partnerAttendanceData.totalHours.toFixed(2)} h</td>
                            <td className="px-2 py-1.5" colSpan={1} />
                            <td className="px-2 py-1.5 text-right font-bold text-slate-800">{formatCurrency(partnerAttendanceData.totalAmount)}</td>
                            <td className="px-2 py-1.5" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </article>
            );
          }

          return (
            <article key={row.name} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setAttendanceExpanded((current) => !current)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm">{row.icon}</div>
                  <div>
                    <p translate="no" className="text-xl font-extrabold tracking-tight text-emerald-500">Asistencias</p>
                    <p className="text-sm font-semibold text-slate-600"><span translate="no">{attendanceData.totalRecords}</span> fichajes</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <p translate="no" className="text-3xl font-extrabold text-emerald-500">{formatCompactAmount(attendanceData.totalAmount)}</p>
                  <span className="text-slate-400">{attendanceExpanded ? '⌄' : '›'}</span>
                </div>
              </button>

              {attendanceExpanded && (
                <div className="border-t border-slate-200 px-4 pb-3 pt-2">
                  <p className="pb-2 text-sm font-semibold text-slate-600">
                    Resumen · {attendanceData.totalRecords} fichajes · {formatCurrency(attendanceData.totalAmount)}
                  </p>

                  <div className="space-y-1 pb-2">
                    {attendanceData.summary.slice(0, 5).map((item) => (
                      <div key={item.employee_name} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
                        <span className="font-semibold text-slate-700">{item.employee_name}</span>
                        <span className="text-slate-600">{formatHours(item.hours)} · {formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-0.5 py-1 text-left">Puesto</th>
                          <th className="px-0.5 py-1 text-left">Empleado</th>
                          <th className="px-0.5 py-1 text-left">Entrada</th>
                          <th className="px-0.5 py-1 text-left">Salida</th>
                          <th className="px-0.5 py-1 text-left">Proyecto E.</th>
                          <th className="px-0.5 py-1 text-left">Proyecto S.</th>
                          <th className="px-0.5 py-1 text-center">DE</th>
                          <th className="px-0.5 py-1 text-center">DS</th>
                          <th className="px-0.5 py-1 text-center">A</th>
                          <th className="px-0.5 py-1 text-center">C</th>
                          <th className="px-0.5 py-1 text-left w-10">Nota</th>
                          <th className="px-0.5 py-1 text-center">Fest.</th>
                          <th className="px-0.5 py-1 text-right">UD</th>
                          <th className="px-0.5 py-1 text-right">MOD</th>
                          <th className="px-0.5 py-1 text-right">Total HH</th>
                          <th className="px-0.5 py-1 text-right">MOE</th>
                          <th className="px-0.5 py-1 text-right">MOF</th>
                          <th className="px-0.5 py-1 text-right">T-Extra</th>
                          <th className="px-0.5 py-1 text-right">Dietas</th>
                          <th className="px-0.5 py-1 text-right">€/H</th>
                          <th className="px-0.5 py-1 text-right">Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceData.rows.map((attendance) => (
                          <tr key={attendance.id} className="border-t border-slate-200">
                            <td className="px-0.5 py-1 text-slate-600">{attendance.job_name || '—'}</td>
                            <td className="px-0.5 py-1 text-slate-700">{attendance.employee_name}</td>
                            <td className="px-0.5 py-1 text-slate-600">{formatDateTime(attendance.check_in)}</td>
                            <td className="px-0.5 py-1 text-slate-600">{formatDateTime(attendance.check_out)}</td>
                            <td className="px-0.5 py-1 text-slate-600">{attendance.project_name || '—'}</td>
                            <td className="px-0.5 py-1 text-slate-600">{attendance.project_out_name || '—'}</td>
                            <td className="px-0.5 py-1 text-center text-slate-600">{attendance.de || '—'}</td>
                            <td className="px-0.5 py-1 text-center text-slate-600">{attendance.ds || '—'}</td>
                            <td className="px-0.5 py-1 text-center">{attendance.almuerzo ? <span className="inline-block h-3 w-3 rounded-sm bg-brand-500" /> : <span className="inline-block h-3 w-3 rounded-sm border border-slate-300" />}</td>
                            <td className="px-0.5 py-1 text-center">{attendance.comida ? <span className="inline-block h-3 w-3 rounded-sm bg-brand-500" /> : <span className="inline-block h-3 w-3 rounded-sm border border-slate-300" />}</td>
                            <td className="px-0.5 py-1 text-slate-600 w-10 max-w-10 truncate" title={attendance.note}>{attendance.note || '—'}</td>
                            <td className="px-0.5 py-1 text-center">{attendance.festivo ? <span className="inline-block h-3 w-3 rounded-sm bg-amber-400" title="Festivo" /> : null}</td>
                            <td className="px-0.5 py-1 text-right text-slate-700">{attendance.ud.toFixed(2)}</td>
                            <td className="px-0.5 py-1 text-right text-slate-700">{attendance.mod.toFixed(2)}</td>
                            <td className="px-0.5 py-1 text-right text-slate-700">{attendance.total_hh.toFixed(2)}</td>
                            <td className="px-0.5 py-1 text-right text-slate-700">{attendance.moe.toFixed(2)}</td>
                            <td className="px-0.5 py-1 text-right text-slate-700">{attendance.mof.toFixed(2)}</td>
                            <td className="px-0.5 py-1 text-right text-slate-700">{attendance.t_extra.toFixed(2)}</td>
                            <td className="px-0.5 py-1 text-right text-slate-700">{attendance.dietas.toFixed(2)}</td>
                            <td className="px-0.5 py-1 text-right text-slate-700">{formatCurrency(attendance.hour_cost)}</td>
                            <td className="px-0.5 py-1 text-right font-semibold text-slate-800">{formatCurrency(attendance.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-slate-300 bg-slate-100">
                        <tr>
                          <td className="px-0.5 py-1 font-bold text-slate-700" colSpan={14}>TOTAL</td>
                          <td className="px-0.5 py-1 text-right font-bold text-slate-700">{attendanceData.totalHours.toFixed(2)} h</td>
                          <td className="px-0.5 py-1" colSpan={5} />
                          <td className="px-0.5 py-1 text-right font-bold text-slate-800">{formatCurrency(attendanceData.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </article>
          );
        })}
          </div>
        </div>
      </div>
    </section>
  );
}
