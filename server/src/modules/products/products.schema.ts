import { z } from "zod";

// stock_actual no está aquí a propósito: solo cambia con movimientos
const productBase = z.object({
  sku: z.string().trim().min(1).max(50),
  nombre: z.string().trim().min(2).max(150),
  category_id: z.number().int().positive(),
  precio: z.number().positive().max(9_999_999_999), // RN-07
  stock_minimo: z.number().int().min(0).default(0),
});

export const createProductSchema = productBase;
export const updateProductSchema = productBase.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  activo: z.enum(["0", "1"]).optional(),
  bajoStock: z.enum(["1"]).optional(), // RF-11
});

export const activoSchema = z.object({ activo: z.boolean() });
export const idSchema = z.coerce.number().int().positive();