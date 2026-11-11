import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { canSeeCosts } from "../../types/roles.js";
import { HttpError } from "../../utils/http-error.js";
import { buildSet } from "../../utils/sql.js";
import type {
  createProductSchema,
  listQuerySchema,
  updateProductSchema,
} from "./products.schema.js";

export async function listProducts(query: z.infer<typeof listQuerySchema>, actor: AuthUser) {
  const where: string[] = [];
  const params: (string | number)[] = [];  if (query.q) {
    where.push("(p.nombre LIKE ? OR p.sku LIKE ?)");
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.category_id) {
    where.push("p.category_id = ?");
    params.push(query.category_id);
  }
  if (query.activo) {
    where.push("p.activo = ?");
    params.push(Number(query.activo));
  }
  if (query.bajoStock) {
    where.push("p.stock_actual < p.stock_minimo");
  }
  if (query.ids) {
    const ids = [...new Set(query.ids.split(",").map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0
    );
    if (ids.length === 0) {
      where.push("1 = 0");
    } else {
      where.push(`p.id IN (${ids.map(() => "?").join(", ")})`);
      params.push(...ids);
    }
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // El operador no ve costos: se devuelve NULL en lugar de omitir la columna
  const verCosto = canSeeCosts(actor.rol);
  const costoColumn = verCosto ? "p.costo" : "NULL AS costo";

  // "costo" solo tiene sentido para roles que pueden verlo: en el resto se
  // ignora y queda el orden por fecha de creación.
  const sort = query.sort && (query.sort !== "costo" || verCosto) ? query.sort : undefined;
  const sortColumns = {
    sku: "p.sku",
    nombre: "p.nombre",
    precio: "p.precio",
    stock: "p.stock_actual",
    costo: "p.costo",
  } as const;
  const orderBy = sort
    ? `${sortColumns[sort]} ${query.order === "desc" ? "DESC" : "ASC"}, p.id ASC`
    : "p.id DESC";

  const [[{ total, unidades, valor }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(p.stock_actual), 0) AS unidades,
            COALESCE(SUM(p.precio * p.stock_actual), 0) AS valor
       FROM products p ${clause}`,
    params
  );

  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.sku, p.nombre, p.category_id, c.nombre AS categoria,
            p.precio, ${costoColumn}, p.stock_actual, p.stock_minimo, p.activo, p.created_at
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${clause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return {
    data,
    total,
    page: query.page,
    pageSize: query.pageSize,
    summary: { unidades: Number(unidades), valor: Number(valor) },
  };
}

export async function createProduct(input: z.infer<typeof createProductSchema>, actor: AuthUser) {
  // Solo admin fija el costo; el operador crea con costo 0 y no lo ve
  const costo = actor.rol === "admin" ? (input.costo ?? 0) : 0;

  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO products (sku, nombre, category_id, precio, costo, stock_minimo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.sku, input.nombre, input.category_id, input.precio, costo, input.stock_minimo]
  );
  return { id: res.insertId };
}

export async function updateProduct(
  id: number,
  input: z.infer<typeof updateProductSchema>,
  actor: AuthUser
) {
  const { sql, params } = buildSet({
    sku: input.sku,
    nombre: input.nombre,
    category_id: input.category_id,
    precio: input.precio,
    // Ver el costo no es lo mismo que poder fijarlo: solo admin lo modifica
    costo: actor.rol === "admin" ? input.costo : undefined,
    stock_minimo: input.stock_minimo,
  });
  if (!sql) throw new HttpError(400, "No hay nada que actualizar");

  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE products SET ${sql} WHERE id = ?`,
    [...params, id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Producto no encontrado");
}

export async function setProductActivo(id: number, activo: boolean) {
  if (!activo) {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT stock_actual FROM products WHERE id = ?",
      [id]
    );
    const stock = Number((rows as RowDataPacket[])[0]?.stock_actual ?? 0);
    if (stock > 0) {
      throw new HttpError(409, `No se puede desactivar: el producto tiene ${stock} unidades en stock`);
    }
    const [q] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM quote_items qi
       JOIN quotes q ON q.id = qi.quote_id
       WHERE qi.product_id = ? AND q.estado IN ('enviado','aprobado')`,
      [id]
    );
    if (Number((q as RowDataPacket[])[0].c) > 0) {
      throw new HttpError(409, "No se puede desactivar: el producto está en cotizaciones enviadas o aprobadas");
    }
  }
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE products SET activo = ? WHERE id = ?",
    [activo ? 1 : 0, id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Producto no encontrado");
}