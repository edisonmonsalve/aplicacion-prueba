import { api } from "./api";
import type { AuditEntity, AuditList } from "@/types";

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  entidad?: AuditEntity;
  entidad_id?: number;
  accion?: string;
  user_id?: number;
  desde?: string;
  hasta?: string;
}

export const listAudit = async (q: AuditQuery) =>
  (await api.get<AuditList>("/audit", { params: q })).data;
