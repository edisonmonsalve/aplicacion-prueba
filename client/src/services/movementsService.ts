import { api } from "./api";
import type { MovementOrigen, MovementTipo, Paginated, StockMovement } from "@/types";

export type MovementSortKey =
  | "fecha"
  | "producto"
  | "tipo"
  | "origen"
  | "cantidad"
  | "costo"
  | "precio";

export interface MovementsQuery {
  page: number;
  pageSize: number;
  product_id?: number;
  tipo?: MovementTipo;
  origen?: MovementOrigen;
  invoice_id?: number;
  quote_id?: number;
  q?: string;
  desde?: string;
  hasta?: string;
  sort?: MovementSortKey;
  order?: "asc" | "desc";
}

export interface MovementsSummary {
  entradas: number;
  salidas: number;
  unidades_entrada: number;
  unidades_salida: number;
}

export interface MovementsResponse extends Paginated<StockMovement> {
  summary: MovementsSummary;
}

export interface MovementInput {
  product_id: number;
  tipo: MovementTipo;
  cantidad: number;
  costo_unitario?: number;
  motivo?: string;
}

export async function getMovements(params: MovementsQuery) {
  const { data } = await api.get<MovementsResponse>("/movements", { params });
  return data;
}

export async function createMovement(input: MovementInput) {
  const { data } = await api.post<{ id: number; stock_actual: number }>("/movements", input);
  return data;
}