// Cálculos de margen y markup compartidos por el catálogo y los formularios.
//
// Margen y markup no son lo mismo:
//   margen % = (precio − costo) / precio × 100   → sobre el precio de venta
//   markup % = (precio − costo) / costo   × 100   → sobre el costo
// Confundirlos es una de las causas más comunes de precios mal fijados.

export type MarginLevel = "unknown" | "negative" | "thin" | "healthy" | "strong";

export interface MarginInfo {
  /** Utilidad bruta por unidad. `null` si falta el costo. */
  utility: number | null;
  /** Margen sobre el precio, en base 100. */
  marginPct: number | null;
  /** Markup sobre el costo, en base 100. */
  markupPct: number | null;
  level: MarginLevel;
}

const num = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Calcula margen, markup y utilidad de un producto.
 * Si el costo es desconocido (rol sin permiso) devuelve todo en `null`.
 */
export function getMargin(
  precio: number | null | undefined,
  costo: number | null | undefined
): MarginInfo {
  if (!num(precio) || precio <= 0 || !num(costo)) {
    return { utility: null, marginPct: null, markupPct: null, level: "unknown" };
  }

  const utility = precio - costo;
  const marginPct = (utility / precio) * 100;
  const markupPct = costo > 0 ? (utility / costo) * 100 : null;

  let level: MarginLevel;
  if (marginPct < 0) level = "negative";
  else if (marginPct < 20) level = "thin";
  else if (marginPct < 40) level = "healthy";
  else level = "strong";

  return { utility, marginPct, markupPct, level };
}

/** Color de etiqueta coherente con el nivel de margen. */
export function marginColor(level: MarginLevel): string {
  switch (level) {
    case "negative":
      return "red";
    case "thin":
      return "orange";
    case "healthy":
      return "gold";
    case "strong":
      return "green";
    default:
      return "default";
  }
}

/** Texto corto del nivel para tooltips y avisos. */
export function marginLabel(level: MarginLevel): string {
  switch (level) {
    case "negative":
      return "Precio por debajo del costo";
    case "thin":
      return "Margen ajustado (menos de 20 %)";
    case "healthy":
      return "Margen razonable (20 % a 40 %)";
    case "strong":
      return "Margen alto (40 % o más)";
    default:
      return "Sin costo registrado";
  }
}

/**
 * Precio necesario para obtener un margen sobre venta.
 * Ejemplo: costo 60.000 y margen 40 % → 100.000.
 * Devuelve `null` si el porcentaje no es válido (0–99,9).
 */
export function priceFromMargin(
  costo: number | null | undefined,
  marginPct: number | null | undefined
): number | null {
  if (!num(costo) || costo < 0 || !num(marginPct) || marginPct <= 0 || marginPct >= 100) {
    return null;
  }
  return Math.round(costo / (1 - marginPct / 100));
}

/**
 * Precio necesario para aplicar un markup sobre el costo.
 * Ejemplo: costo 60.000 y markup 40 % → 84.000.
 * Devuelve `null` si el porcentaje es negativo.
 */
export function priceFromMarkup(
  costo: number | null | undefined,
  markupPct: number | null | undefined
): number | null {
  if (!num(costo) || costo < 0 || !num(markupPct) || markupPct < 0) return null;
  return Math.round(costo * (1 + markupPct / 100));
}
