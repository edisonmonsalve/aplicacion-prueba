import { apiRequest } from "./api";
import type { Dashboard } from "@/types";

export async function getDashboard() {
  const { data } = await apiRequest<"GET /api/dashboard", Dashboard>("GET /api/dashboard");
  return data;
}
