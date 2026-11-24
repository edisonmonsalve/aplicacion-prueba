import { z } from "zod";

const porcentaje = z.number().min(0).max(100);

const invoiceItemSchema = z.object({
  product_id: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  precio_unitario: z.number().min(0.01, "El precio unitario debe ser mayor que cero").max(9_999_999_999),
  /** Snapshot de la descripción facturada; el servidor la toma del catálogo si falta. */
  descripcion: z.string().trim().min(1).max(300).optional(),
  unidad_medida: z.string().trim().min(1).max(20).default("UND"),
  descuento_pct: porcentaje.default(0),
  impuesto_pct: porcentaje.default(19),
  inc_pct: porcentaje.default(0),
  otro_impuesto_nombre: z.string().trim().max(60).optional(),
  otro_impuesto_pct: porcentaje.default(0),
});

const uniqueProducts = (items: { product_id: number }[]) =>
  new Set(items.map((i) => i.product_id)).size === items.length;

const invoiceFields = {
  tipo: z.enum(["venta", "compra"]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_expedicion: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  contraparte: z.string().trim().min(2).max(200),
  tipo_documento_adquirente: z
    .enum(["NIT", "CC", "CE", "PASAPORTE", "OTRO"])
    .optional(),
  documento: z.string().trim().max(50).optional(),
  prefijo: z.string().trim().min(1).max(10).optional(),
  resolucion_numero: z.string().trim().max(40).optional(),
  resolucion_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rango_desde: z.number().int().positive().optional(),
  rango_hasta: z.number().int().positive().optional(),
  orden_compra: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(150).optional(),
  notas: z.string().trim().max(2000).optional(),
  quote_id: z.number().int().positive().nullable().optional(),
  party_id: z.number().int().positive().nullable().optional(),
  condicion_pago: z.enum(["contado", "credito"]).optional(),
  medio_pago: z.enum(["efectivo", "transferencia", "tarjeta", "cheque", "otro"]).optional(),
  dias_credito: z.number().int().min(0).max(3650).optional(),
  fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  account_id: z.number().int().positive().nullable().optional(),
  retencion_fuente: z.number().min(0).max(9_999_999_999).optional(),
  retencion_iva: z.number().min(0).max(9_999_999_999).optional(),
  retencion_ica: z.number().min(0).max(9_999_999_999).optional(),
  items: z.array(invoiceItemSchema).min(1),
};

export const createInvoiceSchema = z
  .object(invoiceFields)
  .refine((inv) => uniqueProducts(inv.items), {
    message: "Un producto no puede repetirse en las líneas de la factura",
    path: ["items"],
  })
  .refine((inv) => !(inv.tipo === "compra" && inv.quote_id), {
    message: "Una factura de compra no puede vincularse a una cotización de venta",
    path: ["quote_id"],
  });

export const updateInvoiceSchema = z
  .object({
    ...invoiceFields,
    tipo: invoiceFields.tipo.optional(),
    fecha: invoiceFields.fecha.optional(),
    contraparte: invoiceFields.contraparte.optional(),
    items: z.array(invoiceItemSchema).min(1).optional(),
  })
  .refine((inv) => !inv.items || uniqueProducts(inv.items), {
    message: "Un producto no puede repetirse en las líneas de la factura",
    path: ["items"],
  })
  .refine((inv) => !(inv.tipo === "compra" && inv.quote_id), {
    message: "Una factura de compra no puede vincularse a una cotización de venta",
    path: ["quote_id"],
  });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  tipo: z.enum(["venta", "compra"]).optional(),
  estado: z.enum(["borrador", "confirmada", "anulada"]).optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  q: z.string().trim().optional(),
  sort: z
    .enum(["numero", "tipo", "contraparte", "estado", "fecha", "total", "creador"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const idSchema = z.object({ id: z.coerce.number().int().positive() });
