import { api } from "./api";
import type { Category } from "@/types";

export async function getCategories() {
  const { data } = await api.get<Category[]>("/categories");
  return data;
}

export async function createCategory(nombre: string, codigo: string) {
  await api.post("/categories", { nombre, codigo });
}

export async function updateCategory(id: number, nombre: string, codigo: string) {
  await api.put(`/categories/${id}`, { nombre, codigo });
}

export async function deleteCategory(id: number) {
  await api.delete(`/categories/${id}`);
}