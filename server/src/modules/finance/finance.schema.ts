import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida");

// Hasta 2 decimales, igual que DECIMAL(18,2)
const money = z
  .number()
  .min(0)
  .max(9_999_999_999_999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "Máximo 2 decimales");

const pct = z
  .number()
  .min(0)
  .max(100)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "Máximo 2 decimales");

export const idSchema = z.coerce.number().int().positive();

export const budgetLineSchema = z
  .object({
    finance_category_id: z.number().int().positive(),
    product_id: z.number().int().positive().nullable().optional(),
    product_category_id: z.number().int().positive().nullable().optional(),
    monto_planeado: money,
  })
  .refine((l) => !(l.product_id && l.product_category_id), {
    message: "Una línea no puede ser a la vez por producto y por categoría de producto",
    path: ["product_category_id"],
  });

export const budgetSchema = z
  .object({
    nombre: z.string().trim().min(2).max(150),
    tipo_periodo: z.enum(["dia", "semana", "mes", "anio"]),
    fecha_inicio: isoDate,
    fecha_fin: isoDate,
    ingreso_meta: money.default(0),
    alerta_pct: pct.refine((v) => v > 0, "Debe ser mayor que cero").default(80),
    lineas: z.array(budgetLineSchema).max(200).default([]),
  })
  .refine((b) => b.fecha_fin >= b.fecha_inicio, {
    message: "La fecha final no puede ser anterior a la inicial",
    path: ["fecha_fin"],
  });

export const listBudgetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().optional(),
  estado: z.enum(["borrador", "activo", "cerrado"]).optional(),
  tipo_periodo: z.enum(["dia", "semana", "mes", "anio"]).optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
  // Filtro rápido: solo presupuestos cuyo rango contiene la fecha de hoy.
  vigente: z.enum(["0", "1"]).optional(),
  sort: z
    .enum(["nombre", "periodo", "inicio", "estado", "lineas", "planeado", "meta", "creador"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const transactionSchema = z.object({
  tipo: z.enum(["ingreso", "gasto", "activo", "pasivo"]),
  monto: money.refine((v) => v > 0, "Debe ser mayor que cero"),
  fecha: isoDate,
  finance_category_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  product_id: z.number().int().positive().nullable().optional(),
  descripcion: z.string().trim().max(255).optional(),
});

export const accountSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  tipo: z.enum(["caja", "banco"]),
  saldo_inicial: money.default(0),
  activo: z.boolean().optional(),
});

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  tipo: z.enum(["ingreso", "gasto", "activo", "pasivo"]).optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
  finance_category_id: z.coerce.number().int().positive().optional(),
  account_id: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  quote_id: z.coerce.number().int().positive().optional(),
  invoice_id: z.coerce.number().int().positive().optional(),
  sort: z
    .enum(["fecha", "tipo", "categoria", "cuenta", "producto", "monto", "creador"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const summaryQuerySchema = z.object({
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
});

export const cashFlowQuerySchema = summaryQuerySchema.extend({
  account_id: z.coerce.number().int().positive().optional(),
});

export const balanceQuerySchema = z.object({
  hasta: isoDate.optional(),
});

export const profitabilityQuerySchema = summaryQuerySchema.extend({
  grupo: z.enum(["producto", "categoria", "cliente"]).optional(),
});
