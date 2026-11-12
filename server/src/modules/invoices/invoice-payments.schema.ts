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

/** Los parámetros de consulta llegan como texto; evita que "false" sea true. */
const boolish = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  return value;
}, z.boolean());

export const carteraAlertQuerySchema = z.object({
  tipo: z.enum(["venta", "compra"]).default("venta"),
  severidad: z.enum(["critica", "alta", "media", "baja"]).optional(),
  incluir_resueltos: boolish.default(false),
  q: z.string().trim().max(120).optional(),
});

export const followupSchema = z
  .object({
    estado: z.enum(["pendiente", "recordado", "promesa", "escalado", "resuelto"]),
    nota: z.string().trim().max(500).optional().nullable(),
    proximo_contacto: isoDate.optional().nullable(),
  })
  .refine((v) => v.estado !== "promesa" || !!v.proximo_contacto, {
    message: "Una promesa de pago requiere la fecha del próximo contacto",
    path: ["proximo_contacto"],
  });

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ReceivableQuery = z.infer<typeof receivableQuerySchema>;
export type AgingQuery = z.infer<typeof agingQuerySchema>;
export type CarteraAlertQuery = z.infer<typeof carteraAlertQuerySchema>;
export type FollowupInput = z.infer<typeof followupSchema>;
