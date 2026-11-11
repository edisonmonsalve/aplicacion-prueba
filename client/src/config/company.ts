/**
 * Identidad de la empresa emisora que aparece en cotizaciones y facturas.
 *
 * Los datos están centralizados aquí para poder reemplazarlos por los reales
 * sin tocar las plantillas de impresión.
 */
export const COMPANY = {
  nombre: "INVENTARIO S.A.S.",
  eslogan: "Gestión de inventario y finanzas",
  nit: "NIT 901.555.010-2",
  regimen: "Régimen común",
  direccion: "Cra. 15 # 100-20, Bogotá D.C., Colombia",
  telefono: "+57 601 555 0123",
  celular: "+57 310 555 0123",
  email: "facturacion@inventario.co",
  web: "www.inventario.co",
} as const;
