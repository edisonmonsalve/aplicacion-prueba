import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { roundMoney } from "../finance/finance.shared.js";

export type LineCalc = {
  bruto: number;
  descuento: number;
  base: number;
  impuesto: number;
  total: number;
};

export function calcLine(item: {
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  impuesto_pct: number;
}): LineCalc {
  const bruto = item.cantidad * item.precio_unitario;
  const descuento = (bruto * item.descuento_pct) / 100;
  const base = bruto - descuento;
  const impuesto = (base * item.impuesto_pct) / 100;
  return {
    bruto: roundMoney(bruto),
    descuento: roundMoney(descuento),
    base: roundMoney(base),
    impuesto: roundMoney(impuesto),
    total: roundMoney(base + impuesto),
  };
}

export function calcTotals(
  items: {
    cantidad: number;
    precio_unitario: number;
    descuento_pct: number;
    impuesto_pct: number;
  }[]
) {
  return items.reduce(
    (acc, item) => {
      const l = calcLine(item);
      return {
        subtotal: roundMoney(acc.subtotal + l.bruto),
        descuento_total: roundMoney(acc.descuento_total + l.descuento),
        impuesto_total: roundMoney(acc.impuesto_total + l.impuesto),
        total: roundMoney(acc.total + l.total),
      };
    },
    { subtotal: 0, descuento_total: 0, impuesto_total: 0, total: 0 }
  );
}

export function rowToLine(it: RowDataPacket) {
  return calcLine({
    cantidad: Number(it.cantidad),
    precio_unitario: Number(it.precio_unitario),
    descuento_pct: Number(it.descuento_pct),
    impuesto_pct: Number(it.impuesto_pct),
  });
}

export function totalsFromRows(items: RowDataPacket[]) {
  return items.reduce(
    (acc, it) => {
      const l = rowToLine(it);
      return {
        subtotal: roundMoney(acc.subtotal + l.bruto),
        descuento_total: roundMoney(acc.descuento_total + l.descuento),
        impuesto_total: roundMoney(acc.impuesto_total + l.impuesto),
        total: roundMoney(acc.total + l.total),
      };
    },
    { subtotal: 0, descuento_total: 0, impuesto_total: 0, total: 0 }
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
