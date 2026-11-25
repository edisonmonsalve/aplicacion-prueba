import { apiRequest } from "./api";
import type { Quote, QuoteDetail, QuotesQuery } from "../types";
import type { QuoteInput } from "@/types/index";

export const listQuotes = async (params: QuotesQuery) =>
  (
    await apiRequest<"GET /api/quotes", { data: Quote[]; total: number; monto_total: number }>(
      "GET /api/quotes",
      { query: params }
    )
  ).data;

export const getQuote = async (id: number) =>
  (await apiRequest<"GET /api/quotes/{id}", QuoteDetail>("GET /api/quotes/{id}", { params: { id } }))
    .data;

export const sendQuote = (id: number) =>
  apiRequest("POST /api/quotes/{id}/send", { params: { id } });
export const approveQuote = (id: number) =>
  apiRequest("POST /api/quotes/{id}/approve", { params: { id } });
export const rejectQuote = (id: number) =>
  apiRequest("POST /api/quotes/{id}/reject", { params: { id } });

export const duplicateQuote = async (id: number) =>
  (
    await apiRequest<"POST /api/quotes/{id}/duplicate", { id: number }>(
      "POST /api/quotes/{id}/duplicate",
      { params: { id } }
    )
  ).data;

const toPayload = (d: QuoteInput) => ({
  party_id: d.party_id ?? null,
  customer_nombre: d.cliente_nombre,
  customer_documento: d.cliente_documento,
  fecha_validez: d.fecha_validez,
  items: d.lineas, // pendiente: nombres reales de lineSchema
  customer_email: d.cliente_email,
  notas: d.notas,
});
export const createQuote = async (data: QuoteInput) =>
  (
    await apiRequest<"POST /api/quotes", { id: number }>("POST /api/quotes", toPayload(data))
  ).data;

export const updateQuote = async (id: number, data: QuoteInput) =>
  (
    await apiRequest<"PUT /api/quotes/{id}", { id: number }>(
      "PUT /api/quotes/{id}",
      toPayload(data),
      { params: { id } }
    )
  ).data;

export const deliverQuote = (id: number) =>
  apiRequest("POST /api/quotes/{id}/deliver", { params: { id } });
