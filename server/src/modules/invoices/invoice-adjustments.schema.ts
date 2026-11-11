import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida");

const money = z
  .number()
  .min(0.01, "El valor debe ser mayor que cero")
  .max(9_999_999_999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "Máximo 2 decimales");

const adjustmentItemSchema = z.object({
  invoice_item_id: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  // Si no se envían, se heredan de la línea original. Permiten corregir
  // precios o descuentos sin cambiar la cantidad devuelta.
  precio_unitario: money.optional(),
  descuento_pct: z.number().min(0).max(100).optional(),
  impuesto_pct: z.number().min(0).max(100).optional(),
});

export const createAdjustmentSchema = z
  .object({
    tipo: z.enum(["credito", "debito"]),
    fecha: isoDate,
    motivo: z.string().trim().max(500).optional(),
    // Crédito: devuelve stock por defecto. Débito: no lo mueve salvo que se pida.
    afecta_stock: z.boolean().optional(),
    items: z.array(adjustmentItemSchema).min(1, "La nota necesita al menos una línea"),
  })
  .refine(
    (n) => new Set(n.items.map((i) => i.invoice_item_id)).size === n.items.length,
    {
      message: "Una línea de la factura no puede repetirse en la nota",
      path: ["items"],
    }
  );

export const adjustmentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  adjustmentId: z.coerce.number().int().positive(),
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
