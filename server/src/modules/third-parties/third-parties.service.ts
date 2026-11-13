import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";
import type {
  createThirdPartySchema,
  listThirdPartiesQuerySchema,
  updateThirdPartySchema,
} from "./third-parties.schema.js";

type ThirdPartyInput = z.infer<typeof createThirdPartySchema>;
type ThirdPartyUpdate = z.infer<typeof updateThirdPartySchema>;
type ListQuery = z.infer<typeof listThirdPartiesQuerySchema>;

export interface ThirdPartyRow extends RowDataPacket {
  id: number;
  tipo: "cliente" | "proveedor" | "ambos";
  tipo_documento: string;
  documento: string | null;
  nombre: string;
  activo: number;
}

const SELECT_FIELDS = `
  tp.id, tp.tipo, tp.tipo_documento, tp.documento, tp.nombre, tp.email,
  tp.telefono, tp.direccion, tp.ciudad, tp.condicion_pago, tp.dias_credito,
  tp.notas, tp.activo, tp.created_at, tp.updated_at,
  (SELECT COUNT(*) FROM invoices i WHERE i.party_id = tp.id) AS facturas,
  (SELECT COUNT(*) FROM invoices i WHERE i.party_id = tp.id AND i.tipo = 'venta') AS ventas,
  (SELECT COUNT(*) FROM invoices i WHERE i.party_id = tp.id AND i.tipo = 'compra') AS compras`;

function duplicateMessage(err: unknown) {
  return (err as { code?: string } | null)?.code === "ER_DUP_ENTRY";
}

export async function listThirdParties(query: ListQuery) {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.q) {
    where.push("(tp.nombre LIKE ? OR tp.documento LIKE ? OR tp.email LIKE ?)");
    params.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`);
  }
  if (query.tipo) {
    if (query.tipo === "ambos") {
      where.push("tp.tipo = 'ambos'");
    } else {
      // Un tercero "ambos" sirve tanto como cliente como proveedor.
      where.push("tp.tipo IN (?, 'ambos')");
      params.push(query.tipo);
    }
  }
  if (query.activo !== undefined) {
    where.push("tp.activo = ?");
    params.push(query.activo);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM third_parties tp ${clause}`,
    params
  );
  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_FIELDS}
     FROM third_parties tp
     ${clause}
     ORDER BY tp.activo DESC, tp.nombre
     LIMIT ? OFFSET ?`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function getThirdParty(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SELECT_FIELDS} FROM third_parties tp WHERE tp.id = ?`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, "Tercero no encontrado");
  return rows[0];
}

export async function createThirdParty(input: ThirdPartyInput) {
  const dias = input.condicion_pago === "contado" ? 0 : input.dias_credito;
  try {
    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO third_parties
         (tipo, tipo_documento, documento, nombre, email, telefono, direccion,
          ciudad, condicion_pago, dias_credito, notas, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tipo,
        input.tipo_documento,
        input.documento ?? null,
        input.nombre,
        input.email ?? null,
        input.telefono ?? null,
        input.direccion ?? null,
        input.ciudad ?? null,
        input.condicion_pago,
        dias,
        input.notas ?? null,
        input.activo === false ? 0 : 1,
      ]
    );
    return { id: res.insertId };
  } catch (err) {
    if (duplicateMessage(err)) {
      throw new HttpError(409, "Ya existe un tercero con ese documento");
    }
    throw err;
  }
}

export async function updateThirdParty(id: number, input: ThirdPartyUpdate) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM third_parties WHERE id = ?",
    [id]
  );
  const current = rows[0];
  if (!current) throw new HttpError(404, "Tercero no encontrado");

  const condicion = input.condicion_pago ?? current.condicion_pago;
  const dias =
    condicion === "contado"
      ? 0
      : input.dias_credito ?? Number(current.dias_credito ?? 0);

  try {
    const [res] = await pool.query<ResultSetHeader>(
      `UPDATE third_parties SET
         tipo = ?, tipo_documento = ?, documento = ?, nombre = ?, email = ?,
         telefono = ?, direccion = ?, ciudad = ?, condicion_pago = ?,
         dias_credito = ?, notas = ?, activo = ?
       WHERE id = ?`,
      [
        input.tipo ?? current.tipo,
        input.tipo_documento ?? current.tipo_documento,
        input.documento !== undefined ? input.documento : current.documento,
        input.nombre ?? current.nombre,
        input.email !== undefined ? input.email : current.email,
        input.telefono !== undefined ? input.telefono : current.telefono,
        input.direccion !== undefined ? input.direccion : current.direccion,
        input.ciudad !== undefined ? input.ciudad : current.ciudad,
        condicion,
        dias,
        input.notas !== undefined ? input.notas : current.notas,
        input.activo === undefined ? current.activo : input.activo ? 1 : 0,
        id,
      ]
    );
    if (res.affectedRows === 0) throw new HttpError(404, "Tercero no encontrado");
  } catch (err) {
    if (duplicateMessage(err)) {
      throw new HttpError(409, "Ya existe un tercero con ese documento");
    }
    throw err;
  }
}

export async function deleteThirdParty(id: number) {
  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM invoices WHERE party_id = ?",
    [id]
  );
  if (total > 0) {
    throw new HttpError(
      409,
      `No se puede eliminar: tiene ${total} factura(s) asociada(s). Desactívalo en su lugar.`
    );
  }
  const [res] = await pool.query<ResultSetHeader>(
    "DELETE FROM third_parties WHERE id = ?",
    [id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Tercero no encontrado");
}

/**
 * Carga un tercero activo dentro de una transacción para vincularlo a un
 * documento (factura o cotización). El nombre histórico anterior se conserva
 * como alias para no tocar los llamados existentes.
 */
export async function findActiveThirdParty(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<ThirdPartyRow[]>(
    "SELECT id, tipo, tipo_documento, documento, nombre, activo, condicion_pago, dias_credito, email, telefono FROM third_parties WHERE id = ? LIMIT 1",
    [id]
  );
  const party = rows[0];
  if (!party) throw new HttpError(400, "El tercero seleccionado no existe");
  if (!party.activo) throw new HttpError(409, `El tercero "${party.nombre}" está inactivo`);
  return party;
}

/** Alias histórico: la factura usa este nombre para cargar su contraparte. */
export const findThirdPartyForInvoice = findActiveThirdParty;

/** Alias para la cotización, que solo admite clientes. */
export const findThirdPartyForQuote = findActiveThirdParty;

export function assertPartyType(
  party: { tipo: string; nombre: string },
  invoiceTipo: "venta" | "compra"
) {
  const expected = invoiceTipo === "venta" ? "cliente" : "proveedor";
  if (party.tipo !== expected && party.tipo !== "ambos") {
    throw new HttpError(
      400,
      `El tercero "${party.nombre}" no está registrado como ${expected}`
    );
  }
}
