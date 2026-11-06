import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/Db.js";
import { listMovements } from "../movements/movements.service.js";

async function count(sql: string) {
  const [[row]] = await pool.query<RowDataPacket[]>(sql);
  return Number(row.total);
}

export async function getDashboard() {
  // Las cinco consultas son independientes: se lanzan juntas
  const [productosActivos, stockBajo, movimientosHoy, valor, bajos, recientes, graficos] = await Promise.all([
    count("SELECT COUNT(*) AS total FROM products WHERE activo = 1"),
    count("SELECT COUNT(*) AS total FROM products WHERE activo = 1 AND stock_actual < stock_minimo"),
    count("SELECT COUNT(*) AS total FROM stock_movements WHERE created_at >= CURDATE()"),
    pool.query<RowDataPacket[]>(
      "SELECT COALESCE(SUM(precio * stock_actual), 0) AS valor FROM products WHERE activo = 1"
    ),
    pool.query<RowDataPacket[]>(
      `SELECT id, sku, nombre, stock_actual, stock_minimo
         FROM products
         WHERE activo = 1 AND stock_actual < stock_minimo
         ORDER BY (stock_minimo - stock_actual) DESC
         LIMIT 5`
    ),
    listMovements({ page: 1, pageSize: 5 }), // se reutiliza la consulta del historial
    charts(),
  ]);

  return {
    productosActivos,
    stockBajo,
    movimientosHoy,
    valorInventario: Number(valor[0][0].valor),
    productosStockBajo: bajos[0],
    ultimosMovimientos: recientes.data,
    ...graficos,
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
