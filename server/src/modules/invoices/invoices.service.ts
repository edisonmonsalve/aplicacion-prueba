import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import { addDays } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { createAutoTransaction, roundMoney } from "../finance/finance.shared.js";
import type { AuthUser } from "../../types/express.js";
import { registerMovement } from "../movements/movements.service.js";
import { formatQuoteNumber } from "../quotes/quotes.format.js";
import {
  assertPartyType,
  findThirdPartyForInvoice,
} from "../third-parties/third-parties.service.js";
import { invoiceBalance, listInvoicePayments } from "./invoice-payments.service.js";
import { listAdjustments } from "./invoice-adjustments.service.js";
import {
  calcLine,
  calcTotals,
  insertAllocations,
  invoiceCashProjection,
  rowToLine,
  totalsFromRows,
} from "./invoices.shared.js";
import type {
  createInvoiceSchema,
  updateInvoiceSchema,
  listQuerySchema,
} from "./invoices.schema.js";

type InvoiceInput = z.infer<typeof createInvoiceSchema>;

function totalRetenciones(inv: {
  retencion_fuente?: number | null;
  retencion_iva?: number | null;
  retencion_ica?: number | null;
}) {
  return roundMoney(
    Number(inv.retencion_fuente ?? 0) +
      Number(inv.retencion_iva ?? 0) +
      Number(inv.retencion_ica ?? 0)
  );
}

/** Una retención mayor que la factura dejaría un neto negativo a pagar. */
function assertRetentions(retenciones: number, total: number) {
  if (retenciones > roundMoney(total)) {
    throw new HttpError(
      400,
      `Las retenciones (${retenciones.toFixed(2)}) no pueden superar el total de la factura (${total.toFixed(2)})`
    );
  }
}

type PaymentCondition = "contado" | "credito";

/**
 * Resuelve la condición de pago de la factura.
 *
 * El tercero aporta los valores por defecto; la factura puede sobrescribirlos.
 * A crédito, el vencimiento se calcula desde la fecha de la factura salvo que
 * el usuario indique una fecha explícita.
 */
function resolvePaymentTerms(params: {
  condicion?: PaymentCondition | null;
  diasCredito?: number | null;
  fechaVencimiento?: string | null;
  fecha: string;
  fallbackCondicion: PaymentCondition;
  fallbackDias: number;
}) {
  const condicion = params.condicion ?? params.fallbackCondicion;
  const dias =
    condicion === "contado"
      ? 0
      : params.diasCredito ?? params.fallbackDias;
  const fecha_vencimiento =
    params.fechaVencimiento ??
    (condicion === "credito" ? addDays(params.fecha, dias) : params.fecha);
  return { condicion_pago: condicion, dias_credito: dias, fecha_vencimiento };
}

async function nextNumber(conn: PoolConnection, tipo: "venta" | "compra") {
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
  if (query.q) {
    where.push("(i.numero LIKE ? OR i.contraparte LIKE ?)");
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Solo columnas conocidas: nunca se interpola el valor recibido.
  const sortColumns: Record<string, string> = {
    numero: "i.numero",
    tipo: "i.tipo",
    contraparte: "i.contraparte",
    estado: "i.estado",
    fecha: "i.fecha",
    total: "i.total",
    creador: "u.nombre",
  };
  const sortAllowed = query.sort ? sortColumns[query.sort] : undefined;
  const orderBy = sortAllowed
    ? `${sortAllowed} ${query.order === "desc" ? "DESC" : "ASC"}, i.id DESC`
    : "i.id DESC";

  // Tres consultas independientes en paralelo. El total se deriva de
  // `por_tipo`, así evitamos un cuarto recorrido del mismo filtro.
  const [dataResult, porTipoResult, porEstadoResult] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT i.id, i.tipo, i.numero, i.fecha, i.contraparte, i.documento,
              i.orden_compra, i.estado, i.subtotal, i.descuento_total,
              i.impuesto_total, i.total, i.total_neto, i.quote_id, i.party_id,
              i.condicion_pago, i.dias_credito, i.fecha_vencimiento,
              i.account_id, i.created_at,
              u.nombre AS creador
       FROM invoices i JOIN users u ON u.id = i.created_by
       ${clause}
       ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT i.tipo, COUNT(*) AS documentos, COALESCE(SUM(i.total), 0) AS total
       FROM invoices i ${clause}
       GROUP BY i.tipo`,
      params
    ),
    pool.query<RowDataPacket[]>(
      `SELECT i.estado, COUNT(*) AS documentos, COALESCE(SUM(i.total), 0) AS total
       FROM invoices i ${clause}
       GROUP BY i.estado`,
      params
    ),
  ]);

  const [data] = dataResult;
  const [porTipo] = porTipoResult;
  const [porEstado] = porEstadoResult;
  const total = porTipo.reduce((sum, r) => sum + Number(r.documentos), 0);

  return {
    data,
    total,
    page: query.page,
    pageSize: query.pageSize,
    resumen: {
      por_tipo: porTipo.map((r) => ({
        tipo: r.tipo,
        documentos: Number(r.documentos),
        total: Number(r.total),
      })),
      por_estado: porEstado.map((r) => ({
        estado: r.estado,
        documentos: Number(r.documentos),
        total: Number(r.total),
      })),
    },
  };
}

export async function getInvoice(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, u.nombre AS creador, q.estado AS quote_estado, q.total AS quote_total
     FROM invoices i
     JOIN users u ON u.id = i.created_by
     LEFT JOIN quotes q ON q.id = i.quote_id
     WHERE i.id = ?`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, "Factura no encontrada");
  const quoteNumero = rows[0].quote_id ? formatQuoteNumber(Number(rows[0].quote_id)) : null;
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT ii.id, ii.product_id, p.sku, p.nombre AS producto, ii.cantidad,
            ii.precio_unitario, ii.descuento_pct, ii.impuesto_pct, ii.total_linea,
            ii.costo_anterior,
            COALESCE(ac.cantidad_acreditada, 0) AS cantidad_acreditada,
            ii.cantidad - COALESCE(ac.cantidad_acreditada, 0) AS cantidad_disponible
     FROM invoice_items ii
     JOIN products p ON p.id = ii.product_id
     LEFT JOIN (
       SELECT iai.invoice_item_id, SUM(iai.cantidad) AS cantidad_acreditada
       FROM invoice_adjustment_items iai
       JOIN invoice_adjustments ia ON ia.id = iai.adjustment_id
       WHERE ia.invoice_id = ? AND ia.tipo = 'credito' AND ia.estado = 'confirmada'
       GROUP BY iai.invoice_item_id
     ) ac ON ac.invoice_item_id = ii.id
     WHERE ii.invoice_id = ? ORDER BY ii.id`,
    [id, id]
  );
  const [transacciones] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.tipo, t.monto, t.descripcion, fc.nombre AS categoria,
            fa.nombre AS cuenta
     FROM transactions t
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     JOIN finance_accounts fa ON fa.id = t.account_id
     WHERE t.invoice_id = ?
       AND t.anulada_de IS NULL
       AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
     ORDER BY t.id`,
    [id]
  );
  let conciliacionEntrega = null;
  if (rows[0].estado === "borrador" && rows[0].quote_id && rows[0].quote_estado === "entregado") {
    const conn = await pool.getConnection();
    try {
      const recon = await quoteDeliveryReconciliation(
        conn,
        Number(rows[0].quote_id),
        Number(rows[0].quote_total ?? 0),
        items.map((it) => ({ product_id: Number(it.product_id), cantidad: Number(it.cantidad) })),
        Number(rows[0].total)
      );
      conciliacionEntrega = recon;
    } finally {
      conn.release();
    }
  }
  const [balance, pagos, notas] = await Promise.all([
    invoiceBalance(rows[0] as never),
    listInvoicePayments(id),
    listAdjustments(id),
  ]);
  return {
    ...rows[0],
    ...balance,
    impacto_caja: invoiceCashProjection(rows[0] as never),
    quote_numero: quoteNumero,
    items,
    transacciones,
    pagos,
    ajustes: notas,
    conciliacion_entrega: conciliacionEntrega,
  };
}

export async function createInvoice(input: InvoiceInput, actor: { id: number }) {
  return withTransaction(async (conn) => {
    const numero = await nextNumber(conn, input.tipo);
    const totals = calcTotals(input.items);
    const retenciones = totalRetenciones(input);
    assertRetentions(retenciones, totals.total);
    const totalNeto = roundMoney(totals.total - retenciones);

    const partyId = input.party_id ?? null;
    const party = partyId ? await findThirdPartyForInvoice(conn, partyId) : null;
    if (party) assertPartyType(party, input.tipo);

    const terms = resolvePaymentTerms({
      condicion: input.condicion_pago,
      diasCredito: input.dias_credito,
      fechaVencimiento: input.fecha_vencimiento,
      fecha: input.fecha,
      fallbackCondicion: party?.condicion_pago ?? "contado",
      fallbackDias: Number(party?.dias_credito ?? 0),
    });

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO invoices
         (tipo, numero, fecha, contraparte, documento, orden_compra, email,
          subtotal, descuento_total, impuesto_total, total, retencion_fuente,
          retencion_iva, retencion_ica, total_neto, notas, quote_id, party_id,
          condicion_pago, dias_credito, fecha_vencimiento, account_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tipo,
        numero,
        input.fecha,
        input.contraparte,
        input.documento ?? null,
        input.orden_compra ?? null,
        input.email ?? null,
        totals.subtotal,
        totals.descuento_total,
        totals.impuesto_total,
        totals.total,
        input.retencion_fuente ?? 0,
        input.retencion_iva ?? 0,
        input.retencion_ica ?? 0,
        totalNeto,
        input.notas ?? null,
        input.quote_id ?? null,
        partyId,
        terms.condicion_pago,
        terms.dias_credito,
        terms.fecha_vencimiento,
        input.account_id ?? null,
        actor.id,
      ]
    );
    const invoiceId = res.insertId;

    for (const it of input.items) {
      const l = calcLine(it);
      await conn.query(
        `INSERT INTO invoice_items
           (invoice_id, product_id, cantidad, precio_unitario, costo_anterior,
            descuento_pct, impuesto_pct, total_linea)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          invoiceId,
          it.product_id,
          it.cantidad,
          it.precio_unitario,
          it.descuento_pct,
          it.impuesto_pct,
          l.total,
        ]
      );
    }
    return { id: invoiceId, numero, tipo: input.tipo };
  });
}

export async function updateInvoice(id: number, input: z.infer<typeof updateInvoiceSchema>) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM invoices WHERE id = ? FOR UPDATE",
      [id]
    );
    const current = rows[0];
    if (!current) throw new HttpError(404, "Factura no encontrada");
    if (current.estado !== "borrador") throw new HttpError(409, "Solo se editan facturas en borrador");

    const totals = input.items ? calcTotals(input.items) : {
      subtotal: Number(current.subtotal),
      descuento_total: Number(current.descuento_total),
      impuesto_total: Number(current.impuesto_total),
      total: Number(current.total),
    };
    const retenciones = totalRetenciones({
      retencion_fuente: input.retencion_fuente ?? current.retencion_fuente,
      retencion_iva: input.retencion_iva ?? current.retencion_iva,
      retencion_ica: input.retencion_ica ?? current.retencion_ica,
    });
    const totalNeto = roundMoney(totals.total - retenciones);
    assertRetentions(retenciones, totals.total);
    const tipo = input.tipo ?? current.tipo;
    const partyId = input.party_id !== undefined ? input.party_id : current.party_id;
    const party = partyId ? await findThirdPartyForInvoice(conn, partyId) : null;
    if (party) assertPartyType(party, tipo);

    const fecha = input.fecha ?? current.fecha;
    const partyChanged = input.party_id !== undefined && input.party_id !== current.party_id;
    const condicion = (input.condicion_pago ??
      (partyChanged && party ? party.condicion_pago : current.condicion_pago) ??
      "contado") as PaymentCondition;
    const fallbackDias =
      partyChanged && party ? Number(party.dias_credito ?? 0) : Number(current.dias_credito ?? 0);
    const terms = resolvePaymentTerms({
      condicion,
      diasCredito: input.dias_credito,
      fechaVencimiento: input.fecha_vencimiento,
      fecha,
      fallbackCondicion: condicion,
      fallbackDias,
    });

    await conn.query(
      `UPDATE invoices SET
         tipo = ?, fecha = ?, contraparte = ?, documento = ?, orden_compra = ?,
         email = ?, notas = ?, quote_id = ?, party_id = ?, condicion_pago = ?,
         dias_credito = ?, fecha_vencimiento = ?, account_id = ?, subtotal = ?,
         descuento_total = ?, impuesto_total = ?, total = ?, retencion_fuente = ?,
         retencion_iva = ?, retencion_ica = ?, total_neto = ?
       WHERE id = ?`,
      [
        tipo,
        fecha,
        input.contraparte ?? current.contraparte,
        input.documento !== undefined ? input.documento : current.documento,
        input.orden_compra !== undefined ? input.orden_compra : current.orden_compra,
        input.email !== undefined ? input.email : current.email,
        input.notas !== undefined ? input.notas : current.notas,
        input.quote_id !== undefined ? input.quote_id : current.quote_id,
        partyId,
        terms.condicion_pago,
        terms.dias_credito,
        terms.fecha_vencimiento,
        input.account_id !== undefined ? input.account_id : current.account_id,
        totals.subtotal,
        totals.descuento_total,
        totals.impuesto_total,
        totals.total,
        input.retencion_fuente ?? current.retencion_fuente,
        input.retencion_iva ?? current.retencion_iva,
        input.retencion_ica ?? current.retencion_ica,
        totalNeto,
        id,
      ]
    );

    if (input.items) {
      await conn.query("DELETE FROM invoice_items WHERE invoice_id = ?", [id]);
      for (const it of input.items) {
        const l = calcLine(it);
        await conn.query(
          `INSERT INTO invoice_items
             (invoice_id, product_id, cantidad, precio_unitario, costo_anterior,
              descuento_pct, impuesto_pct, total_linea)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
          [
            id,
            it.product_id,
            it.cantidad,
            it.precio_unitario,
            it.descuento_pct,
            it.impuesto_pct,
            l.total,
          ]
        );
      }
    }

    return { id };
  });
}

interface DeliveryReconciliationLine {
  product_id: number;
  sku: string;
  producto: string;
  entregado: number;
  facturado_previo: number;
  facturado_actual: number;
  /** Cantidad de esta factura cubierta por la entrega (costo histórico). */
  cubierto: number;
  /** Cantidad facturada que no salió en la entrega y debe descontarse ahora. */
  excedente: number;
  /** Cantidad entregada que vuelve al inventario al cerrar el saldo cotizado. */
  devolucion: number;
  costo_entrega: number;
  costo_producto: number;
}

interface DeliveryReconciliation {
  cierra: boolean;
  lineas: DeliveryReconciliationLine[];
}

/**
 * Compara lo entregado en una cotización con lo facturado (incluida la factura
 * actual) para decidir los ajustes de stock al confirmar.
 *
 * Política acumulada:
 * - El excedente facturado que no salió en la entrega se descuenta siempre.
 * - Lo entregado y no facturado solo se devuelve cuando esta factura cierra el
 *   saldo cotizado; en facturación por hitos se mantiene fuera del inventario
 *   porque el cliente ya lo recibió.
 * - Las notas crédito confirmadas reducen lo facturado acumulado y las
 *   devoluciones ya practicadas evitan devolver dos veces.
 */
async function quoteDeliveryReconciliation(
  conn: PoolConnection,
  quoteId: number,
  quoteTotal: number,
  items: { product_id: number; cantidad: number }[],
  currentTotal: number
): Promise<DeliveryReconciliation> {
  const [deliveredRows] = await conn.query<RowDataPacket[]>(
    `SELECT sm.product_id, p.sku, p.nombre AS producto,
            SUM(sm.cantidad) AS entregado,
            SUM(sm.costo_unitario * sm.cantidad) / NULLIF(SUM(sm.cantidad), 0) AS costo_entrega
     FROM stock_movements sm
     JOIN products p ON p.id = sm.product_id
     WHERE sm.quote_id = ? AND sm.tipo = 'salida' AND sm.origen = 'entrega'
     GROUP BY sm.product_id, p.sku, p.nombre`,
    [quoteId]
  );
  const delivered = new Map<
    number,
    { entregado: number; costo_entrega: number; sku: string; producto: string }
  >();
  for (const r of deliveredRows) {
    delivered.set(Number(r.product_id), {
      entregado: Number(r.entregado),
      costo_entrega: Number(r.costo_entrega ?? 0),
      sku: String(r.sku ?? ""),
      producto: String(r.producto ?? ""),
    });
  }

  const [prevRows] = await conn.query<RowDataPacket[]>(
    `SELECT ii.product_id, SUM(ii.cantidad) AS facturado
     FROM invoice_items ii
     JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.quote_id = ? AND i.estado = 'confirmada'
     GROUP BY ii.product_id`,
    [quoteId]
  );
  const invoicedBefore = new Map<number, number>();
  for (const r of prevRows) {
    invoicedBefore.set(Number(r.product_id), Number(r.facturado));
  }

  // Las notas crédito confirmadas devuelven producto: reducen lo facturado.
  const [creditRows] = await conn.query<RowDataPacket[]>(
    `SELECT ii.product_id, SUM(iai.cantidad) AS acreditado
     FROM invoice_adjustment_items iai
     JOIN invoice_adjustments ia ON ia.id = iai.adjustment_id
     JOIN invoice_items ii ON ii.id = iai.invoice_item_id
     JOIN invoices i ON i.id = ia.invoice_id
     WHERE i.quote_id = ? AND ia.tipo = 'credito' AND ia.estado = 'confirmada'
     GROUP BY ii.product_id`,
    [quoteId]
  );
  for (const r of creditRows) {
    const pid = Number(r.product_id);
    invoicedBefore.set(pid, Math.max(0, (invoicedBefore.get(pid) ?? 0) - Number(r.acreditado)));
  }

  // Devoluciones ya hechas por conciliaciones anteriores.
  const [returnRows] = await conn.query<RowDataPacket[]>(
    `SELECT product_id, SUM(cantidad) AS devuelto
     FROM stock_movements
     WHERE quote_id = ? AND invoice_id IS NOT NULL
       AND tipo = 'entrada' AND origen = 'ajuste'
     GROUP BY product_id`,
    [quoteId]
  );
  const returnedBefore = new Map<number, number>();
  for (const r of returnRows) {
    returnedBefore.set(Number(r.product_id), Number(r.devuelto));
  }

  const [totalRows] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(total), 0) AS total
     FROM invoices WHERE quote_id = ? AND estado = 'confirmada'`,
    [quoteId]
  );
  const prevTotal = Number(totalRows[0]?.total ?? 0);
  const cierra = prevTotal + currentTotal >= quoteTotal - 0.005;

  const invoiced = new Map<number, number>();
  for (const it of items) {
    const pid = Number(it.product_id);
    invoiced.set(pid, (invoiced.get(pid) ?? 0) + Number(it.cantidad));
  }

  const ids = [...new Set([...delivered.keys(), ...invoiced.keys()])];
  if (ids.length === 0) return { cierra, lineas: [] };

  const [productRows] = await conn.query<RowDataPacket[]>(
    "SELECT id, sku, nombre, costo FROM products WHERE id IN (?)",
    [ids]
  );
  const productById = new Map(productRows.map((p) => [Number(p.id), p]));

  const lineas = ids
    .map((pid) => {
      const d = delivered.get(pid);
      const p = productById.get(pid);
      const entregado = d?.entregado ?? 0;
      const previo = invoicedBefore.get(pid) ?? 0;
      const actual = invoiced.get(pid) ?? 0;
      const disponible = Math.max(0, entregado - previo);
      const cubierto = Math.min(actual, disponible);
      const excedente = Math.max(0, actual - disponible);
      const devueltoPrevio = returnedBefore.get(pid) ?? 0;
      const devolucion = cierra
        ? Math.max(0, entregado - (previo + actual) - devueltoPrevio)
        : 0;
      return {
        product_id: pid,
        sku: String(p?.sku ?? d?.sku ?? ""),
        producto: String(p?.nombre ?? d?.producto ?? ""),
        entregado,
        facturado_previo: previo,
        facturado_actual: actual,
        cubierto,
        excedente,
        devolucion,
        costo_entrega: d?.costo_entrega ?? 0,
        costo_producto: Number(p?.costo ?? 0),
      };
    })
    .sort((a, b) => a.producto.localeCompare(b.producto));

  return { cierra, lineas };
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
      "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id",
      [id]
    );
    if (items.length === 0) throw new HttpError(409, "La factura no tiene líneas");

    const isVenta = inv.tipo === "venta";
    // A crédito se reconoce el ingreso/activo, pero la caja se mueve al cobrar
    // o pagar (fase C2). El override del asiento gana sobre la categoría.
    const esCredito = inv.condicion_pago === "credito";
    const afectaCaja = esCredito ? false : undefined;
    if (!isVenta && inv.quote_id) {
      throw new HttpError(400, "Una factura de compra no puede vincularse a una cotización");
    }

    // Si la factura proviene de una cotización, validar el estado del documento previo.
    let quote: RowDataPacket | null = null;
    let quoteWasDelivered = false;
    if (inv.quote_id) {
      const [qrows] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM quotes WHERE id = ? FOR UPDATE",
        [inv.quote_id]
      );
      quote = qrows[0] ?? null;
      if (!quote) throw new HttpError(404, "Cotización no encontrada");
      if (!["aprobado", "entregado"].includes(quote.estado)) {
        throw new HttpError(409, "La cotización debe estar aprobada o entregada para facturarse");
      }
      quoteWasDelivered = quote.estado === "entregado";
    }

    const totals = totalsFromRows(items);
    // Cualquier cambio en estas reglas debe reflejarse en `invoiceCashProjection`
    // (invoices.shared.ts), que alimenta el aviso previo al usuario.
    const baseTotal = roundMoney(totals.subtotal - totals.descuento_total);
    const ivaTotal = totals.impuesto_total;
    // Cuenta elegida en la factura (caja o banco). Si no se indicó, los
    // asientos automáticos usan la primera cuenta activa.
    const accountId = inv.account_id ? Number(inv.account_id) : undefined;

    // M5: la cotización es una propuesta comercial y la factura es el documento legal
    // de la venta, así que sus montos pueden diferir (cantidades, descuentos, precios o
    // tarifas de impuestos negociados antes de facturar). El total cotizado es una
    // referencia, no un tope: la factura se confirma con sus propios valores y, si ya
    // fue emitida, cualquier ajuste posterior se hace con nota crédito o débito.
    // El saldo cotizado solo se muestra como seguimiento en el detalle de la cotización.

    const costByItem = new Map<number, number>();
    // Los movimientos internos de la factura se registran con rol admin para que
    // el costo histórico quede guardado aunque quien confirme sea contador u operador.
    const systemActor: AuthUser = { id: actor.id, rol: "admin" };

    if (isVenta) {
      if (!quoteWasDelivered) {
        // Validar todo el stock antes de mover nada.
        const ids = items.map((i) => i.product_id);
        const [products] = await conn.query<RowDataPacket[]>(
          "SELECT id, stock_actual, activo FROM products WHERE id IN (?) FOR UPDATE",
          [ids]
        );
        const byId = new Map(products.map((p) => [p.id, p]));
        for (const it of items) {
          const p = byId.get(it.product_id);
          if (!p || !p.activo) {
            throw new HttpError(409, `Producto ${it.product_id} inactivo o inexistente`);
          }
          if (p.stock_actual < it.cantidad) {
            throw new HttpError(409, `Stock insuficiente para el producto ${it.product_id}`);
          }
        }

        for (const it of items) {
          const movement = await registerMovement(
            {
              product_id: it.product_id,
              tipo: "salida",
              cantidad: Number(it.cantidad),
              origen: "venta",
              motivo: `Factura ${inv.numero}`,
              precio_unitario: Number(it.precio_unitario),
              invoiceId: id,
              quoteId: inv.quote_id ?? undefined,
              skipFinance: true,
            },
            systemActor,
            conn
          );
          costByItem.set(it.id, Number(movement.costo_unitario ?? 0));
        }

        // Si la factura actúa como entrega de una cotización aprobada, marcarla entregada.
        if (quote && quote.estado === "aprobado") {
          await conn.query("UPDATE quotes SET estado = 'entregado' WHERE id = ?", [quote.id]);
          await conn.query(
            `INSERT INTO quote_status_history (quote_id, estado_anterior, estado_nuevo, user_id)
             VALUES (?, 'aprobado', 'entregado', ?)`,
            [quote.id, actor.id]
          );
        }
      } else {
        // La cotización ya movió el stock (entrega): conciliar entrega vs. factura
        // antes de contabilizar. Se descuenta el excedente facturado que no salió
        // en la entrega y, si la factura cierra el saldo cotizado, se devuelve lo
        // entregado y no facturado (política acumulada).
        const recon = await quoteDeliveryReconciliation(
          conn,
          Number(quote!.id),
          Number(quote!.total),
          items.map((it) => ({ product_id: it.product_id as number, cantidad: Number(it.cantidad) })),
          totals.total
        );

        const linePrice = new Map<number, number>(
          items.map((it) => [Number(it.product_id), Number(it.precio_unitario)])
        );

        for (const l of recon.lineas) {
          if (l.excedente > 0) {
            await registerMovement(
              {
                product_id: l.product_id,
                tipo: "salida",
                cantidad: l.excedente,
                origen: "ajuste",
                motivo: `Conciliación entrega vs factura ${inv.numero}`,
                precio_unitario: linePrice.get(l.product_id) ?? undefined,
                costo_unitario: l.costo_producto,
                invoiceId: id,
                quoteId: Number(inv.quote_id),
                skipFinance: true,
              },
              systemActor,
              conn
            );
          }
          if (l.devolucion > 0) {
            await registerMovement(
              {
                product_id: l.product_id,
                tipo: "entrada",
                cantidad: l.devolucion,
                origen: "ajuste",
                motivo: `Devolución por conciliación ${inv.numero}`,
                costo_unitario: l.costo_entrega,
                invoiceId: id,
                quoteId: Number(inv.quote_id),
                skipFinance: true,
              },
              systemActor,
              conn
            );
          }
        }

        for (const it of items) {
          const l = recon.lineas.find((x) => x.product_id === Number(it.product_id));
          const qty = Number(it.cantidad);
          if (!l || qty <= 0) {
            costByItem.set(it.id as number, 0);
            continue;
          }
          const totalCost = l.cubierto * l.costo_entrega + l.excedente * l.costo_producto;
          costByItem.set(it.id as number, totalCost / qty);
        }
      }
    } else {
      // Compra: entra stock. El costo de referencia del producto (products.costo) SOLO se
      // modifica con edición manual; una compra no lo sobrescribe (M1). El costo neto de la
      // línea se guarda como costo histórico del movimiento de entrada.
      for (const it of items) {
        await registerMovement(
          {
            product_id: it.product_id,
            tipo: "entrada",
            cantidad: Number(it.cantidad),
            origen: "compra",
            motivo: `Factura ${inv.numero}`,
            costo_unitario: Number(it.precio_unitario),
            invoiceId: id,
            skipFinance: true,
          },
          systemActor,
          conn
        );
      }
    }

    // Asientos de cabecera agrupados por factura.
    const lineAllocations = items.map((it) => ({
      invoiceItemId: it.id as number,
      productId: it.product_id as number,
      monto: rowToLine(it).bruto,
    }));

    if (isVenta) {
      if (baseTotal > 0) {
        const txId = await createAutoTransaction(conn, {
          tipo: "ingreso",
          monto: baseTotal,
          fecha: inv.fecha,
          categoriaCodigo: "ventas",
          accountId,
          afectaCaja,
          invoiceId: id,
          descripcion: `Factura ${inv.numero}`,
          userId: actor.id,
        });
        if (txId) await insertAllocations(conn, txId, lineAllocations, baseTotal);
      }
      if (ivaTotal > 0) {
        await createAutoTransaction(conn, {
          tipo: "pasivo",
          monto: ivaTotal,
          fecha: inv.fecha,
          categoriaCodigo: "iva_por_pagar",
          accountId,
          afectaCaja,
          invoiceId: id,
          descripcion: `IVA factura ${inv.numero}`,
          userId: actor.id,
        });
      }
      // Retenciones que el cliente practica al pagar. Son un activo fiscal
      // (saldo a favor), no un menor ingreso: el ingreso ya se reconoció por la
      // base completa. Fuente e ICA reducen el dinero recibido; la retención de
      // IVA no mueve caja porque el IVA tampoco forma parte del capital.
      const retFuenteIca = roundMoney(
        Number(inv.retencion_fuente ?? 0) + Number(inv.retencion_ica ?? 0)
      );
      const retIva = roundMoney(Number(inv.retencion_iva ?? 0));
      if (retFuenteIca > 0) {
        await createAutoTransaction(conn, {
          tipo: "activo",
          monto: retFuenteIca,
          fecha: inv.fecha,
          categoriaCodigo: "retenciones_a_favor",
          accountId,
          afectaCaja: esCredito ? false : true,
          invoiceId: id,
          descripcion: `Retenciones practicadas factura ${inv.numero}`,
          userId: actor.id,
        });
      }
      if (retIva > 0) {
        await createAutoTransaction(conn, {
          tipo: "activo",
          monto: retIva,
          fecha: inv.fecha,
          categoriaCodigo: "retenciones_a_favor",
          accountId,
          afectaCaja: false,
          invoiceId: id,
          descripcion: `Retención de IVA factura ${inv.numero}`,
          userId: actor.id,
        });
      }
      // M2: el costo de ventas se registra como gasto "Costo de ventas" vinculado a la factura
      // (asiento real, parte del presupuesto y del resultado), pero NO reduce el capital de caja:
      // la compra del inventario ya sacó el dinero al registrarse como activo. Así el costo no
      // se descuenta dos veces de la caja.
      const cogs = roundMoney(
        items.reduce(
          (sum, it) => sum + (costByItem.get(it.id) ?? 0) * Number(it.cantidad),
          0
        )
      );
      if (cogs > 0) {
        const txId = await createAutoTransaction(conn, {
          tipo: "gasto",
          monto: cogs,
          fecha: inv.fecha,
          categoriaCodigo: "costo_ventas",
          accountId,
          afectaCaja,
          invoiceId: id,
          descripcion: `Costo de ventas factura ${inv.numero}`,
          userId: actor.id,
        });
        if (txId) {
          await insertAllocations(
            conn,
            txId,
            items.map((it) => ({
              invoiceItemId: it.id as number,
              productId: it.product_id as number,
              monto: roundMoney((costByItem.get(it.id) ?? 0) * Number(it.cantidad)),
            })),
            cogs
          );
        }
      }
    } else {
      if (baseTotal > 0) {
        // Costo de inventario: es una salida de caja que se convierte en un
        // activo (Inventario). No es gasto y por tanto no reduce la utilidad;
        // el gasto se reconoce al vender como "Costo de ventas".
        const txId = await createAutoTransaction(conn, {
          tipo: "activo",
          monto: Number(totals.subtotal),
          fecha: inv.fecha,
          categoriaCodigo: "inventario",
          accountId,
          afectaCaja: false,
          invoiceId: id,
          descripcion: `Factura ${inv.numero}`,
          userId: actor.id,
        });
        if (txId) await insertAllocations(conn, txId, lineAllocations, Number(totals.subtotal));
      }
      if (!esCredito && baseTotal > 0) {
        await createAutoTransaction(conn, {
          tipo: "activo",
          monto: baseTotal,
          fecha: inv.fecha,
          categoriaCodigo: "inventario",
          accountId,
          afectaCaja: true,
          invoiceId: id,
          descripcion: `Salida de caja factura ${inv.numero}`,
          userId: actor.id,
        });
      }
      const descuentoTotal = roundMoney(Number(totals.descuento_total));
      if (descuentoTotal > 0) {
        await createAutoTransaction(conn, {
          tipo: "ingreso",
          monto: descuentoTotal,
          fecha: inv.fecha,
          categoriaCodigo: "descuentos_obtenidos",
          accountId,
          afectaCaja: false,
          invoiceId: id,
          descripcion: `Descuento obtenido factura ${inv.numero}`,
          userId: actor.id,
        });
      }
      if (ivaTotal > 0) {
        await createAutoTransaction(conn, {
          tipo: "activo",
          monto: ivaTotal,
          fecha: inv.fecha,
          categoriaCodigo: "iva_descontable",
          accountId,
          afectaCaja,
          invoiceId: id,
          descripcion: `IVA factura ${inv.numero}`,
          userId: actor.id,
        });
      }
      // Retenciones que la empresa practica al proveedor. Son un pasivo con la
      // autoridad tributaria. Fuente e ICA reducen el dinero pagado; la
      // retención de IVA no mueve caja por la misma razón que en la venta.
      const retFuenteIca = roundMoney(
        Number(inv.retencion_fuente ?? 0) + Number(inv.retencion_ica ?? 0)
      );
      const retIva = roundMoney(Number(inv.retencion_iva ?? 0));
      if (retFuenteIca > 0) {
        await createAutoTransaction(conn, {
          tipo: "pasivo",
          monto: retFuenteIca,
          fecha: inv.fecha,
          categoriaCodigo: "retenciones_por_pagar",
          accountId,
          afectaCaja: esCredito ? false : true,
          invoiceId: id,
          descripcion: `Retenciones asumidas factura ${inv.numero}`,
          userId: actor.id,
        });
      }
      if (retIva > 0) {
        await createAutoTransaction(conn, {
          tipo: "pasivo",
          monto: retIva,
          fecha: inv.fecha,
          categoriaCodigo: "retenciones_por_pagar",
          accountId,
          afectaCaja: false,
          invoiceId: id,
          descripcion: `Retención de IVA factura ${inv.numero}`,
          userId: actor.id,
        });
      }
    }

    await conn.query(
      `UPDATE invoices SET estado = 'confirmada', subtotal = ?, descuento_total = ?,
        impuesto_total = ?, total = ?
       WHERE id = ?`,
      [totals.subtotal, totals.descuento_total, totals.impuesto_total, totals.total, id]
    );
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

    // RN-24: una factura con cobros/pagos válidos no se anula hasta revertirlos.
    const [[{ pagos }]] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS pagos FROM invoice_payments WHERE invoice_id = ? AND estado = 'valido'",
      [id]
    );
    if (pagos > 0) {
      throw new HttpError(
        409,
        `La factura tiene ${pagos} pago(s) válido(s). Anúlalos antes de anular la factura.`
      );
    }

    const [[{ notas }]] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS notas FROM invoice_adjustments WHERE invoice_id = ? AND estado = 'confirmada'",
      [id]
    );
    if (notas > 0) {
      throw new HttpError(
        409,
        `La factura tiene ${notas} nota(s) confirmada(s). Anúlalas antes de anular la factura.`
      );
    }

    // 1. Revertir el stock que movió esta factura (no el que movió la cotización).
    const systemActor: AuthUser = { id: actor.id, rol: "admin" };
    const [movements] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM stock_movements WHERE invoice_id = ? ORDER BY id",
      [id]
    );
    for (const m of movements) {
      const reverseTipo = m.tipo === "salida" ? "entrada" : "salida";
      await registerMovement(
        {
          product_id: m.product_id,
          tipo: reverseTipo,
          cantidad: Number(m.cantidad),
          origen: "ajuste",
          motivo: `Anulación factura ${inv.numero}`,
          costo_unitario: reverseTipo === "entrada" ? Number(m.costo_unitario ?? 0) : undefined,
          invoiceId: id,
          skipFinance: true,
        },
        systemActor,
        conn
      );
    }

    // Si la factura fue la que entregó una cotización aprobada, devolverla a aprobada.
    const invoiceDeliveredQuote = movements.some((m: RowDataPacket) => m.origen === "venta");
    if (invoiceDeliveredQuote && inv.quote_id) {
      const [qrows] = await conn.query<RowDataPacket[]>(
        "SELECT estado FROM quotes WHERE id = ? FOR UPDATE",
        [inv.quote_id]
      );
      if (qrows[0]?.estado === "entregado") {
        await conn.query("UPDATE quotes SET estado = 'aprobado' WHERE id = ?", [inv.quote_id]);
        await conn.query(
          `INSERT INTO quote_status_history (quote_id, estado_anterior, estado_nuevo, user_id)
           VALUES (?, 'entregado', 'aprobado', ?)`,
          [inv.quote_id, actor.id]
        );
      }
    }

    // 2. (M1) No se restaura products.costo al anular una compra: la compra nunca lo modificó.
    // El costo de referencia solo cambia con edición manual del producto.

    // 3. Revertir todos los asientos de la factura con contrapartidas.
    const [originals] = await conn.query<RowDataPacket[]>(
      `SELECT t.* FROM transactions t
       WHERE t.invoice_id = ? AND t.anulada_de IS NULL
         AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
       ORDER BY t.id`,
      [id]
    );
    for (const t of originals) {
      await conn.query(
        `INSERT INTO transactions
           (tipo, monto, afecta_caja, fecha, finance_category_id, account_id, product_id,
            quote_id, invoice_id, stock_movement_id, descripcion, anulada_de, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?)`,
        [
          t.tipo,
          t.monto,
          t.afecta_caja,
          t.fecha,
          t.finance_category_id,
          t.account_id,
          t.product_id,
          t.invoice_id,
          `Anulación de factura ${inv.numero} (transacción #${t.id})`,
          t.id,
          actor.id,
        ]
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
