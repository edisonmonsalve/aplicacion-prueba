import { api } from "./api";
import type { Quote, QuoteDetail, QuotesQuery } from "../types";
import type { QuoteInput } from "@/types/index";

export const listQuotes = async (params: QuotesQuery) =>
  (await api.get<{ data: Quote[]; total: number }>("/quotes", { params })).data;

export const getQuote = async (id: number) => (await api.get<QuoteDetail>(`/quotes/${id}`)).data;

export const sendQuote = (id: number) => api.post(`/quotes/${id}/send`);
export const approveQuote = (id: number) => api.post(`/quotes/${id}/approve`);
export const rejectQuote = (id: number) => api.post(`/quotes/${id}/reject`);

export const duplicateQuote = async (id: number) =>
  (await api.post<{ id: number }>(`/quotes/${id}/duplicate`)).data;

const toPayload = (d: QuoteInput) => ({
  customer_nombre: d.cliente_nombre,
  customer_documento: d.cliente_documento,
  fecha_validez: d.fecha_validez,
  items: d.lineas, // pendiente: nombres reales de lineSchema
  customer_email: d.cliente_email,
  notas: d.notas,
});
export const createQuote = async (data: QuoteInput) =>
  (await api.post<{ id: number }>("/quotes", toPayload(data))).data;

export const updateQuote = async (id: number, data: QuoteInput) =>
  (await api.put<{ id: number }>(`/quotes/${id}`, toPayload(data))).data;
