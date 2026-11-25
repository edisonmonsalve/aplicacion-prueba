import { apiRequest } from "./api";
import type {
  BankReconciliation,
  BankReconciliationListItem,
  ReconciliationEstado,
  ReconciliationInput,
  ReconciliationSuggestion,
  ReconciliationUpdateInput,
  StatementLineInput,
} from "@/types";

export const listReconciliations = async (params?: {
  account_id?: number;
  estado?: ReconciliationEstado;
}) =>
  (
    await apiRequest<"GET /api/finance/reconciliations", BankReconciliationListItem[]>(
      "GET /api/finance/reconciliations",
      { query: params }
    )
  ).data;

export const getReconciliation = async (id: number) =>
  (
    await apiRequest<"GET /api/finance/reconciliations/{id}", BankReconciliation>(
      "GET /api/finance/reconciliations/{id}",
      { params: { id } }
    )
  ).data;

export const createReconciliation = async (input: ReconciliationInput) =>
  (
    await apiRequest<"POST /api/finance/reconciliations", { id: number; estado: ReconciliationEstado }>(
      "POST /api/finance/reconciliations",
      input
    )
  ).data;

export const updateReconciliation = async (id: number, input: ReconciliationUpdateInput) =>
  (
    await apiRequest<"PUT /api/finance/reconciliations/{id}", { id: number }>(
      "PUT /api/finance/reconciliations/{id}",
      input,
      { params: { id } }
    )
  ).data;

export const addStatementLine = async (id: number, input: StatementLineInput) =>
  (
    await apiRequest<"POST /api/finance/reconciliations/{id}/lines", { id: number }>(
      "POST /api/finance/reconciliations/{id}/lines",
      input,
      { params: { id } }
    )
  ).data;

export const updateStatementLine = async (
  id: number,
  lineId: number,
  input: StatementLineInput
) =>
  (
    await apiRequest<"PUT /api/finance/reconciliations/{id}/lines/{lineId}", { id: number }>(
      "PUT /api/finance/reconciliations/{id}/lines/{lineId}",
      input,
      { params: { id, lineId } }
    )
  ).data;

export const deleteStatementLine = async (id: number, lineId: number) =>
  apiRequest("DELETE /api/finance/reconciliations/{id}/lines/{lineId}", {
    params: { id, lineId },
  });

export const getReconciliationSuggestions = async (id: number, dias = 7) =>
  (
    await apiRequest<"GET /api/finance/reconciliations/{id}/suggestions", ReconciliationSuggestion[]>(
      "GET /api/finance/reconciliations/{id}/suggestions",
      { params: { id }, query: { dias } }
    )
  ).data;

export const matchStatementLine = async (
  id: number,
  lineId: number,
  transactionId: number
) =>
  (
    await apiRequest<
      "POST /api/finance/reconciliations/{id}/lines/{lineId}/match",
      { id: number; estado: "conciliada"; transaction_id: number }
    >(
      "POST /api/finance/reconciliations/{id}/lines/{lineId}/match",
      { transaction_id: transactionId },
      { params: { id, lineId } }
    )
  ).data;

export const unmatchStatementLine = async (id: number, lineId: number) =>
  (
    await apiRequest<
      "POST /api/finance/reconciliations/{id}/lines/{lineId}/unmatch",
      { id: number; estado: "pendiente" }
    >("POST /api/finance/reconciliations/{id}/lines/{lineId}/unmatch", {
      params: { id, lineId },
    })
  ).data;

export const ignoreStatementLine = async (id: number, lineId: number, nota: string) =>
  (
    await apiRequest<
      "POST /api/finance/reconciliations/{id}/lines/{lineId}/ignore",
      { id: number; estado: "ignorada" }
    >(
      "POST /api/finance/reconciliations/{id}/lines/{lineId}/ignore",
      { nota },
      { params: { id, lineId } }
    )
  ).data;

export const closeReconciliation = async (id: number) =>
  (
    await apiRequest<"POST /api/finance/reconciliations/{id}/close", { id: number; estado: "cerrada" }>(
      "POST /api/finance/reconciliations/{id}/close",
      { params: { id } }
    )
  ).data;

export const reopenReconciliation = async (id: number, motivo: string) =>
  (
    await apiRequest<
      "POST /api/finance/reconciliations/{id}/reopen",
      { id: number; estado: "abierta" }
    >("POST /api/finance/reconciliations/{id}/reopen", { motivo }, { params: { id } })
  ).data;
