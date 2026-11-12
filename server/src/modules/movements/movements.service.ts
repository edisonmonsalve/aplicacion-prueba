import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { canSeeCosts } from "../../types/roles.js";
import { today } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { createAutoTransaction } from "../finance/finance.shared.js";
import type { createMovementSchema, listQuerySchema } from "./movements.schema.js";

export type MovementInput = z.infer<typeof createMovementSchema> & {
  // Campos internos: los usan cotizaciones/facturas para no duplicar asientos
  // y para dejar trazabilidad documental.
  skipFinance?: boolean;
  invoiceId?: number;
  invoiceAdjustmentId?: number;
  quoteId?: number;
  precio_unitario?: number;
};

export async function registerMovement(
  input: MovementInput,
  actor: AuthUser,
  externalConn?: PoolConnection
) {
  // Con conexión externa, la transacción (begin/commit/rollback) la maneja quien llama
  if (externalConn) return applyMovement(input, actor, externalConn);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await applyMovement(input, actor, conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function applyMovement(
  input: MovementInput,
  actor: AuthUser,
  conn: PoolConnection
) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, stock_actual, precio, costo, activo FROM products WHERE id = ? FOR UPDATE",
    [input.product_id]
  );
  const product = rows[0];

  if (!product) throw new HttpError(404, "Producto no encontrado");
  if (!product.activo) throw new HttpError(409, "El producto está inactivo");

  if (input.tipo === "entrada" && !["compra", "ajuste"].includes(input.origen)) {
    throw new HttpError(400, "El origen no corresponde a una entrada");
  }
  if (input.tipo === "salida" && !["venta", "entrega", "merma", "ajuste"].includes(input.origen)) {
    throw new HttpError(400, "El origen no corresponde a una salida");
  }

  const delta = input.tipo === "entrada" ? input.cantidad : -input.cantidad;
  const nuevoStock = product.stock_actual + delta;

  // RN-02: no se permite una salida mayor al stock disponible
  if (nuevoStock < 0) {
    throw new HttpError(409, `Stock insuficiente: disponible ${product.stock_actual}`);
  }

  await conn.query("UPDATE products SET stock_actual = ? WHERE id = ?", [nuevoStock, input.product_id]);

  // Entrada: costo de compra (dado o del producto).
  // Salida: costo histórico al momento de la salida, para costo de ventas.
  // Las devoluciones internas de notas (skipFinance) pueden fijar el costo
  // histórico de la línea original aunque sea una salida.
  const costoUnitario =
    input.tipo === "entrada"
      ? actor.rol === "admin" && input.costo_unitario !== undefined
        ? input.costo_unitario
        : Number(product.costo ?? 0)
      : actor.rol === "admin" &&
          input.skipFinance &&
          input.costo_unitario !== undefined
        ? input.costo_unitario
        : Number(product.costo ?? 0);

  // Precio comercial de la salida: el de la línea de cotización/factura si se
  // conoce; si no, el precio del catálogo para ventas manuales. No es costo.
  const precioUnitario =
    input.tipo === "salida"
      ? input.precio_unitario ??
        (input.origen === "venta" ? Number(product.precio ?? 0) : null)
      : null;

  const [res] = await conn.query<ResultSetHeader>(
    `INSERT INTO stock_movements
       (product_id, user_id, tipo, origen, cantidad, costo_unitario, precio_unitario,
        motivo, invoice_id, invoice_adjustment_id, quote_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.product_id,
      actor.id,
      input.tipo,
      input.origen,
      input.cantidad,
      costoUnitario,
      precioUnitario,
      input.motivo ?? null,
      input.invoiceId ?? null,
      input.invoiceAdjustmentId ?? null,
      input.quoteId ?? null,
    ]
  );

  // Generacion automatica de asientos financieros segun el origen.
  // Las facturas y cotizaciones la desactivan con skipFinance y crean sus
  // propios asientos a nivel de documento.
  if (!input.skipFinance) {
    if (input.tipo === "entrada" && input.origen === "compra" && costoUnitario > 0) {
      // La compra de inventario es salida de caja y activo, no gasto.
      await createAutoTransaction(conn, {
        tipo: "activo",
        monto: costoUnitario * input.cantidad,
        fecha: today(),
        categoriaCodigo: "inventario",
        accountId: input.account_id,
        productId: input.product_id,
        stockMovementId: res.insertId,
        descripcion: `Entrada de stock #${res.insertId} (compra)`,
        userId: actor.id,
      });
    }

    if (input.tipo === "salida" && input.origen === "venta") {
      const precio = precioUnitario ?? 0;
      if (precio > 0) {
        await createAutoTransaction(conn, {
          tipo: "ingreso",
          monto: precio * input.cantidad,
          fecha: today(),
          categoriaCodigo: "ventas",
          accountId: input.account_id,
          productId: input.product_id,
          stockMovementId: res.insertId,
          descripcion: `Salida de stock #${res.insertId} (venta)`,
          userId: actor.id,
        });
      }
    }
  }

  return {
    id: res.insertId,
    stock_actual: nuevoStock,
    ...(canSeeCosts(actor.rol) && {
      costo_unitario: costoUnitario,
      precio_unitario: precioUnitario,
    }),
  };
}

export async function listMovements(query: z.infer<typeof listQuerySchema>, actor: AuthUser) {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.product_id) {
    where.push("m.product_id = ?");
    params.push(query.product_id);
  }
  if (query.tipo) {
    where.push("m.tipo = ?");
    params.push(query.tipo);
  }
  if (query.origen) {
    where.push("m.origen = ?");
    params.push(query.origen);
  }
  if (query.invoice_id) {
    where.push("m.invoice_id = ?");
    params.push(query.invoice_id);
  }
  if (query.quote_id) {
    where.push("m.quote_id = ?");
    params.push(query.quote_id);
  }
  if (query.q) {
    const term = `%${query.q}%`;
    where.push("(p.sku LIKE ? OR p.nombre LIKE ? OR m.motivo LIKE ? OR u.nombre LIKE ?)");
    params.push(term, term, term, term);
  }
  if (query.desde) {
    // Columna directa: permite usar idx_movements_created_tipo.
    where.push("m.created_at >= ?");
    params.push(query.desde);
  }
  if (query.hasta) {
    where.push("m.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(query.hasta);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[summaryRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(m.tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(m.tipo = 'salida'), 0) AS salidas,
            COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END), 0) AS unidades_entrada,
            COALESCE(SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END), 0) AS unidades_salida
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       JOIN users u ON u.id = m.user_id
       ${clause}`,
    params
  );
  const total = Number(summaryRow.total);
  const costoColumn = canSeeCosts(actor.rol)
    ? "COALESCE(m.costo_unitario, p.costo) AS costo_unitario"
    : "NULL AS costo_unitario";
  // El precio de venta de una salida también es información sensible.
  const precioColumn = canSeeCosts(actor.rol)
    ? "m.precio_unitario"
    : "NULL AS precio_unitario";

  // El orden por costo/precio solo tiene sentido para quien puede ver esas cifras.
  const sortAllowed =
    query.sort && ((query.sort !== "costo" && query.sort !== "precio") || canSeeCosts(actor.rol))
      ? query.sort
      : undefined;
  const sortColumns = {
    fecha: "m.created_at",
    producto: "p.nombre",
    tipo: "m.tipo",
    origen: "m.origen",
    cantidad: "m.cantidad",
    costo: "COALESCE(m.costo_unitario, p.costo)",
    precio: "m.precio_unitario",
  } as const;
  const orderBy = sortAllowed
    ? `${sortColumns[sortAllowed]} ${query.order === "desc" ? "DESC" : "ASC"}, m.id DESC`
    : "m.id DESC";

  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.product_id, p.sku, p.nombre AS producto, m.tipo,
            m.origen, m.cantidad, ${costoColumn}, ${precioColumn},
            m.motivo, m.invoice_id, m.quote_id, u.nombre AS usuario, m.created_at
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     JOIN users u ON u.id = m.user_id
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
    summary: {
      entradas: Number(summaryRow.entradas),
      salidas: Number(summaryRow.salidas),
      unidades_entrada: Number(summaryRow.unidades_entrada),
      unidades_salida: Number(summaryRow.unidades_salida),
    },
  };
}
