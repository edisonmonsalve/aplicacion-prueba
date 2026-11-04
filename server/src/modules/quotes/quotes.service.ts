import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { z } from "zod";
import type { AuthUser } from "../../types/express.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import { calcLine, calcTotals } from "./quotes.calc.js";
import type { quoteSchema } from "./quotes.schema.js";
import { pool } from "../../config/Db.js";
import { addDays, today } from "../../utils/dates.js";
import { getQuote } from "./quotes.queries.js";
import { getQuoteHistory } from "./quotes.queries.js";
import { getQuoteAuditHeader, getQuoteAuditItems } from "./audit/quotes.audit.queries.js";
import { auditQuoteUpdate } from "./audit/quotes.audit.service.js";
import type { QuoteAuditSnapshot } from "./audit/quotes.audit.types.js";

type QuoteInput = z.infer<typeof quoteSchema>;

const MAX_DESCUENTO_OPERADOR = 10;
const VALIDEZ_POR_DEFECTO_DIAS = 15;
// const today = () => new Date().toLocaleDateString("en-CA"); // AAAA-MM-DD en hora local¡

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
async function lockQuote(conn: PoolConnection, id: number, actor: AuthUser) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, estado, created_by, fecha_validez FROM quotes WHERE id = ? FOR UPDATE",
    [id]
  );
  const quote = rows[0];
  if (!quote) throw new HttpError(404, "Presupuesto no encontrado");
  if (actor.rol !== "admin" && quote.created_by !== actor.id) {
    throw new HttpError(403, "Solo el creador o un admin puede modificar este presupuesto");
  }
  return quote;
}

async function lockDraft(conn: PoolConnection, id: number, actor: AuthUser) {
  const quote = await lockQuote(conn, id, actor);
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
    // 1. Verificar existencia, permisos y estado.
    await lockDraft(conn, id, actor);

    // 2. Recuperar el estado anterior dentro de la transacción.
    const previousHeader = await getQuoteAuditHeader(conn, id);
    const previousItems = await getQuoteAuditItems(conn, id);

    if (!previousHeader) {
      throw new HttpError(404, "Cotización no encontrada");
    }

    const previous: QuoteAuditSnapshot = {
      header: previousHeader,
      items: previousItems,
    };

    // 3. Construir las nuevas líneas y calcular totales.
    const { lines, totals } = await buildLines(conn, input.items);

    // 4. Actualizar encabezado.
    await conn.query(
      `UPDATE quotes SET
         customer_nombre = ?,
         customer_documento = ?,
         customer_email = ?,
         fecha_validez = ?,
         notas = ?,
         subtotal = ?,
         descuento_total = ?,
         impuesto_total = ?,
         total = ?
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

    // 5. Reemplazar las líneas.
    await conn.query( "DELETE FROM quote_items WHERE quote_id = ?", [id] );

    await insertItems(conn, id, lines);

    // 6. Construir el nuevo estado.
    const current: QuoteAuditSnapshot = {
      header: {
        customer_nombre: input.customer_nombre,
        customer_documento: input.customer_documento ?? null,
        customer_email: input.customer_email ?? null,
        fecha_validez: input.fecha_validez,
        notas: input.notas ?? null,
        subtotal: totals.subtotal,
        descuento_total: totals.descuentoTotal,
        impuesto_total: totals.impuestoTotal,
        total: totals.total,
      },
      items: lines,
    };

    // 7. Registrar los cambios.
    await auditQuoteUpdate( conn, id, actor.id, previous, current );

    return totalsResponse(id, totals);
  });
}

export async function deleteQuote(id: number, actor: AuthUser) {
  await withTransaction(async (conn) => {
    await lockDraft(conn, id, actor);
    await conn.query("DELETE FROM quotes WHERE id = ?", [id]); // las líneas y el historial caen en cascada
  });
}

export async function duplicateQuote(id: number, actor: AuthUser) {
  const source = (await getQuote(id, actor)) as Awaited<ReturnType<typeof getQuote>> & {
    customer_nombre: string;
    customer_documento: string | null;
    customer_email: string | null;
    notas: string | null;
  }; // mismas reglas de acceso que para leerlo

  // Los productos que ya no están activos se omiten, y se informa cuáles
  let activeIds = new Set<number>();
  if (source.items.length > 0) {
    const [active] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM products WHERE activo = 1 AND id IN (?)",
      [source.items.map((i) => i.product_id)]
    );
    activeIds = new Set(active.map((p) => p.id as number));
  }
  const kept = source.items.filter((i) => activeIds.has(i.product_id));
  const omitidos = source.items
    .filter((i) => !activeIds.has(i.product_id))
    .map((i) => ({ sku: i.sku, nombre: i.nombre }));

  // Pasa por createQuote: se aplican todas las reglas (precios vigentes, límites de descuento...)
  const created = await createQuote(
    {
      customer_nombre: source.customer_nombre,
      customer_documento: source.customer_documento ?? undefined,
      customer_email: source.customer_email ?? undefined,
      notas: source.notas ?? undefined,
      fecha_validez: addDays(today(), VALIDEZ_POR_DEFECTO_DIAS),
      items: kept.map((i) => ({
        product_id: i.product_id,
        cantidad: i.cantidad,
        descuento_pct: i.descuento_pct,
        impuesto_pct: i.impuesto_pct,
      })),
    },
    actor
  );

  return { ...created, omitidos };
}

export type QuoteAction = "send" | "approve" | "reject";

const TRANSITIONS: Record<QuoteAction, { from: string; to: string; verbo: string }> = {
  send: { from: "borrador", to: "enviado", verbo: "enviar" },
  approve: { from: "enviado", to: "aprobado", verbo: "aprobar" },
  reject: { from: "enviado", to: "rechazado", verbo: "rechazar" },
};

export async function changeStatus(id: number, action: QuoteAction, actor: AuthUser) {
  const rule = TRANSITIONS[action];

  return withTransaction(async (conn) => {
    const quote = await lockQuote(conn, id, actor);

    if (quote.estado !== rule.from) {
      throw new HttpError(
        409,
        `No se puede ${rule.verbo}: el presupuesto está en estado "${quote.estado}" y debe estar en "${rule.from}"`
      );
    }

    const expired = quote.fecha_validez < today();

    if (action === "send") {
      if (expired) throw new HttpError(409, "La fecha de validez ya pasó: edítala antes de enviar"); // RN-P11
      const [[{ total }]] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM quote_items WHERE quote_id = ?",
        [id]
      );
      if (Number(total) === 0) {
        throw new HttpError(409, "El presupuesto necesita al menos una línea para enviarse"); // RN-P10
      }
    }

    if (action === "approve" && expired) {
      throw new HttpError(409, "El presupuesto está vencido y ya no puede aprobarse"); // RN-P06
    }

    await conn.query("UPDATE quotes SET estado = ? WHERE id = ?", [rule.to, id]);
    await conn.query(
      `INSERT INTO quote_status_history (quote_id, estado_anterior, estado_nuevo, user_id)
       VALUES (?, ?, ?, ?)`,
      [id, rule.from, rule.to, actor.id] // RN-P12
    );

    return { id, estado: rule.to };
  });
}


// export async function transitionQuote(id: number, target: TransitionTarget, actor: AuthUser) {
//   return withTransaction(async (conn) => {
//     // 1. Bloquear el presupuesto
//     const [rows] = await conn.query<RowDataPacket[]>(
//       `SELECT id, estado, created_by, fecha_validez
//        FROM quotes
//        WHERE id = ?
//        FOR UPDATE`,
//       [id]
//     );

//     const quote = rows[0];

//     // 2. Comprobar existencia
//     if (!quote) {
//       throw new HttpError(404, "Presupuesto no encontrado");
//     }

//     // 3. Comprobar permisos
//     if (actor.rol !== "admin" && quote.created_by !== actor.id) {
//       throw new HttpError(403, "Solo el creador o un admin puede gestionar este presupuesto");
//     }

//     // 4. Comprobar transición permitida
//     const currentStatus = quote.estado as QuoteStatus;

//     if (!ALLOWED_TRANSITIONS[target].includes(currentStatus)) {
//       throw new HttpError(409, `No se puede cambiar de ${currentStatus} a ${target}`);
//     }

//     // Validar reglas de negocio
//     if (target === "enviado") {
//       const [items] = await conn.query<RowDataPacket[]>(
//         `SELECT id
//      FROM quote_items
//      WHERE quote_id = ?
//      LIMIT 1`,
//         [id]
//       );

//       if (items.length === 0) {
//         throw new HttpError(400, "No se puede enviar un presupuesto sin productos");
//       }

//       const todayDate = today();

//       if (quote.fecha_validez < todayDate) {
//         throw new HttpError(400, "No se puede enviar un presupuesto vencido");
//       }
//     }

//     if (target === "aprobado" && quote.fecha_validez < today()) {
//       throw new HttpError(400, "No se puede aprobar un presupuesto vencido");
//     }

//     // Actualizar estado
//     await conn.query(
//       `UPDATE quotes SET estado = ?, 
//       updated_at = CURRENT_TIMESTAMP
//       WHERE id = ?`,
//       [target, id]
//     );

//     // Registrar historial
//     await conn.query(
//       `INSERT INTO quote_status_history
//       (quote_id, estado_anterior, estado_nuevo, user_id)
//       VALUES (?, ?, ?, ?)`,
//       [id, currentStatus, target, actor.id]
//     );

//     return {
//       id,
//       estado_anterior: currentStatus,
//       estado_nuevo: target,
//     };
//   });
// }

export async function getQuoteHistoryById(
  id: number,
  actor: AuthUser
) {
  // Reutiliza la validación de existencia y autorización
  await getQuote(id, actor);

  const history = await getQuoteHistory(id);

  return {
    quote_id: id,
    history,
  };
}

