import { apiRequest } from "./api";
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
  sort?: "sku" | "nombre" | "precio" | "stock" | "costo" | "margen";
  order?: "asc" | "desc";
}

export interface ProductsSummary {
  /** Unidades en stock de todos los productos que cumplen los filtros. */
  unidades: number;
  /** Valor del stock (precio × stock) de esos productos. */
  valor: number;
  /** Productos por debajo del stock mínimo. */
  bajos: number;
  /**
   * Margen del stock a precio de venta: (valor − valor al costo) / valor.
   * `null` para roles que no ven costos.
   */
  margen: number | null;
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
  const { data } = await apiRequest<"GET /api/products", ProductsResponse>("GET /api/products", {
    query: params,
  });
  return data;
}

/** SKU sugerido para una categoría (`PREF-0001`); el usuario puede editarlo. */
export async function getNextSku(categoryId: number) {
  const { data } = await apiRequest("GET /api/products/next-sku", {
    query: { category_id: categoryId },
  });
  return data.sku;
}

export async function createProduct(input: ProductInput) {
  const { data } = await apiRequest("POST /api/products", input);
  return data;
}

export async function updateProduct(id: number, input: ProductInput) {
  await apiRequest("PUT /api/products/{id}", input, { params: { id } });
}

export async function setProductActivo(id: number, activo: boolean) {
  await apiRequest("PATCH /api/products/{id}/activo", { activo }, { params: { id } });
}
