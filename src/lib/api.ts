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
  manager_id: number | false;
  manager_name: string;
  foreman_id: number | false;
  foreman_name: string;
  state_name: string;
  company_id: number | false;
  company_name: string;
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
  code_bim: string;
  job_name: string;
  employee_name: string;
  check_in: string | false;
  check_out: string | false;
  project_name: string;
  project_out_name: string;
  de: string;
  ds: string;
  almuerzo: boolean;
  comida: boolean;
  note: string;
  festivo: boolean;
  ud: number;
  mod: number;
  total_hh: number;
  moe: number;
  mof: number;
  t_extra: number;
  dietas: number;
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
  partner_parent: string;
  project_name: string;
  contract_name: string;
  check_in: string | false;
  check_out: string | false;
  contract_check_in_time: number;
  contract_check_out_time: number;
  check_in_calculated: string | false;
  check_out_calculated: string | false;
  hours: number;
  tiempo_total: number;
  tiempo_total_calculado: number;
  hour_cost: number;
  total: number;
  note: string;
  use_calculated_time: boolean;
}

export interface PartnerAttendanceSummaryItem {
  partner_name: string;
  partner_parent: string;
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
  vehicle: string;
  driver: string;
  km_initial: number;
  km_final: number;
  price: number;
  qty: number;
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
  scheduled_date: string | false;
  partner_name: string;
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
  id: number;
  note: string;
  product_cost: number;
  assets_qty: number;
  subtotal: number;
  oenc: boolean;
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
  project_state: string;
  lines: PickingAnalysisLineItem[];
}

export interface PickingAnalysesResponse extends ApiResponse {
  analyses?: PickingAnalysisItem[];
  total_records?: number;
  total_amount?: number;
  prev_month_total?: number;
}

export interface CreatePickingAnalysisResponse extends ApiResponse {
  analysis?: PickingAnalysisItem;
  warning?: string | false;
}

export interface UpdatePickingAnalysisResponse extends ApiResponse {
  analysis?: PickingAnalysisItem;
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
  line_count?: number;
  state: 'draft' | 'validated' | 'invoiced' | 'cancel' | string;
  date: string | false;
  amount_total: number;
  project_state: string;
}

export interface PaidstatesResponse extends ApiResponse {
  paidstates?: PaidstateItem[];
  total_records?: number;
}

export interface CreatePaidstateResponse extends ApiResponse {
  paidstate?: PaidstateItem;
}

export interface CertificationItem {
  id: number;
  name: string;
  project_id: number | false;
  project_name: string;
  budget_id: number | false;
  budget_name: string;
  stage_id: number | false;
  stage_name: string;
  stage_date_start: string | false;
  stage_date_stop: string | false;
  stage_state: 'draft' | 'process' | 'approved' | 'cancel' | string;
  state: 'draft' | 'loaded' | 'ready' | 'done' | 'cancelled' | string;
  certification_date: string | false;
  total_fit: number;
  total_certif: number;
  percent_certif: number;
  paid_state_id: number | false;
  paid_state_name: string;
  invoice_state: 'pending' | 'invoiced' | string;
}

export interface LaborResourceHours {
  id: number;
  name: string;
  hours_presup: number;
  hours_act: number;
  hours_ori: number;
  hours_ant: number;
}

export interface CertificationLineItem {
  id: number;
  chapter: string;
  chapter_path: string[];
  concept: string;
  stage_name: string;
  budget_qty: number;
  sale_price: number;
  amount_budget: number;
  qty_acc: number;
  imp_ant: number;
  quantity_to_cert_o: number;
  imp_orig: number;
  quantity_to_cert: number;
  amount_certif: number;
  hours_presup: number;
  hours_act: number;
  hours_ori: number;
  hours_ant: number;
  labor_resources: LaborResourceHours[];
}

export interface CertificationsResponse extends ApiResponse {
  certifications?: CertificationItem[];
  total_records?: number;
}

export interface CertificationResponse extends ApiResponse {
  certification?: CertificationItem;
  paidstate?: PaidstateItem | false;
}

export interface CertificationLinesResponse extends ApiResponse {
  certification?: CertificationItem;
  lines?: CertificationLineItem[];
}

export interface CertificationLineResponse extends ApiResponse {
  line?: CertificationLineItem;
  certification?: CertificationItem;
}

export interface CertificationStageHistoryItem {
  id: number;
  chapter: string;
  chapter_path: string[];
  concept: string;
  stage_id: number | false;
  stage_name: string;
  project_id: number | false;
  project_name: string;
  budget_id: number | false;
  budget_name: string;
  budget_qty: number;
  amount_budget: number;
  certif_qty: number;
  certif_percent: number;
  amount_certif: number;
}

export interface CertificationStagesHistoryResponse extends ApiResponse {
  lines?: CertificationStageHistoryItem[];
  total_records?: number;
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
  company_ids?: number[],
  project_ids?: number[],
): Promise<AttendancesResponse> =>
  post('/api/attendances', { project_id, month, months, filter_mode, year, company_ids, project_ids }, token) as Promise<AttendancesResponse>;

export const apiPartnerAttendances = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
  company_ids?: number[],
  project_ids?: number[],
): Promise<PartnerAttendancesResponse> =>
  post('/api/partner-attendances', { project_id, month, months, filter_mode, year, company_ids, project_ids }, token) as Promise<PartnerAttendancesResponse>;

export const apiShipments = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
  company_ids?: number[],
  project_ids?: number[],
): Promise<ShipmentsResponse> =>
  post('/api/shipments', { project_id, month, months, filter_mode, year, company_ids, project_ids }, token) as Promise<ShipmentsResponse>;

export const apiOtherExpenses = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
  company_ids?: number[],
  project_ids?: number[],
): Promise<OtherExpensesResponse> =>
  post('/api/other-expenses', { project_id, month, months, filter_mode, year, company_ids, project_ids }, token) as Promise<OtherExpensesResponse>;

export const apiMaterials = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
  company_ids?: number[],
  project_ids?: number[],
): Promise<MaterialsResponse> =>
  post('/api/materials', { project_id, month, months, filter_mode, year, company_ids, project_ids }, token) as Promise<MaterialsResponse>;

export const apiInvoiced = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
  company_ids?: number[],
  project_ids?: number[],
): Promise<InvoicedResponse> =>
  post('/api/invoiced', { project_id, month, months, filter_mode, year, company_ids, project_ids }, token) as Promise<InvoicedResponse>;

export const apiPickingAnalyses = async (
  token: string,
  project_id: number | 'all' = 'all',
  month?: number,
  filter_mode: 'origin' | 'month' = 'origin',
  months?: number[],
  year?: number,
  company_ids?: number[],
  project_ids?: number[],
): Promise<PickingAnalysesResponse> =>
  post('/api/picking-analyses', { project_id, month, months, filter_mode, year, company_ids, project_ids }, token) as Promise<PickingAnalysesResponse>;

export interface PickingAnalysisFormLine {
  note: string;
  product_cost: number;
  assets_qty: number;
  oenc: boolean;
}

export interface PickingAnalysisEditLine extends PickingAnalysisFormLine {
  id?: number;
}

export const apiCreatePickingAnalysis = async (
  token: string,
  project_id: number,
  end_date: string,
  lines: PickingAnalysisFormLine[],
  type: 'in' | 'out' | 'internal' | 'all' = 'all',
): Promise<CreatePickingAnalysisResponse> =>
  post('/api/picking-analyses/create', { project_id, end_date, lines, type }, token) as Promise<CreatePickingAnalysisResponse>;

export const apiDeletePickingAnalysis = async (
  token: string,
  analysis_id: number,
): Promise<ApiResponse> =>
  post('/api/picking-analyses/delete', { analysis_id }, token);

export const apiUpdatePickingAnalysis = async (
  token: string,
  analysis_id: number,
  end_date: string,
  lines: PickingAnalysisEditLine[],
): Promise<UpdatePickingAnalysisResponse> =>
  post('/api/picking-analyses/update', { analysis_id, end_date, lines }, token) as Promise<UpdatePickingAnalysisResponse>;

export const apiDuplicatePickingAnalysis = async (
  token: string,
  analysis_id: number,
): Promise<UpdatePickingAnalysisResponse> =>
  post('/api/picking-analyses/duplicate', { analysis_id }, token) as Promise<UpdatePickingAnalysisResponse>;

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

export interface NewPaidstateLine {
  budget_id: number;
  name: string;
  quantity: number;
  price_unit: number;
  certification_factor: number;
}

export const apiCreatePaidstate = async (
  token: string,
  project_id: number,
  lines: NewPaidstateLine[],
  date?: string,
): Promise<CreatePaidstateResponse> =>
  post('/api/paidstates/create', { project_id, lines: lines as unknown as Record<string, unknown>[], date }, token) as Promise<CreatePaidstateResponse>;

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

export const apiUpdatePaidstatePrice = async (
  token: string,
  paidstate_id: number,
  price: number,
): Promise<CreatePaidstateResponse> =>
  post('/api/paidstates/update-price', { paidstate_id, price }, token) as Promise<CreatePaidstateResponse>;

export const apiUpdatePaidstateDate = async (
  token: string,
  paidstate_id: number,
  date: string,
): Promise<CreatePaidstateResponse> =>
  post('/api/paidstates/update-date', { paidstate_id, date }, token) as Promise<CreatePaidstateResponse>;

export const apiCertifications = async (
  token: string,
  project_id: number | 'all' = 'all',
): Promise<CertificationsResponse> =>
  post('/api/certifications', { project_id }, token) as Promise<CertificationsResponse>;

export const apiCreateCertification = async (
  token: string,
  project_id: number,
  budget_id: number,
): Promise<CertificationResponse> =>
  post('/api/certifications/create', { project_id, budget_id }, token) as Promise<CertificationResponse>;

export const apiDeleteCertification = async (
  token: string,
  certification_id: number,
): Promise<ApiResponse> =>
  post('/api/certifications/delete', { certification_id }, token) as Promise<ApiResponse>;

export const apiCertificationLines = async (
  token: string,
  certification_id: number,
): Promise<CertificationLinesResponse> =>
  post('/api/certifications/lines', { certification_id }, token) as Promise<CertificationLinesResponse>;

export const apiUpdateCertificationLine = async (
  token: string,
  line_id: number,
  field: 'quantity_to_cert' | 'quantity_to_cert_o',
  value: number,
): Promise<CertificationLineResponse> =>
  post('/api/certifications/update-line', { line_id, [field]: value }, token) as Promise<CertificationLineResponse>;

export const apiUpdateCertificationAdjustment = async (
  token: string,
  certification_id: number,
  total_fit: number,
): Promise<CertificationResponse> =>
  post('/api/certifications/update-adjustment', { certification_id, total_fit }, token) as Promise<CertificationResponse>;

export const apiValidateCertification = async (
  token: string,
  certification_id: number,
): Promise<CertificationResponse> =>
  post('/api/certifications/validate', { certification_id }, token) as Promise<CertificationResponse>;

export const apiResetDraftCertification = async (
  token: string,
  certification_id: number,
): Promise<CertificationResponse> =>
  post('/api/certifications/reset-draft', { certification_id }, token) as Promise<CertificationResponse>;

export const apiCertifyCertification = async (
  token: string,
  certification_id: number,
): Promise<CertificationResponse> =>
  post('/api/certifications/certify', { certification_id }, token) as Promise<CertificationResponse>;

export const apiCertificationStagesHistory = async (
  token: string,
  project_id: number | 'all' = 'all',
): Promise<CertificationStagesHistoryResponse> =>
  post('/api/certification-stages-history', { project_id }, token) as Promise<CertificationStagesHistoryResponse>;

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

export const apiUpdateResultTableTitle = async (
  token: string,
  table_id: number,
  title: string,
): Promise<CreateResultTableResponse> =>
  post('/api/result-tables/update-title', { table_id, title }, token) as Promise<CreateResultTableResponse>;

export const apiDeleteResultTable = async (
  token: string,
  table_id: number,
): Promise<ApiResponse> =>
  post('/api/result-tables/delete', { table_id }, token) as Promise<ApiResponse>;

export const apiPortalPartners = async (token: string): Promise<PortalPartnersResponse> =>
  post('/api/portal-partners', {}, token) as Promise<PortalPartnersResponse>;

// ------------------------------------------------------------------ //
//  Budgets, Objetivos, Mano de Obra                                   //
// ------------------------------------------------------------------ //

export interface BudgetItem {
  id: number;
  code: string;
  name: string;
  display_name: string;
  state_name?: string;
}
export interface BudgetsResponse extends ApiResponse { budgets?: BudgetItem[]; }

export interface ObjectiveItem {
  id: number | null;
  date_from: string;
  date_to: string;
  product_id: number | false;
  product_name: string;
  daily_units: number;
}
export interface ObjectivesResponse extends ApiResponse { objectives?: ObjectiveItem[]; }

export interface LaborLineItem {
  id: number;
  product_name: string;
  h_presupuesto: number;
  h_imputadas: number;
  resultado: number;
  desvio: number;
}
export interface LaborResponse extends ApiResponse {
  lines?: LaborLineItem[];
  total_labor?: number;
  total_material?: number;
  total_other?: number;
}

export interface ProductOption { id: number; name: string; }
export interface ProductsResponse extends ApiResponse { products?: ProductOption[]; }

export const apiBudgets = (token: string, project_id?: number): Promise<BudgetsResponse> =>
  post('/api/budgets', project_id ? { project_id } : {}, token) as Promise<BudgetsResponse>;

export const apiBudgetObjectives = (token: string, budget_id: number): Promise<ObjectivesResponse> =>
  post('/api/budget-objectives', { budget_id }, token) as Promise<ObjectivesResponse>;

export const apiBudgetObjectivesSave = (token: string, budget_id: number, objectives: ObjectiveItem[]): Promise<ApiResponse> =>
  post('/api/budget-objectives/save', { budget_id, objectives }, token);

export const apiBudgetObjectiveProducts = (token: string): Promise<ProductsResponse> =>
  post('/api/budget-objectives/products', {}, token) as Promise<ProductsResponse>;

export const apiBudgetLabor = (token: string, budget_id: number): Promise<LaborResponse> =>
  post('/api/budget-labor', { budget_id }, token) as Promise<LaborResponse>;

export const apiBudgetLaborCompute = (token: string, budget_id: number): Promise<LaborResponse> =>
  post('/api/budget-labor/compute', { budget_id }, token) as Promise<LaborResponse>;

// ------------------------------------------------------------------ //
//  Compras (purchase.order) — solo lectura                            //
// ------------------------------------------------------------------ //

export interface PurchaseItem {
  id: number;
  name: string;
  partner_name: string;
  project_name: string;
  company_name: string;
  user_name: string;
  date_order: string | false;
  date_approve: string | false;
  receipt_status: string;
  receipt_status_label: string;
  invoice_status: string;
  invoice_status_label: string;
  state: string;
  state_label: string;
  amount_untaxed: number;
  amount_total: number;
}

export interface PurchasesResponse extends ApiResponse {
  purchases?: PurchaseItem[];
  total_records?: number;
  total_untaxed?: number;
  total_amount?: number;
}

export interface PurchaseLineItem {
  id: number;
  display_type: 'line_section' | 'line_note' | false;
  name: string;
  product_name?: string;
  product_qty?: number;
  qty_received?: number;
  qty_invoiced?: number;
  uom_name?: string;
  price_unit?: number;
  discount?: number;
  taxes?: string;
  price_subtotal?: number;
  price_total?: number;
}

export interface PurchaseDetail {
  id: number;
  name: string;
  partner_name: string;
  partner_vat: string;
  partner_ref: string;
  project_name: string;
  company_name: string;
  user_name: string;
  currency_name: string;
  origin: string;
  date_order: string | false;
  date_approve: string | false;
  date_planned: string | false;
  picking_type_name: string;
  payment_term_name: string;
  receipt_status_label: string;
  invoice_status_label: string;
  state: string;
  state_label: string;
  notes: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  invoices: { id: number; name: string; state: string }[];
  lines: PurchaseLineItem[];
}

export interface PurchaseDetailResponse extends ApiResponse {
  purchase?: PurchaseDetail;
}

export const apiPurchases = async (
  token: string,
  project_id: number | 'all' = 'all',
  state: string = 'all',
  search?: string,
): Promise<PurchasesResponse> =>
  post('/api/purchases', { project_id, state, search }, token) as Promise<PurchasesResponse>;

export const apiPurchaseDetail = async (token: string, purchase_id: number): Promise<PurchaseDetailResponse> =>
  post('/api/purchases/detail', { purchase_id }, token) as Promise<PurchaseDetailResponse>;

// ------------------------------------------------------------------ //
//  Otros gastos propios (other.expense) — el usuario es el proveedor  //
// ------------------------------------------------------------------ //

export interface MyExpenseLine {
  id: number;
  product_name: string;
  name: string;
  project_name: string;
  qty: number;
  price_unit: number;
  total: number;
}

export interface MyExpense {
  id: number;
  name: string;
  date: string | false;
  partner_name: string;
  user_name: string;
  company_id: number;
  company_name: string;
  state: string;
  state_label: string;
  project_names: string;
  total: number;
  lines?: MyExpenseLine[];
}

export interface MyExpensesResponse extends ApiResponse {
  expenses?: MyExpense[];
  total_records?: number;
  total_amount?: number;
}

export interface MyExpenseDetailResponse extends ApiResponse {
  expense?: MyExpense;
}

export interface ExpenseProductOption {
  id: number;
  code: string;
  name: string;
  display_name: string;
  price_unit: number;
}

export interface ExpenseProjectOption {
  id: number;
  display_name: string;
  company_id: number;
  company_name: string;
  state_name: string;
}

export interface MyExpenseOptionsResponse extends ApiResponse {
  partner_name?: string;
  companies?: { id: number; name: string }[];
  default_company_id?: number | false;
  products?: ExpenseProductOption[];
  projects?: ExpenseProjectOption[];
}

export interface NewExpenseLine {
  product_id: number;
  project_id: number;
  name: string;
  qty: number;
}

export const apiMyExpenses = async (token: string, state = 'all', search?: string): Promise<MyExpensesResponse> =>
  post('/api/my-expenses', { state, search }, token) as Promise<MyExpensesResponse>;

export const apiMyExpenseDetail = async (token: string, expense_id: number): Promise<MyExpenseDetailResponse> =>
  post('/api/my-expenses/detail', { expense_id }, token) as Promise<MyExpenseDetailResponse>;

export const apiMyExpenseOptions = async (token: string): Promise<MyExpenseOptionsResponse> =>
  post('/api/my-expenses/options', {}, token) as Promise<MyExpenseOptionsResponse>;

export const apiCreateMyExpense = async (
  token: string,
  date: string,
  company_id: number,
  lines: NewExpenseLine[],
): Promise<MyExpenseDetailResponse> =>
  post('/api/my-expenses/create', { date, company_id, lines: lines as unknown as Record<string, unknown>[] }, token) as Promise<MyExpenseDetailResponse>;

export const apiSetMyExpenseState = async (
  token: string,
  expense_id: number,
  state: 'draft' | 'done',
): Promise<MyExpenseDetailResponse> =>
  post('/api/my-expenses/set-state', { expense_id, state }, token) as Promise<MyExpenseDetailResponse>;

export const apiDeleteMyExpense = async (token: string, expense_id: number): Promise<ApiResponse> =>
  post('/api/my-expenses/delete', { expense_id }, token);

export const apiAddMyExpenseLines = async (
  token: string,
  expense_id: number,
  lines: NewExpenseLine[],
): Promise<MyExpenseDetailResponse> =>
  post('/api/my-expenses/add-lines', { expense_id, lines: lines as unknown as Record<string, unknown>[] }, token) as Promise<MyExpenseDetailResponse>;

export const apiUpdateMyExpense = async (
  token: string,
  expense_id: number,
  values: { date?: string; company_id?: number },
): Promise<MyExpenseDetailResponse> =>
  post('/api/my-expenses/update', { expense_id, ...values }, token) as Promise<MyExpenseDetailResponse>;

// ------------------------------------------------------------------ //
//  Proyectos propios (bim.project) — el usuario es resp. de ejecución //
// ------------------------------------------------------------------ //

export interface MyProject {
  id: number;
  company_id: number;
  company_name: string;
  code: string;
  name: string;
  customer_name: string;
  manager_name: string;
  foreman_name: string;
  t_desplazamiento: number;
  contracted_sale: number;
  contracted_cost: number;
  contracted_coefficient: number;
  expansion_contract: number;
  state_name: string;
}

export interface MyProjectsResponse extends ApiResponse {
  projects?: MyProject[];
  total_records?: number;
  partner_name?: string;
  companies?: { id: number; name: string }[];
  default_company_id?: number | false;
}

export interface MyProjectCreateResponse extends ApiResponse {
  project?: MyProject;
}

export const apiMyProjects = async (token: string, search?: string): Promise<MyProjectsResponse> =>
  post('/api/my-projects', { search }, token) as Promise<MyProjectsResponse>;

export const apiCreateMyProject = async (
  token: string,
  values: { company_id: number; name: string; contracted_sale: number; contracted_cost: number },
): Promise<MyProjectCreateResponse> =>
  post('/api/my-projects/create', values, token) as Promise<MyProjectCreateResponse>;

export const apiUpdateMyProject = async (
  token: string,
  project_id: number,
  values: { name: string; expansion_contract: number },
): Promise<MyProjectCreateResponse> =>
  post('/api/my-projects/update', { project_id, ...values }, token) as Promise<MyProjectCreateResponse>;
