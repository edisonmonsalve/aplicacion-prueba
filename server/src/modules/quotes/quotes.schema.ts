import { z } from "zod";

// Hasta 2 decimales
const pct = z
  .number()
  .min(0)
  .max(100)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "Máximo 2 decimales");

// El cliente NO envía precio ni totales: se toman del catálogo y se calculan en el servidor
const lineSchema = z.object({
  product_id: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  descuento_pct: pct.default(0),
  impuesto_pct: pct.default(0),
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida");

export const quoteSchema = z.object({
  customer_nombre: z.string().trim().min(2).max(150),
  customer_documento: z.string().trim().max(50).optional(),
  customer_email: z.string().trim().email().max(150).optional(),
  fecha_validez: isoDate,
  notas: z.string().trim().max(2000).optional(),
  // Un borrador puede guardarse sin líneas; para enviarlo sí se exigirá (RN-P10)
  items: z.array(lineSchema).max(100),
});

export const idSchema = z.coerce.number().int().positive();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().optional(),
  estado: z
    .enum(["borrador", "enviado", "aprobado", "rechazado", "entregado", "vencido"])
    .optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
});