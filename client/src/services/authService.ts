import { apiRequest } from "./api";

export async function login(email: string, password: string) {
  const { data } = await apiRequest("POST /api/auth/login", { email, password });
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await apiRequest("PUT /api/auth/password", { currentPassword, newPassword });
}
