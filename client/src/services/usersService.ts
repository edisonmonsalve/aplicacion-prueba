import { api } from "./api";
import type { Paginated, Rol, User } from "@/types";

export interface UsersQuery {
  page: number;
  pageSize: number;
  q?: string;
  rol?: Rol;
  activo?: "0" | "1";
}

export async function getUsers(params: UsersQuery) {
  // axios omite los parámetros undefined, así que los filtros vacíos no viajan
  const { data } = await api.get<Paginated<User>>("/users", { params });
  return data;
}

export async function setUserActivo(id: number, activo: boolean) {
  await api.patch(`/users/${id}/activo`, { activo });
}