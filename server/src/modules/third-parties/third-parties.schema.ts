import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable().optional()
  );

const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().email("Email inválido").max(150).nullable().optional()
);

const thirdPartyFields = {
  tipo: z.enum(["cliente", "proveedor", "ambos"]),
  tipo_documento: z.enum(["NIT", "CC", "CE", "PASAPORTE", "OTRO"]),
  documento: optionalText(30),
  nombre: z.string().trim().min(2, "Mínimo 2 caracteres").max(200),
  email: optionalEmail,
  telefono: optionalText(50),
  direccion: optionalText(250),
  ciudad: optionalText(100),
  condicion_pago: z.enum(["contado", "credito"]),
  dias_credito: z.number().int().min(0).max(3650),
  notas: optionalText(1000),
  activo: z.boolean().optional(),
};

export const createThirdPartySchema = z.object({
  ...thirdPartyFields,
  tipo: thirdPartyFields.tipo.default("cliente"),
  tipo_documento: thirdPartyFields.tipo_documento.default("NIT"),
  condicion_pago: thirdPartyFields.condicion_pago.default("contado"),
  dias_credito: thirdPartyFields.dias_credito.default(0),
});

export const updateThirdPartySchema = z.object(thirdPartyFields).partial();

export const listThirdPartiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  tipo: z.enum(["cliente", "proveedor", "ambos"]).optional(),
  activo: z.coerce.number().int().min(0).max(1).optional(),
});

export const idSchema = z.object({ id: z.coerce.number().int().positive() });
