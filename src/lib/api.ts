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
  portal_all_projects?: boolean;
}

export interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  token?: string;
  partner?: PartnerInfo;
}

export interface PortalProject {
  id: number;
  code: string;
  name: string;
  display_name: string;
  is_manager: boolean;
}

export interface PortalPartner {
  id: number;
  name: string;
}

export interface PortalPartnersResponse extends ApiResponse {
  portal_partners?: PortalPartner[];
}

export interface ProjectsResponse extends ApiResponse {
  projects?: PortalProject[];
}

export interface AttendanceItem {
  id: number;
  employee_name: string;
  project_name: string;
  check_in: string | false;
  check_out: string | false;
  hours: number;
  hour_cost: number;
  total: number;
}

export interface AttendanceSummaryItem {
  employee_name: string;
  hours: number;
  amount: number;
}

export interface AttendancesResponse extends ApiResponse {
  attendances?: AttendanceItem[];
  total_records?: number;
  total_hours?: number;
  total_amount?: number;
  employee_summary?: AttendanceSummaryItem[];
}

export interface PartnerAttendanceItem {
  id: number;
  partner_name: string;
  project_name: string;
  check_in: string | false;
  check_out: string | false;
  hours: number;
  hour_cost: number;
  total: number;
}

export interface PartnerAttendanceSummaryItem {
  partner_name: string;
  hours: number;
  amount: number;
}

export interface PartnerAttendancesResponse extends ApiResponse {
  partner_attendances?: PartnerAttendanceItem[];
  total_records?: number;
  total_hours?: number;
  total_amount?: number;
  partner_summary?: PartnerAttendanceSummaryItem[];
}

export interface ShipmentItem {
  id: number;
  name: string;
  date: string | false;
  origin_project: string;
  destination_project: string;
  total: number;
}

export interface ShipmentsResponse extends ApiResponse {
  shipments?: ShipmentItem[];
  total_records?: number;
  total_amount?: number;
}

export interface OtherExpenseLineItem {
  id: number;
  expense_id: number;
  expense_name: string;
  project_name: string;
  date: string | false;
  total: number;
}

export interface OtherExpensesResponse extends ApiResponse {
  lines?: OtherExpenseLineItem[];
  total_records?: number;
  total_amount?: number;
}

export interface MaterialLineItem {
  id: number;
  picking_name: string;
  project_name: string;
  reference: string;
  product_name: string;
  description: string;
  category_name: string;
  date: string | false;
  qty: number;
  unit_price: number;
  uom_name: string;
  subtotal: number;
}

export interface MaterialsResponse extends ApiResponse {
  lines?: MaterialLineItem[];
  total_records?: number;
  total_amount?: number;
}

export interface InvoicedInvoiceItem {
  id: number;
  name: string;
  date: string | false;
  customer_name: string;
  project_name: string;
  total: number;
}

export interface PickingAnalysisLineItem {
  note: string;
  product_cost: number;
  assets_qty: number;
  subtotal: number;
  // solo líneas con assets_qty != 0 vienen del servidor
}

export interface PickingAnalysisItem {
  id: number;
  name: string;
  project_id: number | false;
  project_name: string;
  end_date: string | false;
  created_by: string;
  create_date: string | false;
  line_count: number;
  subtotal: number;
  state: string;
  lines: PickingAnalysisLineItem[];
}

export interface PickingAnalysesResponse extends ApiResponse {
  analyses?: PickingAnalysisItem[];
  total_records?: number;
  total_amount?: number;
}

export interface CreatePickingAnalysisResponse extends ApiResponse {
  analysis?: PickingAnalysisItem;
  warning?: string | false;
}

export interface ProjectBudgetItem {
  id: number;
  name: string;
  code: string;
  display_name: string;
}

export interface ProjectBudgetsResponse extends ApiResponse {
  budgets?: ProjectBudgetItem[];
}

export interface PaidstateItem {
  id: number;
  name: string;
  project_id: number | false;
  project_name: string;
  budget_id: number | false;
  budget_name: string;
  price: number;
  state: 'draft' | 'validated' | 'invoiced' | 'cancel' | string;
  date: string | false;
  amount_total: number;
}

export interface PaidstatesResponse extends ApiResponse {
  paidstates?: PaidstateItem[];
  total_records?: number;
}

export interface CreatePaidstateResponse extends ApiResponse {
  paidstate?: PaidstateItem;
}

export interface InvoicedResponse extends ApiResponse {
  invoices?: InvoicedInvoiceItem[];
  total_records?: number;
  total_amount?: number;
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

export const apiProjects = async (token: string): Promise<ProjectsResponse> =>
  post('/api/projects', {}, token) as Promise<ProjectsResponse>;

export const apiAttendances = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
): Promise<AttendancesResponse> =>
  post('/api/attendances', { project_id, month, months, filter_mode, year }, token) as Promise<AttendancesResponse>;

export const apiPartnerAttendances = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
): Promise<PartnerAttendancesResponse> =>
  post('/api/partner-attendances', { project_id, month, months, filter_mode, year }, token) as Promise<PartnerAttendancesResponse>;

export const apiShipments = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
): Promise<ShipmentsResponse> =>
  post('/api/shipments', { project_id, month, months, filter_mode, year }, token) as Promise<ShipmentsResponse>;

export const apiOtherExpenses = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
): Promise<OtherExpensesResponse> =>
  post('/api/other-expenses', { project_id, month, months, filter_mode, year }, token) as Promise<OtherExpensesResponse>;

export const apiMaterials = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
): Promise<MaterialsResponse> =>
  post('/api/materials', { project_id, month, months, filter_mode, year }, token) as Promise<MaterialsResponse>;

export const apiInvoiced = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
): Promise<InvoicedResponse> =>
  post('/api/invoiced', { project_id, month, months, filter_mode, year }, token) as Promise<InvoicedResponse>;

export const apiPickingAnalyses = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
): Promise<PickingAnalysesResponse> =>
  post('/api/picking-analyses', { project_id, month, months, filter_mode, year }, token) as Promise<PickingAnalysesResponse>;

export const apiCreatePickingAnalysis = async (
  token: string,
  project_id: number,
  end_date: string,
  note: string,
  product_cost: number,
  assets_qty: number,
  type: 'in' | 'out' | 'internal' | 'all' = 'all',
): Promise<CreatePickingAnalysisResponse> =>
  post('/api/picking-analyses/create', { project_id, end_date, note, product_cost, assets_qty, type }, token) as Promise<CreatePickingAnalysisResponse>;

export const apiDeletePickingAnalysis = async (
  token: string,
  analysis_id: number,
): Promise<ApiResponse> =>
  post('/api/picking-analyses/delete', { analysis_id }, token);

export const apiProjectBudgets = async (
  token: string,
  project_id: number,
): Promise<ProjectBudgetsResponse> =>
  post('/api/project-budgets', { project_id }, token) as Promise<ProjectBudgetsResponse>;

export const apiPaidstates = async (
  token: string,
  project_id: number | 'all' = 'all',
): Promise<PaidstatesResponse> =>
  post('/api/paidstates', { project_id }, token) as Promise<PaidstatesResponse>;

export const apiCreatePaidstate = async (
  token: string,
  project_id: number,
  budget_id: number,
  price: number,
  date?: string,
): Promise<CreatePaidstateResponse> =>
  post('/api/paidstates/create', { project_id, budget_id, price, date }, token) as Promise<CreatePaidstateResponse>;

export const apiSetPaidstateState = async (
  token: string,
  paidstate_id: number,
  target_state: 'draft' | 'validated',
): Promise<CreatePaidstateResponse> =>
  post('/api/paidstates/set-state', { paidstate_id, target_state }, token) as Promise<CreatePaidstateResponse>;

export const apiDeletePaidstate = async (
  token: string,
  paidstate_id: number,
): Promise<ApiResponse> =>
  post('/api/paidstates/delete', { paidstate_id }, token);

// ------------------------------------------------------------------ //
//  result.table                                                       //
// ------------------------------------------------------------------ //

export interface ResultTableItem {
  id: number;
  name: string;
  title: string;
  from_date: string | false;
  to_date: string | false;
  line_count: number;
  states: string[];
  managers: { id: number; name: string }[];
  project_ids: { id: number; display_name: string }[];
}

export interface ResultTableLineItem {
  id: number;
  state_project: string;
  nexecution_manager: string;
  project_name: string;
  year: string;
  month: string;
  // Contrato
  contracted_sale: number;
  expansion_contract: number;
  contracted_cost: number;
  contracted_coefficient: number;
  pending_execution: number;
  // FdO / Cte origen
  fdo_orig: number;
  cte_orig: number;
  // Origen
  o_mat: number;
  o_partner: number;
  o_asist: number;
  o_viajes: number;
  o_otros: number;
  // Año
  fdo_year: number;
  cte_year: number;
  cte_year_mat: number;
  cte_year_partner: number;
  cte_year_asist: number;
  cte_year_viajes: number;
  cte_year_otros: number;
  // Mes
  fdo_mon: number;
  cte_mes: number;
  mat: number;
  partner: number;
  asist: number;
  viajes: number;
  otros: number;
  // A/P
  ap_year: number;
  ap_mon: number;
  // Resultado
  result_orig: number;
  result_year: number;
  // Márgenes
  mbrut_orig: number;
  mbrut_year: number;
  mnet_orig: number;
  mmnet_year: number;
}

export interface ResultTableDetailItem extends ResultTableItem {
  lines: ResultTableLineItem[];
}

export interface ResultTablesResponse extends ApiResponse {
  result_tables?: ResultTableItem[];
  total_records?: number;
}

export interface ResultTableDetailResponse extends ApiResponse {
  result_table?: ResultTableDetailItem;
}

export interface CreateResultTableResponse extends ApiResponse {
  result_table?: ResultTableItem;
}

export const apiResultTables = async (token: string): Promise<ResultTablesResponse> =>
  post('/api/result-tables', {}, token) as Promise<ResultTablesResponse>;

export const apiResultTableDetail = async (
  token: string,
  table_id: number,
): Promise<ResultTableDetailResponse> =>
  post('/api/result-tables/detail', { table_id }, token) as Promise<ResultTableDetailResponse>;

export const apiCreateResultTable = async (
  token: string,
  title: string,
  from_date: string,
  to_date: string,
): Promise<CreateResultTableResponse> =>
  post('/api/result-tables/create', { title, from_date, to_date }, token) as Promise<CreateResultTableResponse>;

export const apiUpdateAndCalcResultTable = async (
  token: string,
  table_id: number,
  from_date: string,
  to_date: string,
  project_ids: number[],
  manager_ids?: number[],
): Promise<ResultTableDetailResponse> =>
  post('/api/result-tables/update-and-calc', { table_id, from_date, to_date, project_ids, manager_ids }, token) as Promise<ResultTableDetailResponse>;

export const apiPortalPartners = async (token: string): Promise<PortalPartnersResponse> =>
  post('/api/portal-partners', {}, token) as Promise<PortalPartnersResponse>;


