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

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  // DATE sin hora: no se puede interpretar como instante local sin desfase.
  if (typeof value === "string" && DATE_ONLY.test(value)) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

/**
 * Fecha de calendario para mostrar al usuario, siempre en DD/MM/AAAA.
 * Acepta tanto "AAAA-MM-DD" como fechas-hora ISO.
 */
export function formatDateDisplay(value: string | Date | null | undefined): string {
  const iso = formatDateOnly(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/**
 * Fecha y hora local: `17/11/2026 14:35`.
 * Para una fecha sin hora devuelve solo la fecha.
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string" && DATE_ONLY.test(value)) return formatDateDisplay(value);
  const date = toDate(value);
  if (!date) return typeof value === "string" ? value : "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const plural = (n: number, singular: string, pluralWord: string) =>
  `${n} ${n === 1 ? singular : pluralWord}`;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

function relativeFromDate(date: Date, now: number): string {
  const diff = now - date.getTime();
  const elapsed = Math.abs(diff);

  if (diff < 0) {
    if (elapsed < 45_000) return "en unos segundos";
    if (elapsed < 3_600_000) {
      return `en ${plural(Math.max(1, Math.round(elapsed / 60_000)), "minuto", "minutos")}`;
    }
    if (elapsed < 86_400_000) {
      return `en ${plural(Math.round(elapsed / 3_600_000), "hora", "horas")}`;
    }
    const days = Math.round(elapsed / 86_400_000);
    if (days <= 7) return `en ${plural(days, "día", "días")}`;
    return formatDateDisplay(date);
  }

  if (elapsed < 10_000) return "ahora";
  if (elapsed < 60_000) {
    return `hace ${plural(Math.floor(elapsed / 1000), "segundo", "segundos")}`;
  }
  if (elapsed < 3_600_000) {
    return `hace ${plural(Math.floor(elapsed / 60_000), "minuto", "minutos")}`;
  }
  if (elapsed < 86_400_000) {
    return `hace ${plural(Math.floor(elapsed / 3_600_000), "hora", "horas")}`;
  }

  const dayDiff = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / 86_400_000);
  if (dayDiff === 1) return "ayer";
  if (dayDiff > 1 && dayDiff < 7) return `hace ${plural(dayDiff, "día", "días")}`;
  return formatDateDisplay(date);
}

/**
 * Tiempo relativo legible: `hace 12 segundos`, `hace 5 minutos`, `hace 3 horas`,
 * `ayer`, `hace 4 días` o la fecha absoluta cuando tiene más de una semana.
 *
 * - Por defecto las fechas sin hora (`AAAA-MM-DD`) se muestran como fecha: no
 *   representan un instante y decir “hace 3 días” sería impreciso. Con
 *   `dateOnlyRelative` se interpretan como medianoche local (útil en el listado
 *   de facturas, donde se quiere ver `ayer` o `hace 2 días`).
 * - Las fechas futuras usan “en …”.
 * - `now` se puede inyectar para probar o para refrescar un listado.
 */
export function formatRelativeTime(
  value: string | Date | null | undefined,
  now: number = Date.now(),
  dateOnlyRelative = false
): string {
  if (!value) return "";

  if (typeof value === "string" && DATE_ONLY.test(value)) {
    if (!dateOnlyRelative) return formatDateDisplay(value);
    // Una fecha de calendario no tiene hora: se compara por días, no por
    // horas, para que la factura de hoy diga «hoy» y no «hace 7 horas».
    // Se construye en hora local para no correr el día por la zona horaria.
    const [year, month, day] = value.split("-").map(Number);
    const local = new Date(year, month - 1, day);
    if (Number.isNaN(local.getTime())) return formatDateDisplay(value);

    const days = Math.round((startOfDay(new Date(now)) - startOfDay(local)) / 86_400_000);
    if (days === 0) return "hoy";
    if (days === 1) return "ayer";
    if (days > 1 && days < 7) return `hace ${plural(days, "día", "días")}`;
    if (days < 0 && days > -7) return `en ${plural(Math.abs(days), "día", "días")}`;
    return formatDateDisplay(value);
  }

  const date = toDate(value);
  if (!date) return typeof value === "string" ? value : "";
  return relativeFromDate(date, now);
}

/**
 * Fecha “inteligente” para tablas: relativa si es reciente, absoluta si no.
 * Es el mismo criterio de `formatRelativeTime`, expuesto con nombre explícito.
 */
export const formatSmartDate = formatRelativeTime;
