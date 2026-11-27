/**
 * Análisis económico-financiero: mismas fórmulas que la plantilla
 * "Análisis económico financiero master.xls" (hojas Balance, Masas, Explotación,
 * Resumen, Ratios 1 y 2, Origen y aplicación, Valor añadido y Umbral).
 * Los valores de partida (3 ejercicios) los calcula Odoo a partir de las cuentas del PGC.
 */

export type Triple = [number, number, number];
export type AfValues = Record<string, Triple>;

export const AF_LBL: Record<string, [string, string]> = {
  inm_int: ['Inmovilizado intangible', '20'], inm_mat: ['Inmovilizado material', '21, 23'], inv_inmo: ['Inversiones inmobiliarias', '22'],
  inv_fin_lp: ['Inversiones financieras a largo plazo', '24–26, 474'], amort: ['− Amortizaciones y deterioros acumulados', '28, 29'],
  mp: ['Materias primas, mercaderías y auxiliares', '30–32, 39'], curso: ['Productos en curso', '33, 34'], pt: ['Productos terminados e intermedios', '35, 36'],
  antic: ['Anticipos a proveedores', '407'],
  clientes: ['Clientes', '43, 490'], act_imp: ['Activos por impuesto corriente', '473, 4709'], otros_cred: ['Otros créditos, personal y AA. PP.', '460, 470–472'],
  deud_var: ['Deudores varios', '44, 480, 55…'], inv_fin_cp: ['Inversiones financieras a corto plazo', '54, 59'], disp: ['Disponible en caja y bancos', '57'],
  inv_grupo: ['Inversiones en empresas del grupo c/p', '53'],
  cap_res: ['Capital y reservas − reparto de dividendos', '10–12, 557'], resultado: ['Resultado del ejercicio', '6, 7'], subv: ['Subvenciones', '13'],
  otros_fp: ['Otros fondos propios (aportaciones de socios)', '118'], prov_riesgos: ['Provisiones para riesgos y cargas', '14'], deuda_lp: ['Deuda a largo plazo', '15–18, 479'],
  acreedores: ['Acreedores', '41'], proveedores: ['Proveedores', '40'], fiscales: ['Deudas fiscales y sociales', '465, 466, 475–477'],
  otras_deudas: ['Otras deudas / anticipos de clientes', '438, 485, 5x'], prov_cp: ['Provisiones a corto plazo', '499, 529'],
  bancos_cp: ['Bancos (deuda a corto plazo)', '520, 527'], socios: ['Socios y accionistas', '551–553'],
  cn: ['Cifra de negocio', '70'], var_st: ['± Variación de existencias de productos', '71'], subcontratas: ['Subcontratas', '607'], compras: ['Compras consumidas', '60, 61'],
  suministros: ['Suministros', '628'], reparaciones: ['Reparaciones y conservación', '622'], transportes: ['Transportes', '624'], diversos: ['Diversos', '620, 627, 629'],
  primas: ['Primas de seguro', '625'], personal: ['Gastos de personal', '64'], serv_banc: ['Servicios bancarios', '626'], serv_prof: ['Servicios profesionales', '623'],
  tributos: ['Tasas y tributos', '631, 634…'], arrend: ['Arrendamientos', '621'], amort_dot: ['Dotación amortizaciones', '68'], prov_dot: ['Dotación provisiones y pérdidas de gestión', '65, 69'],
  excesos: ['Excesos de provisiones (con signo −)', '79'],
  gfin: ['Gastos financieros (netos)', '66 − 76'], otros_ing: ['Otros ingresos', '73–75'], ben_ext: ['Beneficios extraordinarios', '77'], perd_ext: ['Pérdidas extraordinarias', '67'],
  is: ['Impuesto sobre sociedades', '630'],
  empleados: ['Nº de empleados', ''], ss: ['de los gastos de personal, Seguridad Social', '642, 643'],
};

export const AF_TOT: Record<string, string> = {
  A: 'A · INMOVILIZADO', B: 'B · EXISTENCIAS', C: 'C · REALIZABLE + DISPONIBLE', D: 'D · TOTAL ACTIVO', E: 'E · PATRIMONIO NETO', F: 'F · CAPITALES PERMANENTES', G: 'G · DEUDA A CORTO PLAZO', H: 'H · TOTAL PASIVO',
  prod: 'Producción', mb: 'Margen bruto', gfunc: 'Gastos de funcionamiento', va: 'Valor añadido', gestr: 'Gastos de estructura', rexp: 'Resultado de explotación', rao: 'Resultado de actividades ordinarias', rn: 'RESULTADO NETO', dot: 'Dotaciones amortizaciones y provisiones', cf: 'Cash-flow',
};
export const AF_BIG = new Set(['D', 'H', 'rn', 'cf']);
export const AF_BAL_ACT = ['inm_int', 'inm_mat', 'inv_inmo', 'inv_fin_lp', 'amort', '=A', 'mp', 'curso', 'pt', 'antic', '=B', 'clientes', 'act_imp', 'otros_cred', 'deud_var', 'inv_fin_cp', 'disp', 'inv_grupo', '=C', '=D'];
export const AF_BAL_PAS = ['cap_res', 'resultado', 'subv', '=E', 'otros_fp', 'prov_riesgos', 'deuda_lp', '=F', 'acreedores', 'proveedores', 'fiscales', 'otras_deudas', 'prov_cp', 'bancos_cp', 'socios', '=G', '=H'];
export const AF_PYG = ['cn', 'var_st', 'subcontratas', '=prod', 'compras', '=mb', 'suministros', 'reparaciones', 'transportes', 'diversos', '=gfunc', '=va', 'primas', 'personal', 'serv_banc', 'serv_prof', 'tributos', 'arrend', 'amort_dot', 'prov_dot', 'excesos', '=gestr', '=rexp', 'gfin', '=rao', 'otros_ing', 'ben_ext', 'perd_ext', 'is', '=rn', '=dot', '=cf'];

export const fin = (v: number) => typeof v === 'number' && Number.isFinite(v);
const div = (a: number, b: number) => (b && fin(a) && fin(b) ? a / b : NaN);

export type AfResult = ReturnType<typeof afCalc>;

export function afCalc(years: number[], days: number[], values: AfValues) {
  const g = (k: string): Triple => values[k] ?? [0, 0, 0];
  const op = (f: (i: number) => number): Triple => [f(0), f(1), f(2)];
  const sum = (...ks: string[]) => op((i) => ks.reduce((a, k) => a + g(k)[i], 0));
  const dias = op((i) => days[i] || 365);

  const A = sum('inm_int', 'inm_mat', 'inv_inmo', 'inv_fin_lp', 'amort');
  const B = sum('mp', 'curso', 'pt', 'antic');
  const C = sum('clientes', 'act_imp', 'otros_cred', 'deud_var', 'inv_fin_cp', 'disp', 'inv_grupo');
  const D = op((i) => A[i] + B[i] + C[i]);
  const E = sum('cap_res', 'resultado', 'subv');
  const F = op((i) => E[i] + g('otros_fp')[i] + g('prov_riesgos')[i] + g('deuda_lp')[i]);
  const G = sum('acreedores', 'proveedores', 'fiscales', 'otras_deudas', 'prov_cp', 'bancos_cp', 'socios');
  const H = op((i) => F[i] + G[i]);
  // Explotación
  const prod = op((i) => g('cn')[i] + g('var_st')[i] - g('subcontratas')[i]);
  const mb = op((i) => prod[i] - g('compras')[i]);
  const gfunc = sum('suministros', 'reparaciones', 'transportes', 'diversos');
  const va = op((i) => mb[i] - gfunc[i]);
  const gestr = sum('primas', 'personal', 'serv_banc', 'serv_prof', 'tributos', 'arrend', 'amort_dot', 'prov_dot', 'excesos');
  const rexp = op((i) => va[i] - gestr[i]);
  const rao = op((i) => rexp[i] - g('gfin')[i]);
  const rn = op((i) => rao[i] + g('otros_ing')[i] + g('ben_ext')[i] - g('perd_ext')[i] - g('is')[i]);
  const dot = op((i) => g('amort_dot')[i] + g('prov_dot')[i]);
  const cf = op((i) => rn[i] + dot[i]);
  const chkBal = op((i) => D[i] - H[i]);
  const chkRes = op((i) => g('resultado')[i] - rn[i]);
  // Masas
  const fp = op((i) => E[i] + g('otros_fp')[i] + g('prov_riesgos')[i]);
  const capPerm = op((i) => fp[i] + g('deuda_lp')[i]);
  const fmMasas = op((i) => capPerm[i] - A[i]);
  // Resumen
  const ac = op((i) => B[i] + C[i]);
  const pc = G;
  const fm = op((i) => ac[i] - pc[i]);
  const deudaTot = op((i) => g('deuda_lp')[i] + G[i]);
  const deudaBanc = op((i) => g('bancos_cp')[i] + g('deuda_lp')[i]);
  const activoReal = op((i) => H[i] - g('inm_int')[i] - g('inv_fin_lp')[i] - g('inv_fin_cp')[i]);
  const provAcr = op((i) => g('proveedores')[i] + g('acreedores')[i]);
  const gtosGen = op((i) => mb[i] - rao[i]);
  const gtosDia = op((i) => (gtosGen[i] + g('compras')[i] - g('amort_dot')[i] - g('prov_dot')[i]) / dias[i]);
  // Ratios 1
  const pAlm = op((i) => (B[i] <= 0 ? NaN : i === 0 ? div(B[0] * dias[0], g('compras')[0]) : div(((B[i - 1] + B[i]) * dias[i]) / 2, g('compras')[i])));
  const pCob = op((i) => (g('cn')[i] === 0 ? 0 : (g('clientes')[i] * dias[i]) / (g('cn')[i] * 1.21)));
  const pPag = op((i) => (g('compras')[i] === 0 ? 0 : (g('proveedores')[i] * dias[i]) / (g('compras')[i] * 1.21)));
  const mad = op((i) => (fin(pAlm[i]) ? pAlm[i] : 0) + pCob[i]);
  const liq = op((i) => div(ac[i], pc[i]));
  const liqInm = op((i) => div(C[i], pc[i]));
  const tes = op((i) => div(g('disp')[i], pc[i]));
  const gar = op((i) => div(activoReal[i], deudaTot[i]));
  const coste = op((i) => div(g('gfin')[i], deudaBanc[i]) * 100);
  const cobInt = op((i) => div(rn[i] + g('gfin')[i], g('gfin')[i]));
  const incStock = op((i) => (i === 0 || !fin(pAlm[i]) || !fin(pAlm[i - 1]) ? NaN : ((pAlm[i - 1] - pAlm[i]) * g('compras')[i]) / 360));
  const incCobro = op((i) => (i === 0 ? NaN : (pCob[i - 1] - pCob[i]) * ((g('cn')[i] * 1.21) / 360)));
  const incPago = op((i) => (i === 0 ? NaN : (pPag[i] - pPag[i - 1]) * ((g('compras')[i] * 1.21) / 360)));
  const incTot = op((i) => (i === 0 ? NaN : (fin(incStock[i]) ? incStock[i] : 0) + incCobro[i] + incPago[i]));
  const fmNec = op((i) => gtosDia[i] * mad[i] - (g('compras')[i] / dias[i]) * pPag[i]);
  const fmExc = op((i) => fm[i] - fmNec[i]);
  const diasAut = op((i) => div(fm[i], gtosDia[i]));
  const endPos = op((i) => E[i] / 0.4 - H[i]);
  const devol = op((i) => div(cf[i], deudaBanc[i]) * 100);
  // Ratios 2
  const rotAC = op((i) => div(g('cn')[i], ac[i]));
  const rotAF = op((i) => div(g('cn')[i], A[i]));
  const rotCP = op((i) => div(g('cn')[i], E[i]));
  const rotCli = op((i) => div(g('cn')[i], g('clientes')[i]));
  const rentEc = op((i) => div(rn[i], H[i]) * 100);
  const rentFin = op((i) => div(rn[i], E[i]) * 100);
  const aut = op((i) => div(E[i], H[i]));
  const cfDeuda = op((i) => div(cf[i], deudaTot[i]));
  const z = op((i) => -4.2 + 1.35 * liq[i] + 6.5 * aut[i] + (7 * rentEc[i]) / 100 + (5 * rentFin[i]) / 100);
  const fmAct = op((i) => div(fm[i], H[i]));
  // Valor añadido
  const vaPers = op((i) => g('personal')[i] - g('ss')[i]);
  const vaAdm = op((i) => g('tributos')[i] + g('is')[i] + g('ss')[i]);
  const vaBanc = op((i) => g('gfin')[i] + g('serv_banc')[i]);
  const vaTerc = op((i) => g('primas')[i] + g('serv_prof')[i] + g('arrend')[i]);
  const vaEmp = op((i) => g('amort_dot')[i] + g('prov_dot')[i] + g('excesos')[i] - g('otros_ing')[i] - g('ben_ext')[i] + g('perd_ext')[i]);
  const vaProp = rn;
  const vaChk = op((i) => va[i] - vaPers[i] - vaAdm[i] - vaBanc[i] - vaTerc[i] - vaEmp[i] - vaProp[i]);
  // Productividad
  const prodEmp = op((i) => div(prod[i], g('empleados')[i]));
  const costeEmp = op((i) => div(g('personal')[i], g('empleados')[i]));
  const prodSue = op((i) => div(prod[i], g('personal')[i]));
  const mbSue = op((i) => div(mb[i], g('personal')[i]));
  const bnSue = op((i) => div(rn[i], g('personal')[i]));
  // Umbral de rentabilidad
  const mc = op((i) => div(gestr[i] + rao[i], prod[i]));
  const umbral = op((i) => div(gestr[i], mc[i]));
  const umbralFr = op((i) => div(umbral[i], prod[i]));
  const umbralDia = op((i) => dias[i] * umbralFr[i]);

  return {
    y: years, dias, g,
    A, B, C, D, E, F, G, H, prod, mb, gfunc, va, gestr, rexp, rao, rn, dot, cf, chkBal, chkRes,
    fp, capPerm, fmMasas, ac, pc, fm, deudaTot, deudaBanc, activoReal, provAcr, gtosGen, gtosDia,
    pAlm, pCob, pPag, mad, liq, liqInm, tes, gar, coste, cobInt, incStock, incCobro, incPago, incTot,
    fmNec, fmExc, diasAut, endPos, devol, rotAC, rotAF, rotCP, rotCli, rentEc, rentFin, aut, cfDeuda, z, fmAct,
    vaPers, vaAdm, vaBanc, vaTerc, vaEmp, vaProp, vaChk, prodEmp, costeEmp, prodSue, mbSue, bnSue,
    mc, umbral, umbralFr, umbralDia,
  };
}

/** Estado de un ratio frente a su objetivo: ok / vigilar / riesgo (misma regla que la plantilla). */
export type RatioRule = ['>' | '<', number] | null;
export function ratioState(v: number, rule: RatioRule): 'ok' | 'warn' | 'bad' | 'na' {
  if (!fin(v) || !rule) return 'na';
  const [op, t] = rule;
  if (op === '>') return v >= t ? 'ok' : v >= (t > 0 ? t * 0.8 : t - Math.abs(t) * 0.2 - 0.5) ? 'warn' : 'bad';
  return v <= t ? 'ok' : v <= t * 1.2 ? 'warn' : 'bad';
}
