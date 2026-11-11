import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import { auditFinance, roundMoney, VALID_TRANSACTION } from "../finance/finance.shared.js";
import { getSummary } from "../finance/transactions.service.js";
import type {
  CreateClosureInput,
  ReopenClosureInput,
} from "./period-closures.schema.js";

/**
 * Foto inmutable de un periodo. Se guarda como JSON para conservar los totales
 * del momento del cierre aunque después cambien los datos.
 */
async function buildSnapshot(desde: string, hasta: string) {
  const [resumen, facturaRows, transactionRows, carteraRows] = await Promise.all([
    getSummary({ desde, hasta }),
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(estado = 'confirmada'), 0) AS confirmadas,
              COALESCE(SUM(estado = 'anulada'), 0) AS anuladas,
              COALESCE(SUM(tipo = 'venta' AND estado = 'confirmada'), 0) AS ventas,
              COALESCE(SUM(tipo = 'compra' AND estado = 'confirmada'), 0) AS compras,
              COALESCE(SUM(CASE WHEN tipo = 'venta' AND estado = 'confirmada'
                                THEN retencion_fuente + retencion_iva + retencion_ica ELSE 0 END), 0) AS ret_ventas,
              COALESCE(SUM(CASE WHEN tipo = 'compra' AND estado = 'confirmada'
                                THEN retencion_fuente + retencion_iva + retencion_ica ELSE 0 END), 0) AS ret_compras
       FROM invoices
       WHERE fecha BETWEEN ? AND ?`,
      [desde, hasta]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM transactions t
       WHERE t.fecha BETWEEN ? AND ? AND ${VALID_TRANSACTION}`,
      [desde, hasta]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN c.tipo = 'venta' THEN c.saldo_pendiente ELSE 0 END), 0) AS por_cobrar,
         COALESCE(SUM(CASE WHEN c.tipo = 'compra' THEN c.saldo_pendiente ELSE 0 END), 0) AS por_pagar
       FROM (
         SELECT i.tipo,
                GREATEST(i.total_neto - COALESCE(p.pagado, 0), 0) AS saldo_pendiente
         FROM invoices i
         LEFT JOIN (
           SELECT invoice_id, SUM(monto) AS pagado
           FROM invoice_payments
           WHERE estado = 'valido'
           GROUP BY invoice_id
         ) p ON p.invoice_id = i.id
         WHERE i.estado = 'confirmada' AND i.condicion_pago = 'credito'
           AND i.fecha BETWEEN ? AND ?
       ) c`,
      [desde, hasta]
    ),
  ]);

  const f = facturaRows[0][0];
  const cartera = carteraRows[0][0];
  return {
    generado_at: new Date().toISOString(),
    desde,
    hasta,
    resumen,
    facturas: {
      total: Number(f.total),
      confirmadas: Number(f.confirmadas),
      anuladas: Number(f.anuladas),
      ventas: Number(f.ventas),
      compras: Number(f.compras),
    },
    transacciones: Number(transactionRows[0][0]?.total ?? 0),
    cartera: {
      por_cobrar: roundMoney(Number(cartera.por_cobrar)),
      por_pagar: roundMoney(Number(cartera.por_pagar)),
    },
    retenciones: {
      ventas: roundMoney(Number(f.ret_ventas)),
      compras: roundMoney(Number(f.ret_compras)),
    },
  };
}

export interface ClosureRow {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: "cerrado" | "reabierto";
  snapshot: Record<string, unknown>;
  cerrado_at: string;
  reabierto_at: string | null;
  motivo_reapertura: string | null;
  cerrado_por: string;
  reabierto_por: string | null;
}

export async function listClosures(): Promise<ClosureRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT pc.id, pc.nombre, pc.fecha_inicio, pc.fecha_fin, pc.estado,
            pc.snapshot, pc.cerrado_at, pc.reabierto_at, pc.motivo_reapertura,
            uc.nombre AS cerrado_por, ur.nombre AS reabierto_por
     FROM period_closures pc
     JOIN users uc ON uc.id = pc.cerrado_by
     LEFT JOIN users ur ON ur.id = pc.reabierto_by
     ORDER BY pc.fecha_fin DESC, pc.id DESC`
  );
  return rows.map((r) => ({
    ...r,
    snapshot: typeof r.snapshot === "string" ? JSON.parse(r.snapshot) : r.snapshot,
  })) as ClosureRow[];
}

export async function getClosure(id: number) {
  const grouped = await listClosures();
  const found = grouped.find((c) => Number(c.id) === id);
  if (!found) throw new HttpError(404, "Cierre no encontrado");
  return found;
}

export async function createClosure(input: CreateClosureInput, actor: { id: number }) {
  // No se permiten cierres vigentes superpuestos: el bloqueo sería ambiguo.
  const [overlap] = await pool.query<RowDataPacket[]>(
    `SELECT id, nombre
     FROM period_closures
     WHERE estado = 'cerrado' AND fecha_inicio <= ? AND fecha_fin >= ?
     LIMIT 1`,
    [input.fecha_fin, input.fecha_inicio]
  );
  if (overlap[0]) {
    throw new HttpError(
      409,
      `El rango se superpone con el cierre vigente "${overlap[0].nombre}"`
    );
  }

  const snapshot = await buildSnapshot(input.fecha_inicio, input.fecha_fin);

  return withTransaction(async (conn) => {
    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO period_closures
         (nombre, fecha_inicio, fecha_fin, estado, snapshot, cerrado_by)
       VALUES (?, ?, ?, 'cerrado', ?, ?)`,
      [input.nombre, input.fecha_inicio, input.fecha_fin, JSON.stringify(snapshot), actor.id]
    );
    await auditFinance(conn, actor.id, "period_closure", res.insertId, "cerrar", null, {
      nombre: input.nombre,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      snapshot,
    });
    return { id: res.insertId, estado: "cerrado", snapshot };
  });
}

export async function reopenClosure(
  id: number,
  input: ReopenClosureInput,
  actor: { id: number }
) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM period_closures WHERE id = ? FOR UPDATE",
      [id]
    );
    const closure = rows[0];
    if (!closure) throw new HttpError(404, "Cierre no encontrado");
    if (closure.estado === "reabierto") {
      throw new HttpError(409, "El cierre ya está reabierto");
    }

    await conn.query(
      `UPDATE period_closures
       SET estado = 'reabierto', reabierto_by = ?, reabierto_at = NOW(), motivo_reapertura = ?
       WHERE id = ?`,
      [actor.id, input.motivo, id]
    );
    await auditFinance(
      conn,
      actor.id,
      "period_closure",
      id,
      "reabrir",
      { estado: "cerrado" },
      { estado: "reabierto", motivo: input.motivo }
    );

    return { id, estado: "reabierto" };
  });
}
