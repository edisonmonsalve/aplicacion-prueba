import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import { auditFinance, roundMoney, VALID_TRANSACTION } from "../finance/finance.shared.js";
import { getSummary } from "../finance/transactions.service.js";
import { getBalance } from "../finance/reports.service.js";
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
                GREATEST(i.total_neto + COALESCE(n.ajuste, 0) - COALESCE(p.pagado, 0), 0) AS saldo_pendiente
         FROM invoices i
         LEFT JOIN (
           SELECT invoice_id, SUM(monto) AS pagado
           FROM invoice_payments
           WHERE estado = 'valido'
           GROUP BY invoice_id
         ) p ON p.invoice_id = i.id
         LEFT JOIN (
           SELECT invoice_id,
                  SUM(CASE WHEN tipo = 'credito' THEN -total_neto ELSE total_neto END) AS ajuste
           FROM invoice_adjustments
           WHERE estado = 'confirmada'
           GROUP BY invoice_id
         ) n ON n.invoice_id = i.id
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
  tipo: "periodo" | "ejercicio";
  anio: number | null;
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
    `SELECT pc.id, pc.nombre, pc.tipo, pc.anio, pc.fecha_inicio, pc.fecha_fin, pc.estado,
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
         (nombre, tipo, anio, fecha_inicio, fecha_fin, estado, snapshot, cerrado_by)
       VALUES (?, 'periodo', NULL, ?, ?, 'cerrado', ?, ?)`,
      [input.nombre, input.fecha_inicio, input.fecha_fin, JSON.stringify(snapshot), actor.id]
    );
    await auditFinance(conn, actor.id, "period_closure", res.insertId, "cerrar", null, {
      nombre: input.nombre,
      tipo: "periodo",
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      snapshot,
    });
    return { id: res.insertId, estado: "cerrado", tipo: "periodo", snapshot };
  });
}

/** Fecha final del ejercicio y validación de años razonables. */
function fiscalRange(anio: number) {
  const actual = new Date().getFullYear();
  if (anio > actual) {
    throw new HttpError(400, "No se puede cerrar un ejercicio futuro");
  }
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
}

async function activeFiscalClosure(anio: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, nombre
     FROM period_closures
     WHERE tipo = 'ejercicio' AND anio = ? AND estado = 'cerrado'
     LIMIT 1`,
    [anio]
  );
  return rows[0] ?? null;
}

/**
 * Foto del ejercicio: reutiliza el snapshot del periodo y añade el resultado
 * contable y el balance a 31 de diciembre. No crea asientos de cierre.
 */
async function buildFiscalSnapshot(anio: number) {
  const { desde, hasta } = fiscalRange(anio);
  const [base, balance, meses] = await Promise.all([
    buildSnapshot(desde, hasta),
    getBalance({ hasta }),
    pool.query<RowDataPacket[]>(
      `SELECT id, nombre, fecha_inicio, fecha_fin
       FROM period_closures
       WHERE tipo = 'periodo' AND estado = 'cerrado'
         AND fecha_inicio >= ? AND fecha_fin <= ?
       ORDER BY fecha_inicio`,
      [desde, hasta]
    ),
  ]);

  const resumen = base.resumen;
  return {
    ...base,
    tipo: "ejercicio",
    anio,
    resultado: {
      ingresos: resumen.ingresos_totales,
      costo_ventas: resumen.costo_ventas,
      margen_bruto: resumen.margen_bruto,
      gastos: resumen.gastos_totales,
      utilidad: resumen.utilidad,
      utilidad_pct:
        resumen.ingresos_totales > 0
          ? roundMoney((resumen.utilidad / resumen.ingresos_totales) * 100)
          : 0,
    },
    balance: {
      activo: balance.activo.total,
      pasivo: balance.pasivo.total,
      patrimonio: balance.patrimonio,
      caja_bancos: balance.activo.caja_bancos,
      inventario: balance.activo.inventario,
      cartera_por_cobrar: balance.activo.cartera_por_cobrar,
      cartera_por_pagar: balance.pasivo.cartera_por_pagar,
      iva_por_pagar: balance.pasivo.iva_por_pagar,
      iva_a_favor: balance.activo.iva_a_favor,
      cuadra: balance.ecuacion.cuadra,
    },
    meses_cerrados: meses[0].map((m) => ({
      id: Number(m.id),
      nombre: String(m.nombre),
      fecha_inicio: m.fecha_inicio,
      fecha_fin: m.fecha_fin,
    })),
  };
}

/** Vista previa del cierre anual sin persistirlo. */
export async function previewFiscalYear(anio: number) {
  const { desde, hasta } = fiscalRange(anio);
  const [vigente, snapshot] = await Promise.all([
    activeFiscalClosure(anio),
    buildFiscalSnapshot(anio),
  ]);
  return {
    anio,
    fecha_inicio: desde,
    fecha_fin: hasta,
    existe_cierre_vigente: !!vigente,
    cierre_vigente_id: vigente ? Number(vigente.id) : null,
    snapshot,
  };
}

/**
 * Cierra un ejercicio completo (1 de enero a 31 de diciembre).
 *
 * Puede convivir con cierres mensuales ya existentes: el cierre anual es el
 * candado del año. Reabrir el anual no reabre los meses; cada cierre conserva su
 * propio estado y su historial.
 */
export async function createFiscalClosure(anio: number, actor: { id: number }) {
  const { desde, hasta } = fiscalRange(anio);
  const vigente = await activeFiscalClosure(anio);
  if (vigente) {
    throw new HttpError(
      409,
      `El ejercicio ${anio} ya está cerrado por "${vigente.nombre}". Reábrelo antes de volver a cerrarlo.`
    );
  }

  const snapshot = await buildFiscalSnapshot(anio);
  const nombre = `Cierre ejercicio ${anio}`;

  return withTransaction(async (conn) => {
    const [again] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM period_closures
       WHERE tipo = 'ejercicio' AND anio = ? AND estado = 'cerrado'
       FOR UPDATE`,
      [anio]
    );
    if (again[0]) {
      throw new HttpError(409, `El ejercicio ${anio} ya está cerrado`);
    }

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO period_closures
         (nombre, tipo, anio, fecha_inicio, fecha_fin, estado, snapshot, cerrado_by)
       VALUES (?, 'ejercicio', ?, ?, ?, 'cerrado', ?, ?)`,
      [nombre, anio, desde, hasta, JSON.stringify(snapshot), actor.id]
    );
    await auditFinance(
      conn,
      actor.id,
      "period_closure",
      res.insertId,
      "cerrar_ejercicio",
      null,
      { nombre, tipo: "ejercicio", anio, fecha_inicio: desde, fecha_fin: hasta, snapshot }
    );
    return {
      id: res.insertId,
      estado: "cerrado",
      tipo: "ejercicio",
      anio,
      snapshot,
    };
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
      { estado: "cerrado", tipo: closure.tipo, anio: closure.anio },
      { estado: "reabierto", tipo: closure.tipo, anio: closure.anio, motivo: input.motivo }
    );

    return { id, estado: "reabierto" };
  });
}
