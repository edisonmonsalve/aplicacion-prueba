
import type { PoolConnection } from "mysql2/promise";
import type {
  QuoteAuditSnapshot,
  QuoteAuditChanges,
  QuoteAuditItem,
} from "./quotes.audit.types.js";

import {
  insertQuoteAudit,
} from "./quotes.audit.queries.js";


function normalizeItem(item: QuoteAuditItem) {
  return {
    product_id: Number(item.product_id),
    sku: item.sku,
    nombre: item.nombre,
    cantidad: Number(item.cantidad),
    precio_unitario: Number(item.precio_unitario),
    descuento_pct: Number(item.descuento_pct),
    impuesto_pct: Number(item.impuesto_pct),
    total_linea: Number(item.total_linea),
  };
}

function normalizeItems(items: QuoteAuditItem[]) {
  return [...items]
    .map(normalizeItem)
    .sort((a, b) => a.product_id - b.product_id);
}

function normalizeNumber(value: unknown): unknown {
  if (value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function addChange(
  changes: QuoteAuditChanges,
  field: string,
  oldValue: unknown,
  newValue: unknown,
  normalize: (value: unknown) => unknown = (value) => value
): void {
  if (
    JSON.stringify(normalize(oldValue)) !==
    JSON.stringify(normalize(newValue))
  ) {
    changes[field] = {
      old: oldValue,
      new: newValue,
    };
  }
}

export async function auditQuoteUpdate(
  conn: PoolConnection,
  quoteId: number,
  userId: number,
  previous: QuoteAuditSnapshot,
  current: QuoteAuditSnapshot
): Promise<void> {
  const changes: QuoteAuditChanges = {};

  const textFields = ["customer_nombre", "customer_documento", "customer_email", "fecha_validez", "notas",] as const;

  const numericFields = ["subtotal", "descuento_total", "impuesto_total", "total",] as const;

  for (const field of textFields) {
    addChange(changes, field, previous.header[field], current.header[field]);
  }

  for (const field of numericFields) {
    addChange(changes, field, previous.header[field], current.header[field], normalizeNumber);
  }

  const oldItems = normalizeItems(previous.items);
  const newItems = normalizeItems(current.items);

  if (
    JSON.stringify(oldItems) !== JSON.stringify(newItems)
  ) {
    changes.items = { old: oldItems, new: newItems, };
  }

  if (Object.keys(changes).length === 0) {
    return;
  }

  await insertQuoteAudit(conn, quoteId, userId, changes);
}
