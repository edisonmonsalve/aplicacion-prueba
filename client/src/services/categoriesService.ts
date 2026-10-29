import { api } from "./api";
import type { Category } from "@/types";

export async function getCategories() {
  const { data } = await api.get<Category[]>("/categories");
  return data;
}

export async function createCategory(nombre: string) {
  await api.post("/categories", { nombre });
}

export async function updateCategory(id: number, nombre: string) {
  await api.put(`/categories/${id}`, { nombre });
}

export async function deleteCategory(id: number) {
  await api.delete(`/categories/${id}`);
}