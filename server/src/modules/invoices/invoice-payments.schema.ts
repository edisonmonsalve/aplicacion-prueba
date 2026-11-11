import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida");

const money = z
  .number()
  .positive("El monto debe ser mayor que cero")
  .max(9_999_999_999_999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "Máximo 2 decimales");

export const createPaymentSchema = z.object({
  fecha: isoDate,
  monto: money,
  account_id: z.number().int().positive().nullable().optional(),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta", "otro"]).default("transferencia"),
  referencia: z.string().trim().max(100).optional(),
  notas: z.string().trim().max(500).optional(),
});

export const receivableQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tipo: z.enum(["venta", "compra"]).optional(),
  estado: z.enum(["pendiente", "parcial", "pagada", "vencida"]).optional(),
  q: z.string().trim().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

export const paymentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  paymentId: z.coerce.number().int().positive(),
});

export const agingQuerySchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ReceivableQuery = z.infer<typeof receivableQuerySchema>;
export type AgingQuery = z.infer<typeof agingQuerySchema>;
