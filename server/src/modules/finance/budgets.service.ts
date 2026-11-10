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

// Regla de convivencia de líneas: para una misma categoría financiera se
// planifica en un solo nivel (general, por producto o por categoría de producto)
// para no duplicar la ejecución real.
type BudgetScope = "general" | "producto" | "categoria";

const scopeOf = (line: BudgetInput["lineas"][number]): BudgetScope =>
  line.product_id != null ? "producto" : line.product_category_id != null ? "categoria" : "general";

const scopeKey = (line: BudgetInput["lineas"][number]) =>
  line.product_id != null
    ? `P:${line.product_id}`
    : line.product_category_id != null
      ? `C:${line.product_category_id}`
      : "ALL";

function validateLines(lines: BudgetInput["lineas"]) {
  const seen = new Set<string>();
  const scopes = new Map<number, Set<BudgetScope>>();

  for (const line of lines) {
    const key = `${line.finance_category_id}:${scopeKey(line)}`;
    if (seen.has(key)) {
      throw new HttpError(400, "Hay una línea repetida para la misma categoría y alcance");
    }
    seen.add(key);

    const kinds = scopes.get(line.finance_category_id) ?? new Set<BudgetScope>();
    kinds.add(scopeOf(line));
    scopes.set(line.finance_category_id, kinds);
  }

  for (const kinds of scopes.values()) {
    if (kinds.has("general") && kinds.size > 1) {
      throw new HttpError(
        400,
        "Una categoría no puede tener a la vez una línea general y líneas por producto o categoría de producto"
      );
    }
    if (kinds.has("producto") && kinds.has("categoria")) {
      throw new HttpError(
        400,
        "Una categoría no puede mezclar líneas por producto y por categoría de producto"
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
  if (productIds.length > 0) {
    const [products] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM products WHERE id IN (?)",
      [productIds]
    );
    const validProducts = new Set(products.map((p) => p.id as number));
    for (const id of productIds) {
      if (!validProducts.has(id)) throw new HttpError(400, `El producto ${id} no existe`);
    }
  }

  const productCategoryIds = [
    ...new Set(lines.flatMap((l) => (l.product_category_id ? [l.product_category_id] : []))),
  ];
  if (productCategoryIds.length > 0) {
    const [categories] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM categories WHERE id IN (?)",
      [productCategoryIds]
    );
    const valid = new Set(categories.map((c) => c.id as number));
    for (const id of productCategoryIds) {
      if (!valid.has(id)) {
        throw new HttpError(400, `La categoría de producto ${id} no existe`);
      }
    }
  }
}

async function insertLines(conn: PoolConnection, budgetId: number, lines: BudgetInput["lineas"]) {
  if (lines.length === 0) return;
  await conn.query(
    `INSERT INTO budget_lines
       (budget_id, finance_category_id, product_id, product_category_id, monto_planeado)
     VALUES ?`,
    [
      lines.map((l) => [
        budgetId,
        l.finance_category_id,
        l.product_id ?? null,
        l.product_category_id ?? null,
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
     WHERE estado = 'activo' AND tipo_periodo = ?
       AND fecha_inicio <= ? AND fecha_fin >= ?
       AND (? IS NULL OR id <> ?)
     LIMIT 1`,
    [
      budget.tipo_periodo,
      budget.fecha_fin,
      budget.fecha_inicio,
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
    `SELECT bl.id, bl.finance_category_id, bl.product_id, bl.product_category_id,
            bl.monto_planeado, fc.nombre AS categoria, fc.tipo AS tipo_categoria,
            p.sku, p.nombre AS producto, pc.nombre AS producto_categoria
     FROM budget_lines bl
     JOIN finance_categories fc ON fc.id = bl.finance_category_id
     LEFT JOIN products p ON p.id = bl.product_id
     LEFT JOIN categories pc ON pc.id = bl.product_category_id
     WHERE bl.budget_id = ?
     ORDER BY fc.nombre, pc.nombre, p.nombre`,
    [id]
  );

  // Ejecución real: los asientos de cabecera de factura se distribuyen por
  // producto/categoría en transaction_allocations. Los asientos manuales sin
  // distribución se imputan directamente a su product_id (o al total).
  const [txRows] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.finance_category_id, t.product_id, t.monto
     FROM transactions t
     WHERE t.fecha BETWEEN ? AND ?
       AND t.anulada_de IS NULL
       AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)`,
    [budget.fecha_inicio, budget.fecha_fin]
  );

  const [allocRows] = await pool.query<RowDataPacket[]>(
    `SELECT a.transaction_id, a.product_id, a.monto
     FROM transaction_allocations a
     JOIN transactions t ON t.id = a.transaction_id
     WHERE t.fecha BETWEEN ? AND ?
       AND t.anulada_de IS NULL
       AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)`,
    [budget.fecha_inicio, budget.fecha_fin]
  );

  const [productRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, category_id FROM products"
  );
  const categoryOfProduct = new Map<number, number>();
  for (const p of productRows) {
    categoryOfProduct.set(p.id as number, p.category_id as number);
  }

  const allocations = new Map<number, { productId: number | null; monto: number }[]>();
  for (const a of allocRows) {
    const txId = a.transaction_id as number;
    const list = allocations.get(txId) ?? [];
    list.push({ productId: (a.product_id as number | null) ?? null, monto: Number(a.monto) });
    allocations.set(txId, list);
  }

  const categoryTotal = new Map<number, number>();
  const productTotal = new Map<string, number>();
  const productCategoryTotal = new Map<string, number>();

  const addProduct = (categoryId: number, productId: number, monto: number) => {
    const pk = `${categoryId}:${productId}`;
    productTotal.set(pk, (productTotal.get(pk) ?? 0) + monto);
    const productCategoryId = categoryOfProduct.get(productId);
    if (productCategoryId !== undefined) {
      const ck = `${categoryId}:${productCategoryId}`;
      productCategoryTotal.set(ck, (productCategoryTotal.get(ck) ?? 0) + monto);
    }
  };

  for (const tx of txRows) {
    const categoryId = tx.finance_category_id as number;
    const monto = Number(tx.monto);
    categoryTotal.set(categoryId, (categoryTotal.get(categoryId) ?? 0) + monto);

    const txAllocations = allocations.get(tx.id as number);
    if (txAllocations && txAllocations.length > 0) {
      for (const a of txAllocations) {
        if (a.productId !== null) addProduct(categoryId, a.productId, a.monto);
      }
    } else if (tx.product_id !== null) {
      addProduct(categoryId, tx.product_id as number, monto);
    }
  }

  let planeadoTotal = 0;
  let realTotal = 0;

  const lineas = lines.map((line) => {
    const categoryId = line.finance_category_id as number;
    const productId = line.product_id as number | null;
    const productCategoryId = line.product_category_id as number | null;
    const planeado = Number(line.monto_planeado);
    const real =
      productId !== null
        ? (productTotal.get(`${categoryId}:${productId}`) ?? 0)
        : productCategoryId !== null
          ? (productCategoryTotal.get(`${categoryId}:${productCategoryId}`) ?? 0)
          : (categoryTotal.get(categoryId) ?? 0);

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
    if (budget.estado === "cerrado") {
      throw new HttpError(409, "Un presupuesto cerrado no se puede editar");
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

  const [[product]] = await pool.query<RowDataPacket[]>(
    "SELECT category_id FROM products WHERE id = ?",
    [productId]
  );
  const productCategoryId = (product?.category_id as number | undefined) ?? null;

  const now = today();
  // Consulta directa (sin límite arbitrario) de presupuestos activos que contengan hoy.
  const [budgets] = await pool.query<RowDataPacket[]>(
    `SELECT id, nombre, fecha_inicio, fecha_fin
     FROM budgets
     WHERE estado = 'activo' AND ? BETWEEN fecha_inicio AND fecha_fin
     ORDER BY fecha_inicio DESC, id DESC`,
    [now]
  );

  // Preferir el presupuesto más específico (fecha de inicio más cercana) y, dentro de él,
  // la línea del producto; si no existe, la de su categoría; por último, la general.
  for (const b of budgets as RowDataPacket[]) {
    const detail = (await getBudget(b.id as number)) as any;
    const lines = detail.lineas as any[];
    const productLine = lines.find(
      (l: any) =>
        l.finance_category_id === financeCategoryId && l.product_id === productId
    );
    const categoryLine = productCategoryId
      ? lines.find(
          (l: any) =>
            l.finance_category_id === financeCategoryId &&
            l.product_category_id === productCategoryId
        )
      : undefined;
    const generalLine = lines.find(
      (l: any) =>
        l.finance_category_id === financeCategoryId &&
        l.product_id === null &&
        l.product_category_id === null
    );
    const line = productLine ?? categoryLine ?? generalLine;
    if (!line) continue;
    return {
      budget_id: detail.id,
      budget_nombre: detail.nombre,
      finance_category_id: financeCategoryId,
      product_id: productId,
      product_category_id: line.product_category_id ?? null,
      alcance:
        line.product_id !== null
          ? "producto"
          : line.product_category_id !== null
            ? "categoria"
            : "general",
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
