import { api } from "./api";
import type { Dashboard } from "@/types";

export async function getDashboard() {
  const { data } = await api.get<Dashboard>("/dashboard");
  return data;
}