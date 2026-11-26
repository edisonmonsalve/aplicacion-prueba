import { apiRequest } from "./api";
import type {
  PaginatedThirdParties,
  ThirdPartiesQuery,
  ThirdParty,
  ThirdPartyInput,
} from "@/types";

export const listThirdParties = async (q: ThirdPartiesQuery) =>
  (
    await apiRequest<"GET /api/third-parties", PaginatedThirdParties>("GET /api/third-parties", {
      query: q,
    })
  ).data;

export const getThirdParty = async (id: number) =>
  (
    await apiRequest<"GET /api/third-parties/{id}", ThirdParty>("GET /api/third-parties/{id}", {
      params: { id },
    })
  ).data;

export const createThirdParty = async (input: ThirdPartyInput) =>
  (await apiRequest("POST /api/third-parties", input)).data;

export const updateThirdParty = async (id: number, input: Partial<ThirdPartyInput>) =>
  (
    await apiRequest<"PUT /api/third-parties/{id}", { id: number }>(
      "PUT /api/third-parties/{id}",
      input,
      { params: { id } }
    )
  ).data;

export const deleteThirdParty = async (id: number) =>
  apiRequest("DELETE /api/third-parties/{id}", { params: { id } });
