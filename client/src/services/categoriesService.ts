import { apiRequest } from "./api";
import type { Category } from "@/types";

export async function getCategories() {
  const { data } = await apiRequest<"GET /api/categories", Category[]>("GET /api/categories");
  return data;
}

export async function createCategory(nombre: string, codigo: string) {
  await apiRequest("POST /api/categories", { nombre, codigo });
}

export async function updateCategory(id: number, nombre: string, codigo: string) {
  await apiRequest("PUT /api/categories/{id}", { nombre, codigo }, { params: { id } });
}

export async function deleteCategory(id: number) {
  await apiRequest("DELETE /api/categories/{id}", { params: { id } });
}
