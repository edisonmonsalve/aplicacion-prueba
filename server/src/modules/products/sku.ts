import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";

const pad = (value: number) => String(value).padStart(4, "0");

async function skuExists(sku: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM products WHERE sku = ? LIMIT 1",
    [sku]
  );
  return rows.length > 0;
}

/**
 * Sugiere el siguiente SKU libre de una categoría: `PREF-0001`, `PREF-0002`...
 *
 * El prefijo es el código de la categoría. Se calcula el mayor consecutivo ya
 * usado con ese prefijo y se avanza hasta encontrar un SKU libre, porque el
 * usuario puede editar el campo y dejar huecos o repetir prefijos entre
 * categorías. El índice UNIQUE de products sigue siendo la última barrera.
 */
export async function suggestSku(categoryId: number): Promise<string> {
  const [categories] = await pool.query<RowDataPacket[]>(
    "SELECT id, codigo FROM categories WHERE id = ?",
    [categoryId]
  );
  const category = categories[0];
  if (!category) throw new HttpError(404, "Categoría no encontrada");

  const prefix = String(category.codigo || `C${category.id}`);
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT sku FROM products WHERE sku LIKE ?",
    [`${prefix}-%`]
  );

  let max = 0;
  for (const row of rows) {
    const match = /-(\d+)$/.exec(String(row.sku));
    if (match) max = Math.max(max, Number(match[1]));
  }

  let sequence = max + 1;
  let sku = `${prefix}-${pad(sequence)}`;
  while (await skuExists(sku)) {
    sequence += 1;
    sku = `${prefix}-${pad(sequence)}`;
  }
  return sku;
}
