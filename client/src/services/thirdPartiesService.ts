import { api } from "./api";
import type {
  PaginatedThirdParties,
  ThirdPartiesQuery,
  ThirdParty,
  ThirdPartyInput,
} from "@/types";

export const listThirdParties = async (q: ThirdPartiesQuery) =>
  (await api.get<PaginatedThirdParties>("/third-parties", { params: q })).data;

export const getThirdParty = async (id: number) =>
  (await api.get<ThirdParty>(`/third-parties/${id}`)).data;

export const createThirdParty = async (input: ThirdPartyInput) =>
  (await api.post<{ id: number }>("/third-parties", input)).data;

export const updateThirdParty = async (id: number, input: Partial<ThirdPartyInput>) =>
  (await api.put<{ id: number }>(`/third-parties/${id}`, input)).data;

export const deleteThirdParty = async (id: number) =>
  api.delete(`/third-parties/${id}`);
