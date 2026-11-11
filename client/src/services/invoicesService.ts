import { api } from "./api";
import type { InvoiceDetail, InvoiceInput, InvoicesQuery, PaginatedInvoices } from "@/types";

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
