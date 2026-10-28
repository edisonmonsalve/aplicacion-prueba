import { api } from "./api";
import type { AuthUser } from "@/types";

export async function login(email: string, password: string) {
  const { data } = await api.post<{ token: string; user: AuthUser }>(
    "/auth/login",
    { email, password }
  );
  return data;
}