import { z } from "zod";

export const createMovementSchema = z.object({
  product_id: z.number().int().positive(),
  tipo: z.enum(["entrada", "salida"]),
  cantidad: z.number().int().positive(), // RN-07: entero mayor que cero
  motivo: z.string().trim().max(255).optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  product_id: z.coerce.number().int().positive().optional(),
  tipo: z.enum(["entrada", "salida"]).optional(),
});