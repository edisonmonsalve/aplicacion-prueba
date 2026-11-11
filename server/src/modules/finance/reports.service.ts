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

interface BalanceQuery {
  hasta?: string;
}

/**
 * Balance simplificado a una fecha.
 *
 * - Caja y bancos: saldos de todas las cuentas con los movimientos de caja
 *   hasta la fecha.
 * - Inventario: existencias actuales valorizadas al costo del producto.
 * - Cartera: facturas confirmadas a crédito con saldo pendiente, descontando
 *   solo los pagos realizados hasta la fecha.
 * - Impuestos y retenciones: saldos acumulados de sus categorías de sistema.
 *
 * El patrimonio es la cifra de cuadre (capital + resultados acumulados): no se
 * guarda en una tabla, se deriva de activo − pasivo.
 */
export async function getBalance(query: BalanceQuery) {
  const asOf = query.hasta ?? today();
  if (Number.isNaN(Date.parse(`${asOf}T12:00:00`))) {
    throw new HttpError(400, "Fecha no válida");
  }

  const afectaCaja = "COALESCE(t.afecta_caja, fc.afecta_caja) = 1";

  const [cuentaRows, inventarioRows, carteraRows, impuestoRows] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT a.id, a.nombre, a.tipo, a.activo,
              a.saldo_inicial
                + COALESCE(SUM(CASE WHEN ${afectaCaja} THEN
                    CASE WHEN t.tipo IN ('ingreso', 'pasivo') THEN t.monto
                         WHEN t.tipo IN ('gasto', 'activo') THEN -t.monto
                         ELSE 0 END
                    ELSE 0 END), 0) AS saldo
       FROM finance_accounts a
       LEFT JOIN transactions t
         ON t.account_id = a.id
        AND t.fecha <= ?
        AND ${VALID_TRANSACTION}
       LEFT JOIN finance_categories fc ON fc.id = t.finance_category_id
       GROUP BY a.id, a.nombre, a.tipo, a.activo, a.saldo_inicial
       ORDER BY a.nombre`,
      [asOf]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(stock_actual * COALESCE(costo, 0)), 0) AS total,
              COALESCE(SUM(CASE WHEN stock_actual > 0 THEN 1 ELSE 0 END), 0) AS productos,
              COALESCE(SUM(CASE WHEN stock_actual > 0 AND COALESCE(costo, 0) = 0
                                THEN 1 ELSE 0 END), 0) AS sin_costo
       FROM products
       WHERE activo = 1`
    ),
    pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN c.tipo = 'venta' THEN c.saldo ELSE 0 END), 0) AS por_cobrar,
              COALESCE(SUM(CASE WHEN c.tipo = 'compra' THEN c.saldo ELSE 0 END), 0) AS por_pagar,
              COALESCE(SUM(CASE WHEN c.tipo = 'venta' AND c.saldo > 0 THEN 1 ELSE 0 END), 0) AS facturas_cobrar,
              COALESCE(SUM(CASE WHEN c.tipo = 'compra' AND c.saldo > 0 THEN 1 ELSE 0 END), 0) AS facturas_pagar
       FROM (
         SELECT i.tipo,
                GREATEST(i.total_neto - COALESCE(p.pagado, 0), 0) AS saldo
         FROM invoices i
         LEFT JOIN (
           SELECT invoice_id, SUM(monto) AS pagado
           FROM invoice_payments
           WHERE estado = 'valido' AND fecha <= ?
           GROUP BY invoice_id
         ) p ON p.invoice_id = i.id
         WHERE i.estado = 'confirmada' AND i.condicion_pago = 'credito'
           AND i.fecha <= ?
       ) c`,
      [asOf, asOf]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN fc.codigo = 'iva_por_pagar'
                                THEN t.monto ELSE 0 END), 0) AS iva_por_pagar,
              COALESCE(SUM(CASE WHEN fc.codigo = 'iva_descontable'
                                THEN t.monto ELSE 0 END), 0) AS iva_descontable,
              COALESCE(SUM(CASE WHEN fc.codigo = 'retenciones_a_favor'
                                THEN t.monto ELSE 0 END), 0) AS retenciones_a_favor,
              COALESCE(SUM(CASE WHEN fc.codigo = 'retenciones_por_pagar'
                                THEN t.monto ELSE 0 END), 0) AS retenciones_por_pagar
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       WHERE t.fecha <= ? AND ${VALID_TRANSACTION}`,
      [asOf]
    ),
  ]);

  const cuentas = cuentaRows[0].map((r) => ({
    id: Number(r.id),
    nombre: String(r.nombre),
    tipo: String(r.tipo),
    activo: Number(r.activo),
    saldo: roundMoney(Number(r.saldo)),
  }));
  const cajaBancos = roundMoney(cuentas.reduce((sum, c) => sum + c.saldo, 0));

  const inventario = inventarioRows[0][0];
  const cartera = carteraRows[0][0];
  const impuestos = impuestoRows[0][0];

  // El IVA se netea contra la autoridad tributaria: a favor (activo) o a cargo
  // (pasivo). Las retenciones se presentan por separado.
  const ivaNeto = roundMoney(
    Number(impuestos.iva_por_pagar) - Number(impuestos.iva_descontable)
  );
  const ivaAPagar = Math.max(ivaNeto, 0);
  const ivaAFavor = Math.max(-ivaNeto, 0);
  const retencionesAFavor = roundMoney(Number(impuestos.retenciones_a_favor));
  const retencionesPorPagar = roundMoney(Number(impuestos.retenciones_por_pagar));

  const inventarioTotal = roundMoney(Number(inventario.total));
  const porCobrar = roundMoney(Number(cartera.por_cobrar));
  const porPagar = roundMoney(Number(cartera.por_pagar));

  const totalActivo = roundMoney(
    cajaBancos + inventarioTotal + porCobrar + ivaAFavor + retencionesAFavor
  );
  const totalPasivo = roundMoney(porPagar + ivaAPagar + retencionesPorPagar);
  const patrimonio = roundMoney(totalActivo - totalPasivo);

  return {
    as_of: asOf,
    activo: {
      caja_bancos: cajaBancos,
      inventario: inventarioTotal,
      cartera_por_cobrar: porCobrar,
      iva_a_favor: ivaAFavor,
      retenciones_a_favor: retencionesAFavor,
      total: totalActivo,
      cuentas,
      inventario_detalle: {
        productos: Number(inventario.productos),
        sin_costo: Number(inventario.sin_costo),
      },
      cartera_detalle: { facturas: Number(cartera.facturas_cobrar) },
    },
    pasivo: {
      cartera_por_pagar: porPagar,
      iva_por_pagar: ivaAPagar,
      retenciones_por_pagar: retencionesPorPagar,
      total: totalPasivo,
      cartera_detalle: { facturas: Number(cartera.facturas_pagar) },
    },
    patrimonio,
    ecuacion: {
      activo: totalActivo,
      pasivo_mas_patrimonio: roundMoney(totalPasivo + patrimonio),
      cuadra: Math.abs(totalActivo - (totalPasivo + patrimonio)) < 0.01,
    },
  };
}

type ProfitGroup = "producto" | "categoria" | "cliente";

interface ProfitabilityQuery {
  desde?: string;
  hasta?: string;
  grupo?: ProfitGroup;
}

interface ProfitRow {
  key: string;
  nombre: string;
  sku: string | null;
  categoria: string | null;
  ingresos: number;
  costo: number;
  margen: number;
  margen_pct: number;
  /** Participación sobre los ingresos totales del periodo. */
  participacion: number;
  unidades: number;
  facturas: number;
}

/**
 * Agrupaciones disponibles para la rentabilidad.
 *
 * `key` es estable para React y para comparar entre consultas: usa el id del
 * producto/categoría/tercero y cae al texto de la contraparte solo cuando la
 * factura no tiene tercero vinculado.
 */
const PROFIT_GROUPS: Record<
  ProfitGroup,
  { key: string; nombre: string; sku: string; categoria: string }
> = {
  producto: {
    key: "CONCAT('producto:', ii.product_id)",
    nombre: "p.nombre",
    sku: "p.sku",
    categoria: "c.nombre",
  },
  categoria: {
    key: "CONCAT('categoria:', p.category_id)",
    nombre: "c.nombre",
    sku: "NULL",
    categoria: "NULL",
  },
  cliente: {
    key:
      "CASE WHEN i.party_id IS NOT NULL " +
      "THEN CONCAT('tercero:', i.party_id) " +
      "ELSE CONCAT('contraparte:', i.contraparte) END",
    nombre: "COALESCE(tp.nombre, i.contraparte)",
    sku: "NULL",
    categoria: "NULL",
  },
};

/**
 * Rentabilidad por producto, categoría o cliente.
 *
 * Se apoya en `transaction_allocations`: al confirmar una venta, el ingreso y
 * el costo de ventas se reparten por línea de factura con el costo histórico
 * del momento. Así el margen no depende del costo actual del producto ni se
 * distorsiona si luego cambia. Solo entran facturas de venta confirmadas y
 * asientos vigentes (sin anulaciones).
 */
export async function getProfitability(query: ProfitabilityQuery) {
  const hasta = query.hasta ?? today();
  const desde = query.desde ?? `${hasta.slice(0, 7)}-01`;
  if (desde > hasta) {
    throw new HttpError(400, "La fecha inicial no puede ser posterior a la final");
  }
  const grupo = query.grupo ?? "producto";
  const g = PROFIT_GROUPS[grupo];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${g.key} AS grupo_key,
            MAX(${g.nombre}) AS nombre,
            MAX(${g.sku}) AS sku,
            MAX(${g.categoria}) AS categoria,
            COALESCE(SUM(CASE WHEN fc.codigo = 'ventas'
                              THEN a.monto ELSE 0 END), 0) AS ingresos,
            COALESCE(SUM(CASE WHEN fc.codigo = 'costo_ventas'
                              THEN a.monto ELSE 0 END), 0) AS costo,
            COALESCE(SUM(CASE WHEN fc.codigo = 'ventas'
                              THEN ii.cantidad ELSE 0 END), 0) AS unidades,
            COUNT(DISTINCT CASE WHEN fc.codigo = 'ventas'
                                THEN i.id END) AS facturas
     FROM transaction_allocations a
     JOIN transactions t ON t.id = a.transaction_id
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     JOIN invoice_items ii ON ii.id = a.invoice_item_id
     JOIN invoices i ON i.id = ii.invoice_id
     JOIN products p ON p.id = ii.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN third_parties tp ON tp.id = i.party_id
     WHERE i.tipo = 'venta'
       AND i.estado = 'confirmada'
       AND i.fecha BETWEEN ? AND ?
       AND ${VALID_TRANSACTION}
       AND fc.codigo IN ('ventas', 'costo_ventas')
     GROUP BY grupo_key`,
    [desde, hasta]
  );

  const sinTotales = rows.map((r) => {
    const ingresos = roundMoney(Number(r.ingresos));
    const costo = roundMoney(Number(r.costo));
    const margen = roundMoney(ingresos - costo);
    return {
      key: String(r.grupo_key),
      nombre: String(r.nombre ?? "Sin nombre"),
      sku: r.sku ?? null,
      categoria: r.categoria ?? null,
      ingresos,
      costo,
      margen,
      margen_pct: pctOf(margen, ingresos),
      participacion: 0,
      unidades: Number(r.unidades),
      facturas: Number(r.facturas),
    };
  });

  const totalIngresos = roundMoney(sinTotales.reduce((s, r) => s + r.ingresos, 0));
  const totalCosto = roundMoney(sinTotales.reduce((s, r) => s + r.costo, 0));
  const totalMargen = roundMoney(totalIngresos - totalCosto);

  // Las facturas se cuentan una sola vez aunque una venta tenga líneas en
  // varios productos, categorías o clientes.
  const [facturaRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT i.id) AS facturas
     FROM invoices i
     WHERE i.tipo = 'venta'
       AND i.estado = 'confirmada'
       AND i.fecha BETWEEN ? AND ?
       AND EXISTS (
         SELECT 1
         FROM invoice_items ii
         JOIN transaction_allocations a ON a.invoice_item_id = ii.id
         JOIN transactions t ON t.id = a.transaction_id
         JOIN finance_categories fc ON fc.id = t.finance_category_id
         WHERE ii.invoice_id = i.id
           AND fc.codigo = 'ventas'
           AND ${VALID_TRANSACTION}
       )`,
    [desde, hasta]
  );

  const data: ProfitRow[] = sinTotales
    .map((r) => ({
      ...r,
      participacion: pctOf(r.ingresos, totalIngresos),
    }))
    .sort((a, b) => b.margen - a.margen || b.ingresos - a.ingresos || a.nombre.localeCompare(b.nombre));

  return {
    rango: { desde, hasta },
    grupo,
    resumen: {
      ingresos: totalIngresos,
      costo: totalCosto,
      margen: totalMargen,
      margen_pct: pctOf(totalMargen, totalIngresos),
      unidades: data.reduce((s, r) => s + r.unidades, 0),
      facturas: Number(facturaRows[0]?.facturas ?? 0),
    },
    data,
  };
}

interface InventoryAnalyticsQuery {
  desde?: string;
  hasta?: string;
  /** Días sin venta a partir de los cuales el stock se considera muerto. */
  dias_muerto?: number;
}

type AbcClass = "A" | "B" | "C";

interface InventoryRow {
  id: number;
  sku: string;
  nombre: string;
  categoria: string | null;
  activo: number;
  stock_actual: number;
  costo_unitario: number;
  valor_inventario: number;
  unidades_vendidas: number;
  ingresos: number;
  costo_ventas: number;
  margen: number;
  margen_pct: number;
  rotacion: number | null;
  dias_inventario: number | null;
  ultima_venta: string | null;
  dias_sin_venta: number | null;
  stock_muerto: boolean;
  sin_costo: boolean;
  participacion: number;
  acumulado: number;
  clase_abc: AbcClass;
}

const daysBetween = (desde: string, hasta: string) =>
  Math.floor(
    (Date.parse(`${hasta}T12:00:00`) - Date.parse(`${desde}T12:00:00`)) / 86_400_000
  );

/**
 * Rotación y clasificación ABC del inventario.
 *
 * - Ventas del periodo: facturas de venta confirmadas. El costo sale de
 *   `transaction_allocations` (costo histórico del momento de la venta).
 * - Rotación = costo de ventas / valor del inventario actual. Como no se
 *   guardan fotos históricas de existencias, el denominador es el inventario
 *   de hoy valorizado al costo actual; se informa así en la interfaz.
 * - Días de inventario = días del periodo / rotación.
 * - Stock muerto: productos con existencias y sin ventas en `dias_muerto`
 *   días (por defecto 90), contados desde la fecha final del rango.
 * - ABC por ingresos: A hasta el 80 % acumulado, B hasta el 95 %, C el resto.
 */
export async function getInventoryAnalytics(query: InventoryAnalyticsQuery) {
  const hasta = query.hasta ?? today();
  const desde = query.desde ?? `${hasta.slice(0, 7)}-01`;
  if (desde > hasta) {
    throw new HttpError(400, "La fecha inicial no puede ser posterior a la final");
  }
  const diasMuerto = query.dias_muerto ?? 90;
  const diasPeriodo = daysBetween(desde, hasta) + 1;

  // Dos subconsultas independientes para no multiplicar filas: las ventas se
  // agregan por producto y el costo de ventas sale de las asignaciones.
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.sku, p.nombre, p.activo, p.stock_actual, p.costo,
            c.nombre AS categoria,
            COALESCE(v.unidades, 0) AS unidades,
            COALESCE(v.ingresos, 0) AS ingresos,
            COALESCE(k.costo, 0) AS costo_ventas,
            u.ultima_venta
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN (
       SELECT ii.product_id,
              SUM(ii.cantidad) AS unidades,
              SUM(ii.cantidad * ii.precio_unitario *
                  (1 - ii.descuento_pct / 100)) AS ingresos
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE i.tipo = 'venta'
         AND i.estado = 'confirmada'
         AND i.fecha BETWEEN ? AND ?
       GROUP BY ii.product_id
     ) v ON v.product_id = p.id
     LEFT JOIN (
       SELECT a.product_id, SUM(a.monto) AS costo
       FROM transaction_allocations a
       JOIN transactions t ON t.id = a.transaction_id
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       JOIN invoice_items ii ON ii.id = a.invoice_item_id
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE i.tipo = 'venta'
         AND i.estado = 'confirmada'
         AND i.fecha BETWEEN ? AND ?
         AND fc.codigo = 'costo_ventas'
         AND ${VALID_TRANSACTION}
       GROUP BY a.product_id
     ) k ON k.product_id = p.id
     LEFT JOIN (
       SELECT ii.product_id, MAX(i.fecha) AS ultima_venta
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE i.tipo = 'venta' AND i.estado = 'confirmada'
       GROUP BY ii.product_id
     ) u ON u.product_id = p.id
     WHERE p.stock_actual > 0 OR COALESCE(v.unidades, 0) > 0
     ORDER BY p.nombre`,
    [desde, hasta, desde, hasta]
  );

  const base = rows.map((r) => {
    const stock = Number(r.stock_actual);
    const costoUnitario = Number(r.costo ?? 0);
    const valor = roundMoney(stock * costoUnitario);
    const ingresos = roundMoney(Number(r.ingresos));
    const costoVentas = roundMoney(Number(r.costo_ventas));
    const margen = roundMoney(ingresos - costoVentas);
    const rotacionRaw = valor > 0 ? costoVentas / valor : null;
    const ultimaVenta = r.ultima_venta
      ? r.ultima_venta instanceof Date
        ? r.ultima_venta.toISOString().slice(0, 10)
        : String(r.ultima_venta).slice(0, 10)
      : null;
    const diasSinVenta = ultimaVenta ? daysBetween(ultimaVenta, hasta) : null;
    return {
      id: Number(r.id),
      sku: String(r.sku),
      nombre: String(r.nombre),
      categoria: r.categoria ?? null,
      activo: Number(r.activo),
      stock_actual: stock,
      costo_unitario: roundMoney(costoUnitario),
      valor_inventario: valor,
      unidades_vendidas: Number(r.unidades),
      ingresos,
      costo_ventas: costoVentas,
      margen,
      margen_pct: pctOf(margen, ingresos),
      rotacion: rotacionRaw === null ? null : roundMoney(rotacionRaw),
      dias_inventario:
        rotacionRaw && rotacionRaw > 0 ? roundMoney(diasPeriodo / rotacionRaw) : null,
      ultima_venta: ultimaVenta,
      dias_sin_venta: diasSinVenta,
      stock_muerto:
        stock > 0 && (diasSinVenta === null || diasSinVenta > diasMuerto),
      sin_costo: stock > 0 && costoUnitario === 0,
      participacion: 0,
      acumulado: 0,
      clase_abc: "C" as AbcClass,
    };
  });

  const totalIngresos = roundMoney(base.reduce((s, r) => s + r.ingresos, 0));
  const totalCostoVentas = roundMoney(base.reduce((s, r) => s + r.costo_ventas, 0));

  // ABC: se acumula sobre ingresos ordenados de mayor a menor. Los productos
  // sin ventas en el periodo quedan en C (no aportan ingresos).
  const porIngresos = [...base].sort(
    (a, b) => b.ingresos - a.ingresos || a.nombre.localeCompare(b.nombre)
  );
  let acumulado = 0;
  for (const row of porIngresos) {
    row.participacion = pctOf(row.ingresos, totalIngresos);
    if (row.ingresos > 0) acumulado += row.ingresos;
    row.acumulado = pctOf(acumulado, totalIngresos);
    row.clase_abc =
      row.ingresos <= 0 ? "C" : row.acumulado <= 80 ? "A" : row.acumulado <= 95 ? "B" : "C";
  }

  const valorInventario = roundMoney(
    porIngresos.reduce((s, r) => s + r.valor_inventario, 0)
  );
  const rotacionRaw = valorInventario > 0 ? totalCostoVentas / valorInventario : null;

  const muertos = porIngresos.filter((r) => r.stock_muerto);
  const sinCosto = porIngresos.filter((r) => r.sin_costo);

  const abc = (["A", "B", "C"] as const).map((clase) => {
    const items = porIngresos.filter((r) => r.clase_abc === clase);
    const ingresos = roundMoney(items.reduce((s, r) => s + r.ingresos, 0));
    return {
      clase,
      productos: items.length,
      ingresos,
      participacion: pctOf(ingresos, totalIngresos),
    };
  });

  const data: InventoryRow[] = porIngresos.sort(
    (a, b) => b.ingresos - a.ingresos || a.nombre.localeCompare(b.nombre)
  );

  return {
    rango: { desde, hasta, dias: diasPeriodo, dias_muerto: diasMuerto },
    resumen: {
      valor_inventario: valorInventario,
      costo_ventas: totalCostoVentas,
      ingresos: totalIngresos,
      rotacion: rotacionRaw === null ? null : roundMoney(rotacionRaw),
      dias_inventario:
        rotacionRaw && rotacionRaw > 0 ? roundMoney(diasPeriodo / rotacionRaw) : null,
      productos: porIngresos.filter((r) => r.stock_actual > 0).length,
      productos_vendidos: porIngresos.filter((r) => r.unidades_vendidas > 0).length,
      stock_muerto: {
        productos: muertos.length,
        valor: roundMoney(muertos.reduce((s, r) => s + r.valor_inventario, 0)),
      },
      sin_costo: sinCosto.length,
      abc,
    },
    data,
  };
}

interface QuoteFunnelQuery {
  desde?: string;
  hasta?: string;
}

type QuoteState =
  | "borrador"
  | "enviado"
  | "vencido"
  | "aprobado"
  | "rechazado"
  | "entregado";

interface QuoteFunnelRow {
  id: number;
  cliente: string;
  total: number;
  estado: QuoteState;
  creado_at: string;
  aprobado_at: string | null;
  entregado_at: string | null;
  dias_aprobacion: number | null;
  dias_entrega: number | null;
  dias_ciclo: number | null;
}

const dateOnly = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const average = (values: number[]) => ({
  promedio: values.length
    ? roundMoney(values.reduce((s, v) => s + v, 0) / values.length)
    : null,
  muestra: values.length,
  minimo: values.length ? Math.min(...values) : null,
  maximo: values.length ? Math.max(...values) : null,
});

/**
 * Embudo de cotizaciones y tiempos de cierre.
 *
 * Las cotizaciones se filtran por fecha de creación. El embudo es acumulativo:
 * una cotización entregada también cuenta como enviada y aprobada. La
 * conversión se mide contra la etapa anterior y contra el total creado.
 *
 * Los tiempos salen de `quote_status_history`: creación → aprobación, aprobación
 * → entrega y ciclo completo creación → entrega. Solo se promedian las
 * cotizaciones que alcanzaron la etapa, por lo que se informa la muestra.
 */
export async function getQuoteFunnel(query: QuoteFunnelQuery) {
  const hasta = query.hasta ?? today();
  const desde = query.desde ?? `${hasta.slice(0, 7)}-01`;
  if (desde > hasta) {
    throw new HttpError(400, "La fecha inicial no puede ser posterior a la final");
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT q.id,
            q.customer_nombre,
            q.total,
            DATE(q.created_at) AS creado_at,
            MIN(CASE WHEN h.estado_nuevo = 'enviado'
                     THEN DATE(h.created_at) END) AS enviado_at,
            MIN(CASE WHEN h.estado_nuevo = 'aprobado'
                     THEN DATE(h.created_at) END) AS aprobado_at,
            MIN(CASE WHEN h.estado_nuevo = 'rechazado'
                     THEN DATE(h.created_at) END) AS rechazado_at,
            MIN(CASE WHEN h.estado_nuevo = 'entregado'
                     THEN DATE(h.created_at) END) AS entregado_at,
            CASE WHEN q.estado = 'enviado' AND q.fecha_validez < ?
                 THEN 'vencido' ELSE q.estado END AS estado
     FROM quotes q
     LEFT JOIN quote_status_history h ON h.quote_id = q.id
     WHERE DATE(q.created_at) BETWEEN ? AND ?
     GROUP BY q.id, q.customer_nombre, q.total, q.created_at, q.estado,
              q.fecha_validez
     ORDER BY q.created_at DESC, q.id DESC`,
    [today(), desde, hasta]
  );

  const detalle: QuoteFunnelRow[] = rows.map((r) => {
    const creado = dateOnly(r.creado_at)!;
    const aprobado = dateOnly(r.aprobado_at);
    const entregado = dateOnly(r.entregado_at);
    return {
      id: Number(r.id),
      cliente: String(r.customer_nombre),
      total: roundMoney(Number(r.total)),
      estado: String(r.estado) as QuoteState,
      creado_at: creado,
      aprobado_at: aprobado,
      entregado_at: entregado,
      dias_aprobacion: aprobado ? daysBetween(creado, aprobado) : null,
      dias_entrega:
        aprobado && entregado ? daysBetween(aprobado, entregado) : null,
      dias_ciclo: entregado ? daysBetween(creado, entregado) : null,
    };
  });

  const alcanzo = (estado: QuoteState, etapa: "enviado" | "aprobado" | "entregado") => {
    const idx = ["borrador", "enviado", "aprobado", "entregado"].indexOf(estado);
    const target = { enviado: 1, aprobado: 2, entregado: 3 }[etapa];
    return idx >= target;
  };

  const creadas = detalle;
  // Rechazadas y vencidas también pasaron por envío. Se consideran enviadas si
  // su estado actual no es borrador o si tienen historial de una etapa posterior.
  const enviadasReal = detalle.filter(
    (q) => q.estado !== "borrador" || q.aprobado_at !== null || q.entregado_at !== null
  );
  const aprobadas = detalle.filter(
    (q) => q.estado === "aprobado" || q.estado === "entregado" || q.aprobado_at !== null
  );
  const entregadas = detalle.filter(
    (q) => q.estado === "entregado" || q.entregado_at !== null
  );

  const monto = (items: QuoteFunnelRow[]) =>
    roundMoney(items.reduce((s, q) => s + q.total, 0));
  const rate = (part: number, whole: number) =>
    whole > 0 ? roundMoney((part / whole) * 100) : 0;

  const etapas = [
    { etapa: "creadas", cotizaciones: creadas.length, monto: monto(creadas) },
    { etapa: "enviadas", cotizaciones: enviadasReal.length, monto: monto(enviadasReal) },
    { etapa: "aprobadas", cotizaciones: aprobadas.length, monto: monto(aprobadas) },
    { etapa: "entregadas", cotizaciones: entregadas.length, monto: monto(entregadas) },
  ] as const;

  const embudo = etapas.map((stage, index) => {
    const anterior = index === 0 ? stage.cotizaciones : etapas[index - 1].cotizaciones;
    return {
      ...stage,
      tasa_conversion:
        index === 0 ? 100 : rate(stage.cotizaciones, anterior),
      tasa_global: rate(stage.cotizaciones, creadas.length),
    };
  });

  const estados = (["borrador", "enviado", "vencido", "aprobado", "rechazado", "entregado"] as const)
    .map((estado) => {
      const items = detalle.filter((q) => q.estado === estado);
      return {
        estado,
        cotizaciones: items.length,
        monto: monto(items),
        participacion: rate(items.length, detalle.length),
      };
    })
    .filter((e) => e.cotizaciones > 0);

  const rechazadas = detalle.filter(
    (q) => q.estado === "rechazado"
  );

  const tiempos = {
    aprobacion: average(
      detalle
        .map((q) => q.dias_aprobacion)
        .filter((d): d is number => d !== null)
    ),
    entrega: average(
      detalle.map((q) => q.dias_entrega).filter((d): d is number => d !== null)
    ),
    ciclo: average(
      detalle.map((q) => q.dias_ciclo).filter((d): d is number => d !== null)
    ),
  };

  return {
    rango: { desde, hasta },
    resumen: {
      cotizaciones: detalle.length,
      monto: monto(detalle),
      enviadas: enviadasReal.length,
      aprobadas: aprobadas.length,
      entregadas: entregadas.length,
      rechazadas: rechazadas.length,
      tasa_aprobacion: rate(aprobadas.length, enviadasReal.length),
      tasa_cierre: rate(entregadas.length, creadas.length),
      ticket_promedio: detalle.length
        ? roundMoney(monto(detalle) / detalle.length)
        : 0,
    },
    embudo,
    estados,
    tiempos,
    detalle,
  };
}

interface TrendsQuery {
  desde?: string;
  hasta?: string;
}

interface TrendTotals {
  ingresos: number;
  costo_ventas: number;
  margen: number;
  gastos: number;
  utilidad: number;
  margen_pct: number;
  entradas: number;
  salidas: number;
  neto_caja: number;
}

/** Desplaza una fecha un número de años, ajustando el 29 de febrero. */
function shiftYear(fecha: string, years: number) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(anio + years, mes, 0)).getUTCDate();
  return `${anio + years}-${String(mes).padStart(2, "0")}-${String(
    Math.min(dia, ultimoDia)
  ).padStart(2, "0")}`;
}

/**
 * Totales de resultado y caja de un rango, sin desglose mensual.
 * Se usa para los periodos comparativos de las tendencias.
 */
async function trendTotals(desde: string, hasta: string): Promise<TrendTotals> {
  const afectaCaja = "COALESCE(t.afecta_caja, fc.afecta_caja) = 1";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' AND fc.afecta_resultado = 1
                         THEN t.monto ELSE 0 END), 0) AS ingresos,
       COALESCE(SUM(CASE WHEN t.tipo = 'gasto' AND fc.afecta_resultado = 1
                          AND fc.codigo = 'costo_ventas'
                         THEN t.monto ELSE 0 END), 0) AS costo_ventas,
       COALESCE(SUM(CASE WHEN t.tipo = 'gasto' AND fc.afecta_resultado = 1
                          AND (fc.codigo IS NULL OR fc.codigo <> 'costo_ventas')
                         THEN t.monto ELSE 0 END), 0) AS gastos,
       COALESCE(SUM(CASE WHEN ${afectaCaja} AND t.tipo IN ('ingreso', 'pasivo')
                         THEN t.monto ELSE 0 END), 0) AS entradas,
       COALESCE(SUM(CASE WHEN ${afectaCaja} AND t.tipo IN ('gasto', 'activo')
                         THEN t.monto ELSE 0 END), 0) AS salidas
     FROM transactions t
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     WHERE t.fecha BETWEEN ? AND ? AND ${VALID_TRANSACTION}`,
    [desde, hasta]
  );

  const r = rows[0];
  const ingresos = roundMoney(Number(r.ingresos));
  const costoVentas = roundMoney(Number(r.costo_ventas));
  const gastos = roundMoney(Number(r.gastos));
  const margen = roundMoney(ingresos - costoVentas);
  const entradas = roundMoney(Number(r.entradas));
  const salidas = roundMoney(Number(r.salidas));
  return {
    ingresos,
    costo_ventas: costoVentas,
    margen,
    gastos,
    utilidad: roundMoney(margen - gastos),
    margen_pct: pctOf(margen, ingresos),
    entradas,
    salidas,
    neto_caja: roundMoney(entradas - salidas),
  };
}

const growth = (current: number, previous: number) =>
  previous === 0 ? null : roundMoney(((current - previous) / Math.abs(previous)) * 100);

/**
 * Tendencias mensuales de resultado y caja, con comparación de periodos.
 *
 * La serie incluye todos los meses del rango, incluso sin movimientos. Cada
 * mes separa resultado (devengo) de caja real. La comparación usa el periodo
 * inmediatamente anterior de igual duración y el mismo rango del año anterior.
 */
export async function getTrends(query: TrendsQuery) {
  const hasta = query.hasta ?? today();
  const desde = query.desde ?? `${hasta.slice(0, 7)}-01`;
  if (desde > hasta) {
    throw new HttpError(400, "La fecha inicial no puede ser posterior a la final");
  }

  const afectaCaja = "COALESCE(t.afecta_caja, fc.afecta_caja) = 1";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(t.fecha, '%Y-%m') AS mes,
            COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' AND fc.afecta_resultado = 1
                              THEN t.monto ELSE 0 END), 0) AS ingresos,
            COALESCE(SUM(CASE WHEN t.tipo = 'gasto' AND fc.afecta_resultado = 1
                               AND fc.codigo = 'costo_ventas'
                              THEN t.monto ELSE 0 END), 0) AS costo_ventas,
            COALESCE(SUM(CASE WHEN t.tipo = 'gasto' AND fc.afecta_resultado = 1
                               AND (fc.codigo IS NULL OR fc.codigo <> 'costo_ventas')
                              THEN t.monto ELSE 0 END), 0) AS gastos,
            COALESCE(SUM(CASE WHEN ${afectaCaja} AND t.tipo IN ('ingreso', 'pasivo')
                              THEN t.monto ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN ${afectaCaja} AND t.tipo IN ('gasto', 'activo')
                              THEN t.monto ELSE 0 END), 0) AS salidas
     FROM transactions t
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     WHERE t.fecha BETWEEN ? AND ? AND ${VALID_TRANSACTION}
     GROUP BY mes
     ORDER BY mes`,
    [desde, hasta]
  );

  // Saldo de caja al iniciar el rango: saldos iniciales de las cuentas más los
  // movimientos de caja anteriores a `desde`.
  const [cajaRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       (SELECT COALESCE(SUM(saldo_inicial), 0) FROM finance_accounts) +
       COALESCE(SUM(CASE WHEN ${afectaCaja} THEN
           CASE WHEN t.tipo IN ('ingreso', 'pasivo') THEN t.monto
                WHEN t.tipo IN ('gasto', 'activo') THEN -t.monto
                ELSE 0 END
           ELSE 0 END), 0) AS saldo_inicial
     FROM transactions t
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     WHERE t.fecha < ? AND ${VALID_TRANSACTION}`,
    [desde]
  );

  const byMonth = new Map(rows.map((r) => [String(r.mes), r]));
  let saldoCaja = roundMoney(Number(cajaRows[0]?.saldo_inicial ?? 0));

  const serie = mesesEntre(desde, hasta).map((mes) => {
    const r = byMonth.get(mes);
    const ingresos = roundMoney(Number(r?.ingresos ?? 0));
    const costoVentas = roundMoney(Number(r?.costo_ventas ?? 0));
    const margen = roundMoney(ingresos - costoVentas);
    const gastos = roundMoney(Number(r?.gastos ?? 0));
    const entradas = roundMoney(Number(r?.entradas ?? 0));
    const salidas = roundMoney(Number(r?.salidas ?? 0));
    const neto = roundMoney(entradas - salidas);
    saldoCaja = roundMoney(saldoCaja + neto);
    return {
      mes,
      ingresos,
      costo_ventas: costoVentas,
      margen,
      margen_pct: pctOf(margen, ingresos),
      gastos,
      utilidad: roundMoney(margen - gastos),
      entradas,
      salidas,
      neto_caja: neto,
      saldo_caja: saldoCaja,
      variacion_ingresos: null as number | null,
      variacion_utilidad: null as number | null,
    };
  });

  // Variación mes a mes dentro de la serie (los meses sin movimiento son 0).
  for (let i = 1; i < serie.length; i += 1) {
    serie[i].variacion_ingresos = growth(serie[i].ingresos, serie[i - 1].ingresos);
    serie[i].variacion_utilidad = growth(serie[i].utilidad, serie[i - 1].utilidad);
  }

  const totales: TrendTotals = {
    ingresos: roundMoney(serie.reduce((s, m) => s + m.ingresos, 0)),
    costo_ventas: roundMoney(serie.reduce((s, m) => s + m.costo_ventas, 0)),
    margen: roundMoney(serie.reduce((s, m) => s + m.margen, 0)),
    gastos: roundMoney(serie.reduce((s, m) => s + m.gastos, 0)),
    utilidad: roundMoney(serie.reduce((s, m) => s + m.utilidad, 0)),
    margen_pct: 0,
    entradas: roundMoney(serie.reduce((s, m) => s + m.entradas, 0)),
    salidas: roundMoney(serie.reduce((s, m) => s + m.salidas, 0)),
    neto_caja: roundMoney(serie.reduce((s, m) => s + m.neto_caja, 0)),
  };
  totales.margen_pct = pctOf(totales.margen, totales.ingresos);

  const dias =
    Math.floor(
      (Date.parse(`${hasta}T12:00:00`) - Date.parse(`${desde}T12:00:00`)) / 86_400_000
    ) + 1;
  const anteriorHasta = addDays(desde, -1);
  const anteriorDesde = addDays(desde, -dias);
  const anioDesde = shiftYear(desde, -1);
  const anioHasta = shiftYear(hasta, -1);

  const [anterior, anioAnterior] = await Promise.all([
    trendTotals(anteriorDesde, anteriorHasta),
    trendTotals(anioDesde, anioHasta),
  ]);

  return {
    rango: { desde, hasta, meses: serie.length, dias },
    serie,
    totales,
    comparacion: {
      anterior: { desde: anteriorDesde, hasta: anteriorHasta, totales: anterior },
      anio_anterior: { desde: anioDesde, hasta: anioHasta, totales: anioAnterior },
      variaciones: {
        ingresos_vs_anterior: growth(totales.ingresos, anterior.ingresos),
        utilidad_vs_anterior: growth(totales.utilidad, anterior.utilidad),
        ingresos_vs_anio_anterior: growth(totales.ingresos, anioAnterior.ingresos),
        utilidad_vs_anio_anterior: growth(totales.utilidad, anioAnterior.utilidad),
      },
    },
  };
}
