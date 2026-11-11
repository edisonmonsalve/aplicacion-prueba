import { api } from "./api";
import type {
  CarteraAging,
  InvoiceAdjustment,
  InvoiceDetail,
  InvoiceInput,
  InvoicePayment,
  InvoicesQuery,
  PaginatedInvoices,
  PaginatedReceivables,
  PaymentInput,
  ReceivablesQuery,
} from "@/types";

export const listInvoices = async (q: InvoicesQuery) =>
  (await api.get<PaginatedInvoices>("/invoices", { params: q })).data;

export const getInvoice = async (id: number) => (await api.get<InvoiceDetail>(`/invoices/${id}`)).data;

export const createInvoice = async (input: InvoiceInput) =>
  (await api.post<{ id: number; numero: string; tipo: string }>("/invoices", input)).data;

export const updateInvoice = async (id: number, input: Partial<InvoiceInput>) =>
  (await api.put<{ id: number }>(`/invoices/${id}`, input)).data;

export const deleteInvoice = async (id: number) => api.delete(`/invoices/${id}`);

export const confirmInvoice = async (id: number) =>
  (await api.post<{ id: number; estado: string }>(`/invoices/${id}/confirmar`)).data;

export const cancelInvoice = async (id: number) =>
  (await api.post<{ id: number; estado: string }>(`/invoices/${id}/anular`)).data;

// ---------- Cartera y pagos ----------

export const listReceivables = async (q: ReceivablesQuery) =>
  (await api.get<PaginatedReceivables>("/invoices/cartera", { params: q })).data;

export const getCarteraAging = async (params?: { desde?: string; hasta?: string }) =>
  (await api.get<CarteraAging>("/invoices/cartera/aging", { params })).data;

export const listInvoicePayments = async (id: number) =>
  (await api.get<InvoicePayment[]>(`/invoices/${id}/payments`)).data;

export const createInvoicePayment = async (id: number, input: PaymentInput) =>
  (
    await api.post<{
      id: number;
      transaction_id: number;
      pagado: number;
      saldo_pendiente: number;
    }>(`/invoices/${id}/payments`, input)
  ).data;

export const cancelInvoicePayment = async (id: number, paymentId: number) =>
  (
    await api.post<{ id: number; estado: string; saldo_pendiente: number }>(
      `/invoices/${id}/payments/${paymentId}/anular`
    )
  ).data;

export const listInvoiceAdjustments = async (id: number) =>
  (await api.get<InvoiceAdjustment[]>(`/invoices/${id}/notas`)).data;

export const createInvoiceAdjustment = async (
  id: number,
  input: {
    tipo: "credito" | "debito";
    fecha: string;
    motivo?: string;
    afecta_stock?: boolean;
    items: { invoice_item_id: number; cantidad: number; precio_unitario?: number; descuento_pct?: number; impuesto_pct?: number }[];
  }
) =>
  (
    await api.post<{
      id: number;
      numero: string;
      tipo: string;
      estado: string;
      total: number;
      total_neto: number;
    }>(`/invoices/${id}/notas`, input)
  ).data;

export const cancelInvoiceAdjustment = async (id: number, adjustmentId: number) =>
  (
    await api.post<{ id: number; numero: string; estado: string }>(
      `/invoices/${id}/notas/${adjustmentId}/anular`
    )
  ).data;
