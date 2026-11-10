// Utilidades de fecha compartidas por el cliente.
//
// Las columnas DATE de MySQL/MariaDB llegan como "AAAA-MM-DD" (ver
// `dateStrings: ["DATE"]` en el servidor). Si se hace `new Date("2026-11-09")`,
// JavaScript lo interpreta como medianoche UTC y en Bogotá (UTC-5) se muestra
// como el día anterior. Por eso las fechas sin hora se devuelven tal cual.
//
// Las columnas DATETIME sí llegan como fecha-hora ISO: para esas se usa la
// conversión local normal.

const pad = (n: number) => String(n).padStart(2, "0");

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Devuelve una fecha de calendario en formato AAAA-MM-DD sin desfase por zona horaria. */
export function formatDateOnly(value: string | Date | null | undefined): string {
  if (!value) return "";

  // DATE sin hora: conservar el día calendario exacto que envió la base.
  if (typeof value === "string" && DATE_ONLY.test(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value.slice(0, 10) : "";
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
