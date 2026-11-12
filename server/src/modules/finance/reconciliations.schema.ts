import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida");

const money = z
  .number()
  .min(-9_999_999_999_999.99)
  .max(9_999_999_999_999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "Máximo 2 decimales");

// El extracto puede tener saldo inicial y final negativos (sobregiro), pero una
// línea de movimiento nunca vale cero.
const balanceMoney = money;
const movementMoney = money.refine((v) => v !== 0, "El monto no puede ser cero");

export const statementLineSchema = z.object({
  fecha: isoDate,
  descripcion: z.string().trim().min(2, "Describe el movimiento").max(255),
  referencia: z.string().trim().max(100).optional(),
  monto: movementMoney,
  nota: z.string().trim().max(500).optional(),
});

export const createReconciliationSchema = z
  .object({
    account_id: z.number().int().positive(),
    nombre: z.string().trim().min(3, "Mínimo 3 caracteres").max(120),
    fecha_inicio: isoDate,
    fecha_fin: isoDate,
    saldo_extracto_inicial: balanceMoney.default(0),
    saldo_extracto_final: balanceMoney.default(0),
    lineas: z.array(statementLineSchema).max(500).default([]),
  })
  .refine((v) => v.fecha_inicio <= v.fecha_fin, {
    message: "La fecha inicial no puede ser posterior a la final",
    path: ["fecha_fin"],
  })
  .refine(
    (v) =>
      v.lineas.every((l) => l.fecha >= v.fecha_inicio && l.fecha <= v.fecha_fin),
    {
      message: "Todas las líneas deben estar dentro del rango de la conciliación",
      path: ["lineas"],
    }
  );

export const updateReconciliationSchema = z
  .object({
    nombre: z.string().trim().min(3, "Mínimo 3 caracteres").max(120),
    fecha_inicio: isoDate,
    fecha_fin: isoDate,
    saldo_extracto_inicial: balanceMoney,
    saldo_extracto_final: balanceMoney,
  })
  .refine((v) => v.fecha_inicio <= v.fecha_fin, {
    message: "La fecha inicial no puede ser posterior a la final",
    path: ["fecha_fin"],
  });

export const listReconciliationsQuerySchema = z.object({
  account_id: z.coerce.number().int().positive().optional(),
  estado: z.enum(["abierta", "cerrada"]).optional(),
});

export const listSuggestionsQuerySchema = z.object({
  dias: z.coerce.number().int().min(0).max(31).default(7),
});

export const matchLineSchema = z.object({
  transaction_id: z.number().int().positive(),
});

export const ignoreLineSchema = z.object({
  nota: z.string().trim().min(3, "Explica por qué se ignora la línea").max(500),
});

export const reopenReconciliationSchema = z.object({
  motivo: z.string().trim().min(5, "Explica el motivo de la reapertura").max(500),
});

export type CreateReconciliationInput = z.infer<typeof createReconciliationSchema>;
export type UpdateReconciliationInput = z.infer<typeof updateReconciliationSchema>;
export type StatementLineInput = z.infer<typeof statementLineSchema>;
export type ListReconciliationsQuery = z.infer<typeof listReconciliationsQuerySchema>;
