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

export const budgetLineSchema = z.object({
  finance_category_id: z.number().int().positive(),
  product_id: z.number().int().positive().nullable().optional(),
  monto_planeado: money,
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
});

export const transactionSchema = z.object({
  tipo: z.enum(["ingreso", "gasto"]),
  monto: money.refine((v) => v > 0, "Debe ser mayor que cero"),
  fecha: isoDate,
  finance_category_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  product_id: z.number().int().positive().nullable().optional(),
  descripcion: z.string().trim().max(255).optional(),
});

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  tipo: z.enum(["ingreso", "gasto"]).optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
  finance_category_id: z.coerce.number().int().positive().optional(),
  account_id: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  quote_id: z.coerce.number().int().positive().optional(),
});

export const summaryQuerySchema = z.object({
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
});
