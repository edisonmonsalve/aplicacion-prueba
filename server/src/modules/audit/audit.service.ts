import type { RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";
import type { auditQuerySchema } from "./audit.schema.js";

type AuditQuery = z.infer<typeof auditQuerySchema>;

type AuditValue = Record<string, unknown> | null;

/** La columna JSON puede llegar ya parseada o como texto según el driver. */
function parseJson(value: unknown): AuditValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/**
 * Visor de auditoría.
 *
 * `audit_log` es la bitácora append-only del módulo financiero: cada alta,
 * cambio, anulación, cierre o reapertura guarda quién, cuándo, sobre qué
 * entidad y el estado antes/después. Este listado solo lee y pagina; no
 * permite modificar ni borrar registros.
 */
export async function listAudit(query: AuditQuery) {
  if (query.desde && query.hasta && query.desde > query.hasta) {
    throw new HttpError(400, "La fecha inicial no puede ser posterior a la final");
  }

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.entidad) {
    where.push("a.entidad = ?");
    params.push(query.entidad);
  }
  if (query.entidad_id) {
    where.push("a.entidad_id = ?");
    params.push(query.entidad_id);
  }
  if (query.accion) {
    where.push("a.accion = ?");
    params.push(query.accion);
  }
  if (query.user_id) {
    where.push("a.user_id = ?");
    params.push(query.user_id);
  }
  if (query.desde) {
    // Comparar la columna directamente permite usar idx_audit_created.
    where.push("a.created_at >= ?");
    params.push(query.desde);
  }
  if (query.hasta) {
    where.push("a.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(query.hasta);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [countResult, rowsResult, resumenResult] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM audit_log a ${clause}`,
      params
    ),
    pool.query<RowDataPacket[]>(
      `SELECT a.id, a.user_id, u.nombre AS usuario, a.entidad, a.entidad_id,
              a.accion, a.antes, a.despues, a.created_at
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       ${clause}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT a.entidad, COUNT(*) AS total
       FROM audit_log a
       ${clause}
       GROUP BY a.entidad
       ORDER BY total DESC, a.entidad`,
      params
    ),
  ]);

  const [[{ total }]] = countResult;
  const [rows] = rowsResult;
  const [resumen] = resumenResult;

  return {
    data: rows.map((r) => ({
      id: Number(r.id),
      user_id: r.user_id === null ? null : Number(r.user_id),
      usuario: r.usuario ?? null,
      entidad: String(r.entidad),
      entidad_id: Number(r.entidad_id),
      accion: String(r.accion),
      antes: parseJson(r.antes),
      despues: parseJson(r.despues),
      created_at: String(r.created_at),
    })),
    total: Number(total),
    page: query.page,
    pageSize: query.pageSize,
    resumen_por_entidad: resumen.map((r) => ({
      entidad: String(r.entidad),
      total: Number(r.total),
    })),
  };
}
