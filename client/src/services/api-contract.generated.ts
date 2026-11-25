// Generado por `npm run openapi:export` en server. No editar a mano.
// Fuente: esquemas Zod del servidor y rutas reales de Express.

/** Generado desde el esquema Zod `IdParam`. */
export type IdParam = number;

/** Generado desde el esquema Zod `AnioParam`. */
export type AnioParam = number;

/** Generado desde el esquema Zod `LoginRequest`. */
export type LoginRequest = {
  email: string;
  password: string;
};

/** Generado desde el esquema Zod `ChangePasswordRequest`. */
export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

/** Generado desde el esquema Zod `CreateUserRequest`. */
export type CreateUserRequest = {
  nombre: string;
  email: string;
  password: string;
  rol: "admin" | "contador" | "operador" | "consulta";
};

/** Generado desde el esquema Zod `UpdateUserRequest`. */
export type UpdateUserRequest = {
  nombre?: string;
  email?: string;
  password?: string;
  rol?: "admin" | "contador" | "operador" | "consulta";
};

/** Generado desde el esquema Zod `ListUsersQuery`. */
export type ListUsersQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  rol?: "admin" | "contador" | "operador" | "consulta";
  activo?: "0" | "1";
  sort?: "nombre" | "email" | "rol" | "activo" | "creado";
  order?: "asc" | "desc";
};

/** Generado desde el esquema Zod `ActivoRequest`. */
export type ActivoRequest = {
  activo: boolean;
};

/** Generado desde el esquema Zod `CategoryRequest`. */
export type CategoryRequest = {
  nombre: string;
  codigo?: string;
};

/** Generado desde el esquema Zod `CreateProductRequest`. */
export type CreateProductRequest = {
  sku?: string;
  nombre: string;
  category_id: number;
  precio: number;
  costo?: number;
  stock_minimo?: number;
};

/** Generado desde el esquema Zod `UpdateProductRequest`. */
export type UpdateProductRequest = {
  sku?: string;
  nombre?: string;
  category_id?: number;
  precio?: number;
  costo?: number;
  stock_minimo?: number;
};

/** Generado desde el esquema Zod `ListProductsQuery`. */
export type ListProductsQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  ids?: string;
  category_id?: number;
  activo?: "0" | "1";
  bajoStock?: "1";
  sort?: "sku" | "nombre" | "precio" | "stock" | "costo" | "margen";
  order?: "asc" | "desc";
};

/** Generado desde el esquema Zod `NextSkuQuery`. */
export type NextSkuQuery = {
  category_id: number;
};

/** Generado desde el esquema Zod `CreateMovementRequest`. */
export type CreateMovementRequest = {
  product_id: number;
  tipo: "entrada" | "salida";
  cantidad: number;
  costo_unitario?: number;
  motivo?: string;
  origen?: "compra" | "venta" | "entrega" | "merma" | "ajuste";
  account_id?: number;
};

/** Generado desde el esquema Zod `ListMovementsQuery`. */
export type ListMovementsQuery = {
  page?: number;
  pageSize?: number;
  product_id?: number;
  tipo?: "entrada" | "salida";
  origen?: "compra" | "venta" | "entrega" | "merma" | "ajuste";
  invoice_id?: number;
  quote_id?: number;
  q?: string;
  desde?: string;
  hasta?: string;
  sort?: "fecha" | "producto" | "tipo" | "origen" | "cantidad" | "costo" | "precio";
  order?: "asc" | "desc";
};

/** Generado desde el esquema Zod `QuoteRequest`. */
export type QuoteRequest = {
  party_id?: number | null;
  customer_nombre: string;
  customer_documento?: string;
  customer_email?: string;
  fecha_validez: string;
  notas?: string;
  items: {
  product_id: number;
  cantidad: number;
  descuento_pct?: number;
  impuesto_pct?: number;
}[];
};

/** Generado desde el esquema Zod `ListQuotesQuery`. */
export type ListQuotesQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  estado?: "borrador" | "enviado" | "aprobado" | "rechazado" | "entregado" | "vencido";
  desde?: string;
  hasta?: string;
  sort?: "numero" | "cliente" | "total" | "fecha_validez" | "fecha";
  order?: "asc" | "desc";
};

/** Generado desde el esquema Zod `AvailabilityQuery`. */
export type AvailabilityQuery = {
  product_id: IdParam;
};

/** Generado desde el esquema Zod `AccountRequest`. */
export type AccountRequest = {
  nombre: string;
  tipo: "caja" | "banco";
  saldo_inicial?: number;
  activo?: boolean;
};

/** Generado desde el esquema Zod `BudgetLine`. */
export type BudgetLine = {
  finance_category_id: number;
  product_id?: number | null;
  product_category_id?: number | null;
  monto_planeado: number;
};

/** Generado desde el esquema Zod `BudgetRequest`. */
export type BudgetRequest = {
  nombre: string;
  tipo_periodo: "dia" | "semana" | "mes" | "anio";
  fecha_inicio: string;
  fecha_fin: string;
  ingreso_meta?: number;
  alerta_pct?: number;
  lineas?: BudgetLine[];
};

/** Generado desde el esquema Zod `ListBudgetsQuery`. */
export type ListBudgetsQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  estado?: "borrador" | "activo" | "cerrado";
  tipo_periodo?: "dia" | "semana" | "mes" | "anio";
  desde?: string;
  hasta?: string;
  vigente?: "0" | "1";
  sort?: "nombre" | "periodo" | "inicio" | "estado" | "lineas" | "planeado" | "meta" | "creador";
  order?: "asc" | "desc";
};

/** Generado desde el esquema Zod `TransactionRequest`. */
export type TransactionRequest = {
  tipo: "ingreso" | "gasto" | "activo" | "pasivo";
  monto: number;
  fecha: string;
  finance_category_id: number;
  account_id: number;
  product_id?: number | null;
  descripcion?: string;
};

/** Generado desde el esquema Zod `ListTransactionsQuery`. */
export type ListTransactionsQuery = {
  page?: number;
  pageSize?: number;
  tipo?: "ingreso" | "gasto" | "activo" | "pasivo";
  flujo?: "entrada" | "salida";
  desde?: string;
  hasta?: string;
  finance_category_id?: number;
  account_id?: number;
  product_id?: number;
  quote_id?: number;
  invoice_id?: number;
  sort?: "fecha" | "tipo" | "categoria" | "cuenta" | "producto" | "monto" | "creador";
  order?: "asc" | "desc";
};

/** Generado desde el esquema Zod `SummaryQuery`. */
export type SummaryQuery = {
  desde?: string;
  hasta?: string;
};

/** Generado desde el esquema Zod `CashFlowQuery`. */
export type CashFlowQuery = {
  desde?: string;
  hasta?: string;
  account_id?: number;
};

/** Generado desde el esquema Zod `BalanceQuery`. */
export type BalanceQuery = {
  hasta?: string;
};

/** Generado desde el esquema Zod `ProfitabilityQuery`. */
export type ProfitabilityQuery = {
  desde?: string;
  hasta?: string;
  grupo?: "producto" | "categoria" | "cliente";
};

/** Generado desde el esquema Zod `InventoryAnalyticsQuery`. */
export type InventoryAnalyticsQuery = {
  desde?: string;
  hasta?: string;
  dias_muerto?: number;
};

/** Generado desde el esquema Zod `TrendsQuery`. */
export type TrendsQuery = {
  desde?: string;
  hasta?: string;
};

/** Generado desde el esquema Zod `ReconciliationLine`. */
export type ReconciliationLine = {
  fecha: string;
  descripcion: string;
  referencia?: string;
  monto: number;
  nota?: string;
};

/** Generado desde el esquema Zod `CreateReconciliationRequest`. */
export type CreateReconciliationRequest = {
  account_id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  saldo_extracto_inicial?: number;
  saldo_extracto_final?: number;
  lineas?: ReconciliationLine[];
};

/** Generado desde el esquema Zod `UpdateReconciliationRequest`. */
export type UpdateReconciliationRequest = {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  saldo_extracto_inicial: number;
  saldo_extracto_final: number;
};

/** Generado desde el esquema Zod `ListReconciliationsQuery`. */
export type ListReconciliationsQuery = {
  account_id?: number;
  estado?: "abierta" | "cerrada";
};

/** Generado desde el esquema Zod `ListSuggestionsQuery`. */
export type ListSuggestionsQuery = {
  dias?: number;
};

/** Generado desde el esquema Zod `MatchLineRequest`. */
export type MatchLineRequest = {
  transaction_id: number;
};

/** Generado desde el esquema Zod `IgnoreLineRequest`. */
export type IgnoreLineRequest = {
  nota: string;
};

/** Generado desde el esquema Zod `ReopenReconciliationRequest`. */
export type ReopenReconciliationRequest = {
  motivo: string;
};

/** Generado desde el esquema Zod `InvoiceRequest`. */
export type InvoiceRequest = {
  tipo: "venta" | "compra";
  fecha: string;
  hora_expedicion?: string;
  contraparte: string;
  tipo_documento_adquirente?: "NIT" | "CC" | "CE" | "PASAPORTE" | "OTRO";
  documento?: string;
  prefijo?: string;
  resolucion_numero?: string;
  resolucion_fecha?: string;
  rango_desde?: number;
  rango_hasta?: number;
  orden_compra?: string;
  email?: string;
  notas?: string;
  quote_id?: number | null;
  party_id?: number | null;
  condicion_pago?: "contado" | "credito";
  medio_pago?: "efectivo" | "transferencia" | "tarjeta" | "cheque" | "otro";
  dias_credito?: number;
  fecha_vencimiento?: string | null;
  account_id?: number | null;
  retencion_fuente?: number;
  retencion_iva?: number;
  retencion_ica?: number;
  items: {
  product_id: number;
  cantidad: number;
  precio_unitario: number;
  descripcion?: string;
  unidad_medida?: string;
  descuento_pct?: number;
  impuesto_pct?: number;
  inc_pct?: number;
  otro_impuesto_nombre?: string;
  otro_impuesto_pct?: number;
}[];
};

/** Generado desde el esquema Zod `UpdateInvoiceRequest`. */
export type UpdateInvoiceRequest = {
  tipo?: "venta" | "compra";
  fecha?: string;
  hora_expedicion?: string;
  contraparte?: string;
  tipo_documento_adquirente?: "NIT" | "CC" | "CE" | "PASAPORTE" | "OTRO";
  documento?: string;
  prefijo?: string;
  resolucion_numero?: string;
  resolucion_fecha?: string;
  rango_desde?: number;
  rango_hasta?: number;
  orden_compra?: string;
  email?: string;
  notas?: string;
  quote_id?: number | null;
  party_id?: number | null;
  condicion_pago?: "contado" | "credito";
  medio_pago?: "efectivo" | "transferencia" | "tarjeta" | "cheque" | "otro";
  dias_credito?: number;
  fecha_vencimiento?: string | null;
  account_id?: number | null;
  retencion_fuente?: number;
  retencion_iva?: number;
  retencion_ica?: number;
  items?: {
  product_id: number;
  cantidad: number;
  precio_unitario: number;
  descripcion?: string;
  unidad_medida?: string;
  descuento_pct?: number;
  impuesto_pct?: number;
  inc_pct?: number;
  otro_impuesto_nombre?: string;
  otro_impuesto_pct?: number;
}[];
};

/** Generado desde el esquema Zod `ListInvoicesQuery`. */
export type ListInvoicesQuery = {
  page?: number;
  pageSize?: number;
  tipo?: "venta" | "compra";
  estado?: "borrador" | "confirmada" | "anulada";
  desde?: string;
  hasta?: string;
  q?: string;
  sort?: "numero" | "tipo" | "contraparte" | "estado" | "fecha" | "total" | "creador";
  order?: "asc" | "desc";
};

/** Generado desde el esquema Zod `CreatePaymentRequest`. */
export type CreatePaymentRequest = {
  fecha: string;
  monto: number;
  account_id?: number | null;
  metodo?: "efectivo" | "transferencia" | "tarjeta" | "otro";
  referencia?: string;
  notas?: string;
};

/** Generado desde el esquema Zod `ReceivableQuery`. */
export type ReceivableQuery = {
  page?: number;
  pageSize?: number;
  tipo?: "venta" | "compra";
  estado?: "pendiente" | "parcial" | "pagada" | "vencida";
  q?: string;
  desde?: string;
  hasta?: string;
};

/** Generado desde el esquema Zod `PaymentParams`. */
export type PaymentParams = {
  id: number;
  paymentId: number;
};

/** Generado desde el esquema Zod `AgingQuery`. */
export type AgingQuery = {
  desde?: string;
  hasta?: string;
};

/** Generado desde el esquema Zod `CarteraAlertQuery`. */
export type CarteraAlertQuery = {
  tipo?: "venta" | "compra";
  severidad?: "critica" | "alta" | "media" | "baja";
  incluir_resueltos?: boolean;
  q?: string;
};

/** Generado desde el esquema Zod `FollowupRequest`. */
export type FollowupRequest = {
  estado: "pendiente" | "recordado" | "promesa" | "escalado" | "resuelto";
  nota?: string | null;
  proximo_contacto?: string | null;
};

/** Generado desde el esquema Zod `CreateAdjustmentRequest`. */
export type CreateAdjustmentRequest = {
  tipo: "credito" | "debito";
  fecha: string;
  motivo?: string;
  afecta_stock?: boolean;
  items: {
  invoice_item_id: number;
  cantidad: number;
  precio_unitario?: number;
  descuento_pct?: number;
  impuesto_pct?: number;
}[];
};

/** Generado desde el esquema Zod `AdjustmentParams`. */
export type AdjustmentParams = {
  id: number;
  adjustmentId: number;
};

/** Generado desde el esquema Zod `CreateThirdPartyRequest`. */
export type CreateThirdPartyRequest = {
  tipo?: "cliente" | "proveedor" | "ambos";
  tipo_documento?: "NIT" | "CC" | "CE" | "PASAPORTE" | "OTRO";
  documento?: string | null;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  condicion_pago?: "contado" | "credito";
  dias_credito?: number;
  notas?: string | null;
  activo?: boolean;
};

/** Generado desde el esquema Zod `UpdateThirdPartyRequest`. */
export type UpdateThirdPartyRequest = {
  tipo?: "cliente" | "proveedor" | "ambos";
  tipo_documento?: "NIT" | "CC" | "CE" | "PASAPORTE" | "OTRO";
  documento?: string | null;
  nombre?: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  condicion_pago?: "contado" | "credito";
  dias_credito?: number;
  notas?: string | null;
  activo?: boolean;
};

/** Generado desde el esquema Zod `ListThirdPartiesQuery`. */
export type ListThirdPartiesQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  tipo?: "cliente" | "proveedor" | "ambos";
  activo?: number;
};

/** Generado desde el esquema Zod `CreateClosureRequest`. */
export type CreateClosureRequest = {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
};

/** Generado desde el esquema Zod `ReopenClosureRequest`. */
export type ReopenClosureRequest = {
  motivo: string;
};

/** Generado desde el esquema Zod `FiscalYearRequest`. */
export type FiscalYearRequest = {
  anio: AnioParam;
};

/** Generado desde el esquema Zod `FiscalYearParams`. */
export type FiscalYearParams = {
  anio: number;
};

/** Generado desde el esquema Zod `AuditQuery`. */
export type AuditQuery = {
  page?: number;
  pageSize?: number;
  entidad?: "budget" | "transaction" | "account" | "payment" | "period_closure" | "invoice_adjustment" | "bank_reconciliation" | "receivable_followup" | "company_settings" | "stock_movement";
  entidad_id?: number;
  accion?: string;
  user_id?: number;
  desde?: string;
  hasta?: string;
};

/** Generado desde el esquema Zod `CompanyRequest`. */
export type CompanyRequest = {
  nombre: string;
  eslogan?: string | null;
  nit?: string | null;
  regimen?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  celular?: string | null;
  email?: string | null;
  web?: string | null;
  logo_url?: string | null;
};

/** Generado desde el esquema Zod `ErrorResponse`. */
export type ErrorResponse = {
  message: string;
};

/** Generado desde el esquema Zod `ValidationErrorResponse`. */
export type ValidationErrorResponse = {
  message: string;
  errors: Record<string, unknown>[];
};

/** Cuerpo esperado por cada operación que acepta JSON. */
export interface ApiRequests {
  "POST /api/auth/login": LoginRequest;
  "PUT /api/auth/password": ChangePasswordRequest;
  "POST /api/users": CreateUserRequest;
  "PUT /api/users/{id}": UpdateUserRequest;
  "PATCH /api/users/{id}/activo": ActivoRequest;
  "POST /api/categories": CategoryRequest;
  "PUT /api/categories/{id}": CategoryRequest;
  "POST /api/products": CreateProductRequest;
  "PUT /api/products/{id}": UpdateProductRequest;
  "PATCH /api/products/{id}/activo": ActivoRequest;
  "POST /api/movements": CreateMovementRequest;
  "POST /api/quotes": QuoteRequest;
  "PUT /api/quotes/{id}": QuoteRequest;
  "POST /api/finance/accounts": AccountRequest;
  "PUT /api/finance/accounts/{id}": AccountRequest;
  "POST /api/finance/budgets": BudgetRequest;
  "PUT /api/finance/budgets/{id}": BudgetRequest;
  "POST /api/finance/transactions": TransactionRequest;
  "POST /api/finance/reconciliations": CreateReconciliationRequest;
  "PUT /api/finance/reconciliations/{id}": UpdateReconciliationRequest;
  "POST /api/finance/reconciliations/{id}/lines": ReconciliationLine;
  "PUT /api/finance/reconciliations/{id}/lines/{lineId}": ReconciliationLine;
  "POST /api/finance/reconciliations/{id}/lines/{lineId}/match": MatchLineRequest;
  "POST /api/finance/reconciliations/{id}/lines/{lineId}/ignore": IgnoreLineRequest;
  "POST /api/finance/reconciliations/{id}/reopen": ReopenReconciliationRequest;
  "PUT /api/invoices/cartera/alertas/{id}/seguimiento": FollowupRequest;
  "POST /api/invoices/{id}/payments": CreatePaymentRequest;
  "POST /api/invoices/{id}/notas": CreateAdjustmentRequest;
  "POST /api/invoices": InvoiceRequest;
  "PUT /api/invoices/{id}": UpdateInvoiceRequest;
  "POST /api/third-parties": CreateThirdPartyRequest;
  "PUT /api/third-parties/{id}": UpdateThirdPartyRequest;
  "POST /api/period-closures": CreateClosureRequest;
  "POST /api/period-closures/ejercicios": FiscalYearRequest;
  "POST /api/period-closures/{id}/reabrir": ReopenClosureRequest;
  "PUT /api/company": CompanyRequest;
}

export type ApiOperationId =
  | "getApiHealth"
  | "getApiAuthMe"
  | "postApiAuthLogin"
  | "putApiAuthPassword"
  | "getApiUsers"
  | "postApiUsers"
  | "putApiUsersId"
  | "patchApiUsersIdActivo"
  | "getApiCategories"
  | "postApiCategories"
  | "putApiCategoriesId"
  | "deleteApiCategoriesId"
  | "getApiProducts"
  | "postApiProducts"
  | "getApiProductsNextSku"
  | "putApiProductsId"
  | "patchApiProductsIdActivo"
  | "getApiMovements"
  | "postApiMovements"
  | "getApiDashboard"
  | "getApiQuotes"
  | "postApiQuotes"
  | "getApiQuotesId"
  | "putApiQuotesId"
  | "deleteApiQuotesId"
  | "postApiQuotesIdDuplicate"
  | "postApiQuotesIdSend"
  | "postApiQuotesIdApprove"
  | "postApiQuotesIdReject"
  | "getApiQuotesIdHistory"
  | "postApiQuotesIdDeliver"
  | "getApiFinanceAvailability"
  | "getApiFinanceAccounts"
  | "postApiFinanceAccounts"
  | "putApiFinanceAccountsId"
  | "deleteApiFinanceAccountsId"
  | "getApiFinanceCategories"
  | "getApiFinanceBudgets"
  | "postApiFinanceBudgets"
  | "getApiFinanceBudgetsId"
  | "putApiFinanceBudgetsId"
  | "deleteApiFinanceBudgetsId"
  | "postApiFinanceBudgetsIdActivate"
  | "postApiFinanceBudgetsIdClose"
  | "getApiFinanceTransactions"
  | "postApiFinanceTransactions"
  | "postApiFinanceTransactionsIdReverse"
  | "getApiFinanceReconciliations"
  | "postApiFinanceReconciliations"
  | "getApiFinanceReconciliationsId"
  | "putApiFinanceReconciliationsId"
  | "getApiFinanceReconciliationsIdSuggestions"
  | "postApiFinanceReconciliationsIdLines"
  | "putApiFinanceReconciliationsIdLinesLineId"
  | "deleteApiFinanceReconciliationsIdLinesLineId"
  | "postApiFinanceReconciliationsIdLinesLineIdMatch"
  | "postApiFinanceReconciliationsIdLinesLineIdUnmatch"
  | "postApiFinanceReconciliationsIdLinesLineIdIgnore"
  | "postApiFinanceReconciliationsIdClose"
  | "postApiFinanceReconciliationsIdReopen"
  | "getApiFinanceSuggestions"
  | "getApiFinanceSummary"
  | "getApiFinancePnl"
  | "getApiFinanceCashFlow"
  | "getApiFinanceBalance"
  | "getApiFinanceProfitability"
  | "getApiFinanceInventoryAnalytics"
  | "getApiFinanceQuotesFunnel"
  | "getApiFinanceTrends"
  | "getApiFinanceDataHealth"
  | "getApiInvoicesCartera"
  | "getApiInvoicesCarteraAging"
  | "getApiInvoicesCarteraAlertas"
  | "putApiInvoicesCarteraAlertasIdSeguimiento"
  | "getApiInvoicesIdPayments"
  | "postApiInvoicesIdPayments"
  | "postApiInvoicesIdPaymentsPaymentIdAnular"
  | "getApiInvoicesIdNotas"
  | "postApiInvoicesIdNotas"
  | "postApiInvoicesIdNotasAdjustmentIdAnular"
  | "getApiInvoices"
  | "postApiInvoices"
  | "getApiInvoicesId"
  | "putApiInvoicesId"
  | "deleteApiInvoicesId"
  | "postApiInvoicesIdConfirmar"
  | "postApiInvoicesIdAnular"
  | "getApiThirdParties"
  | "postApiThirdParties"
  | "getApiThirdPartiesId"
  | "putApiThirdPartiesId"
  | "deleteApiThirdPartiesId"
  | "getApiPeriodClosures"
  | "postApiPeriodClosures"
  | "getApiPeriodClosuresId"
  | "getApiPeriodClosuresEjerciciosAnioPreview"
  | "postApiPeriodClosuresEjercicios"
  | "postApiPeriodClosuresIdReabrir"
  | "getApiAudit"
  | "getApiCompany"
  | "putApiCompany";

/** Puntos de entrada de la API, con la misma ruta que publica el servidor. */
export const apiEndpoints = {
  "getApiHealth": { method: "GET", path: "/api/health" },
  "getApiAuthMe": { method: "GET", path: "/api/auth/me" },
  "postApiAuthLogin": { method: "POST", path: "/api/auth/login" },
  "putApiAuthPassword": { method: "PUT", path: "/api/auth/password" },
  "getApiUsers": { method: "GET", path: "/api/users" },
  "postApiUsers": { method: "POST", path: "/api/users" },
  "putApiUsersId": { method: "PUT", path: "/api/users/{id}" },
  "patchApiUsersIdActivo": { method: "PATCH", path: "/api/users/{id}/activo" },
  "getApiCategories": { method: "GET", path: "/api/categories" },
  "postApiCategories": { method: "POST", path: "/api/categories" },
  "putApiCategoriesId": { method: "PUT", path: "/api/categories/{id}" },
  "deleteApiCategoriesId": { method: "DELETE", path: "/api/categories/{id}" },
  "getApiProducts": { method: "GET", path: "/api/products" },
  "postApiProducts": { method: "POST", path: "/api/products" },
  "getApiProductsNextSku": { method: "GET", path: "/api/products/next-sku" },
  "putApiProductsId": { method: "PUT", path: "/api/products/{id}" },
  "patchApiProductsIdActivo": { method: "PATCH", path: "/api/products/{id}/activo" },
  "getApiMovements": { method: "GET", path: "/api/movements" },
  "postApiMovements": { method: "POST", path: "/api/movements" },
  "getApiDashboard": { method: "GET", path: "/api/dashboard" },
  "getApiQuotes": { method: "GET", path: "/api/quotes" },
  "postApiQuotes": { method: "POST", path: "/api/quotes" },
  "getApiQuotesId": { method: "GET", path: "/api/quotes/{id}" },
  "putApiQuotesId": { method: "PUT", path: "/api/quotes/{id}" },
  "deleteApiQuotesId": { method: "DELETE", path: "/api/quotes/{id}" },
  "postApiQuotesIdDuplicate": { method: "POST", path: "/api/quotes/{id}/duplicate" },
  "postApiQuotesIdSend": { method: "POST", path: "/api/quotes/{id}/send" },
  "postApiQuotesIdApprove": { method: "POST", path: "/api/quotes/{id}/approve" },
  "postApiQuotesIdReject": { method: "POST", path: "/api/quotes/{id}/reject" },
  "getApiQuotesIdHistory": { method: "GET", path: "/api/quotes/{id}/history" },
  "postApiQuotesIdDeliver": { method: "POST", path: "/api/quotes/{id}/deliver" },
  "getApiFinanceAvailability": { method: "GET", path: "/api/finance/availability" },
  "getApiFinanceAccounts": { method: "GET", path: "/api/finance/accounts" },
  "postApiFinanceAccounts": { method: "POST", path: "/api/finance/accounts" },
  "putApiFinanceAccountsId": { method: "PUT", path: "/api/finance/accounts/{id}" },
  "deleteApiFinanceAccountsId": { method: "DELETE", path: "/api/finance/accounts/{id}" },
  "getApiFinanceCategories": { method: "GET", path: "/api/finance/categories" },
  "getApiFinanceBudgets": { method: "GET", path: "/api/finance/budgets" },
  "postApiFinanceBudgets": { method: "POST", path: "/api/finance/budgets" },
  "getApiFinanceBudgetsId": { method: "GET", path: "/api/finance/budgets/{id}" },
  "putApiFinanceBudgetsId": { method: "PUT", path: "/api/finance/budgets/{id}" },
  "deleteApiFinanceBudgetsId": { method: "DELETE", path: "/api/finance/budgets/{id}" },
  "postApiFinanceBudgetsIdActivate": { method: "POST", path: "/api/finance/budgets/{id}/activate" },
  "postApiFinanceBudgetsIdClose": { method: "POST", path: "/api/finance/budgets/{id}/close" },
  "getApiFinanceTransactions": { method: "GET", path: "/api/finance/transactions" },
  "postApiFinanceTransactions": { method: "POST", path: "/api/finance/transactions" },
  "postApiFinanceTransactionsIdReverse": { method: "POST", path: "/api/finance/transactions/{id}/reverse" },
  "getApiFinanceReconciliations": { method: "GET", path: "/api/finance/reconciliations" },
  "postApiFinanceReconciliations": { method: "POST", path: "/api/finance/reconciliations" },
  "getApiFinanceReconciliationsId": { method: "GET", path: "/api/finance/reconciliations/{id}" },
  "putApiFinanceReconciliationsId": { method: "PUT", path: "/api/finance/reconciliations/{id}" },
  "getApiFinanceReconciliationsIdSuggestions": { method: "GET", path: "/api/finance/reconciliations/{id}/suggestions" },
  "postApiFinanceReconciliationsIdLines": { method: "POST", path: "/api/finance/reconciliations/{id}/lines" },
  "putApiFinanceReconciliationsIdLinesLineId": { method: "PUT", path: "/api/finance/reconciliations/{id}/lines/{lineId}" },
  "deleteApiFinanceReconciliationsIdLinesLineId": { method: "DELETE", path: "/api/finance/reconciliations/{id}/lines/{lineId}" },
  "postApiFinanceReconciliationsIdLinesLineIdMatch": { method: "POST", path: "/api/finance/reconciliations/{id}/lines/{lineId}/match" },
  "postApiFinanceReconciliationsIdLinesLineIdUnmatch": { method: "POST", path: "/api/finance/reconciliations/{id}/lines/{lineId}/unmatch" },
  "postApiFinanceReconciliationsIdLinesLineIdIgnore": { method: "POST", path: "/api/finance/reconciliations/{id}/lines/{lineId}/ignore" },
  "postApiFinanceReconciliationsIdClose": { method: "POST", path: "/api/finance/reconciliations/{id}/close" },
  "postApiFinanceReconciliationsIdReopen": { method: "POST", path: "/api/finance/reconciliations/{id}/reopen" },
  "getApiFinanceSuggestions": { method: "GET", path: "/api/finance/suggestions" },
  "getApiFinanceSummary": { method: "GET", path: "/api/finance/summary" },
  "getApiFinancePnl": { method: "GET", path: "/api/finance/pnl" },
  "getApiFinanceCashFlow": { method: "GET", path: "/api/finance/cash-flow" },
  "getApiFinanceBalance": { method: "GET", path: "/api/finance/balance" },
  "getApiFinanceProfitability": { method: "GET", path: "/api/finance/profitability" },
  "getApiFinanceInventoryAnalytics": { method: "GET", path: "/api/finance/inventory-analytics" },
  "getApiFinanceQuotesFunnel": { method: "GET", path: "/api/finance/quotes-funnel" },
  "getApiFinanceTrends": { method: "GET", path: "/api/finance/trends" },
  "getApiFinanceDataHealth": { method: "GET", path: "/api/finance/data-health" },
  "getApiInvoicesCartera": { method: "GET", path: "/api/invoices/cartera" },
  "getApiInvoicesCarteraAging": { method: "GET", path: "/api/invoices/cartera/aging" },
  "getApiInvoicesCarteraAlertas": { method: "GET", path: "/api/invoices/cartera/alertas" },
  "putApiInvoicesCarteraAlertasIdSeguimiento": { method: "PUT", path: "/api/invoices/cartera/alertas/{id}/seguimiento" },
  "getApiInvoicesIdPayments": { method: "GET", path: "/api/invoices/{id}/payments" },
  "postApiInvoicesIdPayments": { method: "POST", path: "/api/invoices/{id}/payments" },
  "postApiInvoicesIdPaymentsPaymentIdAnular": { method: "POST", path: "/api/invoices/{id}/payments/{paymentId}/anular" },
  "getApiInvoicesIdNotas": { method: "GET", path: "/api/invoices/{id}/notas" },
  "postApiInvoicesIdNotas": { method: "POST", path: "/api/invoices/{id}/notas" },
  "postApiInvoicesIdNotasAdjustmentIdAnular": { method: "POST", path: "/api/invoices/{id}/notas/{adjustmentId}/anular" },
  "getApiInvoices": { method: "GET", path: "/api/invoices" },
  "postApiInvoices": { method: "POST", path: "/api/invoices" },
  "getApiInvoicesId": { method: "GET", path: "/api/invoices/{id}" },
  "putApiInvoicesId": { method: "PUT", path: "/api/invoices/{id}" },
  "deleteApiInvoicesId": { method: "DELETE", path: "/api/invoices/{id}" },
  "postApiInvoicesIdConfirmar": { method: "POST", path: "/api/invoices/{id}/confirmar" },
  "postApiInvoicesIdAnular": { method: "POST", path: "/api/invoices/{id}/anular" },
  "getApiThirdParties": { method: "GET", path: "/api/third-parties" },
  "postApiThirdParties": { method: "POST", path: "/api/third-parties" },
  "getApiThirdPartiesId": { method: "GET", path: "/api/third-parties/{id}" },
  "putApiThirdPartiesId": { method: "PUT", path: "/api/third-parties/{id}" },
  "deleteApiThirdPartiesId": { method: "DELETE", path: "/api/third-parties/{id}" },
  "getApiPeriodClosures": { method: "GET", path: "/api/period-closures" },
  "postApiPeriodClosures": { method: "POST", path: "/api/period-closures" },
  "getApiPeriodClosuresId": { method: "GET", path: "/api/period-closures/{id}" },
  "getApiPeriodClosuresEjerciciosAnioPreview": { method: "GET", path: "/api/period-closures/ejercicios/{anio}/preview" },
  "postApiPeriodClosuresEjercicios": { method: "POST", path: "/api/period-closures/ejercicios" },
  "postApiPeriodClosuresIdReabrir": { method: "POST", path: "/api/period-closures/{id}/reabrir" },
  "getApiAudit": { method: "GET", path: "/api/audit" },
  "getApiCompany": { method: "GET", path: "/api/company" },
  "putApiCompany": { method: "PUT", path: "/api/company" },
} as const;
