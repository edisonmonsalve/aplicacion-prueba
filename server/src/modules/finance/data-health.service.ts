import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import { VALID_TRANSACTION } from "./finance.shared.js";

type Severity = "alta" | "media";

interface HealthCheck {
  codigo: string;
  titulo: string;
  descripcion: string;
  severidad: Severity;
  hallazgos: number;
  detalle: Record<string, unknown>[];
}

/**
 * Panel de salud de datos.
 *
 * Revisa invariantes que los informes asumen ciertas y que, si se rompen,
 * descuadran la contabilidad o la analítica:
 *
 * - Asientos huérfanos: asientos vigentes ligados a una factura que ya no está
 *   confirmada (anulada o desaparecida). Deberían haber sido revertidos.
 * - Pagos huérfanos: cobros/pagos válidos sin asiento de caja vigente.
 * - Stock negativo: existencias por debajo de cero (dato heredado o importado).
 * - Productos sin costo: existencias con costo cero o nulo, que subestiman el
 *   inventario, el costo de ventas y el margen.
 *
 * El panel es de solo lectura: informa hallazgos, no corrige datos.
 */
export async function getDataHealth() {
  const [huerfanos] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.fecha, t.monto, t.tipo, t.invoice_id,
            i.numero AS factura, i.estado AS estado_factura
     FROM transactions t
     LEFT JOIN invoices i ON i.id = t.invoice_id
     WHERE t.invoice_id IS NOT NULL
       AND ${VALID_TRANSACTION}
       AND (i.id IS NULL OR i.estado <> 'confirmada')
     ORDER BY t.fecha DESC, t.id DESC`
  );

  const [pagos] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.invoice_id, i.numero AS factura, p.fecha, p.monto,
            p.transaction_id, p.estado
     FROM invoice_payments p
     LEFT JOIN invoices i ON i.id = p.invoice_id
     LEFT JOIN transactions t ON t.id = p.transaction_id
     WHERE p.estado = 'valido'
       AND (
         p.transaction_id IS NULL
         OR t.id IS NULL
         OR t.anulada_de IS NOT NULL
         OR EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
       )
     ORDER BY p.fecha DESC, p.id DESC`
  );

  const [stockNegativo] = await pool.query<RowDataPacket[]>(
    `SELECT id, sku, nombre, stock_actual
     FROM products
     WHERE stock_actual < 0
     ORDER BY stock_actual, nombre`
  );

  const [sinCosto] = await pool.query<RowDataPacket[]>(
    `SELECT id, sku, nombre, stock_actual, costo
     FROM products
     WHERE activo = 1 AND stock_actual > 0 AND (costo IS NULL OR costo = 0)
     ORDER BY stock_actual DESC, nombre`
  );

  const checks: HealthCheck[] = [
    {
      codigo: "asientos_huerfanos",
      titulo: "Asientos huérfanos",
      descripcion:
        "Asientos vigentes ligados a facturas anuladas o no confirmadas; deberían haberse revertido.",
      severidad: "alta",
      hallazgos: huerfanos.length,
      detalle: huerfanos.map((r) => ({
        id: Number(r.id),
        fecha: String(r.fecha).slice(0, 10),
        monto: Number(r.monto),
        tipo: String(r.tipo),
        invoice_id: Number(r.invoice_id),
        factura: r.factura ?? null,
        estado_factura: r.estado_factura ?? null,
      })),
    },
    {
      codigo: "pagos_huerfanos",
      titulo: "Pagos sin asiento vigente",
      descripcion:
        "Cobros o pagos marcados como válidos cuyo asiento de caja falta, fue anulado o no existe.",
      severidad: "alta",
      hallazgos: pagos.length,
      detalle: pagos.map((r) => ({
        id: Number(r.id),
        invoice_id: Number(r.invoice_id),
        factura: r.factura ?? null,
        fecha: String(r.fecha).slice(0, 10),
        monto: Number(r.monto),
        transaction_id: r.transaction_id === null ? null : Number(r.transaction_id),
      })),
    },
    {
      codigo: "stock_negativo",
      titulo: "Stock negativo",
      descripcion:
        "Productos con existencias por debajo de cero, normalmente por datos heredados o importados.",
      severidad: "alta",
      hallazgos: stockNegativo.length,
      detalle: stockNegativo.map((r) => ({
        id: Number(r.id),
        sku: String(r.sku),
        nombre: String(r.nombre),
        stock_actual: Number(r.stock_actual),
      })),
    },
    {
      codigo: "productos_sin_costo",
      titulo: "Productos sin costo",
      descripcion:
        "Productos activos con existencias y costo cero o nulo: subestiman inventario, costo de ventas y margen.",
      severidad: "media",
      hallazgos: sinCosto.length,
      detalle: sinCosto.map((r) => ({
        id: Number(r.id),
        sku: String(r.sku),
        nombre: String(r.nombre),
        stock_actual: Number(r.stock_actual),
        costo: r.costo === null ? null : Number(r.costo),
      })),
    },
  ];

  const conProblemas = checks.filter((c) => c.hallazgos > 0).length;
  const totalHallazgos = checks.reduce((s, c) => s + c.hallazgos, 0);

  return {
    generado_at: new Date().toISOString(),
    estado: totalHallazgos === 0 ? "ok" : "alerta",
    resumen: {
      checks: checks.length,
      con_problemas: conProblemas,
      total_hallazgos: totalHallazgos,
    },
    checks,
  };
}
