import { api } from "./api";
import type {
  BudgetAvailability,
  BudgetDetail,
  BudgetInput,
  BudgetListItem,
  BudgetsQuery,
  BalanceReport,
  CashFlowReport,
  FinanceAccount,
  FinanceAccountInput,
  FinanceCategory,
  FinanceSummary,
  Paginated,
  PaginatedTransactions,
  PnlReport,
  Suggestion,
  TransactionInput,
  TransactionsQuery,
} from "@/types";

export const getFinanceAccounts = async () => (await api.get<FinanceAccount[]>("/finance/accounts")).data;
export const createFinanceAccount = async (input: FinanceAccountInput) =>
  (await api.post<{ id: number }>("/finance/accounts", input)).data;
export const updateFinanceAccount = async (id: number, input: FinanceAccountInput) =>
  (await api.put<{ id: number }>(`/finance/accounts/${id}`, input)).data;
export const deleteFinanceAccount = async (id: number) =>
  api.delete(`/finance/accounts/${id}`);
export const getFinanceCategories = async () => (await api.get<FinanceCategory[]>("/finance/categories")).data;

export const listBudgets = async (q: BudgetsQuery) =>
  (await api.get<Paginated<BudgetListItem>>("/finance/budgets", { params: q })).data;
export const getBudget = async (id: number) => (await api.get<BudgetDetail>(`/finance/budgets/${id}`)).data;
export const createBudget = async (input: BudgetInput) =>
  (await api.post<{ id: number }>("/finance/budgets", input)).data;
export const updateBudget = async (id: number, input: BudgetInput) =>
  (await api.put<{ id: number }>(`/finance/budgets/${id}`, input)).data;
export const deleteBudget = async (id: number) => api.delete(`/finance/budgets/${id}`);
export const activateBudget = async (id: number) =>
  (await api.post<{ id: number; estado: "activo" }>(`/finance/budgets/${id}/activate`)).data;
export const closeBudget = async (id: number) =>
  (await api.post<{ id: number; estado: "cerrado" }>(`/finance/budgets/${id}/close`)).data;

export const listTransactions = async (q: TransactionsQuery) =>
  (await api.get<PaginatedTransactions>("/finance/transactions", { params: q })).data;
export const createTransaction = async (input: TransactionInput) =>
  (await api.post<{ id: number }>("/finance/transactions", input)).data;
export const reverseTransaction = async (id: number) =>
  (await api.post<{ id: number; anulada_de: number }>(`/finance/transactions/${id}/reverse`)).data;

export const getFinanceSummary = async (params: { desde?: string; hasta?: string }) =>
  (await api.get<FinanceSummary>("/finance/summary", { params })).data;
export const getPnl = async (params: { desde?: string; hasta?: string }) =>
  (await api.get<PnlReport>("/finance/pnl", { params })).data;
export const getCashFlow = async (params: {
  desde?: string;
  hasta?: string;
  account_id?: number;
}) => (await api.get<CashFlowReport>("/finance/cash-flow", { params })).data;
export const getBalance = async (params: { hasta?: string }) =>
  (await api.get<BalanceReport>("/finance/balance", { params })).data;
export const getAvailability = async (productId: number) =>
  (await api.get<BudgetAvailability | null>("/finance/availability", { params: { product_id: productId } })).data;
export const getSuggestions = async () => (await api.get<Suggestion[]>("/finance/suggestions")).data;
