import { apiRequest } from "./api";
import type {
  CarteraAging,
  CarteraAlertReport,
  CarteraAlertSeveridad,
  CarteraFollowup,
  CarteraFollowupInput,
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
  (await apiRequest<"GET /api/invoices", PaginatedInvoices>("GET /api/invoices", { query: q })).data;

export const getInvoice = async (id: number) =>
  (await apiRequest<"GET /api/invoices/{id}", InvoiceDetail>("GET /api/invoices/{id}", {
    params: { id },
  })).data;

export const createInvoice = async (input: InvoiceInput) =>
  (
    await apiRequest<"POST /api/invoices", { id: number; numero: string; tipo: string }>(
      "POST /api/invoices",
      input
    )
  ).data;

export const updateInvoice = async (id: number, input: Partial<InvoiceInput>) =>
  (
    await apiRequest<"PUT /api/invoices/{id}", { id: number }>(
      "PUT /api/invoices/{id}",
      input,
      { params: { id } }
    )
  ).data;

export const deleteInvoice = async (id: number) =>
  apiRequest("DELETE /api/invoices/{id}", { params: { id } });

export const confirmInvoice = async (id: number) =>
  (
    await apiRequest<"POST /api/invoices/{id}/confirmar", { id: number; estado: string }>(
      "POST /api/invoices/{id}/confirmar",
      { params: { id } }
    )
  ).data;

export const cancelInvoice = async (id: number) =>
  (
    await apiRequest<"POST /api/invoices/{id}/anular", { id: number; estado: string }>(
      "POST /api/invoices/{id}/anular",
      { params: { id } }
    )
  ).data;

// ---------- Cartera y pagos ----------

export const listReceivables = async (q: ReceivablesQuery) =>
  (
    await apiRequest<"GET /api/invoices/cartera", PaginatedReceivables>("GET /api/invoices/cartera", {
      query: q,
    })
  ).data;

export const getCarteraAging = async (params?: { desde?: string; hasta?: string }) =>
  (
    await apiRequest<"GET /api/invoices/cartera/aging", CarteraAging>(
      "GET /api/invoices/cartera/aging",
      { query: params }
    )
  ).data;

export const getCarteraAlertas = async (params?: {
  tipo?: "venta" | "compra";
  severidad?: CarteraAlertSeveridad;
  incluir_resueltos?: boolean;
  q?: string;
}) =>
  (
    await apiRequest<"GET /api/invoices/cartera/alertas", CarteraAlertReport>(
      "GET /api/invoices/cartera/alertas",
      { query: params }
    )
  ).data;

export const saveCarteraFollowup = async (invoiceId: number, input: CarteraFollowupInput) =>
  (
    await apiRequest<"PUT /api/invoices/cartera/alertas/{id}/seguimiento", CarteraFollowup & { invoice_id: number }>(
      "PUT /api/invoices/cartera/alertas/{id}/seguimiento",
      input,
      { params: { id: invoiceId } }
    )
  ).data;

export const listInvoicePayments = async (id: number) =>
  (
    await apiRequest<"GET /api/invoices/{id}/payments", InvoicePayment[]>(
      "GET /api/invoices/{id}/payments",
      { params: { id } }
    )
  ).data;

export const createInvoicePayment = async (id: number, input: PaymentInput) =>
  (
    await apiRequest<
      "POST /api/invoices/{id}/payments",
      { id: number; transaction_id: number; pagado: number; saldo_pendiente: number }
    >("POST /api/invoices/{id}/payments", input, { params: { id } })
  ).data;

export const cancelInvoicePayment = async (id: number, paymentId: number) =>
  (
    await apiRequest<
      "POST /api/invoices/{id}/payments/{paymentId}/anular",
      { id: number; estado: string; saldo_pendiente: number }
    >("POST /api/invoices/{id}/payments/{paymentId}/anular", {
      params: { id, paymentId },
    })
  ).data;

export const listInvoiceAdjustments = async (id: number) =>
  (
    await apiRequest<"GET /api/invoices/{id}/notas", InvoiceAdjustment[]>(
      "GET /api/invoices/{id}/notas",
      { params: { id } }
    )
  ).data;

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
    await apiRequest<
      "POST /api/invoices/{id}/notas",
      { id: number; numero: string; tipo: string; estado: string; total: number; total_neto: number }
    >("POST /api/invoices/{id}/notas", input, { params: { id } })
  ).data;

export const cancelInvoiceAdjustment = async (id: number, adjustmentId: number) =>
  (
    await apiRequest<
      "POST /api/invoices/{id}/notas/{adjustmentId}/anular",
      { id: number; numero: string; estado: string }
    >("POST /api/invoices/{id}/notas/{adjustmentId}/anular", {
      params: { id, adjustmentId },
    })
  ).data;
