import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/Db.js";
import { listMovements } from "../movements/movements.service.js";

async function count(sql: string) {
  const [[row]] = await pool.query<RowDataPacket[]>(sql);
  return Number(row.total);
}

export async function getDashboard() {
  // Las cinco consultas son independientes: se lanzan juntas
  const [productosActivos, stockBajo, movimientosHoy, valor, bajos, recientes] =
    await Promise.all([
      count("SELECT COUNT(*) AS total FROM products WHERE activo = 1"),
      count(
        "SELECT COUNT(*) AS total FROM products WHERE activo = 1 AND stock_actual < stock_minimo"
      ),
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
    ]);

  return {
    productosActivos,
    stockBajo,
    movimientosHoy,
    valorInventario: Number(valor[0][0].valor),
    productosStockBajo: bajos[0],
    ultimosMovimientos: recientes.data,
  };
}