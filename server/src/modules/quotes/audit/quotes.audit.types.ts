export interface QuoteAuditHeader {
  customer_nombre: string;
  customer_documento: string | null;
  customer_email: string | null;
  fecha_validez: string;
  notas: string | null;
  subtotal: number | string;
  descuento_total: number | string;
  impuesto_total: number | string;
  total: number | string;
}

export interface QuoteAuditItem {
  product_id: number;
  sku: string;
  nombre: string;
  cantidad: number | string;
  precio_unitario: number | string;
  descuento_pct: number | string;
  impuesto_pct: number | string;
  total_linea: number | string;
}

export interface QuoteAuditSnapshot {
  header: QuoteAuditHeader;
  items: QuoteAuditItem[];
}

export interface QuoteAuditChange {
  old: unknown;
  new: unknown;
}

export type QuoteAuditChanges = Record<string, QuoteAuditChange>;