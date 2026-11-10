import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida");

export const createMovementSchema = z.object({
  product_id: z.number().int().positive(),
  tipo: z.enum(["entrada", "salida"]),
  cantidad: z.number().int().positive(), // RN-07: entero mayor que cero
  // Costo unitario de la entrada. Si se omite, se usa products.costo.
  costo_unitario: z.number().min(0).max(9_999_999_999).optional(),
  motivo: z.string().trim().max(255).optional(),
  origen: z.enum(["compra", "venta", "entrega", "merma", "ajuste"]).default("ajuste"),
  // Cuenta de caja/banco que mueve el asiento automático (solo compras/ventas).
  account_id: z.number().int().positive().optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  product_id: z.coerce.number().int().positive().optional(),
  tipo: z.enum(["entrada", "salida"]).optional(),
  origen: z.enum(["compra", "venta", "entrega", "merma", "ajuste"]).optional(),
  invoice_id: z.coerce.number().int().positive().optional(),
  quote_id: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(150).optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
});