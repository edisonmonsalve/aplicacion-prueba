import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { today } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import type { budgetSchema, listBudgetsQuerySchema } from "./finance.schema.js";
import { auditFinance } from "./finance.shared.js";

type BudgetInput = z.infer<typeof budgetSchema>;
type BudgetListQuery = z.infer<typeof listBudgetsQuerySchema>;

const round2 = (value: number) => Math.round(value * 100) / 100;

// Regla de convivencia de líneas: una categoría se planifica o por categoría
// completa o por productos, pero no mezclando ambas para no duplicar la ejecución.
function validateLines(lines: BudgetInput["lineas"]) {
  const seen = new Set<string>();
  const withProduct = new Map<number, number>();
  const categoryOnly = new Set<number>();

  for (const line of lines) {
    const key = `${line.finance_category_id}:${line.product_id ?? 0}`;
    if (seen.has(key)) {
      throw new HttpError(400, "Hay una línea repetida para la misma categoría y producto");
    }
    seen.add(key);

    if (line.product_id == null) {
      categoryOnly.add(line.finance_category_id);
    } else {
      withProduct.set(line.finance_category_id, (withProduct.get(line.finance_category_id) ?? 0) + 1);
    }
  }

  for (const categoryId of categoryOnly) {
    if ((withProduct.get(categoryId) ?? 0) > 0) {
      throw new HttpError(
        400,
        "Una categoría no puede tener a la vez una línea general y líneas por producto"
      );
    }
  }
}

async function assertEntities(conn: PoolConnection, lines: BudgetInput["lineas"]) {
  if (lines.length === 0) return;

  const categoryIds = [...new Set(lines.map((l) => l.finance_category_id))];
  const [categories] = await conn.query<RowDataPacket[]>(
    "SELECT id, activo FROM finance_categories WHERE id IN (?)",
    [categoryIds]
  );
  const validCategories = new Set(
    categories.filter((c) => c.activo).map((c) => c.id as number)
  );
  for (const id of categoryIds) {
    if (!validCategories.has(id)) {
      throw new HttpError(400, `La categoría financiera ${id} no existe o está inactiva`);
    }
  }

  const productIds = [...new Set(lines.flatMap((l) => (l.product_id ? [l.product_id] : [])))];
  if (productIds.length === 0) return;

  const [products] = await conn.query<RowDataPacket[]>(
    "SELECT id FROM products WHERE id IN (?)",
    [productIds]
  );
  const validProducts = new Set(products.map((p) => p.id as number));
  for (const id of productIds) {
    if (!validProducts.has(id)) throw new HttpError(400, `El producto ${id} no existe`);
  }
}

async function insertLines(conn: PoolConnection, budgetId: number, lines: BudgetInput["lineas"]) {
  if (lines.length === 0) return;
  await conn.query(
    `INSERT INTO budget_lines (budget_id, finance_category_id, product_id, monto_planeado)
     VALUES ?`,
    [
      lines.map((l) => [
        budgetId,
        l.finance_category_id,
        l.product_id ?? null,
        l.monto_planeado,
      ]),
    ]
  );
}

async function lockBudget(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT * FROM budgets WHERE id = ? FOR UPDATE",
    [id]
  );
  if (!rows[0]) throw new HttpError(404, "Presupuesto no encontrado");
  return rows[0];
}

async function snapshot(conn: PoolConnection, id: number) {
  const [header] = await conn.query<RowDataPacket[]>(
    "SELECT * FROM budgets WHERE id = ?",
    [id]
  );
  const [lines] = await conn.query<RowDataPacket[]>(
    "SELECT * FROM budget_lines WHERE budget_id = ? ORDER BY id",
    [id]
  );
  return { header: header[0] ?? null, lineas: lines };
}

async function assertNoActivePeriod(
  conn: PoolConnection,
  budget: Pick<BudgetInput, "tipo_periodo" | "fecha_inicio" | "fecha_fin">,
  excludeId?: number
) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM budgets
     WHERE estado = 'activo' AND tipo_periodo = ? AND fecha_inicio = ? AND fecha_fin = ?
       AND (? IS NULL OR id <> ?)
     LIMIT 1`,
    [
      budget.tipo_periodo,
      budget.fecha_inicio,
      budget.fecha_fin,
      excludeId ?? null,
      excludeId ?? null,
    ]
  );
  if (rows[0]) {
    throw new HttpError(409, "Ya existe un presupuesto activo para ese periodo");
  }
}

export async function listBudgets(query: BudgetListQuery) {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.q) {
    where.push("b.nombre LIKE ?");
    params.push(`%${query.q}%`);
  }
  if (query.estado) {
    where.push("b.estado = ?");
    params.push(query.estado);
  }
  if (query.tipo_periodo) {
    where.push("b.tipo_periodo = ?");
    params.push(query.tipo_periodo);
  }
  if (query.desde) {
    where.push("b.fecha_fin >= ?");
    params.push(query.desde);
  }
  if (query.hasta) {
    where.push("b.fecha_inicio <= ?");
    params.push(query.hasta);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM budgets b ${clause}`,
    params
  );

  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT b.id, b.nombre, b.tipo_periodo, b.fecha_inicio, b.fecha_fin,
            b.ingreso_meta, b.alerta_pct, b.estado, b.created_by,
            u.nombre AS creador, b.created_at, b.updated_at,
            (SELECT COUNT(*) FROM budget_lines bl WHERE bl.budget_id = b.id) AS lineas,
            (SELECT COALESCE(SUM(bl.monto_planeado), 0)
               FROM budget_lines bl WHERE bl.budget_id = b.id) AS planeado_total
     FROM budgets b
     JOIN users u ON u.id = b.created_by
     ${clause}
     ORDER BY b.fecha_inicio DESC, b.id DESC
     LIMIT ? OFFSET ?`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function getBudget(id: number) {
  const [headers] = await pool.query<RowDataPacket[]>(
    `SELECT b.id, b.nombre, b.tipo_periodo, b.fecha_inicio, b.fecha_fin,
            b.ingreso_meta, b.alerta_pct, b.estado, b.created_by,
            u.nombre AS creador, b.created_at, b.updated_at
     FROM budgets b
     JOIN users u ON u.id = b.created_by
     WHERE b.id = ?`,
    [id]
  );
  const budget = headers[0];
  if (!budget) throw new HttpError(404, "Presupuesto no encontrado");

  const [lines] = await pool.query<RowDataPacket[]>(
    `SELECT bl.id, bl.finance_category_id, bl.product_id, bl.monto_planeado,
            fc.nombre AS categoria, fc.tipo AS tipo_categoria,
            p.sku, p.nombre AS producto
     FROM budget_lines bl
     JOIN finance_categories fc ON fc.id = bl.finance_category_id
     LEFT JOIN products p ON p.id = bl.product_id
     WHERE bl.budget_id = ?
     ORDER BY fc.nombre, p.nombre`,
    [id]
  );

  const [reals] = await pool.query<RowDataPacket[]>(
    `SELECT t.finance_category_id, t.product_id, SUM(t.monto) AS monto_real
     FROM transactions t
     WHERE t.fecha BETWEEN ? AND ?
       AND t.anulada_de IS NULL
       AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
     GROUP BY t.finance_category_id, t.product_id`,
    [budget.fecha_inicio, budget.fecha_fin]
  );

  const categoryTotal = new Map<number, number>();
  const productTotal = new Map<string, number>();
  for (const row of reals) {
    const categoryId = row.finance_category_id as number;
    const productId = row.product_id as number | null;
    categoryTotal.set(categoryId, (categoryTotal.get(categoryId) ?? 0) + Number(row.monto_real));
    if (productId !== null) {
      const key = `${categoryId}:${productId}`;
      productTotal.set(key, (productTotal.get(key) ?? 0) + Number(row.monto_real));
    }
  }

  let planeadoTotal = 0;
  let realTotal = 0;

  const lineas = lines.map((line) => {
    const categoryId = line.finance_category_id as number;
    const productId = line.product_id as number | null;
    const planeado = Number(line.monto_planeado);
    const real =
      productId === null
        ? (categoryTotal.get(categoryId) ?? 0)
        : (productTotal.get(`${categoryId}:${productId}`) ?? 0);

    const ejecucionPct = planeado > 0 ? round2((real / planeado) * 100) : real > 0 ? 100 : 0;
    const estado =
      real > planeado || ejecucionPct >= 100
        ? "excedido"
        : ejecucionPct >= Number(budget.alerta_pct)
          ? "alerta"
          : "ok";

    planeadoTotal += planeado;
    realTotal += real;

    return {
      ...line,
      monto_planeado: planeado,
      real: round2(real),
      disponible: round2(planeado - real),
      ejecucion_pct: ejecucionPct,
      estado,
    };
  });

  const [ingresos] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(t.monto), 0) AS total
     FROM transactions t
     WHERE t.tipo = 'ingreso' AND t.fecha BETWEEN ? AND ?
       AND t.anulada_de IS NULL
       AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)`,
    [budget.fecha_inicio, budget.fecha_fin]
  );
  const ingresosReales = Number(ingresos[0].total);

  const ejecucionPct = planeadoTotal > 0 ? round2((realTotal / planeadoTotal) * 100) : 0;
  const diasPeriodo =
    Math.round(
      (new Date(`${budget.fecha_fin}T12:00:00`).getTime() -
        new Date(`${budget.fecha_inicio}T12:00:00`).getTime()) /
        86_400_000
    ) + 1;

  const hoy = today();
  let proyeccion: number | null = null;
  if (budget.estado === "activo" && hoy >= budget.fecha_inicio && hoy <= budget.fecha_fin) {
    const diasTranscurridos =
      Math.round(
        (new Date(`${hoy}T12:00:00`).getTime() -
          new Date(`${budget.fecha_inicio}T12:00:00`).getTime()) /
          86_400_000
      ) + 1;
    proyeccion = round2((realTotal / Math.max(diasTranscurridos, 1)) * diasPeriodo);
  }

  return {
    ...budget,
    lineas,
    resumen: {
      planeado_total: round2(planeadoTotal),
      real_total: round2(realTotal),
      disponible_total: round2(planeadoTotal - realTotal),
      ejecucion_pct: ejecucionPct,
      estado:
        realTotal > planeadoTotal || ejecucionPct >= 100
          ? "excedido"
          : ejecucionPct >= Number(budget.alerta_pct)
            ? "alerta"
            : "ok",
      proyeccion,
      ingreso_meta: Number(budget.ingreso_meta),
      ingresos_reales: round2(ingresosReales),
      cumplimiento_ingreso_pct:
        Number(budget.ingreso_meta) > 0
          ? round2((ingresosReales / Number(budget.ingreso_meta)) * 100)
          : 0,
    },
  };
}

export async function createBudget(input: BudgetInput, actor: AuthUser) {
  validateLines(input.lineas);

  return withTransaction(async (conn) => {
    await assertEntities(conn, input.lineas);

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO budgets
         (nombre, tipo_periodo, fecha_inicio, fecha_fin, ingreso_meta, alerta_pct, estado, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'borrador', ?)`,
      [
        input.nombre,
        input.tipo_periodo,
        input.fecha_inicio,
        input.fecha_fin,
        input.ingreso_meta,
        input.alerta_pct,
        actor.id,
      ]
    );

    await insertLines(conn, res.insertId, input.lineas);
    await auditFinance(conn, actor.id, "budget", res.insertId, "crear", null, {
      ...input,
      estado: "borrador",
    });

    return { id: res.insertId };
  });
}

export async function updateBudget(id: number, input: BudgetInput, actor: AuthUser) {
  validateLines(input.lineas);

  return withTransaction(async (conn) => {
    const budget = await lockBudget(conn, id);
    if (budget.estado !== "borrador") {
      throw new HttpError(409, "Solo los presupuestos en borrador se pueden editar");
    }

    await assertEntities(conn, input.lineas);
    const previous = await snapshot(conn, id);

    await conn.query(
      `UPDATE budgets SET
         nombre = ?, tipo_periodo = ?, fecha_inicio = ?, fecha_fin = ?,
         ingreso_meta = ?, alerta_pct = ?
       WHERE id = ?`,
      [
        input.nombre,
        input.tipo_periodo,
        input.fecha_inicio,
        input.fecha_fin,
        input.ingreso_meta,
        input.alerta_pct,
        id,
      ]
    );

    await conn.query("DELETE FROM budget_lines WHERE budget_id = ?", [id]);
    await insertLines(conn, id, input.lineas);

    const current = await snapshot(conn, id);
    await auditFinance(conn, actor.id, "budget", id, "actualizar", previous, current);

    return { id };
  });
}

export async function deleteBudget(id: number, actor: AuthUser) {
  return withTransaction(async (conn) => {
    const budget = await lockBudget(conn, id);
    if (budget.estado !== "borrador") {
      throw new HttpError(409, "Solo los presupuestos en borrador se pueden eliminar");
    }

    const previous = await snapshot(conn, id);
    await conn.query("DELETE FROM budgets WHERE id = ?", [id]);
    await auditFinance(conn, actor.id, "budget", id, "eliminar", previous, null);
  });
}

export async function activateBudget(id: number, actor: AuthUser) {
  return withTransaction(async (conn) => {
    const budget = await lockBudget(conn, id);
    if (budget.estado !== "borrador") {
      throw new HttpError(409, "Solo un presupuesto en borrador se puede activar");
    }

    const [[{ total }]] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM budget_lines WHERE budget_id = ?",
      [id]
    );
    if (Number(total) === 0) {
      throw new HttpError(409, "El presupuesto necesita al menos una línea para activarse");
    }

    await assertNoActivePeriod(
      conn,
      {
        tipo_periodo: budget.tipo_periodo,
        fecha_inicio: budget.fecha_inicio,
        fecha_fin: budget.fecha_fin,
      },
      id
    );

    await conn.query("UPDATE budgets SET estado = 'activo' WHERE id = ?", [id]);
    const current = await snapshot(conn, id);
    await auditFinance(conn, actor.id, "budget", id, "activar", null, current);
    return { id, estado: "activo" as const };
  });
}

export async function getAvailability(productId: number) {
  const financeCategoryId = await (async () => {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM finance_categories WHERE nombre = 'Compra de inventario' AND tipo = 'gasto' AND activo = 1 LIMIT 1",
      []
    );
    return rows[0]?.id as number | undefined;
  })();
  if (!financeCategoryId) return null;

  const now = today();
  const { data: budgets } = await listBudgets({ page: 1, pageSize: 100, estado: "activo" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = (budgets as any[]).filter((b: any) => b.fecha_inicio <= now && b.fecha_fin >= now);

  for (const b of active) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = (await getBudget(b.id)) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const line = (detail.lineas as any[]).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (l: any) =>
        l.finance_category_id === financeCategoryId &&
        (l.product_id === productId || l.product_id === null)
    );
    if (!line) continue;
    return {
      budget_id: detail.id,
      budget_nombre: detail.nombre,
      finance_category_id: financeCategoryId,
      product_id: productId,
      planeado: Number(line.monto_planeado),
      real: Number(line.real),
      disponible: Number(line.disponible),
      ejecucion_pct: Number(line.ejecucion_pct),
    };
  }
  return null;
}

export async function closeBudget(id: number, actor: AuthUser) {
  return withTransaction(async (conn) => {
    const budget = await lockBudget(conn, id);
    if (budget.estado !== "activo") {
      throw new HttpError(409, "Solo un presupuesto activo se puede cerrar");
    }

    await conn.query("UPDATE budgets SET estado = 'cerrado' WHERE id = ?", [id]);
    const current = await snapshot(conn, id);
    await auditFinance(conn, actor.id, "budget", id, "cerrar", null, current);
    return { id, estado: "cerrado" as const };
  });
}
