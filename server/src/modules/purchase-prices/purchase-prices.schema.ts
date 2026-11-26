import { z } from "zod";

/** Configuración del singleton: el umbral es porcentual y el adjunto es booleano. */
export const purchaseSettingsSchema = z.object({
  umbral_pct: z.number().min(0).max(100),
  requiere_adjunto: z.boolean(),
});

export const purchaseSettingsResponseSchema = purchaseSettingsSchema.extend({
  id: z.number(),
  updated_by: z.number().nullable(),
  updated_at: z.string(),
});

export const lastPriceQuerySchema = z.object({
  product_id: z.coerce.number().int().positive().optional(),
  supplier_key: z.string().trim().max(191).optional(),
});

export const priceHistoryQuerySchema = z.object({
  product_id: z.coerce.number().int().positive().optional(),
  supplier_key: z.string().trim().max(191).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

/** El adjunto viaja como base64 dentro de JSON; los bytes se validan en el servicio. */
export const attachmentSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  contenido_base64: z.string().min(1),
  mime: z.string().trim().max(100).optional(),
});

export const attachmentResponseSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  mime: z.string(),
  tamano_bytes: z.number(),
  created_at: z.string(),
});

export const approvalDecisionSchema = z.object({
  motivo: z.string().trim().max(500).optional(),
});

export const attachmentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  adjuntoId: z.coerce.number().int().positive(),
});

export const lastPriceItemSchema = z.object({
  product_id: z.number(),
  sku: z.string(),
  producto: z.string(),
  supplier_key: z.string(),
  precio_unitario: z.number(),
  invoice_id: z.number().nullable(),
  confirmed_at: z.string().nullable(),
});

export const priceHistoryItemSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  sku: z.string(),
  producto: z.string(),
  supplier_key: z.string(),
  precio_unitario: z.number(),
  precio_anterior: z.number().nullable(),
  variacion_pct: z.number().nullable(),
  invoice_id: z.number().nullable(),
  origen: z.string(),
  created_at: z.string(),
  created_by: z.number().nullable(),
});

export const approvalResponseSchema = z.object({
  id: z.number(),
  invoice_id: z.number(),
  estado: z.enum(["pendiente", "aprobada", "rechazada", "invalida"]),
  motivo: z.string().nullable(),
  solicitada_por: z.number(),
  revisada_por: z.number().nullable(),
  revisada_at: z.string().nullable(),
  created_at: z.string(),
});

export const approvalLookupResponseSchema = z.object({
  aprobacion: approvalResponseSchema.nullable(),
});

export const purchaseValidationResponseSchema = z.object({
  tipo: z.enum(["venta", "compra"]),
  estado: z.string(),
  puede_confirmar: z.boolean(),
  bloqueos: z.array(
    z.object({
      codigo: z.string(),
      mensaje: z.string(),
      detalles: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  proveedor_key: z.string().nullable().optional(),
  requiere_aprobacion: z.boolean().optional(),
  aprobacion: z
    .object({ id: z.number(), estado: z.string() })
    .nullable()
    .optional(),
  umbral_pct: z.number().optional(),
  tiene_adjunto: z.boolean().optional(),
  total_xml: z.number().nullable().optional(),
  lineas: z
    .array(
      z.object({
        product_id: z.number(),
        precio_unitario: z.number().optional(),
        precio_anterior: z.number().optional(),
        variacion_pct: z.number().optional(),
      })
    )
    .optional(),
});

export const lastPriceResponseSchema = z.array(lastPriceItemSchema);
export const priceHistoryResponseSchema = z.array(priceHistoryItemSchema);
export const attachmentListResponseSchema = z.array(attachmentResponseSchema);
