import { roundMoney } from "../finance/finance.shared.js";

/** Configuración por defecto de la migración V033 (el umbral es porcentual). */
export const UMBRAL_POR_DEFECTO = 10;
export const TOLERANCIA_TOTALES = 0.01;
export const MAX_ADJUNTO_BYTES = 5 * 1024 * 1024;

/** Códigos estables que devuelve la API cuando una compra no se puede confirmar. */
export const CODIGOS_COMPRA = {
  PROVEEDOR_NO_IDENTIFICABLE: "PROVEEDOR_NO_IDENTIFICABLE",
  FACTURA_DUPLICADA: "FACTURA_DUPLICADA",
  TOTALES_NO_COINCIDEN: "TOTALES_NO_COINCIDEN",
  ADJUNTO_REQUERIDO: "ADJUNTO_REQUERIDO",
  ADJUNTO_INVALIDO: "ADJUNTO_INVALIDO",
  TOTAL_XML_NO_COINCIDE: "TOTAL_XML_NO_COINCIDE",
  APROBACION_REQUERIDA: "APROBACION_REQUERIDA",
} as const;

export type CodigoCompra = (typeof CODIGOS_COMPRA)[keyof typeof CODIGOS_COMPRA];

export interface BloqueoCompra {
  codigo: CodigoCompra;
  mensaje: string;
  /** Detalles con importes y productos; se ocultan al rol operador. */
  detalles?: Record<string, unknown>;
}

export interface LineaVariacion {
  product_id: number;
  precio_unitario: number;
  precio_anterior: number;
  variacion_pct: number;
}

export interface DatosProveedor {
  contraparte: string | number | null | undefined;
  documento?: string | number | null;
}

/** Normaliza texto para comparar proveedores sin depender de mayúsculas/espacios. */
export function normalizarTexto(valor: string | number | null | undefined) {
  return String(valor ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Clave estable del proveedor. El documento (NIT) gana sobre el nombre porque
 * dos razones sociales distintas pueden corresponder al mismo contribuyente.
 * Si no hay ninguno de los dos, el proveedor no se considera identificable.
 */
export function supplierKey(proveedor: DatosProveedor): string | null {
  const documento = normalizarTexto(proveedor.documento);
  if (documento) return `doc:${documento}`;
  const nombre = normalizarTexto(proveedor.contraparte);
  return nombre ? `nom:${nombre}` : null;
}

/** Variación porcentual entre el precio anterior y el actual (0 si no hay base). */
export function variacionPct(actual: number, anterior: number) {
  if (anterior <= 0) return 0;
  return roundMoney((Math.abs(actual - anterior) / anterior) * 100);
}

/** El umbral se compara con `>`: exactamente el 10 % no exige aprobación. */
export function superaUmbral(actual: number, anterior: number, umbralPct: number) {
  return anterior > 0 && variacionPct(actual, anterior) > Number(umbralPct);
}

/** Costo neto de una línea: sin IVA y con el descuento ya aplicado. */
export function precioNetoLinea(item: Record<string, unknown>) {
  const descuento = Number(item.descuento_pct ?? 0);
  return roundMoney(Number(item.precio_unitario ?? 0) * (1 - descuento / 100));
}
