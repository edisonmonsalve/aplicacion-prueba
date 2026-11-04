import { api } from "./api";
import type { Quote, QuoteDetail, QuotesQuery } from "../types";

export const listQuotes = async (params: QuotesQuery) =>
  (await api.get<{ data: Quote[]; total: number }>("/quotes", { params })).data;

export const getQuote = async (id: number) => (await api.get<QuoteDetail>(`/quotes/${id}`)).data;

export const sendQuote = (id: number) => api.post(`/quotes/${id}/send`);
export const approveQuote = (id: number) => api.post(`/quotes/${id}/approve`);
export const rejectQuote = (id: number) => api.post(`/quotes/${id}/reject`);

export const duplicateQuote = async (id: number) =>
  (await api.post<{ id: number }>(`/quotes/${id}/duplicate`)).data;
