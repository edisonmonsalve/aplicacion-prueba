import { apiRequest } from "./api";
import type {
  BudgetAvailability,
  BudgetDetail,
  BudgetInput,
  BudgetListItem,
  BudgetsQuery,
  BalanceReport,
  CashFlowReport,
  DataHealthReport,
  FinanceAccount,
  FinanceAccountInput,
  FinanceCategory,
  FinanceSummary,
  InventoryAnalyticsReport,
  Paginated,
  PaginatedTransactions,
  PnlReport,
  ProfitabilityReport,
  QuoteFunnelReport,
  Suggestion,
  TransactionInput,
  TransactionsQuery,
  TrendsReport,
} from "@/types";

export const getFinanceAccounts = async () =>
  (await apiRequest<"GET /api/finance/accounts", FinanceAccount[]>("GET /api/finance/accounts")).data;
export const createFinanceAccount = async (input: FinanceAccountInput) =>
  (await apiRequest<"POST /api/finance/accounts", { id: number }>("POST /api/finance/accounts", input))
    .data;
export const updateFinanceAccount = async (id: number, input: FinanceAccountInput) =>
  (
    await apiRequest<"PUT /api/finance/accounts/{id}", { id: number }>(
      "PUT /api/finance/accounts/{id}",
      input,
      { params: { id } }
    )
  ).data;
export const deleteFinanceAccount = async (id: number) =>
  apiRequest("DELETE /api/finance/accounts/{id}", { params: { id } });
export const getFinanceCategories = async () =>
  (await apiRequest<"GET /api/finance/categories", FinanceCategory[]>("GET /api/finance/categories"))
    .data;

export const listBudgets = async (q: BudgetsQuery) =>
  (
    await apiRequest<"GET /api/finance/budgets", Paginated<BudgetListItem>>(
      "GET /api/finance/budgets",
      { query: q }
    )
  ).data;
export const getBudget = async (id: number) =>
  (
    await apiRequest<"GET /api/finance/budgets/{id}", BudgetDetail>("GET /api/finance/budgets/{id}", {
      params: { id },
    })
  ).data;
export const createBudget = async (input: BudgetInput) =>
  (await apiRequest<"POST /api/finance/budgets", { id: number }>("POST /api/finance/budgets", input))
    .data;
export const updateBudget = async (id: number, input: BudgetInput) =>
  (
    await apiRequest<"PUT /api/finance/budgets/{id}", { id: number }>(
      "PUT /api/finance/budgets/{id}",
      input,
      { params: { id } }
    )
  ).data;
export const deleteBudget = async (id: number) =>
  apiRequest("DELETE /api/finance/budgets/{id}", { params: { id } });
export const activateBudget = async (id: number) =>
  (
    await apiRequest<"POST /api/finance/budgets/{id}/activate", { id: number; estado: "activo" }>(
      "POST /api/finance/budgets/{id}/activate",
      { params: { id } }
    )
  ).data;
export const closeBudget = async (id: number) =>
  (
    await apiRequest<"POST /api/finance/budgets/{id}/close", { id: number; estado: "cerrado" }>(
      "POST /api/finance/budgets/{id}/close",
      { params: { id } }
    )
  ).data;

export const listTransactions = async (q: TransactionsQuery) =>
  (
    await apiRequest<"GET /api/finance/transactions", PaginatedTransactions>(
      "GET /api/finance/transactions",
      { query: q }
    )
  ).data;
export const createTransaction = async (input: TransactionInput) =>
  (
    await apiRequest<"POST /api/finance/transactions", { id: number }>(
      "POST /api/finance/transactions",
      input
    )
  ).data;
export const reverseTransaction = async (id: number) =>
  (
    await apiRequest<"POST /api/finance/transactions/{id}/reverse", { id: number; anulada_de: number }>(
      "POST /api/finance/transactions/{id}/reverse",
      { params: { id } }
    )
  ).data;

export const getFinanceSummary = async (params: { desde?: string; hasta?: string }) =>
  (await apiRequest<"GET /api/finance/summary", FinanceSummary>("GET /api/finance/summary", { query: params }))
    .data;
export const getPnl = async (params: { desde?: string; hasta?: string }) =>
  (await apiRequest<"GET /api/finance/pnl", PnlReport>("GET /api/finance/pnl", { query: params })).data;
export const getCashFlow = async (params: {
  desde?: string;
  hasta?: string;
  account_id?: number;
}) =>
  (
    await apiRequest<"GET /api/finance/cash-flow", CashFlowReport>("GET /api/finance/cash-flow", {
      query: params,
    })
  ).data;
export const getBalance = async (params: { hasta?: string }) =>
  (await apiRequest<"GET /api/finance/balance", BalanceReport>("GET /api/finance/balance", {
    query: params,
  })).data;
export const getProfitability = async (params: {
  desde?: string;
  hasta?: string;
  grupo?: "producto" | "categoria" | "cliente";
}) =>
  (
    await apiRequest<"GET /api/finance/profitability", ProfitabilityReport>(
      "GET /api/finance/profitability",
      { query: params }
    )
  ).data;
export const getInventoryAnalytics = async (params: {
  desde?: string;
  hasta?: string;
  dias_muerto?: number;
}) =>
  (
    await apiRequest<"GET /api/finance/inventory-analytics", InventoryAnalyticsReport>(
      "GET /api/finance/inventory-analytics",
      { query: params }
    )
  ).data;
export const getQuoteFunnel = async (params: { desde?: string; hasta?: string }) =>
  (
    await apiRequest<"GET /api/finance/quotes-funnel", QuoteFunnelReport>(
      "GET /api/finance/quotes-funnel",
      { query: params }
    )
  ).data;
export const getTrends = async (params: { desde?: string; hasta?: string }) =>
  (await apiRequest<"GET /api/finance/trends", TrendsReport>("GET /api/finance/trends", {
    query: params,
  })).data;
export const getDataHealth = async () =>
  (await apiRequest<"GET /api/finance/data-health", DataHealthReport>("GET /api/finance/data-health"))
    .data;
export const getAvailability = async (productId: number) =>
  (
    await apiRequest<"GET /api/finance/availability", BudgetAvailability | null>(
      "GET /api/finance/availability",
      { query: { product_id: productId } }
    )
  ).data;
export const getSuggestions = async () =>
  (await apiRequest<"GET /api/finance/suggestions", Suggestion[]>("GET /api/finance/suggestions")).data;
