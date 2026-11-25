import { apiRequest } from "./api";
import type { AuthUser } from "@/types";

export async function login(email: string, password: string) {
  const { data } = await apiRequest<"POST /api/auth/login", { token: string; user: AuthUser }>(
    "POST /api/auth/login",
    { email, password }
  );
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await apiRequest("PUT /api/auth/password", { currentPassword, newPassword });
}