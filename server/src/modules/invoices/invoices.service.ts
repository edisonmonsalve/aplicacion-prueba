import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";
import { today } from "../../utils/dates.js";
import { roundMoney } from "../finance/finance.shared.js";
import { createAutoTransaction } from "../finance/finance.shared.js";
import { registerMovement } from "../movements/movements.service.js";
import type {
  createInvoiceSchema,
  updateInvoiceSchema,
  listQuerySchema,
} from "./invoices.schema.js";

function calcLine(item: z.infer<typeof createInvoiceSchema>["items"][number]) {
  const base = item.cantidad * item.precio_unitario;
  const desc = (base * item.descuento_pct) / 100;
  const imp = ((base - desc) * item.impuesto_pct) / 100;
  return roundMoney(base - desc + imp);
}

async function nextNumber(conn: PoolConnection, tipo: "venta" | "compra") {
  // Asegurar que exista el contador (por si fue eliminado en reset de tests)
  await conn.query(
    "INSERT IGNORE INTO invoice_counters (tipo, last_number) VALUES (?, 0)",
    [tipo]
  );
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT last_number FROM invoice_counters WHERE tipo = ? FOR UPDATE",
    [tipo]
  );
  const last = rows[0]?.last_number ?? 0;
  const next = last + 1;
  await conn.query("UPDATE invoice_counters SET last_number = ? WHERE tipo = ?", [next, tipo]);
  const prefix = tipo === "venta" ? "FAC" : "COM";
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export async function listInvoices(query: z.infer<typeof listQuerySchema>) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.tipo) { where.push("i.tipo = ?"); params.push(query.tipo); }
  if (query.estado) { where.push("i.estado = ?"); params.push(query.estado); }
  if (query.desde) { where.push("i.fecha >= ?"); params.push(query.desde); }
  if (query.hasta) { where.push("i.fecha <= ?"); params.push(query.hasta); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM invoices i ${clause}`,
    params
  );
  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT i.id, i.tipo, i.numero, i.fecha, i.contraparte, i.estado, i.total, i.created_at,
            u.nombre AS creador
     FROM invoices i JOIN users u ON u.id = i.created_by
     ${clause}
     ORDER BY i.id DESC LIMIT ? OFFSET ?`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize]
  );
  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function getInvoice(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, u.nombre AS creador FROM invoices i JOIN users u ON u.id = i.created_by WHERE i.id = ?`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, "Factura no encontrada");
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT ii.id, ii.product_id, p.sku, p.nombre AS producto, ii.cantidad, ii.precio_unitario,
            ii.descuento_pct, ii.impuesto_pct, ii.total_linea
     FROM invoice_items ii JOIN products p ON p.id = ii.product_id
     WHERE ii.invoice_id = ?`,
    [id]
  );
  return { ...rows[0], items };
}

export async function createInvoice(input: z.infer<typeof createInvoiceSchema>, actor: { id: number }) {
  return withTransaction(async (conn) => {
    const numero = await nextNumber(conn, input.tipo);
    const total = roundMoney(input.items.reduce((s, it) => s + calcLine(it), 0));

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO invoices (tipo, numero, fecha, contraparte, documento, email, total, notas, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.tipo, numero, input.fecha, input.contraparte, input.documento ?? null, input.email ?? null, total, input.notas ?? null, actor.id]
    );
    const invoiceId = res.insertId;

    for (const it of input.items) {
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, product_id, cantidad, precio_unitario, descuento_pct, impuesto_pct, total_linea)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [invoiceId, it.product_id, it.cantidad, it.precio_unitario, it.descuento_pct, it.impuesto_pct, calcLine(it)]
      );
    }
    return { id: invoiceId, numero, tipo: input.tipo };
  });
}

export async function updateInvoice(id: number, input: z.infer<typeof updateInvoiceSchema>) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT estado FROM invoices WHERE id = ? FOR UPDATE",
      [id]
    );
    if (!rows[0]) throw new HttpError(404, "Factura no encontrada");
    if (rows[0].estado !== "borrador") throw new HttpError(409, "Solo se editan facturas en borrador");

    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (input.fecha !== undefined) { sets.push("fecha = ?"); params.push(input.fecha); }
    if (input.contraparte !== undefined) { sets.push("contraparte = ?"); params.push(input.contraparte); }
    if (input.documento !== undefined) { sets.push("documento = ?"); params.push(input.documento ?? null); }
    if (input.email !== undefined) { sets.push("email = ?"); params.push(input.email ?? null); }
    if (input.notas !== undefined) { sets.push("notas = ?"); params.push(input.notas ?? null); }

    if (input.items) {
      await conn.query("DELETE FROM invoice_items WHERE invoice_id = ?", [id]);
      const total = roundMoney(input.items.reduce((s, it) => s + calcLine(it), 0));
      sets.push("total = ?"); params.push(total);
      for (const it of input.items) {
        await conn.query(
          `INSERT INTO invoice_items (invoice_id, product_id, cantidad, precio_unitario, descuento_pct, impuesto_pct, total_linea)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, it.product_id, it.cantidad, it.precio_unitario, it.descuento_pct, it.impuesto_pct, calcLine(it)]
        );
      }
    }
    if (sets.length === 0) throw new HttpError(400, "No hay nada que actualizar");
    await conn.query(`UPDATE invoices SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
    return { id };
  });
}

export async function confirmInvoice(id: number, actor: { id: number }) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM invoices WHERE id = ? FOR UPDATE",
      [id]
    );
    const inv = rows[0];
    if (!inv) throw new HttpError(404, "Factura no encontrada");
    if (inv.estado !== "borrador") throw new HttpError(409, "Solo se confirman facturas en borrador");

    const [items] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM invoice_items WHERE invoice_id = ?",
      [id]
    );
    if (items.length === 0) throw new HttpError(409, "La factura no tiene líneas");

    const isVenta = inv.tipo === "venta";

    // Validar stock para ventas antes de mover nada
    if (isVenta) {
      const ids = items.map((i: any) => i.product_id);
      const [products] = await conn.query<RowDataPacket[]>(
        "SELECT id, stock_actual, activo FROM products WHERE id IN (?) FOR UPDATE",
        [ids]
      );
      const byId = new Map(products.map((p: any) => [p.id, p]));
      for (const it of items as any[]) {
        const p = byId.get(it.product_id);
        if (!p || !p.activo) throw new HttpError(409, `Producto ${it.product_id} inactivo o inexistente`);
        if (p.stock_actual < it.cantidad) {
          throw new HttpError(409, `Stock insuficiente para el producto ${it.product_id}`);
        }
      }
    }

    let total = 0;
    for (const it of items as any[]) {
      const lineTotal = Number(it.total_linea);
      total += lineTotal;

      if (isVenta) {
        // salida de stock, origen venta (sin asiento automatico, se crea ingreso abajo)
        await registerMovement(
          {
            product_id: it.product_id,
            tipo: "salida",
            cantidad: it.cantidad,
            motivo: `Factura ${inv.numero}`,
            origen: "venta",
          },
          { id: actor.id, rol: "admin" } as any,
          conn
        );
      } else {
        // entrada de stock, origen compra: auto-genera gasto con el costo de la linea
        await registerMovement(
          {
            product_id: it.product_id,
            tipo: "entrada",
            cantidad: it.cantidad,
            costo_unitario: Number(it.precio_unitario),
            motivo: `Factura ${inv.numero}`,
            origen: "compra",
          },
          { id: actor.id, rol: "admin" } as any,
          conn
        );
        // Actualizar costo del producto
        await conn.query("UPDATE products SET costo = ? WHERE id = ?", [it.precio_unitario, it.product_id]);
      }
    }

    // Asiento financiero
    const financeCategoryId = await (async () => {
      const name = isVenta ? "Ventas" : "Compra de inventario";
      const tipo = isVenta ? "ingreso" : "gasto";
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM finance_categories WHERE nombre = ? AND tipo = ? AND activo = 1 LIMIT 1",
        [name, tipo]
      );
      return rows[0]?.id as number | undefined;
    })();
    if (!financeCategoryId) throw new HttpError(500, "Falta categoría financiera");

    const accountId = await (async () => {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM finance_accounts WHERE activo = 1 ORDER BY id LIMIT 1"
      );
      return rows[0]?.id as number | undefined;
    })();
    if (!accountId) throw new HttpError(500, "No hay cuenta financiera activa");

    await conn.query(
      `INSERT INTO transactions (tipo, monto, fecha, finance_category_id, account_id, descripcion, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [isVenta ? "ingreso" : "gasto", roundMoney(total), inv.fecha, financeCategoryId, accountId, `Factura ${inv.numero}`, actor.id]
    );

    await conn.query("UPDATE invoices SET estado = 'confirmada', total = ? WHERE id = ?", [roundMoney(total), id]);
    return { id, estado: "confirmada" };
  });
}

export async function cancelInvoice(id: number, actor: { id: number }) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM invoices WHERE id = ? FOR UPDATE",
      [id]
    );
    const inv = rows[0];
    if (!inv) throw new HttpError(404, "Factura no encontrada");
    if (inv.estado !== "confirmada") throw new HttpError(409, "Solo se anulan facturas confirmadas");

    const [items] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM invoice_items WHERE invoice_id = ?",
      [id]
    );

    const isVenta = inv.tipo === "venta";
    for (const it of items as any[]) {
      if (isVenta) {
        await conn.query("UPDATE products SET stock_actual = stock_actual + ? WHERE id = ?", [it.cantidad, it.product_id]);
      } else {
        await conn.query("UPDATE products SET stock_actual = stock_actual - ? WHERE id = ?", [it.cantidad, it.product_id]);
      }
    }

    // Contrapartida financiera
    const financeCategoryId = await (async () => {
      const name = isVenta ? "Ventas" : "Compra de inventario";
      const tipo = isVenta ? "ingreso" : "gasto";
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM finance_categories WHERE nombre = ? AND tipo = ? AND activo = 1 LIMIT 1",
        [name, tipo]
      );
      return rows[0]?.id as number | undefined;
    })();
    const accountId = await (async () => {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM finance_accounts WHERE activo = 1 ORDER BY id LIMIT 1"
      );
      return rows[0]?.id as number | undefined;
    })();
    if (financeCategoryId && accountId) {
      await conn.query(
        `INSERT INTO transactions (tipo, monto, fecha, finance_category_id, account_id, descripcion, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [isVenta ? "gasto" : "ingreso", inv.total, inv.fecha, financeCategoryId, accountId, `Anulación de factura ${inv.numero}`, actor.id]
      );
    }

    await conn.query("UPDATE invoices SET estado = 'anulada' WHERE id = ?", [id]);
    return { id, estado: "anulada" };
  });
}

export async function deleteInvoice(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT estado FROM invoices WHERE id = ?", [id]);
  if (!rows[0]) throw new HttpError(404, "Factura no encontrada");
  if (rows[0].estado !== "borrador") throw new HttpError(409, "Solo se eliminan facturas en borrador");
  await pool.query("DELETE FROM invoices WHERE id = ?", [id]);
  return { id };
}

function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  // lazy import to avoid circular
  return (async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const r = await fn(conn);
      await conn.commit();
      return r;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })();
}