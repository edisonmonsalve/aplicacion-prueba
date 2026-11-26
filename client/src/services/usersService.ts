import { apiRequest } from "./api";
import type { Paginated, Rol, User } from "@/types";

export interface UsersQuery {
  page: number;
  pageSize: number;
  q?: string;
  rol?: Rol;
  activo?: "0" | "1";
  sort?: UserSortKey;
  order?: "asc" | "desc";
}

export type UserSortKey = "nombre" | "email" | "rol" | "activo" | "creado";
export interface CreateUserInput {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
}
export type UpdateUserInput = Partial<CreateUserInput>;

export async function getUsers(params: UsersQuery) {
  // axios omite los parámetros undefined, así que los filtros vacíos no viajan
  const { data } = await apiRequest<"GET /api/users", Paginated<User>>("GET /api/users", {
    query: params,
  });
  return data;
}

export async function setUserActivo(id: number, activo: boolean) {
  await apiRequest("PATCH /api/users/{id}/activo", { activo }, { params: { id } });
}

export async function createUser(input: CreateUserInput) {
  const { data } = await apiRequest("POST /api/users", input);
  return data;
}

export async function updateUser(id: number, input: UpdateUserInput) {
  await apiRequest("PUT /api/users/{id}", input, { params: { id } });
}
