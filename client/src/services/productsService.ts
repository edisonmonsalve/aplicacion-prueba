import { api } from "./api";
import type { Paginated, Product } from "@/types";

export interface ProductsQuery {
  page: number;
  pageSize: number;
  q?: string;
  /** Lista de ids separados por coma para hidratar líneas autocompletadas. */
  ids?: string;
  category_id?: number;
  activo?: "0" | "1";
  bajoStock?: "1";
  sort?: "sku" | "nombre" | "precio" | "stock" | "costo";
  order?: "asc" | "desc";
}

export interface ProductsSummary {
  /** Unidades en stock de todos los productos que cumplen los filtros. */
  unidades: number;
  /** Valor del stock (precio × stock) de esos productos. */
  valor: number;
}

export interface ProductsResponse extends Paginated<Product> {
  summary: ProductsSummary;
}

export interface ProductInput {
  sku: string;
  nombre: string;
  category_id: number;
  precio: number;
  costo?: number;
  stock_minimo: number;
}

export async function getProducts(params: ProductsQuery) {
  const { data } = await api.get<ProductsResponse>("/products", { params });
  return data;
}

export async function createProduct(input: ProductInput) {
  const { data } = await api.post<{ id: number }>("/products", input);
  return data;
}

export async function updateProduct(id: number, input: ProductInput) {
  await api.put(`/products/${id}`, input);
}

export async function setProductActivo(id: number, activo: boolean) {
  await api.patch(`/products/${id}/activo`, { activo });
}