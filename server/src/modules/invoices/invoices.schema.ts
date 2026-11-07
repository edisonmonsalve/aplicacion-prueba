import { z } from "zod";

export const invoiceItemSchema = z.object({
  product_id: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  precio_unitario: z.number().min(0.01, "El precio unitario debe ser mayor que cero").max(9_999_999_999),
  descuento_pct: z.number().min(0).max(100).default(0),
  impuesto_pct: z.number().min(0).max(100).default(0),
});

export const createInvoiceSchema = z.object({
  tipo: z.enum(["venta", "compra"]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contraparte: z.string().trim().min(2).max(200),
  documento: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(150).optional(),
  notas: z.string().trim().max(2000).optional(),
  items: z.array(invoiceItemSchema).min(1),
});

export const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  items: z.array(invoiceItemSchema).min(1).optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  tipo: z.enum(["venta", "compra"]).optional(),
  estado: z.enum(["borrador", "confirmada", "anulada"]).optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

export const idSchema = z.object({ id: z.coerce.number().int().positive() });