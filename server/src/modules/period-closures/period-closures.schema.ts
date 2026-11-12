import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida");

export const createClosureSchema = z
  .object({
    nombre: z.string().trim().min(3, "Mínimo 3 caracteres").max(120),
    fecha_inicio: isoDate,
    fecha_fin: isoDate,
  })
  .refine((v) => v.fecha_inicio <= v.fecha_fin, {
    message: "La fecha inicial no puede ser posterior a la final",
    path: ["fecha_fin"],
  });

export const reopenClosureSchema = z.object({
  motivo: z.string().trim().min(5, "Explica el motivo de la reapertura").max(500),
});

export const fiscalYearSchema = z.object({
  anio: z.coerce
    .number()
    .int("El año debe ser entero")
    .min(2000, "Año mínimo: 2000")
    .max(2100, "Año máximo: 2100"),
});

export const fiscalYearQuerySchema = z.object({
  anio: z.coerce
    .number()
    .int("El año debe ser entero")
    .min(2000, "Año mínimo: 2000")
    .max(2100, "Año máximo: 2100"),
});

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

export type CreateClosureInput = z.infer<typeof createClosureSchema>;
export type ReopenClosureInput = z.infer<typeof reopenClosureSchema>;
export type FiscalYearInput = z.infer<typeof fiscalYearSchema>;
