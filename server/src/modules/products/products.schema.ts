import { z } from "zod";

// stock_actual no está aquí a propósito: solo cambia con movimientos
const productBase = z.object({
  sku: z.string().trim().min(1).max(50),
  nombre: z.string().trim().min(2).max(150),
  category_id: z.number().int().positive(),
  precio: z.number().positive().max(9_999_999_999), // RN-07
  costo: z.number().min(0).max(9_999_999_999).optional(),
  stock_minimo: z.number().int().min(0).default(0),
});

export const createProductSchema = productBase;
export const updateProductSchema = productBase.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().optional(),
  // Búsqueda por lote: "1,2,3". Permite hidratar líneas autocompletadas
  // (edición, cotización -> factura, reabastecimiento) sin paginar el catálogo.
  ids: z
    .string()
    .trim()
    .regex(/^\d+(,\d+)*$/, "ids debe ser una lista de números separados por coma")
    .optional(),
  category_id: z.coerce.number().int().positive().optional(),
  activo: z.enum(["0", "1"]).optional(),
  bajoStock: z.enum(["1"]).optional(), // RF-11
  // Ordenamiento del listado: se aplica en el servidor para que funcione en
  // todas las páginas y no solo en la página visible.
  sort: z.enum(["sku", "nombre", "precio", "stock", "costo"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const activoSchema = z.object({ activo: z.boolean() });
export const idSchema = z.coerce.number().int().positive();