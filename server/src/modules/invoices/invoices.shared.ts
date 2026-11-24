import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { roundMoney } from "../finance/finance.shared.js";

export type LineCalc = {
  bruto: number;
  descuento: number;
  base: number;
  /** IVA. Sigue siendo `impuesto_total` para no alterar los asientos. */
  iva: number;
  /** Impuesto nacional al consumo. */
  inc: number;
  /** Otro tributo parametrizable por línea. */
  otro: number;
  /** Suma de los tres tributos (compatibilidad con callers anteriores). */
  impuesto: number;
  total: number;
};

type TaxableItem = {
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  impuesto_pct: number;
  inc_pct?: number;
  otro_impuesto_pct?: number;
};

/**
 * Discrimina los tributos de una línea sin cambiar la base contable.
 *
 * `impuesto_total` de la cabecera sigue siendo solo IVA: los asientos de IVA
 * descontable por pagar no deben mezclar INC ni otros tributos. El total de la
 * factura sí incluye los tres.
 */
export function calcLine(item: TaxableItem): LineCalc {
  const bruto = item.cantidad * item.precio_unitario;
  const descuento = (bruto * item.descuento_pct) / 100;
  const base = bruto - descuento;
  const iva = (base * item.impuesto_pct) / 100;
  const inc = (base * (item.inc_pct ?? 0)) / 100;
  const otro = (base * (item.otro_impuesto_pct ?? 0)) / 100;
  const impuesto = iva + inc + otro;
  return {
    bruto: roundMoney(bruto),
    descuento: roundMoney(descuento),
    base: roundMoney(base),
    iva: roundMoney(iva),
    inc: roundMoney(inc),
    otro: roundMoney(otro),
    impuesto: roundMoney(impuesto),
    total: roundMoney(base + impuesto),
  };
}

export function calcTotals(items: TaxableItem[]) {
  return items.reduce(
    (acc, item) => {
      const l = calcLine(item);
      return {
        subtotal: roundMoney(acc.subtotal + l.bruto),
        descuento_total: roundMoney(acc.descuento_total + l.descuento),
        impuesto_total: roundMoney(acc.impuesto_total + l.iva),
        inc_total: roundMoney(acc.inc_total + l.inc),
        otros_impuestos_total: roundMoney(acc.otros_impuestos_total + l.otro),
        total: roundMoney(acc.total + l.total),
      };
    },
    {
      subtotal: 0,
      descuento_total: 0,
      impuesto_total: 0,
      inc_total: 0,
      otros_impuestos_total: 0,
      total: 0,
    }
  );
}

export function rowToLine(it: RowDataPacket) {
  return calcLine({
    cantidad: Number(it.cantidad),
    precio_unitario: Number(it.precio_unitario),
    descuento_pct: Number(it.descuento_pct),
    impuesto_pct: Number(it.impuesto_pct),
    inc_pct: Number(it.inc_pct ?? 0),
    otro_impuesto_pct: Number(it.otro_impuesto_pct ?? 0),
  });
}

export function totalsFromRows(items: RowDataPacket[]) {
  return items.reduce(
    (acc, it) => {
      const l = rowToLine(it);
      return {
        subtotal: roundMoney(acc.subtotal + l.bruto),
        descuento_total: roundMoney(acc.descuento_total + l.descuento),
        impuesto_total: roundMoney(acc.impuesto_total + l.iva),
        inc_total: roundMoney(acc.inc_total + l.inc),
        otros_impuestos_total: roundMoney(acc.otros_impuestos_total + l.otro),
        total: roundMoney(acc.total + l.total),
      };
    },
    {
      subtotal: 0,
      descuento_total: 0,
      impuesto_total: 0,
      inc_total: 0,
      otros_impuestos_total: 0,
      total: 0,
    }
  );
}

// Costo unitario de compra: neto de descuento, sin IVA (el IVA es descontable).
export function netUnitCost(item: {
  precio_unitario: number | string;
  descuento_pct: number | string;
}) {
  return roundMoney(
    Number(item.precio_unitario) * (1 - Number(item.descuento_pct) / 100)
  );
}

export type InvoiceCashProjection = {
  /** La factura mueve caja al confirmarse (solo contado). */
  mueve_caja: boolean;
  /** Base contable: subtotal menos descuento, sin IVA. */
  base: number;
  /** IVA total. Se registra aparte y nunca forma parte del capital de caja. */
  iva: number;
  /** Retenciones de fuente + ICA: reducen el efectivo recibido o pagado. */
  retenciones_caja: number;
  /** Retención de IVA: informativa, no mueve caja. */
  retencion_iva: number;
  /** Movimiento neto de caja al confirmar (0 si es a crédito). */
  movimiento_caja: number;
  /** Saldo que queda en cartera si es a crédito (total neto de retenciones). */
  cartera: number;
};

/**
 * Proyección del movimiento de caja al confirmar una factura.
 *
 * Replica exactamente la regla de `confirmInvoice` y de los asientos:
 * - Venta: entra la base (`ventas`) y salen las retenciones de fuente/ICA.
 * - Compra: sale la base (`inventario`) y las retenciones de fuente/ICA
 *   reducen lo pagado.
 * - El IVA (por pagar o descontable) y la retención de IVA no mueven caja.
 * - A crédito no hay movimiento: el saldo queda en cartera por el total neto.
 *
 * Se expone en el detalle de factura para que la UI no recomponga la fórmula
 * con el total (que incluye IVA) y termine mostrando un impacto confundible.
 */
export function invoiceCashProjection(inv: {
  tipo: string;
  condicion_pago: string;
  subtotal: number | string;
  descuento_total: number | string;
  impuesto_total: number | string;
  total: number | string;
  retencion_fuente?: number | string | null;
  retencion_iva?: number | string | null;
  retencion_ica?: number | string | null;
  total_neto?: number | string | null;
}): InvoiceCashProjection {
  const base = roundMoney(Number(inv.subtotal) - Number(inv.descuento_total));
  const iva = roundMoney(Number(inv.impuesto_total));
  const retencionesCaja = roundMoney(
    Number(inv.retencion_fuente ?? 0) + Number(inv.retencion_ica ?? 0)
  );
  const retencionIva = roundMoney(Number(inv.retencion_iva ?? 0));
  const esCredito = inv.condicion_pago === "credito";
  const signo = inv.tipo === "venta" ? 1 : -1;
  const movimientoCaja = esCredito
    ? 0
    : roundMoney(signo * (base - retencionesCaja));
  const totalNeto = roundMoney(
    Number(inv.total_neto ?? Number(inv.total) - retencionesCaja - retencionIva)
  );

  return {
    mueve_caja: !esCredito,
    base,
    iva,
    retenciones_caja: retencionesCaja,
    retencion_iva: retencionIva,
    movimiento_caja: movimientoCaja,
    cartera: esCredito ? totalNeto : 0,
  };
}

/**
 * Inserta la distribución analítica de un asiento y ajusta la última línea por
 * redondeo. Admite montos negativos para las notas crédito.
 */
export async function insertAllocations(
  conn: PoolConnection,
  transactionId: number,
  allocations: { invoiceItemId: number; productId: number; monto: number }[],
  total: number
) {
  if (allocations.length === 0) return;
  const sum = roundMoney(allocations.reduce((s, a) => s + a.monto, 0));
  const diff = roundMoney(total - sum);
  if (diff !== 0) {
    allocations[allocations.length - 1].monto = roundMoney(
      allocations[allocations.length - 1].monto + diff
    );
  }
  await conn.query(
    `INSERT INTO transaction_allocations (transaction_id, invoice_item_id, product_id, monto)
     VALUES ?`,
    [allocations.map((a) => [transactionId, a.invoiceItemId, a.productId, a.monto])]
  );
}
