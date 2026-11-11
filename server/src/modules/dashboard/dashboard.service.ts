import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { today } from "../../utils/dates.js";
import { getSummary } from "../finance/transactions.service.js";
import { listMovements } from "../movements/movements.service.js";

async function count(sql: string) {
  const [[row]] = await pool.query<RowDataPacket[]>(sql);
  return Number(row.total);
}

export async function getDashboard(actor: AuthUser) {
  // Las consultas son independientes: se lanzan juntas.
  const [productosActivos, stockBajo, movimientosHoy, valor, bajos, recientes, graficos, finanzas] = await Promise.all([
    count("SELECT COUNT(*) AS total FROM products WHERE activo = 1"),
    count("SELECT COUNT(*) AS total FROM products WHERE activo = 1 AND stock_actual < stock_minimo"),
    count("SELECT COUNT(*) AS total FROM stock_movements WHERE created_at >= CURDATE()"),
    pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(precio * stock_actual), 0) AS venta,
              COALESCE(SUM(costo * stock_actual), 0) AS costo,
              COALESCE(SUM(CASE WHEN costo <= 0 AND stock_actual > 0 THEN 1 ELSE 0 END), 0) AS sin_costo
       FROM products WHERE activo = 1`
    ),
    pool.query<RowDataPacket[]>(
      `SELECT id, sku, nombre, stock_actual, stock_minimo
         FROM products
         WHERE activo = 1 AND stock_actual < stock_minimo
         ORDER BY (stock_minimo - stock_actual) DESC
         LIMIT 5`
    ),
    listMovements({ page: 1, pageSize: 5 }, actor), // se reutiliza la consulta del historial
    charts(),
    // El operador no participa del módulo financiero: no recibe estas cifras.
    actor.rol === "operador" ? Promise.resolve(null) : financeOverview(),
  ]);

  return {
    productosActivos,
    stockBajo,
    movimientosHoy,
    valorInventario: Number(valor[0][0].venta),
    valorInventarioCosto: Number(valor[0][0].costo),
    productosSinCosto: Number(valor[0][0].sin_costo),
    productosStockBajo: bajos[0],
    ultimosMovimientos: recientes.data,
    ...graficos,
    ...(finanzas ? { finanzas } : {}),
  };
}

/** Rango [inicio, fin] del mes actual y del anterior, en formato AAAA-MM-DD. */
function monthRanges() {
  const now = today();
  const [year, month] = now.slice(0, 7).split("-").map(Number);
  const currentStart = `${now.slice(0, 7)}-01`;
  const prevStartDate = new Date(Date.UTC(year, month - 2, 1));
  const prevEndDate = new Date(Date.UTC(year, month - 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    current: { desde: currentStart, hasta: now },
    previous: { desde: iso(prevStartDate), hasta: iso(prevEndDate) },
  };
}

/**
 * Resumen financiero del mes para el panel de Inicio.
 * Compara el mes en curso con el mes anterior completo.
 */
async function financeOverview() {
  const ranges = monthRanges();
  const [actual, anterior] = await Promise.all([
    getSummary(ranges.current),
    getSummary(ranges.previous),
  ]);
  const variacion = (now: number, before: number) =>
    before === 0 ? null : Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
  return {
    desde: actual.desde,
    hasta: actual.hasta,
    ingresos: actual.ingresos,
    egresos: actual.egresos,
    utilidad: actual.utilidad,
    margen_bruto_pct: actual.margen_bruto_pct,
    iva_neto: actual.iva_neto,
    capital_disponible: actual.capital_disponible,
    ingresos_anterior: anterior.ingresos,
    egresos_anterior: anterior.egresos,
    utilidad_anterior: anterior.utilidad,
    variacion_ingresos_pct: variacion(actual.ingresos, anterior.ingresos),
    variacion_egresos_pct: variacion(actual.egresos, anterior.egresos),
    variacion_utilidad_pct: variacion(actual.utilidad, anterior.utilidad),
  };
}

async function charts() {
  const [dias, estados, top] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS dia, tipo, SUM(cantidad) AS total
       FROM stock_movements
       WHERE created_at >= CURDATE() - INTERVAL 6 DAY
       GROUP BY dia, tipo`
    ),
    pool.query<RowDataPacket[]>("SELECT estado, COUNT(*) AS total FROM quotes GROUP BY estado"),
    pool.query<RowDataPacket[]>(
      `SELECT p.sku, p.nombre, SUM(qi.cantidad) AS unidades
       FROM quote_items qi
       JOIN quotes q ON q.id = qi.quote_id
       JOIN products p ON p.id = qi.product_id
       WHERE q.estado IN ('aprobado', 'entregado')
       GROUP BY p.id, p.sku, p.nombre
       ORDER BY unidades DESC
       LIMIT 5`
    ),
  ]);
  return {
    movimientosPorDia: dias[0].map((r) => ({
      dia: r.dia as string,
      tipo: r.tipo as string,
      total: Number(r.total),
    })),
    presupuestosPorEstado: estados[0].map((r) => ({ estado: r.estado as string, total: Number(r.total) })),
    topProductos: top[0].map((r) => ({
      sku: r.sku as string,
      nombre: r.nombre as string,
      unidades: Number(r.unidades),
    })),
  };
}
