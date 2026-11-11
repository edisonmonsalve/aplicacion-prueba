import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { today } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import {
  auditFinance,
  createAutoTransaction,
  roundMoney,
  VALID_TRANSACTION,
} from "../finance/finance.shared.js";
import { registerMovement } from "../movements/movements.service.js";
import type { CreateAdjustmentInput } from "./invoice-adjustments.schema.js";
import {
  calcLine,
  insertAllocations,
  netUnitCost,
  type LineCalc,
} from "./invoices.shared.js";

type InvoiceForAdjustment = RowDataPacket & {
  id: number;
  numero: string;
  tipo: "venta" | "compra";
  estado: string;
  condicion_pago: "contado" | "credito";
  fecha: string;
  total: number;
  total_neto: number;
  retencion_fuente: number;
  retencion_iva: number;
  retencion_ica: number;
  account_id: number | null;
};

type InvoiceItemForAdjustment = RowDataPacket & {
  id: number;
  product_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  impuesto_pct: number;
  producto_costo: number | null;
};

type AdjustmentLine = {
  original: InvoiceItemForAdjustment;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  impuesto_pct: number;
  calc: LineCalc;
  stockUnitCost: number;
};

type RetentionSplit = {
  fuente: number;
  iva: number;
  ica: number;
};

async function lockInvoice(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<InvoiceForAdjustment[]>(
    "SELECT * FROM invoices WHERE id = ? FOR UPDATE",
    [id]
  );
  if (!rows[0]) throw new HttpError(404, "Factura no encontrada");
  return rows[0];
}

async function nextAdjustmentNumber(conn: PoolConnection, tipo: "credito" | "debito") {
  await conn.query(
    "INSERT IGNORE INTO adjustment_counters (tipo, last_number) VALUES (?, 0)",
    [tipo]
  );
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT last_number FROM adjustment_counters WHERE tipo = ? FOR UPDATE",
    [tipo]
  );
  const next = Number(rows[0]?.last_number ?? 0) + 1;
  await conn.query(
    "UPDATE adjustment_counters SET last_number = ? WHERE tipo = ?",
    [next, tipo]
  );
  const prefix = tipo === "credito" ? "NC" : "ND";
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

async function loadInvoiceItems(conn: PoolConnection, invoiceId: number) {
  const [items] = await conn.query<InvoiceItemForAdjustment[]>(
    `SELECT ii.*, p.costo AS producto_costo
     FROM invoice_items ii
     JOIN products p ON p.id = ii.product_id
     WHERE ii.invoice_id = ?
     ORDER BY ii.id`,
    [invoiceId]
  );
  return items;
}

/**
 * Costo histórico de venta por línea de factura. Se toma solo el asiento
 * original (invoice_adjustment_id IS NULL) para que una nota no infle el costo
 * de la siguiente.
 */
async function loadCostByInvoiceItem(conn: PoolConnection, invoiceId: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ta.invoice_item_id, SUM(ta.monto) AS costo_total
     FROM transaction_allocations ta
     JOIN transactions t ON t.id = ta.transaction_id
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     WHERE t.invoice_id = ?
       AND t.invoice_adjustment_id IS NULL
       AND fc.codigo = 'costo_ventas'
       AND ${VALID_TRANSACTION}
     GROUP BY ta.invoice_item_id`,
    [invoiceId]
  );
  return new Map<number, number>(
    rows.map((r) => [Number(r.invoice_item_id), Number(r.costo_total ?? 0)])
  );
}

/** Cantidad ya acreditada por notas crédito confirmadas, por línea original. */
async function loadCreditedQuantities(conn: PoolConnection, invoiceId: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT iai.invoice_item_id, SUM(iai.cantidad) AS cantidad
     FROM invoice_adjustment_items iai
     JOIN invoice_adjustments ia ON ia.id = iai.adjustment_id
     WHERE ia.invoice_id = ?
       AND ia.tipo = 'credito'
       AND ia.estado = 'confirmada'
     GROUP BY iai.invoice_item_id`,
    [invoiceId]
  );
  return new Map<number, number>(
    rows.map((r) => [Number(r.invoice_item_id), Number(r.cantidad ?? 0)])
  );
}

function buildLines(
  invoice: InvoiceForAdjustment,
  items: InvoiceItemForAdjustment[],
  input: CreateAdjustmentInput,
  costs: Map<number, number>,
  credited: Map<number, number>
): AdjustmentLine[] {
  const byId = new Map(items.map((it) => [Number(it.id), it]));

  return input.items.map((ni) => {
    const original = byId.get(ni.invoice_item_id);
    if (!original) {
      throw new HttpError(
        409,
        `La línea ${ni.invoice_item_id} no pertenece a la factura ${invoice.numero}`
      );
    }

    if (input.tipo === "credito") {
      const devuelta = credited.get(ni.invoice_item_id) ?? 0;
      const disponible = Number(original.cantidad) - devuelta;
      if (ni.cantidad > disponible) {
        throw new HttpError(
          409,
          `La línea ${ni.invoice_item_id} solo tiene ${disponible} unidad(es) disponible(s) para acreditar`
        );
      }
    }

    const precio_unitario = ni.precio_unitario ?? Number(original.precio_unitario);
    const descuento_pct = ni.descuento_pct ?? Number(original.descuento_pct);
    const impuesto_pct = ni.impuesto_pct ?? Number(original.impuesto_pct);
    const calc = calcLine({
      cantidad: ni.cantidad,
      precio_unitario,
      descuento_pct,
      impuesto_pct,
    });

    // En ventas el costo sale del asiento de costo de ventas original; si no
    // existe (producto sin costo), una devolución no inventa costo. En compras
    // el costo histórico es el neto de la línea de compra.
    const costoTotal = costs.get(ni.invoice_item_id) ?? 0;
    const costoUnitario =
      Number(original.cantidad) > 0
        ? roundMoney(costoTotal / Number(original.cantidad))
        : 0;
    const stockUnitCost =
      invoice.tipo === "compra"
        ? netUnitCost(original)
        : input.tipo === "debito" && costoTotal === 0
          ? roundMoney(Number(original.producto_costo ?? 0))
          : costoUnitario;

    return {
      original,
      cantidad: ni.cantidad,
      precio_unitario,
      descuento_pct,
      impuesto_pct,
      calc,
      stockUnitCost,
    };
  });
}

/**
 * Reparte las retenciones de la factura en proporción al valor de la nota.
 * Se limita al saldo de retención aún no revertido por notas anteriores para
 * que varias notas parciales nunca reviertan más de lo retenido.
 */
function proportionalRetention(
  invoice: InvoiceForAdjustment,
  noteTotal: number,
  alreadyReversed: number
): RetentionSplit {
  const invoiceTotal = Number(invoice.total);
  if (invoiceTotal <= 0 || noteTotal <= 0) {
    return { fuente: 0, iva: 0, ica: 0 };
  }

  const factor = noteTotal / invoiceTotal;
  const fuente = roundMoney(Number(invoice.retencion_fuente) * factor);
  const iva = roundMoney(Number(invoice.retencion_iva) * factor);
  const ica = roundMoney(Number(invoice.retencion_ica) * factor);
  const raw = roundMoney(fuente + iva + ica);

  const invoiceRetention = roundMoney(
    Number(invoice.retencion_fuente) +
      Number(invoice.retencion_iva) +
      Number(invoice.retencion_ica)
  );
  const remaining = Math.max(0, roundMoney(invoiceRetention - alreadyReversed));
  if (raw <= remaining || raw === 0) {
    return { fuente, iva, ica };
  }

  const scale = remaining / raw;
  const scaled = {
    fuente: roundMoney(fuente * scale),
    iva: roundMoney(iva * scale),
    ica: roundMoney(ica * scale),
  };
  const diff = roundMoney(remaining - (scaled.fuente + scaled.iva + scaled.ica));
  scaled.ica = roundMoney(scaled.ica + diff);
  return scaled;
}

async function movementForLine(
  conn: PoolConnection,
  invoice: InvoiceForAdjustment,
  line: AdjustmentLine,
  tipo: "credito" | "debito",
  numero: string,
  adjustmentId: number,
  actor: AuthUser
) {
  const motivo = `Nota ${tipo} ${numero} factura ${invoice.numero}`;
  const base = {
    product_id: line.original.product_id,
    cantidad: line.cantidad,
    motivo,
    invoiceId: invoice.id,
    invoiceAdjustmentId: adjustmentId,
    skipFinance: true,
  };

  if (invoice.tipo === "venta") {
    if (tipo === "credito") {
      await registerMovement(
        {
          ...base,
          tipo: "entrada",
          origen: "ajuste",
          costo_unitario: line.stockUnitCost,
        },
        actor,
        conn
      );
    } else {
      await registerMovement(
        {
          ...base,
          tipo: "salida",
          origen: "venta",
          precio_unitario: line.precio_unitario,
        },
        actor,
        conn
      );
    }
    return;
  }

  if (tipo === "credito") {
    await registerMovement(
      {
        ...base,
        tipo: "salida",
        origen: "ajuste",
        costo_unitario: line.stockUnitCost,
      },
      actor,
      conn
    );
  } else {
    await registerMovement(
      {
        ...base,
        tipo: "entrada",
        origen: "compra",
        costo_unitario: line.stockUnitCost,
      },
      actor,
      conn
    );
  }
}

export async function createAdjustment(
  invoiceId: number,
  input: CreateAdjustmentInput,
  actor: AuthUser
) {
  return withTransaction(async (conn) => {
    const invoice = await lockInvoice(conn, invoiceId);
    if (invoice.estado !== "confirmada") {
      throw new HttpError(409, "Solo se emiten notas sobre facturas confirmadas");
    }

    const items = await loadInvoiceItems(conn, invoiceId);
    if (items.length === 0) throw new HttpError(409, "La factura no tiene líneas");

    const isVenta = invoice.tipo === "venta";
    const costs = isVenta
      ? await loadCostByInvoiceItem(conn, invoiceId)
      : new Map<number, number>();
    const credited =
      input.tipo === "credito"
        ? await loadCreditedQuantities(conn, invoiceId)
        : new Map<number, number>();

    const lines = buildLines(invoice, items, input, costs, credited);
    const totals = lines.reduce(
      (acc, l) => ({
        subtotal: roundMoney(acc.subtotal + l.calc.bruto),
        descuento_total: roundMoney(acc.descuento_total + l.calc.descuento),
        impuesto_total: roundMoney(acc.impuesto_total + l.calc.impuesto),
        total: roundMoney(acc.total + l.calc.total),
      }),
      { subtotal: 0, descuento_total: 0, impuesto_total: 0, total: 0 }
    );

    // Una nota crédito no puede dejar la factura con valor negativo. Las notas
    // débito sí suman y no tienen tope.
    if (input.tipo === "credito") {
      const [[previous]] = await conn.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(total), 0) AS total,
                COALESCE(SUM(retencion_total), 0) AS retencion
         FROM invoice_adjustments
         WHERE invoice_id = ? AND tipo = 'credito' AND estado = 'confirmada'`,
        [invoiceId]
      );
      const yaAcreditado = roundMoney(Number(previous.total));
      if (
        roundMoney(yaAcreditado + totals.total) >
        roundMoney(Number(invoice.total) + 0.01)
      ) {
        throw new HttpError(
          409,
          `La nota crédito excede el valor de la factura: acreditado ${yaAcreditado.toFixed(
            2
          )} + nota ${totals.total.toFixed(2)} > factura ${Number(invoice.total).toFixed(2)}`
        );
      }

      const retencion = proportionalRetention(
        invoice,
        totals.total,
        roundMoney(Number(previous.retencion))
      );
      const retencionTotal = roundMoney(retencion.fuente + retencion.iva + retencion.ica);
      const totalNeto = roundMoney(totals.total - retencionTotal);
      return finishAdjustment(
        conn,
        invoice,
        input,
        actor,
        lines,
        totals,
        retencion,
        retencionTotal,
        totalNeto
      );
    }

    return finishAdjustment(
      conn,
      invoice,
      input,
      actor,
      lines,
      totals,
      { fuente: 0, iva: 0, ica: 0 },
      0,
      totals.total
    );
  });
}

async function finishAdjustment(
  conn: PoolConnection,
  invoice: InvoiceForAdjustment,
  input: CreateAdjustmentInput,
  actor: AuthUser,
  lines: AdjustmentLine[],
  totals: { subtotal: number; descuento_total: number; impuesto_total: number; total: number },
  retention: RetentionSplit,
  retentionTotal: number,
  totalNeto: number
) {
  const isVenta = invoice.tipo === "venta";
  const afectaStock = input.afecta_stock ?? input.tipo === "credito";
  const numero = await nextAdjustmentNumber(conn, input.tipo);

  const [res] = await conn.query<ResultSetHeader>(
    `INSERT INTO invoice_adjustments
       (invoice_id, tipo, numero, fecha, motivo, subtotal, descuento_total,
        impuesto_total, retencion_total, total, total_neto, afecta_stock, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoice.id,
      input.tipo,
      numero,
      input.fecha,
      input.motivo ?? null,
      totals.subtotal,
      totals.descuento_total,
      totals.impuesto_total,
      retentionTotal,
      totals.total,
      totalNeto,
      afectaStock ? 1 : 0,
      actor.id,
    ]
  );
  const adjustmentId = res.insertId;

  await conn.query(
    `INSERT INTO invoice_adjustment_items
       (adjustment_id, invoice_item_id, product_id, cantidad, precio_unitario,
        descuento_pct, impuesto_pct, total_linea)
     VALUES ?`,
    [
      lines.map((l) => [
        adjustmentId,
        l.original.id,
        l.original.product_id,
        l.cantidad,
        l.precio_unitario,
        l.descuento_pct,
        l.impuesto_pct,
        l.calc.total,
      ]),
    ]
  );

  // Los movimientos internos usan rol admin para conservar el costo histórico
  // de la línea original aunque quien emita la nota sea contador.
  const systemActor: AuthUser = { id: actor.id, rol: "admin" };
  let cogs = 0;
  if (afectaStock) {
    for (const line of lines) {
      await movementForLine(conn, invoice, line, input.tipo, numero, adjustmentId, systemActor);
      if (isVenta) {
        cogs = roundMoney(cogs + line.stockUnitCost * line.cantidad);
      }
    }
  }

  const sign = input.tipo === "credito" ? -1 : 1;
  const base = roundMoney(totals.subtotal - totals.descuento_total);
  const iva = totals.impuesto_total;
  const accountId = invoice.account_id ? Number(invoice.account_id) : undefined;
  const afectaCaja = invoice.condicion_pago === "credito" ? false : undefined;
  const descripcion = `Nota ${input.tipo} ${numero} factura ${invoice.numero}`;
  const allocations = lines.map((l) => ({
    invoiceItemId: Number(l.original.id),
    productId: Number(l.original.product_id),
    monto: roundMoney(sign * l.calc.base),
  }));

  if (isVenta) {
    if (base !== 0) {
      const txId = await createAutoTransaction(conn, {
        tipo: "ingreso",
        monto: sign * base,
        fecha: input.fecha,
        categoriaCodigo: "ventas",
        accountId,
        afectaCaja,
        invoiceId: invoice.id,
        invoiceAdjustmentId: adjustmentId,
        descripcion,
        userId: actor.id,
      });
      if (txId) await insertAllocations(conn, txId, allocations, sign * base);
    }
    if (iva !== 0) {
      await createAutoTransaction(conn, {
        tipo: "pasivo",
        monto: sign * iva,
        fecha: input.fecha,
        categoriaCodigo: "iva_por_pagar",
        accountId,
        afectaCaja,
        invoiceId: invoice.id,
        invoiceAdjustmentId: adjustmentId,
        descripcion: `IVA ${descripcion}`,
        userId: actor.id,
      });
    }
    if (retentionTotal !== 0) {
      const retFuenteIca = roundMoney(retention.fuente + retention.ica);
      if (retFuenteIca !== 0) {
        await createAutoTransaction(conn, {
          tipo: "activo",
          monto: sign * retFuenteIca,
          fecha: input.fecha,
          categoriaCodigo: "retenciones_a_favor",
          accountId,
          afectaCaja: invoice.condicion_pago === "credito" ? false : true,
          invoiceId: invoice.id,
          invoiceAdjustmentId: adjustmentId,
          descripcion: `Retenciones ${descripcion}`,
          userId: actor.id,
        });
      }
      if (retention.iva !== 0) {
        await createAutoTransaction(conn, {
          tipo: "activo",
          monto: sign * retention.iva,
          fecha: input.fecha,
          categoriaCodigo: "retenciones_a_favor",
          accountId,
          afectaCaja: false,
          invoiceId: invoice.id,
          invoiceAdjustmentId: adjustmentId,
          descripcion: `Retención de IVA ${descripcion}`,
          userId: actor.id,
        });
      }
    }
    if (afectaStock && cogs !== 0) {
      const txId = await createAutoTransaction(conn, {
        tipo: "gasto",
        monto: sign * cogs,
        fecha: input.fecha,
        categoriaCodigo: "costo_ventas",
        accountId,
        afectaCaja,
        invoiceId: invoice.id,
        invoiceAdjustmentId: adjustmentId,
        descripcion: `Costo de ventas ${descripcion}`,
        userId: actor.id,
      });
      if (txId) {
        await insertAllocations(
          conn,
          txId,
          lines.map((l) => ({
            invoiceItemId: Number(l.original.id),
            productId: Number(l.original.product_id),
            monto: roundMoney(sign * l.stockUnitCost * l.cantidad),
          })),
          sign * cogs
        );
      }
    }
  } else {
    if (base !== 0) {
      const txId = await createAutoTransaction(conn, {
        tipo: "activo",
        monto: sign * base,
        fecha: input.fecha,
        categoriaCodigo: "inventario",
        accountId,
        afectaCaja,
        invoiceId: invoice.id,
        invoiceAdjustmentId: adjustmentId,
        descripcion,
        userId: actor.id,
      });
      if (txId) await insertAllocations(conn, txId, allocations, sign * base);
    }
    if (iva !== 0) {
      await createAutoTransaction(conn, {
        tipo: "activo",
        monto: sign * iva,
        fecha: input.fecha,
        categoriaCodigo: "iva_descontable",
        accountId,
        afectaCaja,
        invoiceId: invoice.id,
        invoiceAdjustmentId: adjustmentId,
        descripcion: `IVA ${descripcion}`,
        userId: actor.id,
      });
    }
    // Una nota crédito de compra reduce también la retención por pagar. Una
    // nota débito es un mayor valor y no altera la retención ya practicada.
    if (input.tipo === "credito" && retentionTotal !== 0) {
      const retFuenteIca = roundMoney(retention.fuente + retention.ica);
      if (retFuenteIca !== 0) {
        await createAutoTransaction(conn, {
          tipo: "pasivo",
          monto: sign * retFuenteIca,
          fecha: input.fecha,
          categoriaCodigo: "retenciones_por_pagar",
          accountId,
          afectaCaja: invoice.condicion_pago === "credito" ? false : true,
          invoiceId: invoice.id,
          invoiceAdjustmentId: adjustmentId,
          descripcion: `Retenciones ${descripcion}`,
          userId: actor.id,
        });
      }
      if (retention.iva !== 0) {
        await createAutoTransaction(conn, {
          tipo: "pasivo",
          monto: sign * retention.iva,
          fecha: input.fecha,
          categoriaCodigo: "retenciones_por_pagar",
          accountId,
          afectaCaja: false,
          invoiceId: invoice.id,
          invoiceAdjustmentId: adjustmentId,
          descripcion: `Retención de IVA ${descripcion}`,
          userId: actor.id,
        });
      }
    }
  }

  await auditFinance(conn, actor.id, "invoice_adjustment", adjustmentId, "crear", null, {
    invoice_id: invoice.id,
    numero,
    tipo: input.tipo,
    fecha: input.fecha,
    total: totals.total,
    total_neto: totalNeto,
    retencion_total: retentionTotal,
    afecta_stock: afectaStock,
    items: lines.map((l) => ({
      invoice_item_id: l.original.id,
      product_id: l.original.product_id,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
    })),
  });

  return {
    id: adjustmentId,
    numero,
    tipo: input.tipo,
    estado: "confirmada" as const,
    subtotal: totals.subtotal,
    descuento_total: totals.descuento_total,
    impuesto_total: totals.impuesto_total,
    retencion_total: retentionTotal,
    total: totals.total,
    total_neto: totalNeto,
    afecta_stock: afectaStock,
  };
}

export async function cancelAdjustment(
  invoiceId: number,
  adjustmentId: number,
  actor: AuthUser
) {
  return withTransaction(async (conn) => {
    const invoice = await lockInvoice(conn, invoiceId);
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM invoice_adjustments WHERE id = ? AND invoice_id = ? FOR UPDATE",
      [adjustmentId, invoiceId]
    );
    const adjustment = rows[0];
    if (!adjustment) throw new HttpError(404, "Nota no encontrada");
    if (adjustment.estado === "anulada") throw new HttpError(409, "La nota ya está anulada");

    const systemActor: AuthUser = { id: actor.id, rol: "admin" };
    const motivo = `Anulación nota ${adjustment.numero} factura ${invoice.numero}`;

    // 1. Revertir el stock que movió la nota (si lo movió).
    const [movements] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM stock_movements WHERE invoice_adjustment_id = ? ORDER BY id",
      [adjustmentId]
    );
    for (const m of movements) {
      await registerMovement(
        {
          product_id: Number(m.product_id),
          tipo: m.tipo === "entrada" ? "salida" : "entrada",
          cantidad: Number(m.cantidad),
          origen: "ajuste",
          motivo,
          costo_unitario: Number(m.costo_unitario ?? 0),
          invoiceId,
          invoiceAdjustmentId: adjustmentId,
          skipFinance: true,
        },
        systemActor,
        conn
      );
    }

    // 2. Revertir los asientos de la nota con contrapartidas auditables.
    const [transactions] = await conn.query<RowDataPacket[]>(
      `SELECT t.* FROM transactions t
       WHERE t.invoice_adjustment_id = ?
         AND t.anulada_de IS NULL
         AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
       ORDER BY t.id`,
      [adjustmentId]
    );
    for (const tx of transactions) {
      await conn.query<ResultSetHeader>(
        `INSERT INTO transactions
           (tipo, monto, afecta_caja, fecha, finance_category_id, account_id, product_id,
            quote_id, invoice_id, invoice_adjustment_id, stock_movement_id, descripcion,
            anulada_de, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.tipo,
          tx.monto,
          tx.afecta_caja,
          today(),
          tx.finance_category_id,
          tx.account_id,
          tx.product_id,
          tx.quote_id,
          tx.invoice_id,
          adjustmentId,
          tx.stock_movement_id,
          motivo,
          tx.id,
          actor.id,
        ]
      );
    }

    await conn.query(
      `UPDATE invoice_adjustments
       SET estado = 'anulada', anulada_at = NOW(), anulada_by = ?
       WHERE id = ?`,
      [actor.id, adjustmentId]
    );

    await auditFinance(
      conn,
      actor.id,
      "invoice_adjustment",
      adjustmentId,
      "anular",
      { estado: "confirmada" },
      { estado: "anulada", movimientos_revertidos: movements.length }
    );

    return {
      id: adjustmentId,
      numero: adjustment.numero,
      estado: "anulada" as const,
    };
  });
}

/** Notas de una factura, con sus líneas, para el detalle y la impresión. */
export async function listAdjustments(invoiceId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ia.*, u.nombre AS creador, au.nombre AS anulada_por
     FROM invoice_adjustments ia
     JOIN users u ON u.id = ia.created_by
     LEFT JOIN users au ON au.id = ia.anulada_by
     WHERE ia.invoice_id = ?
     ORDER BY ia.fecha DESC, ia.id DESC`,
    [invoiceId]
  );
  if (rows.length === 0) return [];

  const ids = rows.map((r) => Number(r.id));
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT iai.*, p.sku, p.nombre AS producto
     FROM invoice_adjustment_items iai
     JOIN products p ON p.id = iai.product_id
     WHERE iai.adjustment_id IN (?)
     ORDER BY iai.id`,
    [ids]
  );
  const byAdjustment = new Map<number, RowDataPacket[]>();
  for (const item of items) {
    const key = Number(item.adjustment_id);
    const list = byAdjustment.get(key) ?? [];
    list.push(item);
    byAdjustment.set(key, list);
  }

  return rows.map((r) => ({
    ...r,
    items: byAdjustment.get(Number(r.id)) ?? [],
  }));
}
