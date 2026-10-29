import { api } from "./api";
import type { Paginated, Rol, User } from "@/types";

export interface UsersQuery {
  page: number;
  pageSize: number;
  q?: string;
  rol?: Rol;
  activo?: "0" | "1";
}
export interface CreateUserInput {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
}
export type UpdateUserInput = Partial<CreateUserInput>;

export async function getUsers(params: UsersQuery) {
  // axios omite los parámetros undefined, así que los filtros vacíos no viajan
  const { data } = await api.get<Paginated<User>>("/users", { params });
  return data;
}

export async function setUserActivo(id: number, activo: boolean) {
  await api.patch(`/users/${id}/activo`, { activo });
}


export async function createUser(input: CreateUserInput) {
  const { data } = await api.post<{ id: number }>("/users", input);
  return data;
}

export async function updateUser(id: number, input: UpdateUserInput) {
  await api.put(`/users/${id}`, input);
}