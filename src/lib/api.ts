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
  line_note: string;
  line_cost: number;
  line_subtotal: number;
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

