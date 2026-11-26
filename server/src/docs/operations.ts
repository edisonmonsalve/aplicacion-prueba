export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface OperationMeta {
  summary: string;
  tag: string;
  /** `public` omite el candado; `auth` (por defecto) solo exige token. */
  roles?: "public" | "auth" | string[];
  body?: string;
  query?: string;
  /** Esquema de la respuesta correcta, cuando el handler tiene una forma verificable. */
  response?: string;
  /** Parámetros de ruta con un esquema distinto al entero positivo por defecto. */
  params?: Record<string, string>;
  status?: number;
  description?: string;
}

type Entry = [tag: string, summary: string, extra?: Omit<OperationMeta, "tag" | "summary">];

const READ = ["admin", "contador", "consulta"];
const WRITE = ["admin", "contador"];
// Inventario y cotizaciones: el contador consulta, pero no opera.
const OPERATE = ["admin", "operador"];
// Facturación: el contador sí crea, confirma y anula.
const INVOICE_WRITE = ["admin", "contador", "operador"];
const ADMIN = ["admin"];
// Los precios de compra y sus variaciones son visibles solo para admin/contador.
const PURCHASE_READ = ["admin", "contador"];
const ALL_ROLES = ["admin", "contador", "operador", "consulta"];

const SESSION = "Sesión";
const USERS = "Usuarios";
const CATALOG = "Catálogos e inventario";
const QUOTES = "Cotizaciones";
const FINANCE = "Finanzas";
const INVOICES = "Facturación y cartera";
const PURCHASE_PRICES = "Precios de compra";
const PARTIES = "Terceros";
const CLOSURES = "Cierres fiscales";
const AUDIT = "Auditoría";
const COMPANY = "Empresa";
const OPS = "Operación";

/**
 * Metadata declarativa de cada operación. Las rutas NO se enumeran aquí: se leen
 * del router de Express, de modo que añadir o quitar una ruta actualiza la spec.
 * Esta tabla solo enriquece las operaciones existentes.
 */
const entries: Record<string, Entry> = {
  "GET /api/health": [
    SESSION,
    "Estado del servidor y la conexión a la base",
    { roles: "public", response: "HealthResponse" },
  ],
  "GET /api/metrics": [
    OPS,
    "Métricas de uso, errores y latencia desde el arranque",
    { roles: ADMIN },
  ],
  "POST /api/auth/login": [
    SESSION,
    "Iniciar sesión y obtener un token JWT",
    { roles: "public", body: "LoginRequest", response: "LoginResponse" },
  ],
  "POST /api/auth/refresh": [
    SESSION,
    "Renovar el token de acceso con un refresh token",
    { roles: "public", body: "RefreshTokenRequest", response: "LoginResponse" },
  ],
  "POST /api/auth/logout": [
    SESSION,
    "Cerrar la sesión y revocar el refresh token",
    { roles: "public", body: "RefreshTokenRequest", status: 204 },
  ],
  "GET /api/auth/me": [
    SESSION,
    "Datos del usuario de la sesión",
    { response: "AuthUserResponse" },
  ],
  "PUT /api/auth/password": [
    SESSION,
    "Cambiar la contraseña del usuario actual",
    { body: "ChangePasswordRequest", response: "MessageResponse" },
  ],

  "GET /api/users": [USERS, "Listar usuarios", { roles: ADMIN, query: "ListUsersQuery" }],
  "POST /api/users": [
    USERS,
    "Crear un usuario",
    { roles: ADMIN, body: "CreateUserRequest", status: 201, response: "IdResponse" },
  ],
  "PUT /api/users/{id}": [
    USERS,
    "Editar un usuario",
    { roles: ADMIN, body: "UpdateUserRequest", response: "MessageResponse" },
  ],
  "PATCH /api/users/{id}/activo": [
    USERS,
    "Activar o desactivar un usuario",
    { roles: ADMIN, body: "ActivoRequest", response: "MessageResponse" },
  ],

  "GET /api/categories": [CATALOG, "Listar categorías con su número de productos"],
  "POST /api/categories": [
    CATALOG,
    "Crear una categoría",
    { roles: ADMIN, body: "CategoryRequest", status: 201, response: "IdResponse" },
  ],
  "PUT /api/categories/{id}": [
    CATALOG,
    "Editar una categoría",
    { roles: ADMIN, body: "CategoryRequest", response: "MessageResponse" },
  ],
  "DELETE /api/categories/{id}": [
    CATALOG,
    "Eliminar una categoría",
    { roles: ADMIN, response: "MessageResponse" },
  ],

  "GET /api/products": [CATALOG, "Listar productos", { query: "ListProductsQuery" }],
  "GET /api/products/next-sku": [
    CATALOG,
    "Sugerir el siguiente SKU de una categoría",
    { query: "NextSkuQuery", response: "SkuResponse" },
  ],
  "POST /api/products": [
    CATALOG,
    "Crear un producto",
    { roles: OPERATE, body: "CreateProductRequest", status: 201, response: "IdResponse" },
  ],
  "PUT /api/products/{id}": [
    CATALOG,
    "Editar un producto",
    { roles: OPERATE, body: "UpdateProductRequest", response: "MessageResponse" },
  ],
  "PATCH /api/products/{id}/activo": [
    CATALOG,
    "Activar o desactivar un producto",
    { roles: ADMIN, body: "ActivoRequest", response: "MessageResponse" },
  ],

  "GET /api/movements": [
    CATALOG,
    "Historial de movimientos de stock",
    { query: "ListMovementsQuery" },
  ],
  "POST /api/movements": [
    CATALOG,
    "Registrar una entrada o salida de stock",
    { roles: OPERATE, body: "CreateMovementRequest", status: 201, response: "IdStockResponse" },
  ],

  "GET /api/dashboard": [CATALOG, "Métricas-resumen del inicio"],

  "GET /api/quotes": [
    QUOTES,
    "Listar cotizaciones",
    { query: "ListQuotesQuery" },
  ],
  "GET /api/quotes/{id}": [QUOTES, "Detalle de una cotización con sus líneas"],
  "POST /api/quotes": [
    QUOTES,
    "Crear un borrador de cotización",
    { roles: OPERATE, body: "QuoteRequest", status: 201 },
  ],
  "POST /api/quotes/{id}/duplicate": [
    QUOTES,
    "Duplicar una cotización como borrador nuevo",
    { roles: OPERATE },
  ],
  "PUT /api/quotes/{id}": [
    QUOTES,
    "Editar un borrador de cotización",
    {
      roles: OPERATE,
      body: "QuoteRequest",
      description: "Solo el creador del borrador o un administrador.",
    },
  ],
  "DELETE /api/quotes/{id}": [
    QUOTES,
    "Eliminar un borrador de cotización",
    {
      roles: OPERATE,
      description: "Solo el creador del borrador o un administrador.",
    },
  ],
  "POST /api/quotes/{id}/send": [QUOTES, "Enviar una cotización al cliente", { roles: OPERATE }],
  "POST /api/quotes/{id}/approve": [
    QUOTES,
    "Aprobar una cotización enviada",
    { roles: OPERATE },
  ],
  "POST /api/quotes/{id}/reject": [
    QUOTES,
    "Rechazar una cotización enviada",
    { roles: OPERATE },
  ],
  "GET /api/quotes/{id}/history": [QUOTES, "Historial de cambios de estado"],
  "POST /api/quotes/{id}/deliver": [
    QUOTES,
    "Marcar la entrega de almacén (endpoint conservado por compatibilidad)",
    { roles: OPERATE },
  ],

  "GET /api/finance/availability": [
    FINANCE,
    "Disponibilidad de un producto para presupuestar",
    { roles: READ, query: "AvailabilityQuery" },
  ],
  "GET /api/finance/accounts": [FINANCE, "Listar cuentas de caja y banco", { roles: READ }],
  "POST /api/finance/accounts": [
    FINANCE,
    "Crear una cuenta",
    { roles: WRITE, body: "AccountRequest", status: 201 },
  ],
  "PUT /api/finance/accounts/{id}": [
    FINANCE,
    "Editar una cuenta",
    { roles: WRITE, body: "AccountRequest" },
  ],
  "DELETE /api/finance/accounts/{id}": [FINANCE, "Eliminar una cuenta", { roles: WRITE }],
  "GET /api/finance/categories": [FINANCE, "Listar categorías financieras", { roles: READ }],
  "GET /api/finance/budgets": [
    FINANCE,
    "Listar presupuestos",
    { roles: READ, query: "ListBudgetsQuery" },
  ],
  "GET /api/finance/budgets/{id}": [FINANCE, "Detalle de un presupuesto", { roles: READ }],
  "POST /api/finance/budgets": [
    FINANCE,
    "Crear un presupuesto",
    { roles: WRITE, body: "BudgetRequest", status: 201 },
  ],
  "PUT /api/finance/budgets/{id}": [
    FINANCE,
    "Editar un presupuesto",
    { roles: WRITE, body: "BudgetRequest" },
  ],
  "DELETE /api/finance/budgets/{id}": [FINANCE, "Eliminar un presupuesto", { roles: WRITE }],
  "POST /api/finance/budgets/{id}/activate": [
    FINANCE,
    "Activar un presupuesto",
    { roles: WRITE },
  ],
  "POST /api/finance/budgets/{id}/close": [FINANCE, "Cerrar un presupuesto", { roles: WRITE }],
  "GET /api/finance/transactions": [
    FINANCE,
    "Listar asientos contables",
    { roles: READ, query: "ListTransactionsQuery" },
  ],
  "POST /api/finance/transactions": [
    FINANCE,
    "Registrar un asiento contable",
    { roles: WRITE, body: "TransactionRequest", status: 201 },
  ],
  "POST /api/finance/transactions/{id}/reverse": [
    FINANCE,
    "Anular un asiento con contrapartida",
    { roles: WRITE },
  ],
  "GET /api/finance/reconciliations": [
    FINANCE,
    "Listar conciliaciones bancarias",
    { roles: READ, query: "ListReconciliationsQuery" },
  ],
  "POST /api/finance/reconciliations": [
    FINANCE,
    "Crear una conciliación",
    { roles: WRITE, body: "CreateReconciliationRequest", status: 201 },
  ],
  "GET /api/finance/reconciliations/{id}": [
    FINANCE,
    "Detalle de una conciliación",
    { roles: READ },
  ],
  "PUT /api/finance/reconciliations/{id}": [
    FINANCE,
    "Editar el encabezado de una conciliación",
    { roles: WRITE, body: "UpdateReconciliationRequest" },
  ],
  "GET /api/finance/reconciliations/{id}/suggestions": [
    FINANCE,
    "Sugerencias de cruce con asientos",
    { roles: READ, query: "ListSuggestionsQuery" },
  ],
  "POST /api/finance/reconciliations/{id}/lines": [
    FINANCE,
    "Añadir una línea del extracto",
    { roles: WRITE, body: "ReconciliationLine", status: 201 },
  ],
  "PUT /api/finance/reconciliations/{id}/lines/{lineId}": [
    FINANCE,
    "Editar una línea del extracto",
    { roles: WRITE, body: "ReconciliationLine" },
  ],
  "DELETE /api/finance/reconciliations/{id}/lines/{lineId}": [
    FINANCE,
    "Eliminar una línea del extracto",
    { roles: WRITE },
  ],
  "POST /api/finance/reconciliations/{id}/lines/{lineId}/match": [
    FINANCE,
    "Cruzar una línea con un asiento",
    { roles: WRITE, body: "MatchLineRequest" },
  ],
  "POST /api/finance/reconciliations/{id}/lines/{lineId}/unmatch": [
    FINANCE,
    "Descruzar una línea del extracto",
    { roles: WRITE },
  ],
  "POST /api/finance/reconciliations/{id}/lines/{lineId}/ignore": [
    FINANCE,
    "Ignorar una línea del extracto",
    { roles: WRITE, body: "IgnoreLineRequest" },
  ],
  "POST /api/finance/reconciliations/{id}/close": [
    FINANCE,
    "Cerrar una conciliación",
    { roles: WRITE },
  ],
  "POST /api/finance/reconciliations/{id}/reopen": [
    FINANCE,
    "Reabrir una conciliación",
    { roles: WRITE, body: "ReopenReconciliationRequest" },
  ],
  "GET /api/finance/suggestions": [FINANCE, "Sugerencias globales de conciliación", { roles: READ }],
  "GET /api/finance/summary": [
    FINANCE,
    "Resumen de ingresos, gastos y resultado",
    { roles: READ, query: "SummaryQuery" },
  ],
  "GET /api/finance/pnl": [
    FINANCE,
    "Estado de resultados",
    { roles: READ, query: "SummaryQuery" },
  ],
  "GET /api/finance/cash-flow": [
    FINANCE,
    "Flujo de caja por cuenta",
    { roles: READ, query: "CashFlowQuery" },
  ],
  "GET /api/finance/balance": [
    FINANCE,
    "Balance general a una fecha",
    { roles: READ, query: "BalanceQuery" },
  ],
  "GET /api/finance/profitability": [
    FINANCE,
    "Rentabilidad por producto, categoría o cliente",
    { roles: READ, query: "ProfitabilityQuery" },
  ],
  "GET /api/finance/inventory-analytics": [
    FINANCE,
    "Rotación y días muertos de inventario",
    { roles: READ, query: "InventoryAnalyticsQuery" },
  ],
  "GET /api/finance/quotes-funnel": [
    FINANCE,
    "Embudo de cotizaciones",
    { roles: READ, query: "SummaryQuery" },
  ],
  "GET /api/finance/trends": [
    FINANCE,
    "Tendencias mensuales",
    { roles: READ, query: "TrendsQuery" },
  ],
  "GET /api/finance/data-health": [FINANCE, "Salud e integridad de los datos", { roles: READ }],

  "GET /api/invoices/cartera": [
    INVOICES,
    "Cartera paginada de facturas",
    { roles: READ, query: "ReceivableQuery" },
  ],
  "GET /api/invoices/cartera/aging": [
    INVOICES,
    "Envejecimiento de saldos por tramo",
    { roles: READ, query: "AgingQuery" },
  ],
  "GET /api/invoices/cartera/alertas": [
    INVOICES,
    "Alertas de cobro y pago",
    { roles: READ, query: "CarteraAlertQuery" },
  ],
  "PUT /api/invoices/cartera/alertas/{id}/seguimiento": [
    INVOICES,
    "Guardar el seguimiento de una alerta",
    { roles: WRITE, body: "FollowupRequest" },
  ],
  "GET /api/invoices/{id}/payments": [INVOICES, "Cobros y pagos de una factura"],
  "POST /api/invoices/{id}/payments": [
    INVOICES,
    "Registrar un cobro o pago",
    { roles: WRITE, body: "CreatePaymentRequest", status: 201 },
  ],
  "POST /api/invoices/{id}/payments/{paymentId}/anular": [
    INVOICES,
    "Anular un cobro o pago",
    { roles: WRITE, params: { paymentId: "IdParam" } },
  ],
  "GET /api/invoices/{id}/notas": [INVOICES, "Notas crédito y débito de una factura"],
  "POST /api/invoices/{id}/notas": [
    INVOICES,
    "Crear una nota crédito o débito",
    { roles: WRITE, body: "CreateAdjustmentRequest", status: 201 },
  ],
  "POST /api/invoices/{id}/notas/{adjustmentId}/anular": [
    INVOICES,
    "Anular una nota crédito o débito",
    { roles: WRITE, params: { adjustmentId: "IdParam" } },
  ],
  "GET /api/invoices": [
    INVOICES,
    "Listar facturas",
    { query: "ListInvoicesQuery" },
  ],
  "GET /api/invoices/{id}": [INVOICES, "Detalle de una factura"],
  "POST /api/invoices": [
    INVOICES,
    "Crear un borrador de factura",
    { roles: INVOICE_WRITE, body: "InvoiceRequest", status: 201 },
  ],
  "PUT /api/invoices/{id}": [
    INVOICES,
    "Editar un borrador de factura",
    { roles: INVOICE_WRITE, body: "UpdateInvoiceRequest" },
  ],
  "POST /api/invoices/{id}/confirmar": [
    INVOICES,
    "Confirmar una factura: mueve stock, contabiliza y marca la cotización como entregada",
    { roles: INVOICE_WRITE },
  ],
  "POST /api/invoices/{id}/anular": [
    INVOICES,
    "Anular una factura con sus contrapartidas",
    { roles: INVOICE_WRITE },
  ],
  "DELETE /api/invoices/{id}": [
    INVOICES,
    "Eliminar un borrador de factura",
    { roles: INVOICE_WRITE },
  ],

  "GET /api/invoices/{id}/validacion-compra": [
    PURCHASE_PRICES,
    "Validación de compra antes de confirmar (el operador no ve precios)",
    { roles: ALL_ROLES, response: "PurchaseValidationResponse" },
  ],
  "POST /api/invoices/{id}/solicitar-aprobacion": [
    PURCHASE_PRICES,
    "Solicitar aprobación por variación de precios",
    { roles: INVOICE_WRITE, status: 201, response: "PurchaseApprovalResponse" },
  ],
  "GET /api/invoices/{id}/aprobacion": [
    PURCHASE_PRICES,
    "Estado de la aprobación de precios de una factura",
    { roles: ALL_ROLES, response: "ApprovalLookupResponse" },
  ],
  "POST /api/invoices/{id}/adjuntos": [
    PURCHASE_PRICES,
    "Subir un adjunto PDF/XML validado (máximo 5 MB)",
    { roles: INVOICE_WRITE, body: "PurchaseAttachmentRequest", status: 201, response: "AttachmentResponse" },
  ],
  "GET /api/invoices/{id}/adjuntos": [
    PURCHASE_PRICES,
    "Listar metadatos de los adjuntos de una factura",
    { roles: ALL_ROLES, response: "AttachmentListResponse" },
  ],
  "DELETE /api/invoices/{id}/adjuntos/{adjuntoId}": [
    PURCHASE_PRICES,
    "Eliminar un adjunto de una factura en borrador",
    { roles: INVOICE_WRITE, params: { adjuntoId: "IdParam" }, response: "IdResponse" },
  ],
  "GET /api/purchase-prices/settings": [
    PURCHASE_PRICES,
    "Consultar el umbral de variación y la obligatoriedad de adjunto",
    { roles: ALL_ROLES, response: "PurchaseSettingsResponse" },
  ],
  "PUT /api/purchase-prices/settings": [
    PURCHASE_PRICES,
    "Actualizar la configuración de control de precios",
    {
      roles: PURCHASE_READ,
      body: "PurchaseSettingsRequest",
      response: "PurchaseSettingsResponse",
    },
  ],
  "GET /api/purchase-prices/last": [
    PURCHASE_PRICES,
    "Consultar el último precio por producto y proveedor",
    { roles: PURCHASE_READ, query: "LastPriceQuery", response: "LastPriceResponse" },
  ],
  "GET /api/purchase-prices/history": [
    PURCHASE_PRICES,
    "Consultar el historial de precios de compra",
    { roles: PURCHASE_READ, query: "PriceHistoryQuery", response: "PriceHistoryResponse" },
  ],
  "POST /api/purchase-prices/approvals/{id}/aprobar": [
    PURCHASE_PRICES,
    "Aprobar una solicitud de variación de precios",
    { roles: PURCHASE_READ, body: "ApprovalDecisionRequest", response: "PurchaseApprovalResponse" },
  ],
  "POST /api/purchase-prices/approvals/{id}/rechazar": [
    PURCHASE_PRICES,
    "Rechazar una solicitud de variación de precios",
    { roles: PURCHASE_READ, body: "ApprovalDecisionRequest", response: "PurchaseApprovalResponse" },
  ],

  "GET /api/third-parties": [
    PARTIES,
    "Listar terceros",
    { query: "ListThirdPartiesQuery" },
  ],
  "GET /api/third-parties/{id}": [PARTIES, "Detalle de un tercero"],
  "POST /api/third-parties": [
    PARTIES,
    "Crear un tercero",
    { roles: WRITE, body: "CreateThirdPartyRequest", status: 201, response: "IdResponse" },
  ],
  "PUT /api/third-parties/{id}": [
    PARTIES,
    "Editar un tercero",
    { roles: WRITE, body: "UpdateThirdPartyRequest" },
  ],
  "DELETE /api/third-parties/{id}": [PARTIES, "Eliminar un tercero", { roles: WRITE }],

  "GET /api/period-closures": [CLOSURES, "Listar cierres de periodo", { roles: READ }],
  "GET /api/period-closures/{id}": [CLOSURES, "Detalle de un cierre", { roles: READ }],
  "POST /api/period-closures": [
    CLOSURES,
    "Crear un cierre de periodo",
    { roles: WRITE, body: "CreateClosureRequest", status: 201 },
  ],
  "GET /api/period-closures/ejercicios/{anio}/preview": [
    CLOSURES,
    "Vista previa del cierre de un ejercicio",
    { roles: READ, params: { anio: "AnioParam" } },
  ],
  "POST /api/period-closures/ejercicios": [
    CLOSURES,
    "Cerrar un ejercicio fiscal",
    { roles: WRITE, body: "FiscalYearRequest", status: 201 },
  ],
  "POST /api/period-closures/{id}/reabrir": [
    CLOSURES,
    "Reabrir un cierre",
    { roles: WRITE, body: "ReopenClosureRequest" },
  ],

  "GET /api/audit": [
    AUDIT,
    "Consultar la bitácora de auditoría",
    { roles: READ, query: "AuditQuery" },
  ],

  "GET /api/company": [COMPANY, "Datos del emisor"],
  "PUT /api/company": [
    COMPANY,
    "Actualizar la identidad del emisor",
    { roles: ADMIN, body: "CompanyRequest" },
  ],
};

export const operationMeta: Readonly<Record<string, OperationMeta>> = Object.fromEntries(
  Object.entries(entries).map(([key, [tag, summary, extra]]) => [
    key,
    { tag, summary, ...extra },
  ])
);
