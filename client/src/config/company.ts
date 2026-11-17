import type { CompanySettings } from "@/types";

/**
 * Identidad de la empresa emisora usada mientras carga la configuración real.
 *
 * Los datos editables viven en la tabla `company_settings` y se administran
 * desde la página «Empresa». Estos valores solo evitan que la impresión quede
 * vacía si la consulta aún no respondió o falla.
 */
export const DEFAULT_COMPANY: CompanySettings = {
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
