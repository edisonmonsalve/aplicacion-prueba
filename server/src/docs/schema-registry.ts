import { z } from "zod";
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
} from "../modules/auth/auth.service.js";
import * as users from "../modules/users/users.schema.js";
import { categorySchema } from "../modules/categories/categories.service.js";
import * as products from "../modules/products/products.schema.js";
import * as movements from "../modules/movements/movements.schema.js";
import * as quotes from "../modules/quotes/quotes.schema.js";
import * as finance from "../modules/finance/finance.schema.js";
import * as reconciliations from "../modules/finance/reconciliations.schema.js";
import * as invoices from "../modules/invoices/invoices.schema.js";
import * as payments from "../modules/invoices/invoice-payments.schema.js";
import * as adjustments from "../modules/invoices/invoice-adjustments.schema.js";
import * as purchasePrices from "../modules/purchase-prices/purchase-prices.schema.js";
import * as thirdParties from "../modules/third-parties/third-parties.schema.js";
import * as closures from "../modules/period-closures/period-closures.schema.js";
import { auditQuerySchema } from "../modules/audit/audit.schema.js";
import { companySchema } from "../modules/company/company.service.js";
import { ROLES } from "../types/roles.js";

type NamedSchema = [name: string, schema: z.ZodType];

const authUserSchema = z.object({
  id: finance.idSchema,
  nombre: z.string(),
  email: z.string().email(),
  rol: z.enum(ROLES),
});

/**
 * Esquemas Zod ya usados por los handlers. Se registran con un nombre para que
 * `z.toJSONSchema` emita `$ref` entre componentes en lugar de duplicarlos.
 * No hay validaciones nuevas: la spec y el runtime comparten la misma fuente.
 */
const namedSchemas: NamedSchema[] = [
  ["IdParam", finance.idSchema],
  ["AnioParam", closures.fiscalYearSchema.shape.anio],

  ["LoginRequest", loginSchema],
  ["RefreshTokenRequest", refreshTokenSchema],
  ["ChangePasswordRequest", changePasswordSchema],

  ["CreateUserRequest", users.createUserSchema],
  ["UpdateUserRequest", users.updateUserSchema],
  ["ListUsersQuery", users.listQuerySchema],
  ["ActivoRequest", users.activoSchema],

  ["CategoryRequest", categorySchema],

  ["CreateProductRequest", products.createProductSchema],
  ["UpdateProductRequest", products.updateProductSchema],
  ["ListProductsQuery", products.listQuerySchema],
  ["NextSkuQuery", products.nextSkuQuerySchema],

  ["CreateMovementRequest", movements.createMovementSchema],
  ["ListMovementsQuery", movements.listQuerySchema],

  ["QuoteRequest", quotes.quoteSchema],
  ["ListQuotesQuery", quotes.listQuerySchema],

  ["AvailabilityQuery", z.object({ product_id: finance.idSchema })],
  ["AccountRequest", finance.accountSchema],
  ["BudgetLine", finance.budgetLineSchema],
  ["BudgetRequest", finance.budgetSchema],
  ["ListBudgetsQuery", finance.listBudgetsQuerySchema],
  ["TransactionRequest", finance.transactionSchema],
  ["ListTransactionsQuery", finance.listTransactionsQuerySchema],
  ["SummaryQuery", finance.summaryQuerySchema],
  ["CashFlowQuery", finance.cashFlowQuerySchema],
  ["BalanceQuery", finance.balanceQuerySchema],
  ["ProfitabilityQuery", finance.profitabilityQuerySchema],
  ["InventoryAnalyticsQuery", finance.inventoryAnalyticsQuerySchema],
  ["TrendsQuery", finance.trendsQuerySchema],

  ["ReconciliationLine", reconciliations.statementLineSchema],
  ["CreateReconciliationRequest", reconciliations.createReconciliationSchema],
  ["UpdateReconciliationRequest", reconciliations.updateReconciliationSchema],
  ["ListReconciliationsQuery", reconciliations.listReconciliationsQuerySchema],
  ["ListSuggestionsQuery", reconciliations.listSuggestionsQuerySchema],
  ["MatchLineRequest", reconciliations.matchLineSchema],
  ["IgnoreLineRequest", reconciliations.ignoreLineSchema],
  ["ReopenReconciliationRequest", reconciliations.reopenReconciliationSchema],

  ["InvoiceRequest", invoices.createInvoiceSchema],
  ["UpdateInvoiceRequest", invoices.updateInvoiceSchema],
  ["ListInvoicesQuery", invoices.listQuerySchema],
  ["CreatePaymentRequest", payments.createPaymentSchema],
  ["ReceivableQuery", payments.receivableQuerySchema],
  ["PaymentParams", payments.paymentParamsSchema],
  ["AgingQuery", payments.agingQuerySchema],
  ["CarteraAlertQuery", payments.carteraAlertQuerySchema],
  ["FollowupRequest", payments.followupSchema],
  ["CreateAdjustmentRequest", adjustments.createAdjustmentSchema],
  ["AdjustmentParams", adjustments.adjustmentParamsSchema],

  ["PurchaseSettingsRequest", purchasePrices.purchaseSettingsSchema],
  ["PurchaseSettingsResponse", purchasePrices.purchaseSettingsResponseSchema],
  ["LastPriceQuery", purchasePrices.lastPriceQuerySchema],
  ["PriceHistoryQuery", purchasePrices.priceHistoryQuerySchema],
  ["PurchaseAttachmentRequest", purchasePrices.attachmentSchema],
  ["AttachmentParams", purchasePrices.attachmentParamsSchema],
  ["ApprovalDecisionRequest", purchasePrices.approvalDecisionSchema],
  ["PurchaseApprovalResponse", purchasePrices.approvalResponseSchema],
  ["ApprovalLookupResponse", purchasePrices.approvalLookupResponseSchema],
  ["PurchaseValidationResponse", purchasePrices.purchaseValidationResponseSchema],
  ["LastPriceResponse", purchasePrices.lastPriceResponseSchema],
  ["PriceHistoryResponse", purchasePrices.priceHistoryResponseSchema],
  ["AttachmentResponse", purchasePrices.attachmentResponseSchema],
  ["AttachmentListResponse", purchasePrices.attachmentListResponseSchema],

  ["CreateThirdPartyRequest", thirdParties.createThirdPartySchema],
  ["UpdateThirdPartyRequest", thirdParties.updateThirdPartySchema],
  ["ListThirdPartiesQuery", thirdParties.listThirdPartiesQuerySchema],

  ["CreateClosureRequest", closures.createClosureSchema],
  ["ReopenClosureRequest", closures.reopenClosureSchema],
  ["FiscalYearRequest", closures.fiscalYearSchema],
  ["FiscalYearParams", closures.fiscalYearQuerySchema],

  ["AuditQuery", auditQuerySchema],
  ["CompanyRequest", companySchema],

  // Respuestas verificadas en los handlers; el cliente las obtiene como tipos TS.
  ["HealthResponse", z.object({
    status: z.literal("ok"),
    uptime_seconds: z.number(),
    db: z.object({ status: z.literal("ok"), latency_ms: z.number() }),
  })],
  ["AuthUserResponse", authUserSchema],
  ["LoginResponse", z.object({
    token: z.string(),
    refreshToken: z.string(),
    user: authUserSchema,
  })],
  ["MessageResponse", z.object({ message: z.string() })],
  ["IdResponse", z.object({ id: finance.idSchema })],
  ["SkuResponse", z.object({ sku: z.string() })],
  ["IdStockResponse", z.object({
    id: finance.idSchema,
    stock_actual: z.number(),
    costo_unitario: z.number().optional(),
    precio_unitario: z.number().optional(),
  })],
];

const registry = z.registry<{ id: string }>();
for (const [name, schema] of namedSchemas) registry.add(schema, { id: name });

/** Componentes OpenAPI generados por Zod, con `$ref` entre esquemas compartidos. */
export const componentSchemas: Record<string, unknown> = Object.fromEntries(
  Object.entries(
    z.toJSONSchema(registry, {
      target: "draft-2020-12",
      io: "input",
      uri: (id) => `#/components/schemas/${id}`,
    }).schemas
  ).map(([name, schema]) => {
    const rest = { ...(schema as Record<string, unknown>) };
    delete rest.$schema;
    delete rest.$id;
    return [name, rest];
  })
);

export const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/** Nombres disponibles, para detectar referencias rotas en las pruebas. */
export const schemaNames = Object.keys(componentSchemas);
