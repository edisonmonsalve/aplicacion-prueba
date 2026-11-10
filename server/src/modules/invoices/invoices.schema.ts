import { z } from "zod";

const invoiceItemSchema = z.object({
  product_id: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  precio_unitario: z.number().min(0.01, "El precio unitario debe ser mayor que cero").max(9_999_999_999),
  descuento_pct: z.number().min(0).max(100).default(0),
  impuesto_pct: z.number().min(0).max(100).default(19),
});

const uniqueProducts = (items: { product_id: number }[]) =>
  new Set(items.map((i) => i.product_id)).size === items.length;

const invoiceFields = {
  tipo: z.enum(["venta", "compra"]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contraparte: z.string().trim().min(2).max(200),
  documento: z.string().trim().max(50).optional(),
  orden_compra: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(150).optional(),
  notas: z.string().trim().max(2000).optional(),
  quote_id: z.number().int().positive().nullable().optional(),
  account_id: z.number().int().positive().nullable().optional(),
  retencion_fuente: z.number().min(0).max(9_999_999_999).optional(),
  retencion_iva: z.number().min(0).max(9_999_999_999).optional(),
  retencion_ica: z.number().min(0).max(9_999_999_999).optional(),
  items: z.array(invoiceItemSchema).min(1),
};

export const createInvoiceSchema = z
  .object(invoiceFields)
  .refine((inv) => uniqueProducts(inv.items), {
    message: "Un producto no puede repetirse en las líneas de la factura",
    path: ["items"],
  })
  .refine((inv) => !(inv.tipo === "compra" && inv.quote_id), {
    message: "Una factura de compra no puede vincularse a una cotización de venta",
    path: ["quote_id"],
  });

export const updateInvoiceSchema = z
  .object({
    ...invoiceFields,
    tipo: invoiceFields.tipo.optional(),
    fecha: invoiceFields.fecha.optional(),
    contraparte: invoiceFields.contraparte.optional(),
    items: z.array(invoiceItemSchema).min(1).optional(),
  })
  .refine((inv) => !inv.items || uniqueProducts(inv.items), {
    message: "Un producto no puede repetirse en las líneas de la factura",
    path: ["items"],
  })
  .refine((inv) => !(inv.tipo === "compra" && inv.quote_id), {
    message: "Una factura de compra no puede vincularse a una cotización de venta",
    path: ["quote_id"],
  });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  tipo: z.enum(["venta", "compra"]).optional(),
  estado: z.enum(["borrador", "confirmada", "anulada"]).optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  q: z.string().trim().optional(),
});

export const idSchema = z.object({ id: z.coerce.number().int().positive() });
