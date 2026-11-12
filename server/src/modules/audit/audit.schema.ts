import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida");

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  entidad: z
    .enum([
      "budget",
      "transaction",
      "account",
      "payment",
      "period_closure",
      "invoice_adjustment",
      "bank_reconciliation",
    ])
    .optional(),
  entidad_id: z.coerce.number().int().positive().optional(),
  accion: z.string().trim().max(30).optional(),
  user_id: z.coerce.number().int().positive().optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
});
