import { api } from "./api";
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
}) => (await api.get<BankReconciliationListItem[]>("/finance/reconciliations", { params })).data;

export const getReconciliation = async (id: number) =>
  (await api.get<BankReconciliation>(`/finance/reconciliations/${id}`)).data;

export const createReconciliation = async (input: ReconciliationInput) =>
  (await api.post<{ id: number; estado: ReconciliationEstado }>("/finance/reconciliations", input))
    .data;

export const updateReconciliation = async (id: number, input: ReconciliationUpdateInput) =>
  (await api.put<{ id: number }>(`/finance/reconciliations/${id}`, input)).data;

export const addStatementLine = async (id: number, input: StatementLineInput) =>
  (await api.post<{ id: number }>(`/finance/reconciliations/${id}/lines`, input)).data;

export const updateStatementLine = async (
  id: number,
  lineId: number,
  input: StatementLineInput
) =>
  (await api.put<{ id: number }>(`/finance/reconciliations/${id}/lines/${lineId}`, input)).data;

export const deleteStatementLine = async (id: number, lineId: number) =>
  api.delete(`/finance/reconciliations/${id}/lines/${lineId}`);

export const getReconciliationSuggestions = async (id: number, dias = 7) =>
  (
    await api.get<ReconciliationSuggestion[]>(
      `/finance/reconciliations/${id}/suggestions`,
      { params: { dias } }
    )
  ).data;

export const matchStatementLine = async (
  id: number,
  lineId: number,
  transactionId: number
) =>
  (
    await api.post<{ id: number; estado: "conciliada"; transaction_id: number }>(
      `/finance/reconciliations/${id}/lines/${lineId}/match`,
      { transaction_id: transactionId }
    )
  ).data;

export const unmatchStatementLine = async (id: number, lineId: number) =>
  (
    await api.post<{ id: number; estado: "pendiente" }>(
      `/finance/reconciliations/${id}/lines/${lineId}/unmatch`
    )
  ).data;

export const ignoreStatementLine = async (id: number, lineId: number, nota: string) =>
  (
    await api.post<{ id: number; estado: "ignorada" }>(
      `/finance/reconciliations/${id}/lines/${lineId}/ignore`,
      { nota }
    )
  ).data;

export const closeReconciliation = async (id: number) =>
  (await api.post<{ id: number; estado: "cerrada" }>(`/finance/reconciliations/${id}/close`))
    .data;

export const reopenReconciliation = async (id: number, motivo: string) =>
  (await api.post<{ id: number; estado: "abierta" }>(`/finance/reconciliations/${id}/reopen`, {
    motivo,
  })).data;
