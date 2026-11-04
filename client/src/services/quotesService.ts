import { api } from "./api";
import type { Paginated } from "@/types";

export type QuoteStatus =
  | "borrador"
  | "enviado"
  | "aprobado"
  | "rechazado"
  | "vencido";

export interface Quote {
  id: number;
  numero: string;
  customer_nombre: string;
  estado: QuoteStatus;
  fecha_validez: string;
  total: number;
  creador: string;
  created_at: string;
}

export interface QuotesQuery {
  page: number;
  pageSize: number;
  q?: string;
  estado?: QuoteStatus;
}

export async function getQuotes(params: QuotesQuery) {
  const { data } = await api.get<Paginated<Quote>>("/quotes", {
    params,
  });

  return data;
}