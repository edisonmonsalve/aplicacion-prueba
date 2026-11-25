import { apiRequest } from "./api";
import type { CompanySettings } from "@/types";

export async function getCompany(): Promise<CompanySettings> {
  const { data } = await apiRequest<"GET /api/company", CompanySettings>("GET /api/company");
  return data;
}

export type CompanyPayload = Omit<CompanySettings, "id" | "actualizado_en">;

export async function updateCompany(payload: CompanyPayload): Promise<CompanySettings> {
  const { data } = await apiRequest<"PUT /api/company", CompanySettings>("PUT /api/company", payload);
  return data;
}
