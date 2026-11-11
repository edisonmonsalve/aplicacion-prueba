import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";
import { addDays, today } from "../../utils/dates.js";
import { roundMoney, VALID_TRANSACTION } from "./finance.shared.js";

type PnlQuery = { desde?: string; hasta?: string };

interface PnlLine {
  id: number;
  nombre: string;
  codigo: string | null;
  total: number;
  /** Participación sobre los ingresos del periodo actual. */
  pct: number;
  anterior: number;
  variacion: number | null;
}

interface PnlGroup {
  total: number;
  lineas: PnlLine[];
}

interface PnlTotals {
  ingresos: number;
  costo_ventas: number;
  margen_bruto: number;
  margen_bruto_pct: number;
  gastos: number;
  utilidad: number;
  utilidad_pct: number;
}

const VARIACION_KEYS = [
  "ingresos",
  "costo_ventas",
  "margen_bruto",
  "gastos",
  "utilidad",
] as const;

const pctOf = (value: number, base: number) =>
  base > 0 ? roundMoney((value / base) * 100) : 0;

/** Variación porcentual contra el periodo anterior; null si no hay base. */
const variation = (current: number, previous: number) =>
  previous === 0 ? null : roundMoney(((current - previous) / Math.abs(previous)) * 100);

function baseLines(items: RowDataPacket[], ingresos: number): PnlLine[] {
  return items.map((r) => ({
    id: Number(r.id),
    nombre: String(r.nombre),
    codigo: r.codigo ?? null,
    total: roundMoney(Number(r.total)),
    pct: pctOf(Number(r.total), ingresos),
    anterior: 0,
    variacion: null,
  }));
}

/**
 * Une las líneas del periodo actual con las del anterior por categoría. Así el
 * comparativo muestra también categorías que solo tuvieron movimiento antes
 * (con total actual 0) y no desaparecen del informe.
 */
function mergeLines(current: PnlLine[], previous: PnlLine[]): PnlLine[] {
  const prevById = new Map(previous.map((l) => [l.id, l]));
  const seen = new Set<number>();
  const merged = current.map((line) => {
    seen.add(line.id);
    const before = prevById.get(line.id)?.total ?? 0;
    return { ...line, anterior: before, variacion: variation(line.total, before) };
  });
  for (const line of previous) {
    if (seen.has(line.id)) continue;
    merged.push({
      ...line,
      total: 0,
      pct: 0,
      anterior: line.total,
      variacion: variation(0, line.total),
    });
  }
  return merged.sort(
    (a, b) => Math.max(b.total, b.anterior) - Math.max(a.total, a.anterior) || a.nombre.localeCompare(b.nombre)
  );
}

/**
 * Totales y líneas del estado de resultados de un rango.
 *
 * Solo entran asientos con `afecta_resultado = 1`: una venta a crédito cuenta
 * como ingreso aunque todavía no mueva caja, y un cobro de cartera no vuelve a
 * sumar ingreso. El costo de ventas se separa de los gastos operativos para
 * poder mostrar el margen bruto.
 */
async function pnlRange(desde: string, hasta: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT fc.id, fc.nombre, fc.codigo, fc.tipo,
            COALESCE(SUM(t.monto), 0) AS total
     FROM transactions t
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     WHERE t.fecha BETWEEN ? AND ?
       AND ${VALID_TRANSACTION}
       AND fc.afecta_resultado = 1
       AND t.tipo IN ('ingreso', 'gasto')
     GROUP BY fc.id, fc.nombre, fc.codigo, fc.tipo
     HAVING total > 0
     ORDER BY total DESC, fc.nombre`,
    [desde, hasta]
  );

  const ingresosRaw = rows.filter((r) => r.tipo === "ingreso");
  const gastoRaw = rows.filter((r) => r.tipo === "gasto");
  const costoVentasRaw = gastoRaw.filter((r) => r.codigo === "costo_ventas");
  // Los gastos operativos excluyen el costo de ventas para no contarlo dos veces.
  const gastosRaw = gastoRaw.filter((r) => r.codigo !== "costo_ventas");

  const ingresos = roundMoney(
    ingresosRaw.reduce((sum, r) => sum + Number(r.total), 0)
  );
  const costoVentas = roundMoney(
    costoVentasRaw.reduce((sum, r) => sum + Number(r.total), 0)
  );
  const gastos = roundMoney(gastosRaw.reduce((sum, r) => sum + Number(r.total), 0));
  const margenBruto = roundMoney(ingresos - costoVentas);
  const utilidad = roundMoney(margenBruto - gastos);

  const totals: PnlTotals = {
    ingresos,
    costo_ventas: costoVentas,
    margen_bruto: margenBruto,
    margen_bruto_pct: pctOf(margenBruto, ingresos),
    gastos,
    utilidad,
    utilidad_pct: pctOf(utilidad, ingresos),
  };

  return {
    totals,
    ingresos: { total: ingresos, lineas: baseLines(ingresosRaw, ingresos) },
    gastos: { total: gastos, lineas: baseLines(gastosRaw, ingresos) },
    costoVentas: { total: costoVentas, lineas: baseLines(costoVentasRaw, ingresos) },
  };
}

function previousRange(desde: string, hasta: string) {
  const dias =
    Math.floor(
      (Date.parse(`${hasta}T12:00:00`) - Date.parse(`${desde}T12:00:00`)) / 86_400_000
    ) + 1;
  const prevHasta = addDays(desde, -1);
  const prevDesde = addDays(desde, -dias);
  return { desde: prevDesde, hasta: prevHasta, dias };
}

/**
 * Estado de resultados del periodo con comparativo contra el periodo anterior
 * de igual duración. Devuelve variaciones absolutas y porcentuales.
 */
export async function getPnl(query: PnlQuery) {
  const hasta = query.hasta ?? today();
  const desde = query.desde ?? `${hasta.slice(0, 7)}-01`;
  if (desde > hasta) {
    throw new HttpError(400, "La fecha inicial no puede ser posterior a la final");
  }

  const prev = previousRange(desde, hasta);
  const [actual, anterior] = await Promise.all([
    pnlRange(desde, hasta),
    pnlRange(prev.desde, prev.hasta),
  ]);

  const variaciones = Object.fromEntries(
    VARIACION_KEYS.map((key) => [
      key,
      variation(actual.totals[key], anterior.totals[key]),
    ])
  ) as Record<(typeof VARIACION_KEYS)[number], number | null>;

  const ingresos: PnlGroup = {
    total: actual.ingresos.total,
    lineas: mergeLines(actual.ingresos.lineas, anterior.ingresos.lineas),
  };
  const gastos: PnlGroup = {
    total: actual.gastos.total,
    lineas: mergeLines(actual.gastos.lineas, anterior.gastos.lineas),
  };

  return {
    rango: { desde, hasta, dias: prev.dias },
    comparativo: { desde: prev.desde, hasta: prev.hasta, dias: prev.dias },
    ingresos,
    costo_ventas: {
      total: actual.costoVentas.total,
      pct: pctOf(actual.costoVentas.total, actual.totals.ingresos),
      lineas: mergeLines(actual.costoVentas.lineas, anterior.costoVentas.lineas),
    },
    margen_bruto: actual.totals.margen_bruto,
    margen_bruto_pct: actual.totals.margen_bruto_pct,
    gastos,
    utilidad: actual.totals.utilidad,
    utilidad_pct: actual.totals.utilidad_pct,
    comparativo_totales: anterior.totals,
    variaciones,
  };
}
