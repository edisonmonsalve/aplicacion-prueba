import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { z } from "zod";
import type { AuthUser } from "../../types/express.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import { calcLine, calcTotals } from "./quotes.calc.js";
import type { quoteSchema } from "./quotes.schema.js";

type QuoteInput = z.infer<typeof quoteSchema>;

const MAX_DESCUENTO_OPERADOR = 10;
const today = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD en hora local

// Validaciones que no necesitan la base de datos
function validateInput(input: QuoteInput, actor: AuthUser) {
  if (input.fecha_validez < today()) {
    throw new HttpError(400, "La fecha de validez no puede ser anterior a hoy"); // RN-P11
  }

  const ids = input.items.map((i) => i.product_id);
  if (new Set(ids).size !== ids.length) {
    throw new HttpError(400, "Un producto no puede repetirse en el presupuesto"); // RN-P03
  }

  if (actor.rol !== "admin" && input.items.some((i) => i.descuento_pct > MAX_DESCUENTO_OPERADOR)) {
    throw new HttpError(
      403,
      `Los descuentos mayores al ${MAX_DESCUENTO_OPERADOR} % requieren rol admin`
    ); // RN-P04
  }
}

// Toma precio, SKU y nombre del catálogo (RN-P02) y calcula cada línea y los totales (RN-P05)
async function buildLines(conn: PoolConnection, items: QuoteInput["items"]) {
  if (items.length === 0) return { lines: [], totals: calcTotals([]) };

  const [products] = await conn.query<RowDataPacket[]>(
    "SELECT id, sku, nombre, precio, activo FROM products WHERE id IN (?)",
    [items.map((i) => i.product_id)]
  );
  const byId = new Map(products.map((p) => [p.id as number, p]));

  const lines = items.map((item) => {
    const product = byId.get(item.product_id);
    if (!product) throw new HttpError(400, `El producto ${item.product_id} no existe`);
    if (!product.activo) throw new HttpError(409, `El producto ${product.sku} está inactivo`);

    const calc = calcLine({
      cantidad: item.cantidad,
      precioUnitario: product.precio,
      descuentoPct: item.descuento_pct,
      impuestoPct: item.impuesto_pct,
    });

    return {
      product_id: item.product_id,
      sku: product.sku as string,
      nombre: product.nombre as string,
      cantidad: item.cantidad,
      precio_unitario: product.precio as number,
      descuento_pct: item.descuento_pct,
      impuesto_pct: item.impuesto_pct,
      total_linea: calc.total,
    };
  });

  const totals = calcTotals(
    lines.map((l) => ({
      cantidad: l.cantidad,
      precioUnitario: l.precio_unitario,
      descuentoPct: l.descuento_pct,
      impuestoPct: l.impuesto_pct,
    }))
  );

  return { lines, totals };
}

async function insertItems(
  conn: PoolConnection,
  quoteId: number,
  lines: Awaited<ReturnType<typeof buildLines>>["lines"]
) {
  if (lines.length === 0) return;
  await conn.query(
    `INSERT INTO quote_items
       (quote_id, product_id, sku, nombre, cantidad, precio_unitario, descuento_pct, impuesto_pct, total_linea)
     VALUES ?`,
    [
      lines.map((l) => [
        quoteId,
        l.product_id,
        l.sku,
        l.nombre,
        l.cantidad,
        l.precio_unitario,
        l.descuento_pct,
        l.impuesto_pct,
        l.total_linea,
      ]),
    ]
  );
}

// Bloquea el presupuesto y comprueba que se puede modificar
async function lockDraft(conn: PoolConnection, id: number, actor: AuthUser) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, estado, created_by FROM quotes WHERE id = ? FOR UPDATE",
    [id]
  );
  const quote = rows[0];

  if (!quote) throw new HttpError(404, "Presupuesto no encontrado");
  if (actor.rol !== "admin" && quote.created_by !== actor.id) {
    throw new HttpError(403, "Solo el creador o un admin puede modificar este presupuesto");
  }
  if (quote.estado !== "borrador") {
    throw new HttpError(409, "Solo los borradores se pueden modificar"); // RN-P01
  }
}

const totalsResponse = (id: number, t: ReturnType<typeof calcTotals>) => ({
  id,
  subtotal: t.subtotal,
  descuento_total: t.descuentoTotal,
  impuesto_total: t.impuestoTotal,
  total: t.total,
});

export async function createQuote(input: QuoteInput, actor: AuthUser) {
  validateInput(input, actor);

  return withTransaction(async (conn) => {
    const { lines, totals } = await buildLines(conn, input.items);

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO quotes
         (customer_nombre, customer_documento, customer_email, fecha_validez, notas,
          subtotal, descuento_total, impuesto_total, total, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.customer_nombre,
        input.customer_documento ?? null,
        input.customer_email ?? null,
        input.fecha_validez,
        input.notas ?? null,
        totals.subtotal,
        totals.descuentoTotal,
        totals.impuestoTotal,
        totals.total,
        actor.id,
      ]
    );

    await insertItems(conn, res.insertId, lines);

    // RN-P12: primer registro del historial
    await conn.query(
      `INSERT INTO quote_status_history (quote_id, estado_anterior, estado_nuevo, user_id)
       VALUES (?, NULL, 'borrador', ?)`,
      [res.insertId, actor.id]
    );

    return totalsResponse(res.insertId, totals);
  });
}

export async function updateQuote(id: number, input: QuoteInput, actor: AuthUser) {
  validateInput(input, actor);

  return withTransaction(async (conn) => {
    await lockDraft(conn, id, actor);
    const { lines, totals } = await buildLines(conn, input.items);

    await conn.query(
      `UPDATE quotes SET
         customer_nombre = ?, customer_documento = ?, customer_email = ?,
         fecha_validez = ?, notas = ?,
         subtotal = ?, descuento_total = ?, impuesto_total = ?, total = ?
       WHERE id = ?`,
      [
        input.customer_nombre,
        input.customer_documento ?? null,
        input.customer_email ?? null,
        input.fecha_validez,
        input.notas ?? null,
        totals.subtotal,
        totals.descuentoTotal,
        totals.impuestoTotal,
        totals.total,
        id,
      ]
    );

    // Las líneas se reemplazan completas: más simple que comparar una por una
    await conn.query("DELETE FROM quote_items WHERE quote_id = ?", [id]);
    await insertItems(conn, id, lines);

    return totalsResponse(id, totals);
  });
}

export async function deleteQuote(id: number, actor: AuthUser) {
  await withTransaction(async (conn) => {
    await lockDraft(conn, id, actor);
    await conn.query("DELETE FROM quotes WHERE id = ?", [id]); // las líneas y el historial caen en cascada
  });
}