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

interface CashFlowQuery {
  desde?: string;
  hasta?: string;
  account_id?: number;
}

/** Lista de meses AAAA-MM entre dos fechas, incluidos los extremos. */
function mesesEntre(desde: string, hasta: string) {
  const [anioIni, mesIni] = desde.slice(0, 7).split("-").map(Number);
  const [anioFin, mesFin] = hasta.slice(0, 7).split("-").map(Number);
  const meses: string[] = [];
  let anio = anioIni;
  let mes = mesIni;
  while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
    meses.push(`${anio}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return meses;
}

/**
 * Flujo de caja real por cuenta y por mes.
 *
 * Solo cuenta asientos que mueven caja (override del asiento o categoría). Un
 * pasivo con impacto de caja (p. ej. retenciones que se descuentan del pago)
 * entra como menor salida, igual que en el saldo de las cuentas. Las compras de
 * inventario son salidas; el costo de ventas y el IVA informativos no aparecen.
 */
export async function getCashFlow(query: CashFlowQuery) {
  const hasta = query.hasta ?? today();
  const desde = query.desde ?? `${hasta.slice(0, 7)}-01`;
  if (desde > hasta) {
    throw new HttpError(400, "La fecha inicial no puede ser posterior a la final");
  }

  // Misma regla que el saldo de cuentas: ingreso/pasivo suman, gasto/activo restan.
  const afectaCaja = "COALESCE(t.afecta_caja, fc.afecta_caja) = 1";
  const filtroCuenta = query.account_id ? " AND a.id = ?" : "";
  const accountParams = query.account_id ? [query.account_id] : [];

  const [cuentaRows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.nombre, a.tipo, a.activo, a.saldo_inicial,
            COALESCE(SUM(CASE WHEN t.fecha < ? AND ${afectaCaja}
              THEN CASE WHEN t.tipo IN ('ingreso', 'pasivo') THEN t.monto
                        WHEN t.tipo IN ('gasto', 'activo') THEN -t.monto
                        ELSE 0 END
              ELSE 0 END), 0) AS previo,
            COALESCE(SUM(CASE WHEN t.fecha BETWEEN ? AND ? AND ${afectaCaja}
                               AND t.tipo IN ('ingreso', 'pasivo')
                              THEN t.monto ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN t.fecha BETWEEN ? AND ? AND ${afectaCaja}
                               AND t.tipo IN ('gasto', 'activo')
                              THEN t.monto ELSE 0 END), 0) AS salidas
     FROM finance_accounts a
     LEFT JOIN transactions t
       ON t.account_id = a.id
      AND ${VALID_TRANSACTION}
     LEFT JOIN finance_categories fc ON fc.id = t.finance_category_id
     WHERE 1 = 1${filtroCuenta}
     GROUP BY a.id, a.nombre, a.tipo, a.activo, a.saldo_inicial
     ORDER BY a.nombre`,
    [desde, desde, hasta, desde, hasta, ...accountParams]
  );

  const porCuenta = cuentaRows.map((r) => {
    const saldoInicial = roundMoney(Number(r.saldo_inicial) + Number(r.previo));
    const entradas = roundMoney(Number(r.entradas));
    const salidas = roundMoney(Number(r.salidas));
    return {
      id: Number(r.id),
      nombre: String(r.nombre),
      tipo: String(r.tipo),
      activo: Number(r.activo),
      saldo_inicial: saldoInicial,
      entradas,
      salidas,
      neto: roundMoney(entradas - salidas),
      saldo_final: roundMoney(saldoInicial + entradas - salidas),
    };
  });

  const totales = porCuenta.reduce(
    (acc, c) => ({
      saldo_inicial: roundMoney(acc.saldo_inicial + c.saldo_inicial),
      entradas: roundMoney(acc.entradas + c.entradas),
      salidas: roundMoney(acc.salidas + c.salidas),
      neto: roundMoney(acc.neto + c.neto),
      saldo_final: roundMoney(acc.saldo_final + c.saldo_final),
    }),
    { saldo_inicial: 0, entradas: 0, salidas: 0, neto: 0, saldo_final: 0 }
  );

  const filtroMesCuenta = query.account_id ? " AND t.account_id = ?" : "";
  const [mesRows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(t.fecha, '%Y-%m') AS mes,
            COALESCE(SUM(CASE WHEN ${afectaCaja} AND t.tipo IN ('ingreso', 'pasivo')
                              THEN t.monto ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN ${afectaCaja} AND t.tipo IN ('gasto', 'activo')
                              THEN t.monto ELSE 0 END), 0) AS salidas
     FROM transactions t
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     WHERE t.fecha BETWEEN ? AND ?
       AND ${VALID_TRANSACTION}${filtroMesCuenta}
     GROUP BY mes
     ORDER BY mes`,
    [desde, hasta, ...accountParams]
  );

  const mesMap = new Map(mesRows.map((r) => [String(r.mes), r]));
  const porMes = mesesEntre(desde, hasta).map((mes) => {
    const row = mesMap.get(mes);
    const entradas = roundMoney(Number(row?.entradas ?? 0));
    const salidas = roundMoney(Number(row?.salidas ?? 0));
    return { mes, entradas, salidas, neto: roundMoney(entradas - salidas) };
  });

  return {
    rango: { desde, hasta },
    filtro_cuenta: query.account_id ?? null,
    totales,
    por_cuenta: porCuenta,
    por_mes: porMes,
  };
}
