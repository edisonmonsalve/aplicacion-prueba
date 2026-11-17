// Formato común de números y moneda para toda la aplicación.
//
// El peso colombiano no usa centavos en la práctica: precios, costos y totales
// se muestran como enteros con separador de miles. Un único formateador evita
// que cada pantalla invente su propio formato.

const LOCALE = "es-CO";
const CURRENCY = "COP";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Moneda completa: `$ 1.250.000`. Devuelve `—` cuando no hay valor. */
export function formatCurrency(value: number | null | undefined): string {
  if (!isNumber(value)) return "—";
  return currencyFormatter.format(value);
}

/**
 * Moneda abreviada para tarjetas y resúmenes: `$ 1,2 M`.
 * Por debajo de 100.000 se muestra completa para no perder precisión.
 */
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (!isNumber(value)) return "—";
  if (Math.abs(value) < 100_000) return currencyFormatter.format(value);
  return `$ ${compactFormatter.format(value)}`;
}

/** Número entero con separador de miles: `12.500`. */
export function formatNumber(value: number | null | undefined): string {
  if (!isNumber(value)) return "—";
  return integerFormatter.format(value);
}

/** Número con hasta dos decimales (cantidades, medidas). */
export function formatDecimal(value: number | null | undefined): string {
  if (!isNumber(value)) return "—";
  return decimalFormatter.format(value);
}

/** Porcentaje a partir de un número ya expresado en base 100: `35,3 %`. */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (!isNumber(value)) return "—";
  return `${value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} %`;
}

/** Utilidad con signo explícito: `+$ 12.000` / `-$ 3.500`. */
export function formatSignedCurrency(value: number | null | undefined): string {
  if (!isNumber(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

/**
 * Convierte lo que el usuario escribe en un campo de moneda a número entero.
 * Acepta `$ 1.250.000`, `1250000` o valores ya numéricos; ignora separadores.
 */
export function parseCurrencyInput(value: string | number | null | undefined): number {
  if (isNumber(value)) return Math.trunc(value);
  if (value === null || value === undefined) return 0;
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/**
 * Props listas para `InputNumber` en campos de dinero.
 *
 * El campo muestra separador de miles mientras se escribe y devuelve un entero,
 * que es lo que espera la API. Se usa en precios, costos y montos.
 */
export const currencyInputProps = {
  min: 0,
  step: 1000,
  precision: 0,
  formatter: (value: string | number | undefined) =>
    value === undefined || value === null || value === ""
      ? ""
      : `$ ${integerFormatter.format(parseCurrencyInput(value))}`,
  parser: (value: string | undefined) => parseCurrencyInput(value),
  style: { width: "100%" },
} as const;

/** Props de `InputNumber` para cantidades enteras (stock, unidades). */
export const integerInputProps = {
  min: 0,
  step: 1,
  precision: 0,
  formatter: (value: string | number | undefined) =>
    value === undefined || value === null || value === ""
      ? ""
      : integerFormatter.format(Number(value)),
  parser: (value: string | undefined) => {
    const digits = String(value ?? "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  },
  style: { width: "100%" },
} as const;
