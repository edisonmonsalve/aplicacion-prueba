import { z } from "zod";

export const createMovementSchema = z.object({
  product_id: z.number().int().positive(),
  tipo: z.enum(["entrada", "salida"]),
  cantidad: z.number().int().positive(), // RN-07: entero mayor que cero
  // Costo unitario de la entrada. Si se omite, se usa products.costo.
  costo_unitario: z.number().min(0).max(9_999_999_999).optional(),
  motivo: z.string().trim().max(255).optional(),
  origen: z.enum(["compra", "venta", "entrega", "merma", "ajuste"]).default("ajuste"),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  product_id: z.coerce.number().int().positive().optional(),
  tipo: z.enum(["entrada", "salida"]).optional(),
});