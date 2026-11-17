import { api } from "./api";
import type { CompanySettings } from "@/types";

export async function getCompany(): Promise<CompanySettings> {
  const { data } = await api.get<CompanySettings>("/company");
  return data;
}

export type CompanyPayload = Omit<CompanySettings, "id" | "actualizado_en">;

export async function updateCompany(payload: CompanyPayload): Promise<CompanySettings> {
  const { data } = await api.put<CompanySettings>("/company", payload);
  return data;
}
