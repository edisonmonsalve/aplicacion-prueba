import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { withTransaction } from "../../utils/transaction.js";
import { auditFinance } from "../finance/finance.shared.js";

/**
 * Datos de la empresa emisora que aparecen en cotizaciones y facturas.
 *
 * La tabla es un singleton (`id = 1`). Si por alguna razón la fila no existe,
 * se devuelven los datos de ejemplo para que la impresión nunca quede vacía.
 */
export interface CompanySettings {
  id: number;
  nombre: string;
  eslogan: string | null;
  nit: string | null;
  regimen: string | null;
  direccion: string | null;
  telefono: string | null;
  celular: string | null;
  email: string | null;
  web: string | null;
  logo_url: string | null;
  actualizado_en?: string;
}

const DEFAULT_COMPANY: CompanySettings = {
  id: 1,
  nombre: "INVENTARIO S.A.S.",
  eslogan: "Gestión de inventario y finanzas",
  nit: "NIT 901.555.010-2",
  regimen: "Régimen común",
  direccion: "Cra. 15 # 100-20, Bogotá D.C., Colombia",
  telefono: "+57 601 555 0123",
  celular: "+57 310 555 0123",
  email: "facturacion@inventario.co",
  web: "www.inventario.co",
  logo_url: null,
};

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).nullable().optional();

export const companySchema = z.object({
  nombre: text(150).min(2, "El nombre debe tener al menos 2 caracteres"),
  eslogan: optionalText(150),
  nit: optionalText(40),
  regimen: optionalText(60),
  direccion: optionalText(200),
  telefono: optionalText(40),
  celular: optionalText(40),
  email: optionalText(120).refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Correo electrónico no válido"
  ),
  web: optionalText(120),
  logo_url: optionalText(500).refine(
    (value) =>
      !value ||
      /^https?:\/\//i.test(value) ||
      value.startsWith("/") ||
      value.startsWith("data:image/"),
    "El logo debe ser una URL http(s), una ruta interna o una imagen data:"
  ),
});

export type CompanyInput = z.infer<typeof companySchema>;

const clean = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export async function getCompany(): Promise<CompanySettings> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, nombre, eslogan, nit, regimen, direccion, telefono, celular,
            email, web, logo_url, actualizado_en
     FROM company_settings WHERE id = 1 LIMIT 1`
  );
  return (rows[0] as CompanySettings | undefined) ?? DEFAULT_COMPANY;
}

export async function updateCompany(input: CompanyInput, actor: AuthUser) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM company_settings WHERE id = 1 FOR UPDATE"
    );
    const before = rows[0] ?? null;

    const values = [
      input.nombre,
      clean(input.eslogan),
      clean(input.nit),
      clean(input.regimen),
      clean(input.direccion),
      clean(input.telefono),
      clean(input.celular),
      clean(input.email),
      clean(input.web),
      clean(input.logo_url),
      actor.id,
    ];

    await conn.query(
      `INSERT INTO company_settings
         (id, nombre, eslogan, nit, regimen, direccion, telefono, celular,
          email, web, logo_url, actualizado_por)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nombre = VALUES(nombre),
         eslogan = VALUES(eslogan),
         nit = VALUES(nit),
         regimen = VALUES(regimen),
         direccion = VALUES(direccion),
         telefono = VALUES(telefono),
         celular = VALUES(celular),
         email = VALUES(email),
         web = VALUES(web),
         logo_url = VALUES(logo_url),
         actualizado_por = VALUES(actualizado_por)`,
      values
    );

    const [afterRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, nombre, eslogan, nit, regimen, direccion, telefono, celular,
              email, web, logo_url, actualizado_en
       FROM company_settings WHERE id = 1`
    );
    const after = afterRows[0] as CompanySettings;

    await auditFinance(conn, actor.id, "company_settings", 1, "actualizar", before, after);

    return after;
  });
}
