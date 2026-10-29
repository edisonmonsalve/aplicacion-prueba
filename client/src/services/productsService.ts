import { api } from "./api";
import type { Paginated, Product } from "@/types";

export interface ProductsQuery {
  page: number;
  pageSize: number;
  q?: string;
  category_id?: number;
  activo?: "0" | "1";
  bajoStock?: "1";
}

export interface ProductInput {
  sku: string;
  nombre: string;
  category_id: number;
  precio: number;
  stock_minimo: number;
}

export async function getProducts(params: ProductsQuery) {
  const { data } = await api.get<Paginated<Product>>("/products", { params });
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