import { apiRequest } from "./api";

export async function login(email: string, password: string) {
  const { data } = await apiRequest("POST /api/auth/login", { email, password });
  return data;
}

export async function refreshSession(refreshToken: string) {
  const { data } = await apiRequest("POST /api/auth/refresh", { refreshToken });
  return data;
}

export async function logout(refreshToken: string) {
  await apiRequest("POST /api/auth/logout", { refreshToken });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await apiRequest("PUT /api/auth/password", { currentPassword, newPassword });
}
