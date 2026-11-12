import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import { today } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import {
  assertPeriodOpen,
  auditFinance,
  createAutoTransaction,
  roundMoney,
} from "../finance/finance.shared.js";
import type { AgingQuery, CreatePaymentInput, ReceivableQuery } from "./invoice-payments.schema.js";

type InvoiceForCartera = {
  id: number;
  numero: string;
  tipo: "venta" | "compra";
  estado: string;
  condicion_pago: "contado" | "credito";
  total_neto: number;
  fecha_vencimiento: string | null;
};

export type CarteraEstado = "pendiente" | "parcial" | "pagada" | "vencida" | "no_aplica";

export function receivableState(
  invoice: InvoiceForCartera,
  pagado: number,
  ajuste = 0
): CarteraEstado {
  if (invoice.estado !== "confirmada") return "no_aplica";
  if (invoice.condicion_pago !== "credito") return "pagada";
  const saldo = roundMoney(Number(invoice.total_neto) + ajuste - pagado);
  if (saldo <= 0) return "pagada";
  if (invoice.fecha_vencimiento && invoice.fecha_vencimiento < today()) return "vencida";
  return pagado > 0 ? "parcial" : "pendiente";
}

export function saldoPendiente(invoice: InvoiceForCartera, pagado: number, ajuste = 0) {
  if (invoice.estado !== "confirmada" || invoice.condicion_pago !== "credito") return 0;
  return Math.max(0, roundMoney(Number(invoice.total_neto) + ajuste - pagado));
}

/** Pagos de una factura, incluidos los anulados para conservar la historia. */
export async function listInvoicePayments(invoiceId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.fecha, p.monto, p.metodo, p.referencia, p.notas, p.estado,
            p.created_at, p.anulada_at,
            fa.nombre AS cuenta, u.nombre AS creador
     FROM invoice_payments p
     LEFT JOIN finance_accounts fa ON fa.id = p.account_id
     JOIN users u ON u.id = p.created_by
     WHERE p.invoice_id = ?
     ORDER BY p.fecha DESC, p.id DESC`,
    [invoiceId]
  );
  return rows;
}

/** Saldo y estado de cartera de una factura concreta. */
export async function invoiceBalance(invoice: InvoiceForCartera) {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(monto), 0) AS pagado
     FROM invoice_payments
     WHERE invoice_id = ? AND estado = 'valido'`,
    [invoice.id]
  );
  const [[nota]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN total_neto ELSE 0 END), 0) AS credito,
            COALESCE(SUM(CASE WHEN tipo = 'debito' THEN total_neto ELSE 0 END), 0) AS debito
     FROM invoice_adjustments
     WHERE invoice_id = ? AND estado = 'confirmada'`,
    [invoice.id]
  );
  const pagado = roundMoney(Number(row.pagado));
  const credito = roundMoney(Number(nota.credito));
  const debito = roundMoney(Number(nota.debito));
  const ajuste = roundMoney(debito - credito);
  return {
    pagado,
    notas_credito: credito,
    notas_debito: debito,
    ajuste_notas: ajuste,
    saldo_pendiente: saldoPendiente(invoice, pagado, ajuste),
    estado_cartera: receivableState(invoice, pagado, ajuste),
  };
}

/**
 * Consulta base de cartera: facturas confirmadas a crédito con su saldo
 * derivado de los pagos válidos. Se reutiliza en la lista y en el aging para
 * que ambos informes midan exactamente lo mismo.
 */
export const CARTERA_DERIVED = `
    SELECT i.id, i.tipo, i.numero, i.fecha, i.contraparte, i.party_id,
           i.condicion_pago, i.dias_credito, i.fecha_vencimiento, i.total_neto,
           COALESCE(p.pagado, 0) AS pagado,
           COALESCE(n.ajuste, 0) AS ajuste_notas,
           GREATEST(i.total_neto + COALESCE(n.ajuste, 0) - COALESCE(p.pagado, 0), 0) AS saldo_pendiente,
           CASE
             WHEN i.total_neto + COALESCE(n.ajuste, 0) - COALESCE(p.pagado, 0) <= 0 THEN 'pagada'
             WHEN i.fecha_vencimiento < CURDATE() THEN 'vencida'
             WHEN COALESCE(p.pagado, 0) > 0 THEN 'parcial'
             ELSE 'pendiente'
           END AS estado_cartera,
           CASE
             WHEN i.fecha_vencimiento IS NULL THEN 0
             ELSE DATEDIFF(CURDATE(), i.fecha_vencimiento)
           END AS dias_vencido
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(monto) AS pagado
      FROM invoice_payments
      WHERE estado = 'valido'
      GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    LEFT JOIN (
      SELECT invoice_id,
             SUM(CASE WHEN tipo = 'credito' THEN -total_neto ELSE total_neto END) AS ajuste
      FROM invoice_adjustments
      WHERE estado = 'confirmada'
      GROUP BY invoice_id
    ) n ON n.invoice_id = i.id
    WHERE i.estado = 'confirmada' AND i.condicion_pago = 'credito'`;

/**
 * Cartera CxC/CxP derivada de facturas confirmadas a crédito.
 *
 * No duplica saldos: el pendiente se calcula como total_neto menos los pagos
 * válidos. El estado se deriva de la fecha de vencimiento y del saldo.
 */
export async function listReceivables(query: ReceivableQuery) {
  const inner = CARTERA_DERIVED;

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.q) {
    where.push("(c.numero LIKE ? OR c.contraparte LIKE ?)");
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.tipo) {
    where.push("c.tipo = ?");
    params.push(query.tipo);
  }
  if (query.estado) {
    where.push("c.estado_cartera = ?");
    params.push(query.estado);
  }
  if (query.desde) {
    where.push("c.fecha >= ?");
    params.push(query.desde);
  }
  if (query.hasta) {
    where.push("c.fecha <= ?");
    params.push(query.hasta);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Conteo, página y resumen son independientes: una sola ida y vuelta lógica.
  const [countResult, dataResult, resumenResult] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM (${inner}) c ${clause}`,
      params
    ),
    pool.query<RowDataPacket[]>(
      `SELECT c.* FROM (${inner}) c
       ${clause}
       ORDER BY c.fecha_vencimiento, c.id DESC
       LIMIT ? OFFSET ?`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN c.tipo = 'venta' THEN c.saldo_pendiente ELSE 0 END), 0) AS por_cobrar,
         COALESCE(SUM(CASE WHEN c.tipo = 'compra' THEN c.saldo_pendiente ELSE 0 END), 0) AS por_pagar,
         COALESCE(SUM(CASE WHEN c.estado_cartera = 'vencida' THEN c.saldo_pendiente ELSE 0 END), 0) AS vencido
       FROM (${inner}) c ${clause}`,
      params
    ),
  ]);
  const [[{ total }]] = countResult;
  const [data] = dataResult;
  const [[resumen]] = resumenResult;

  return {
    data,
    total,
    page: query.page,
    pageSize: query.pageSize,
    resumen: {
      por_cobrar: Number(resumen.por_cobrar),
      por_pagar: Number(resumen.por_pagar),
      vencido: Number(resumen.vencido),
    },
  };
}

const bucket = (row: RowDataPacket | undefined) => ({
  corriente: roundMoney(Number(row?.corriente ?? 0)),
  d1_30: roundMoney(Number(row?.d1_30 ?? 0)),
  d31_60: roundMoney(Number(row?.d31_60 ?? 0)),
  d61_90: roundMoney(Number(row?.d61_90 ?? 0)),
  d90_mas: roundMoney(Number(row?.d90_mas ?? 0)),
  total: roundMoney(Number(row?.total ?? 0)),
});

/**
 * Aging de cartera, DSO y alertas de cobro.
 *
 * Los tramos se miden desde `fecha_vencimiento` hasta hoy: corriente (aún no
 * vence), 1-30, 31-60, 61-90 y más de 90 días. El DSO es simple: cartera por
 * cobrar actual dividida entre las ventas a crédito del periodo, multiplicada
 * por los días del periodo. Si no hubo ventas a crédito, no se informa.
 */
export async function carteraAging(query: AgingQuery) {
  const hasta = query.hasta ?? today();
  const desde = query.desde ?? `${hasta.slice(0, 7)}-01`;
  if (desde > hasta) {
    throw new HttpError(400, "La fecha inicial no puede ser posterior a la final");
  }
  const periodoDias = Math.floor(
    (Date.parse(`${hasta}T12:00:00`) - Date.parse(`${desde}T12:00:00`)) / 86_400_000
  ) + 1;

  // Los cuatro bloques del aging son independientes: se consultan en paralelo.
  const [agingResult, totalesResult, ventasResult, topDeudoresResult] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT c.tipo,
              COALESCE(SUM(CASE WHEN c.dias_vencido <= 0 THEN c.saldo_pendiente ELSE 0 END), 0) AS corriente,
              COALESCE(SUM(CASE WHEN c.dias_vencido BETWEEN 1 AND 30 THEN c.saldo_pendiente ELSE 0 END), 0) AS d1_30,
              COALESCE(SUM(CASE WHEN c.dias_vencido BETWEEN 31 AND 60 THEN c.saldo_pendiente ELSE 0 END), 0) AS d31_60,
              COALESCE(SUM(CASE WHEN c.dias_vencido BETWEEN 61 AND 90 THEN c.saldo_pendiente ELSE 0 END), 0) AS d61_90,
              COALESCE(SUM(CASE WHEN c.dias_vencido > 90 THEN c.saldo_pendiente ELSE 0 END), 0) AS d90_mas,
              COALESCE(SUM(c.saldo_pendiente), 0) AS total
       FROM (${CARTERA_DERIVED}) c
       WHERE c.saldo_pendiente > 0
       GROUP BY c.tipo`,
      []
    ),
    pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN c.tipo = 'venta' THEN c.saldo_pendiente ELSE 0 END), 0) AS por_cobrar,
         COALESCE(SUM(CASE WHEN c.tipo = 'compra' THEN c.saldo_pendiente ELSE 0 END), 0) AS por_pagar,
         COALESCE(SUM(CASE WHEN c.estado_cartera = 'vencida' THEN c.saldo_pendiente ELSE 0 END), 0) AS vencido,
         COALESCE(SUM(CASE WHEN c.tipo = 'venta' AND c.estado_cartera = 'vencida' THEN c.saldo_pendiente ELSE 0 END), 0) AS vencido_cobrar,
         COALESCE(SUM(CASE WHEN c.tipo = 'venta' AND c.dias_vencido BETWEEN -7 AND 0
                           THEN c.saldo_pendiente ELSE 0 END), 0) AS por_vencer_7d,
         COALESCE(SUM(CASE WHEN c.estado_cartera = 'vencida' THEN 1 ELSE 0 END), 0) AS facturas_vencidas
       FROM (${CARTERA_DERIVED}) c
       WHERE c.saldo_pendiente > 0`,
      []
    ),
    // DSO simple: cuántos días de ventas a crédito representa la cartera actual.
    pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(i.total_neto), 0) AS total, COUNT(*) AS facturas
       FROM invoices i
       WHERE i.tipo = 'venta' AND i.estado = 'confirmada'
         AND i.condicion_pago = 'credito'
         AND i.fecha BETWEEN ? AND ?`,
      [desde, hasta]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT c.contraparte, c.party_id,
              COALESCE(SUM(c.saldo_pendiente), 0) AS saldo,
              COALESCE(SUM(CASE WHEN c.estado_cartera = 'vencida' THEN c.saldo_pendiente ELSE 0 END), 0) AS vencido,
              COALESCE(MAX(c.dias_vencido), 0) AS max_dias
       FROM (${CARTERA_DERIVED}) c
       WHERE c.tipo = 'venta' AND c.saldo_pendiente > 0
       GROUP BY c.contraparte, c.party_id
       ORDER BY vencido DESC, saldo DESC
       LIMIT 5`,
      []
    ),
  ]);

  const [agingRows] = agingResult;
  const ventaRow = agingRows.find((r) => r.tipo === "venta");
  const compraRow = agingRows.find((r) => r.tipo === "compra");
  const [[totales]] = totalesResult;
  const [[ventas]] = ventasResult;
  const [topDeudores] = topDeudoresResult;
  const ventasCredito = roundMoney(Number(ventas.total));
  const porCobrar = roundMoney(Number(totales.por_cobrar));
  const dso =
    ventasCredito > 0 ? roundMoney((porCobrar / ventasCredito) * periodoDias) : null;

  return {
    as_of: today(),
    periodo: { desde, hasta, dias: periodoDias },
    dso,
    ventas_credito: ventasCredito,
    facturas_credito: Number(ventas.facturas),
    totales: {
      por_cobrar: porCobrar,
      por_pagar: roundMoney(Number(totales.por_pagar)),
      vencido: roundMoney(Number(totales.vencido)),
      vencido_cobrar: roundMoney(Number(totales.vencido_cobrar)),
      por_vencer_7d: roundMoney(Number(totales.por_vencer_7d)),
      facturas_vencidas: Number(totales.facturas_vencidas),
    },
    aging: {
      venta: bucket(ventaRow),
      compra: bucket(compraRow),
    },
    top_deudores: topDeudores.map((r) => ({
      contraparte: r.contraparte,
      party_id: r.party_id,
      saldo: roundMoney(Number(r.saldo)),
      vencido: roundMoney(Number(r.vencido)),
      max_dias: Number(r.max_dias),
    })),
  };
}

async function lockInvoice(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<(RowDataPacket & InvoiceForCartera)[]>(
    "SELECT * FROM invoices WHERE id = ? FOR UPDATE",
    [id]
  );
  const invoice = rows[0];
  if (!invoice) throw new HttpError(404, "Factura no encontrada");
  return invoice;
}

export async function createPayment(
  invoiceId: number,
  input: CreatePaymentInput,
  actor: { id: number }
) {
  return withTransaction(async (conn) => {
    const invoice = await lockInvoice(conn, invoiceId);
    if (invoice.estado !== "confirmada") {
      throw new HttpError(409, "Solo se registran pagos sobre facturas confirmadas");
    }
    if (invoice.condicion_pago !== "credito") {
      throw new HttpError(409, "La factura es de contado y no tiene cartera pendiente");
    }

    const [[paid]] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(monto), 0) AS pagado
       FROM invoice_payments
       WHERE invoice_id = ? AND estado = 'valido'`,
      [invoiceId]
    );
    const [[nota]] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN -total_neto ELSE total_neto END), 0) AS ajuste
       FROM invoice_adjustments
       WHERE invoice_id = ? AND estado = 'confirmada'`,
      [invoiceId]
    );
    const saldo = saldoPendiente(invoice, Number(paid.pagado), Number(nota.ajuste));
    if (roundMoney(input.monto) > saldo) {
      throw new HttpError(
        400,
        `El monto supera el saldo pendiente de la factura (${saldo.toFixed(2)})`
      );
    }

    await assertPeriodOpen(conn, input.fecha);

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO invoice_payments
         (invoice_id, fecha, monto, account_id, metodo, referencia, notas, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        input.fecha,
        roundMoney(input.monto),
        input.account_id ?? null,
        input.metodo,
        input.referencia ?? null,
        input.notas ?? null,
        actor.id,
      ]
    );
    const paymentId = res.insertId;

    const tipo = invoice.tipo === "venta" ? "ingreso" : "gasto";
    const codigo = invoice.tipo === "venta" ? "cobro_cartera" : "pago_cartera";
    const txId = await createAutoTransaction(conn, {
      tipo,
      monto: input.monto,
      fecha: input.fecha,
      categoriaCodigo: codigo,
      accountId: input.account_id ?? null,
      invoiceId,
      afectaCaja: true, // el cobro/pago sí mueve caja
      descripcion: `${invoice.tipo === "venta" ? "Cobro" : "Pago"} factura ${invoice.numero}`,
      userId: actor.id,
    });

    // Se guarda la cuenta realmente usada (puede ser la cuenta por defecto).
    const [[tx]] = await conn.query<RowDataPacket[]>(
      "SELECT account_id FROM transactions WHERE id = ?",
      [txId]
    );
    await conn.query(
      "UPDATE invoice_payments SET transaction_id = ?, account_id = ? WHERE id = ?",
      [txId, tx.account_id, paymentId]
    );

    await auditFinance(conn, actor.id, "payment", paymentId, "crear", null, {
      invoice_id: invoiceId,
      monto: input.monto,
      fecha: input.fecha,
      tipo,
      transaction_id: txId,
    });

    const pagado = roundMoney(Number(paid.pagado) + input.monto);
    const [[nota2]] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN -total_neto ELSE total_neto END), 0) AS ajuste
       FROM invoice_adjustments
       WHERE invoice_id = ? AND estado = 'confirmada'`,
      [invoiceId]
    );
    const ajuste = roundMoney(Number(nota2.ajuste));
    return {
      id: paymentId,
      transaction_id: txId,
      pagado,
      saldo_pendiente: Math.max(0, roundMoney(Number(invoice.total_neto) + ajuste - pagado)),
    };
  });
}

export async function cancelPayment(
  invoiceId: number,
  paymentId: number,
  actor: { id: number }
) {
  return withTransaction(async (conn) => {
    const invoice = await lockInvoice(conn, invoiceId);
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM invoice_payments WHERE id = ? AND invoice_id = ? FOR UPDATE",
      [paymentId, invoiceId]
    );
    const payment = rows[0];
    if (!payment) throw new HttpError(404, "Pago no encontrado");
    if (payment.estado === "anulado") throw new HttpError(409, "El pago ya está anulado");
    if (!payment.transaction_id) {
      throw new HttpError(409, "El pago no tiene un asiento contable asociado");
    }

    const [txRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM transactions WHERE id = ? AND anulada_de IS NULL",
      [payment.transaction_id]
    );
    const original = txRows[0];
    if (!original) throw new HttpError(409, "El asiento del pago ya fue anulado");

    const [reversal] = await conn.query<ResultSetHeader>(
      `INSERT INTO transactions
         (tipo, monto, afecta_caja, fecha, finance_category_id, account_id, product_id,
          quote_id, invoice_id, stock_movement_id, descripcion, anulada_de, created_by)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?)`,
      [
        original.tipo,
        original.monto,
        original.afecta_caja,
        today(),
        original.finance_category_id,
        original.account_id,
        invoiceId,
        `Anulación de ${invoice.tipo === "venta" ? "cobro" : "pago"} #${paymentId} factura ${invoice.numero}`,
        original.id,
        actor.id,
      ]
    );

    await conn.query(
      `UPDATE invoice_payments
       SET estado = 'anulado', anulada_at = NOW(), anulada_by = ?
       WHERE id = ?`,
      [actor.id, paymentId]
    );

    await auditFinance(conn, actor.id, "payment", paymentId, "anular", {
      estado: "valido",
    }, {
      estado: "anulado",
      reversal_transaction_id: reversal.insertId,
    });

    const [[paid]] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(monto), 0) AS pagado
       FROM invoice_payments
       WHERE invoice_id = ? AND estado = 'valido'`,
      [invoiceId]
    );
    const [[nota]] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN -total_neto ELSE total_neto END), 0) AS ajuste
       FROM invoice_adjustments
       WHERE invoice_id = ? AND estado = 'confirmada'`,
      [invoiceId]
    );
    return {
      id: paymentId,
      estado: "anulado",
      saldo_pendiente: saldoPendiente(invoice, Number(paid.pagado), Number(nota.ajuste)),
    };
  });
}
