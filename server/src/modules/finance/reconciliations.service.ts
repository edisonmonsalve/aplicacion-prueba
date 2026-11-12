import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { addDays } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import { auditFinance, roundMoney, VALID_TRANSACTION } from "./finance.shared.js";
import type {
  CreateReconciliationInput,
  ListReconciliationsQuery,
  StatementLineInput,
  UpdateReconciliationInput,
} from "./reconciliations.schema.js";

type Db = Pick<typeof pool, "query">;

/**
 * Importe firmado de un asiento para el extracto:
 * las entradas (ingreso/pasivo) suman y las salidas (gasto/activo) restan.
 * Solo aplica a asientos que afectan caja; el resto no es un movimiento bancario.
 */
const SIGNED_AMOUNT = `(CASE t.tipo
  WHEN 'ingreso' THEN t.monto
  WHEN 'pasivo' THEN t.monto
  ELSE -t.monto
END)`;

const LINE_SELECT = `
  SELECT l.id, l.reconciliation_id, l.fecha, l.descripcion, l.referencia, l.monto,
         l.estado, l.transaction_id, l.nota, l.conciliada_at, l.created_at,
         uc.nombre AS conciliada_por,
         t.fecha AS tx_fecha, t.tipo AS tx_tipo, t.monto AS tx_monto,
         ${SIGNED_AMOUNT} AS tx_monto_firmado, t.descripcion AS tx_descripcion,
         fc.nombre AS tx_categoria, t.invoice_id AS tx_invoice_id,
         i.numero AS tx_factura
  FROM bank_statement_lines l
  LEFT JOIN users uc ON uc.id = l.conciliada_by
  LEFT JOIN transactions t ON t.id = l.transaction_id
  LEFT JOIN finance_categories fc ON fc.id = t.finance_category_id
  LEFT JOIN invoices i ON i.id = t.invoice_id`;

const HEADER_SELECT = `
  SELECT r.id, r.account_id, a.nombre AS cuenta, a.tipo AS cuenta_tipo,
         r.nombre, r.fecha_inicio, r.fecha_fin,
         r.saldo_extracto_inicial, r.saldo_extracto_final, r.estado, r.snapshot,
         r.cerrada_at, r.reabierta_at, r.motivo_reapertura, r.created_at,
         uc.nombre AS creador, ucl.nombre AS cerrada_por, ur.nombre AS reabierta_por
  FROM bank_reconciliations r
  JOIN finance_accounts a ON a.id = r.account_id
  JOIN users uc ON uc.id = r.created_by
  LEFT JOIN users ucl ON ucl.id = r.cerrada_by
  LEFT JOIN users ur ON ur.id = r.reabierta_by`;

function parseSnapshot(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  return value as Record<string, unknown>;
}

async function assertNoOverlap(
  conn: Db,
  accountId: number,
  fechaInicio: string,
  fechaFin: string,
  excludeId?: number
) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id, nombre
     FROM bank_reconciliations
     WHERE account_id = ? AND estado = 'abierta'
       AND fecha_inicio <= ? AND fecha_fin >= ?
       ${excludeId ? "AND id <> ?" : ""}
     LIMIT 1`,
    excludeId
      ? [accountId, fechaFin, fechaInicio, excludeId]
      : [accountId, fechaFin, fechaInicio]
  );
  if (rows[0]) {
    throw new HttpError(
      409,
      `El rango se superpone con la conciliación abierta "${rows[0].nombre}" de la misma cuenta`
    );
  }
}

async function assertAccount(conn: Db, accountId: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, activo FROM finance_accounts WHERE id = ?",
    [accountId]
  );
  if (!rows[0] || !rows[0].activo) {
    throw new HttpError(400, "La cuenta financiera no existe o está inactiva");
  }
}

async function loadOpenReconciliation(conn: Db, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT * FROM bank_reconciliations WHERE id = ? FOR UPDATE",
    [id]
  );
  const reconciliation = rows[0];
  if (!reconciliation) throw new HttpError(404, "Conciliación no encontrada");
  if (reconciliation.estado !== "abierta") {
    throw new HttpError(409, "La conciliación está cerrada. Reábrela para modificarla.");
  }
  return reconciliation as RowDataPacket & {
    id: number;
    account_id: number;
    fecha_inicio: string;
    fecha_fin: string;
    estado: "abierta" | "cerrada";
  };
}

async function computeDetail(db: Db, id: number) {
  const [headers] = await db.query<RowDataPacket[]>(
    `${HEADER_SELECT} WHERE r.id = ?`,
    [id]
  );
  const header = headers[0];
  if (!header) throw new HttpError(404, "Conciliación no encontrada");

  const [lineRows] = await db.query<RowDataPacket[]>(
    `${LINE_SELECT} WHERE l.reconciliation_id = ? ORDER BY l.fecha, l.id`,
    [id]
  );
  const [movementRows] = await db.query<RowDataPacket[]>(
    `SELECT t.id, t.fecha, t.tipo, t.monto, ${SIGNED_AMOUNT} AS monto_firmado,
            fc.nombre AS categoria, t.descripcion, t.invoice_id,
            i.numero AS factura, ml.id AS line_id,
            EXISTS(
              SELECT 1 FROM bank_statement_lines x
              WHERE x.transaction_id = t.id AND x.estado = 'conciliada'
                AND x.reconciliation_id <> ?
            ) AS otra_conciliacion
     FROM transactions t
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     LEFT JOIN invoices i ON i.id = t.invoice_id
     LEFT JOIN bank_statement_lines ml
       ON ml.transaction_id = t.id AND ml.reconciliation_id = ?
     WHERE t.account_id = ? AND t.fecha BETWEEN ? AND ?
       AND COALESCE(t.afecta_caja, fc.afecta_caja) = 1
       AND ${VALID_TRANSACTION}
     ORDER BY t.fecha, t.id`,
    [id, id, header.account_id, header.fecha_inicio, header.fecha_fin]
  );
  const [balanceRows] = await db.query<RowDataPacket[]>(
    `SELECT a.saldo_inicial + COALESCE((
              SELECT SUM(${SIGNED_AMOUNT})
              FROM transactions t
              JOIN finance_categories fc ON fc.id = t.finance_category_id
              WHERE t.account_id = a.id AND t.fecha < ?
                AND COALESCE(t.afecta_caja, fc.afecta_caja) = 1
                AND ${VALID_TRANSACTION}
            ), 0) AS saldo_inicial
     FROM finance_accounts a
     WHERE a.id = ?`,
    [header.fecha_inicio, header.account_id]
  );

  const lineas = lineRows.map((r) => ({
    id: Number(r.id),
    reconciliation_id: Number(r.reconciliation_id),
    fecha: String(r.fecha),
    descripcion: String(r.descripcion),
    referencia: r.referencia ?? null,
    monto: roundMoney(Number(r.monto)),
    estado: r.estado as "pendiente" | "conciliada" | "ignorada",
    transaction_id: r.transaction_id === null ? null : Number(r.transaction_id),
    nota: r.nota ?? null,
    conciliada_at: r.conciliada_at ?? null,
    conciliada_por: r.conciliada_por ?? null,
    created_at: r.created_at ?? null,
    tx_fecha: r.tx_fecha ? String(r.tx_fecha) : null,
    tx_tipo: r.tx_tipo ?? null,
    tx_monto: r.tx_monto === null ? null : roundMoney(Number(r.tx_monto)),
    tx_monto_firmado:
      r.tx_monto_firmado === null ? null : roundMoney(Number(r.tx_monto_firmado)),
    tx_descripcion: r.tx_descripcion ?? null,
    tx_categoria: r.tx_categoria ?? null,
    tx_invoice_id: r.tx_invoice_id === null ? null : Number(r.tx_invoice_id),
    tx_factura: r.tx_factura ?? null,
  }));

  const movimientos = movementRows.map((r) => ({
    id: Number(r.id),
    fecha: String(r.fecha),
    tipo: r.tipo as "ingreso" | "gasto" | "activo" | "pasivo",
    monto: roundMoney(Number(r.monto)),
    monto_firmado: roundMoney(Number(r.monto_firmado)),
    categoria: String(r.categoria),
    descripcion: r.descripcion ?? null,
    invoice_id: r.invoice_id === null ? null : Number(r.invoice_id),
    factura: r.factura ?? null,
    line_id: r.line_id === null ? null : Number(r.line_id),
    otra_conciliacion: Boolean(Number(r.otra_conciliacion)),
  }));

  const saldoInicialSistema = roundMoney(Number(balanceRows[0]?.saldo_inicial ?? 0));
  const saldoSistema = roundMoney(
    saldoInicialSistema + movimientos.reduce((sum, m) => sum + m.monto_firmado, 0)
  );
  const saldoExtractoInicial = roundMoney(Number(header.saldo_extracto_inicial));
  const saldoExtractoFinal = roundMoney(Number(header.saldo_extracto_final));
  const saldoExtractoCalculado = roundMoney(
    saldoExtractoInicial + lineas.reduce((sum, l) => sum + l.monto, 0)
  );
  const diferencia = roundMoney(saldoExtractoFinal - saldoSistema);

  const pendientes = lineas.filter((l) => l.estado === "pendiente");
  const conciliadas = lineas.filter((l) => l.estado === "conciliada");
  const ignoradas = lineas.filter((l) => l.estado === "ignorada");
  const movimientosSinConciliar = movimientos.filter(
    (m) => !m.line_id && !m.otra_conciliacion
  );

  const montoPendiente = roundMoney(
    pendientes.reduce((sum, l) => sum + l.monto, 0)
  );
  const montoIgnorado = roundMoney(
    ignoradas.reduce((sum, l) => sum + l.monto, 0)
  );
  const montoSistemaSinConciliar = roundMoney(
    movimientosSinConciliar.reduce((sum, m) => sum + m.monto_firmado, 0)
  );

  // Si todas las líneas del extracto y todos los asientos del sistema se
  // cruzan, la única diferencia legítima es la de los saldos iniciales. El
  // resto son partidas conciliatorias: líneas del banco aún sin registrar y
  // movimientos del sistema que el banco todavía no ha procesado.
  const diferenciaExplicada = roundMoney(
    montoPendiente + montoIgnorado - montoSistemaSinConciliar
  );
  const diferenciaNoExplicada = roundMoney(diferencia - diferenciaExplicada);

  const resueltas = conciliadas.length + ignoradas.length;
  const extractoCuadra =
    Math.abs(saldoExtractoCalculado - saldoExtractoFinal) <= 0.005;
  const lineasResueltas = pendientes.length === 0;
  const resumen = {
    saldo_inicial_sistema: saldoInicialSistema,
    saldo_sistema: saldoSistema,
    saldo_extracto_inicial: saldoExtractoInicial,
    saldo_extracto_final: saldoExtractoFinal,
    saldo_extracto_calculado: saldoExtractoCalculado,
    diferencia,
    diferencia_explicada: diferenciaExplicada,
    diferencia_no_explicada: diferenciaNoExplicada,
    monto_pendiente: montoPendiente,
    monto_ignorado: montoIgnorado,
    monto_sistema_sin_conciliar: montoSistemaSinConciliar,
    movimientos_sistema: movimientos.length,
    movimientos_sin_conciliar: movimientosSinConciliar.length,
    lineas_total: lineas.length,
    lineas_conciliadas: conciliadas.length,
    lineas_ignoradas: ignoradas.length,
    lineas_pendientes: pendientes.length,
    pct_conciliado: lineas.length ? roundMoney((resueltas / lineas.length) * 100) : 0,
    extracto_cuadra: extractoCuadra,
    lineas_resueltas: lineasResueltas,
    puede_cerrar:
      header.estado === "abierta" && lineasResueltas && extractoCuadra,
  };

  return {
    id: Number(header.id),
    account_id: Number(header.account_id),
    cuenta: String(header.cuenta),
    cuenta_tipo: String(header.cuenta_tipo),
    nombre: String(header.nombre),
    fecha_inicio: String(header.fecha_inicio),
    fecha_fin: String(header.fecha_fin),
    saldo_extracto_inicial: saldoExtractoInicial,
    saldo_extracto_final: saldoExtractoFinal,
    estado: header.estado as "abierta" | "cerrada",
    snapshot: parseSnapshot(header.snapshot),
    cerrada_at: header.cerrada_at ?? null,
    reabierta_at: header.reabierta_at ?? null,
    motivo_reapertura: header.motivo_reapertura ?? null,
    cerrada_por: header.cerrada_por ?? null,
    reabierta_por: header.reabierta_por ?? null,
    creador: String(header.creador),
    created_at: header.created_at ?? null,
    lineas,
    movimientos,
    resumen,
  };
}

export async function listReconciliations(query: ListReconciliationsQuery) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.account_id) {
    where.push("r.account_id = ?");
    params.push(query.account_id);
  }
  if (query.estado) {
    where.push("r.estado = ?");
    params.push(query.estado);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.account_id, a.nombre AS cuenta, a.tipo AS cuenta_tipo,
            r.nombre, r.fecha_inicio, r.fecha_fin,
            r.saldo_extracto_inicial, r.saldo_extracto_final, r.estado,
            r.cerrada_at, r.reabierta_at, r.motivo_reapertura, r.created_at,
            uc.nombre AS creador, ucl.nombre AS cerrada_por, ur.nombre AS reabierta_por,
            COALESCE(l.total, 0) AS total_lineas,
            COALESCE(l.conciliadas, 0) AS conciliadas,
            COALESCE(l.ignoradas, 0) AS ignoradas,
            COALESCE(l.pendientes, 0) AS pendientes
     FROM bank_reconciliations r
     JOIN finance_accounts a ON a.id = r.account_id
     JOIN users uc ON uc.id = r.created_by
     LEFT JOIN users ucl ON ucl.id = r.cerrada_by
     LEFT JOIN users ur ON ur.id = r.reabierta_by
     LEFT JOIN (
       SELECT reconciliation_id,
              COUNT(*) AS total,
              SUM(estado = 'conciliada') AS conciliadas,
              SUM(estado = 'ignorada') AS ignoradas,
              SUM(estado = 'pendiente') AS pendientes
       FROM bank_statement_lines
       GROUP BY reconciliation_id
     ) l ON l.reconciliation_id = r.id
     ${clause}
     ORDER BY r.fecha_fin DESC, r.id DESC`,
    params
  );

  return rows.map((r) => {
    const total = Number(r.total_lineas);
    const conciliadas = Number(r.conciliadas);
    const ignoradas = Number(r.ignoradas);
    return {
      id: Number(r.id),
      account_id: Number(r.account_id),
      cuenta: String(r.cuenta),
      cuenta_tipo: String(r.cuenta_tipo),
      nombre: String(r.nombre),
      fecha_inicio: String(r.fecha_inicio),
      fecha_fin: String(r.fecha_fin),
      saldo_extracto_inicial: roundMoney(Number(r.saldo_extracto_inicial)),
      saldo_extracto_final: roundMoney(Number(r.saldo_extracto_final)),
      estado: r.estado as "abierta" | "cerrada",
      total_lineas: total,
      conciliadas,
      ignoradas,
      pendientes: Number(r.pendientes),
      pct_conciliado: total
        ? roundMoney(((conciliadas + ignoradas) / total) * 100)
        : 0,
      cerrada_at: r.cerrada_at ?? null,
      reabierta_at: r.reabierta_at ?? null,
      motivo_reapertura: r.motivo_reapertura ?? null,
      cerrada_por: r.cerrada_por ?? null,
      reabierta_por: r.reabierta_por ?? null,
      creador: String(r.creador),
      created_at: r.created_at ?? null,
    };
  });
}

export async function getReconciliation(id: number) {
  return computeDetail(pool, id);
}

export async function createReconciliation(
  input: CreateReconciliationInput,
  actor: AuthUser
) {
  return withTransaction(async (conn) => {
    await assertAccount(conn, input.account_id);
    await assertNoOverlap(conn, input.account_id, input.fecha_inicio, input.fecha_fin);

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO bank_reconciliations
         (account_id, nombre, fecha_inicio, fecha_fin, saldo_extracto_inicial,
          saldo_extracto_final, estado, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'abierta', ?)`,
      [
        input.account_id,
        input.nombre,
        input.fecha_inicio,
        input.fecha_fin,
        input.saldo_extracto_inicial,
        input.saldo_extracto_final,
        actor.id,
      ]
    );

    for (const linea of input.lineas) {
      await conn.query(
        `INSERT INTO bank_statement_lines
           (reconciliation_id, fecha, descripcion, referencia, monto, estado, created_by)
         VALUES (?, ?, ?, ?, ?, 'pendiente', ?)`,
        [
          res.insertId,
          linea.fecha,
          linea.descripcion,
          linea.referencia ?? null,
          linea.monto,
          actor.id,
        ]
      );
    }

    await auditFinance(
      conn,
      actor.id,
      "bank_reconciliation",
      res.insertId,
      "crear",
      null,
      {
        account_id: input.account_id,
        nombre: input.nombre,
        fecha_inicio: input.fecha_inicio,
        fecha_fin: input.fecha_fin,
        saldo_extracto_inicial: input.saldo_extracto_inicial,
        saldo_extracto_final: input.saldo_extracto_final,
        lineas: input.lineas.length,
      }
    );

    return { id: res.insertId, estado: "abierta" };
  });
}

export async function updateReconciliation(
  id: number,
  input: UpdateReconciliationInput,
  actor: AuthUser
) {
  return withTransaction(async (conn) => {
    const current = await loadOpenReconciliation(conn, id);

    const [outside] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM bank_statement_lines
       WHERE reconciliation_id = ? AND (fecha < ? OR fecha > ?)`,
      [id, input.fecha_inicio, input.fecha_fin]
    );
    if (Number(outside[0].total) > 0) {
      throw new HttpError(
        409,
        "Hay líneas del extracto fuera del nuevo rango. Ajusta las fechas o corrige las líneas."
      );
    }

    await assertNoOverlap(
      conn,
      current.account_id,
      input.fecha_inicio,
      input.fecha_fin,
      id
    );

    await conn.query(
      `UPDATE bank_reconciliations
       SET nombre = ?, fecha_inicio = ?, fecha_fin = ?,
           saldo_extracto_inicial = ?, saldo_extracto_final = ?
       WHERE id = ?`,
      [
        input.nombre,
        input.fecha_inicio,
        input.fecha_fin,
        input.saldo_extracto_inicial,
        input.saldo_extracto_final,
        id,
      ]
    );

    await auditFinance(
      conn,
      actor.id,
      "bank_reconciliation",
      id,
      "actualizar",
      {
        nombre: current.nombre,
        fecha_inicio: current.fecha_inicio,
        fecha_fin: current.fecha_fin,
        saldo_extracto_inicial: Number(current.saldo_extracto_inicial),
        saldo_extracto_final: Number(current.saldo_extracto_final),
      },
      input
    );

    return { id, estado: current.estado };
  });
}

export async function addStatementLine(
  id: number,
  input: StatementLineInput,
  actor: AuthUser
) {
  return withTransaction(async (conn) => {
    const reconciliation = await loadOpenReconciliation(conn, id);
    if (input.fecha < reconciliation.fecha_inicio || input.fecha > reconciliation.fecha_fin) {
      throw new HttpError(400, "La fecha de la línea debe estar dentro del rango de la conciliación");
    }

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO bank_statement_lines
         (reconciliation_id, fecha, descripcion, referencia, monto, estado, nota, created_by)
       VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
      [
        id,
        input.fecha,
        input.descripcion,
        input.referencia ?? null,
        input.monto,
        input.nota ?? null,
        actor.id,
      ]
    );

    await auditFinance(conn, actor.id, "bank_reconciliation", id, "linea_agregar", null, {
      id: res.insertId,
      ...input,
    });

    return { id: res.insertId };
  });
}

export async function updateStatementLine(
  id: number,
  lineId: number,
  input: StatementLineInput,
  actor: AuthUser
) {
  return withTransaction(async (conn) => {
    const reconciliation = await loadOpenReconciliation(conn, id);
    if (input.fecha < reconciliation.fecha_inicio || input.fecha > reconciliation.fecha_fin) {
      throw new HttpError(400, "La fecha de la línea debe estar dentro del rango de la conciliación");
    }

    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM bank_statement_lines WHERE id = ? AND reconciliation_id = ? FOR UPDATE",
      [lineId, id]
    );
    const line = rows[0];
    if (!line) throw new HttpError(404, "Línea del extracto no encontrada");
    if (line.estado === "conciliada") {
      throw new HttpError(409, "Desconcilia la línea antes de editarla");
    }

    await conn.query(
      `UPDATE bank_statement_lines
       SET fecha = ?, descripcion = ?, referencia = ?, monto = ?, nota = ?
       WHERE id = ?`,
      [
        input.fecha,
        input.descripcion,
        input.referencia ?? null,
        input.monto,
        input.nota ?? line.nota ?? null,
        lineId,
      ]
    );

    await auditFinance(conn, actor.id, "bank_reconciliation", id, "actualizar", line, {
      id: lineId,
      ...input,
    });

    return { id: lineId };
  });
}

export async function deleteStatementLine(id: number, lineId: number, actor: AuthUser) {
  return withTransaction(async (conn) => {
    await loadOpenReconciliation(conn, id);
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM bank_statement_lines WHERE id = ? AND reconciliation_id = ? FOR UPDATE",
      [lineId, id]
    );
    const line = rows[0];
    if (!line) throw new HttpError(404, "Línea del extracto no encontrada");
    if (line.estado === "conciliada") {
      throw new HttpError(409, "Desconcilia la línea antes de eliminarla");
    }

    await conn.query("DELETE FROM bank_statement_lines WHERE id = ?", [lineId]);
    await auditFinance(conn, actor.id, "bank_reconciliation", id, "linea_eliminar", line, null);

    return { id: lineId };
  });
}

export async function listSuggestions(id: number, dias: number) {
  const [headers] = await pool.query<RowDataPacket[]>(
    "SELECT id, account_id, fecha_inicio, fecha_fin FROM bank_reconciliations WHERE id = ?",
    [id]
  );
  const reconciliation = headers[0];
  if (!reconciliation) throw new HttpError(404, "Conciliación no encontrada");

  const [pending] = await pool.query<RowDataPacket[]>(
    `SELECT id, fecha, descripcion, monto
     FROM bank_statement_lines
     WHERE reconciliation_id = ? AND estado = 'pendiente'
     ORDER BY fecha, id`,
    [id]
  );

  if (pending.length === 0) return [];

  const [candidates] = await pool.query<RowDataPacket[]>(
    `SELECT l.id AS line_id, t.id AS transaction_id, t.fecha, t.tipo, t.monto,
            ${SIGNED_AMOUNT} AS monto_firmado, fc.nombre AS categoria,
            t.descripcion, t.invoice_id, i.numero AS factura,
            ABS(DATEDIFF(t.fecha, l.fecha)) AS diferencia_dias
     FROM bank_statement_lines l
     JOIN bank_reconciliations r ON r.id = l.reconciliation_id
     JOIN transactions t ON t.account_id = r.account_id
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     LEFT JOIN invoices i ON i.id = t.invoice_id
     WHERE l.reconciliation_id = ? AND l.estado = 'pendiente'
       AND t.fecha BETWEEN ? AND ?
       AND COALESCE(t.afecta_caja, fc.afecta_caja) = 1
       AND ${SIGNED_AMOUNT} = l.monto
       AND ${VALID_TRANSACTION}
       AND ABS(DATEDIFF(t.fecha, l.fecha)) <= ?
       AND NOT EXISTS (
         SELECT 1 FROM bank_statement_lines m
         WHERE m.transaction_id = t.id AND m.estado = 'conciliada'
       )
     ORDER BY l.id, diferencia_dias, t.fecha DESC, t.id DESC`,
    [
      id,
      addDays(String(reconciliation.fecha_inicio), -31),
      addDays(String(reconciliation.fecha_fin), 31),
      dias,
    ]
  );

  const byLine = new Map<number, RowDataPacket[]>();
  for (const row of candidates) {
    const lineId = Number(row.line_id);
    const list = byLine.get(lineId) ?? [];
    list.push(row);
    byLine.set(lineId, list);
  }

  return pending.map((line) => ({
    linea_id: Number(line.id),
    fecha: String(line.fecha),
    descripcion: String(line.descripcion),
    monto: roundMoney(Number(line.monto)),
    candidatos: (byLine.get(Number(line.id)) ?? []).map((c) => ({
      transaction_id: Number(c.transaction_id),
      fecha: String(c.fecha),
      tipo: c.tipo,
      monto: roundMoney(Number(c.monto)),
      monto_firmado: roundMoney(Number(c.monto_firmado)),
      categoria: String(c.categoria),
      descripcion: c.descripcion ?? null,
      invoice_id: c.invoice_id === null ? null : Number(c.invoice_id),
      factura: c.factura ?? null,
      diferencia_dias: Number(c.diferencia_dias),
    })),
  }));
}

export async function matchStatementLine(
  id: number,
  lineId: number,
  transactionId: number,
  actor: AuthUser
) {
  return withTransaction(async (conn) => {
    const reconciliation = await loadOpenReconciliation(conn, id);

    const [lineRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM bank_statement_lines WHERE id = ? AND reconciliation_id = ? FOR UPDATE",
      [lineId, id]
    );
    const line = lineRows[0];
    if (!line) throw new HttpError(404, "Línea del extracto no encontrada");
    if (line.estado !== "pendiente") {
      throw new HttpError(409, "Solo se pueden conciliar líneas pendientes");
    }

    const [txRows] = await conn.query<RowDataPacket[]>(
      `SELECT t.*, fc.afecta_caja AS categoria_afecta_caja
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       WHERE t.id = ? FOR UPDATE`,
      [transactionId]
    );
    const transaction = txRows[0];
    if (!transaction) throw new HttpError(404, "Transacción no encontrada");
    if (Number(transaction.account_id) !== Number(reconciliation.account_id)) {
      throw new HttpError(400, "La transacción pertenece a otra cuenta financiera");
    }
    if (transaction.anulada_de !== null) {
      throw new HttpError(400, "Una anulación no se puede conciliar");
    }
    const [reversals] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM transactions WHERE anulada_de = ? LIMIT 1",
      [transactionId]
    );
    if (reversals[0]) {
      throw new HttpError(400, "La transacción está anulada y no se puede conciliar");
    }
    if (
      Number(transaction.afecta_caja ?? transaction.categoria_afecta_caja) !== 1
    ) {
      throw new HttpError(400, "La transacción no afecta caja; no es un movimiento bancario");
    }

    const sign =
      transaction.tipo === "ingreso" || transaction.tipo === "pasivo" ? 1 : -1;
    const signed = roundMoney(Number(transaction.monto) * sign);
    if (Math.abs(signed - Number(line.monto)) > 0.005) {
      throw new HttpError(
        400,
        `El monto no coincide: el extracto tiene ${line.monto} y el sistema ${signed}`
      );
    }

    const txFecha = String(transaction.fecha);
    if (
      txFecha < addDays(String(reconciliation.fecha_inicio), -31) ||
      txFecha > addDays(String(reconciliation.fecha_fin), 31)
    ) {
      throw new HttpError(
        400,
        "La fecha de la transacción está demasiado lejos del periodo de la conciliación"
      );
    }

    const [matched] = await conn.query<RowDataPacket[]>(
      `SELECT l.id, r.nombre
       FROM bank_statement_lines l
       JOIN bank_reconciliations r ON r.id = l.reconciliation_id
       WHERE l.transaction_id = ? AND l.estado = 'conciliada' AND l.id <> ?
       LIMIT 1`,
      [transactionId, lineId]
    );
    if (matched[0]) {
      throw new HttpError(
        409,
        `La transacción ya está conciliada en "${matched[0].nombre}"`
      );
    }

    await conn.query(
      `UPDATE bank_statement_lines
       SET estado = 'conciliada', transaction_id = ?, conciliada_by = ?,
           conciliada_at = NOW(), nota = NULL
       WHERE id = ?`,
      [transactionId, actor.id, lineId]
    );

    await auditFinance(
      conn,
      actor.id,
      "bank_reconciliation",
      id,
      "conciliar",
      { linea_id: lineId, estado: line.estado },
      { linea_id: lineId, estado: "conciliada", transaction_id: transactionId }
    );

    return { id: lineId, estado: "conciliada", transaction_id: transactionId };
  });
}

export async function unmatchStatementLine(id: number, lineId: number, actor: AuthUser) {
  return withTransaction(async (conn) => {
    await loadOpenReconciliation(conn, id);
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM bank_statement_lines WHERE id = ? AND reconciliation_id = ? FOR UPDATE",
      [lineId, id]
    );
    const line = rows[0];
    if (!line) throw new HttpError(404, "Línea del extracto no encontrada");
    if (line.estado !== "conciliada") {
      throw new HttpError(409, "La línea no está conciliada");
    }

    await conn.query(
      `UPDATE bank_statement_lines
       SET estado = 'pendiente', transaction_id = NULL, conciliada_by = NULL,
           conciliada_at = NULL
       WHERE id = ?`,
      [lineId]
    );

    await auditFinance(conn, actor.id, "bank_reconciliation", id, "desconciliar", line, {
      linea_id: lineId,
      estado: "pendiente",
    });

    return { id: lineId, estado: "pendiente" };
  });
}

export async function ignoreStatementLine(
  id: number,
  lineId: number,
  nota: string,
  actor: AuthUser
) {
  return withTransaction(async (conn) => {
    await loadOpenReconciliation(conn, id);
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM bank_statement_lines WHERE id = ? AND reconciliation_id = ? FOR UPDATE",
      [lineId, id]
    );
    const line = rows[0];
    if (!line) throw new HttpError(404, "Línea del extracto no encontrada");
    if (line.estado !== "pendiente") {
      throw new HttpError(409, "Solo se pueden ignorar líneas pendientes");
    }

    await conn.query(
      `UPDATE bank_statement_lines
       SET estado = 'ignorada', transaction_id = NULL, nota = ?,
           conciliada_by = ?, conciliada_at = NOW()
       WHERE id = ?`,
      [nota, actor.id, lineId]
    );

    await auditFinance(conn, actor.id, "bank_reconciliation", id, "ignorar", line, {
      linea_id: lineId,
      estado: "ignorada",
      nota,
    });

    return { id: lineId, estado: "ignorada" };
  });
}

export async function closeReconciliation(id: number, actor: AuthUser) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM bank_reconciliations WHERE id = ? FOR UPDATE",
      [id]
    );
    const reconciliation = rows[0];
    if (!reconciliation) throw new HttpError(404, "Conciliación no encontrada");
    if (reconciliation.estado === "cerrada") {
      throw new HttpError(409, "La conciliación ya está cerrada");
    }

    const detail = await computeDetail(conn, id);
    if (!detail.resumen.extracto_cuadra) {
      throw new HttpError(
        409,
        "El saldo final del extracto no coincide con el saldo inicial más sus líneas"
      );
    }
    if (detail.resumen.lineas_pendientes > 0) {
      throw new HttpError(
        409,
        `Quedan ${detail.resumen.lineas_pendientes} líneas del extracto sin conciliar o ignorar`
      );
    }

    const snapshot = {
      generado_at: new Date().toISOString(),
      resumen: detail.resumen,
      lineas: detail.lineas.length,
    };

    await conn.query(
      `UPDATE bank_reconciliations
       SET estado = 'cerrada', snapshot = ?, cerrada_by = ?, cerrada_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(snapshot), actor.id, id]
    );

    await auditFinance(
      conn,
      actor.id,
      "bank_reconciliation",
      id,
      "cerrar",
      { estado: "abierta" },
      { estado: "cerrada", snapshot }
    );

    return { id, estado: "cerrada", snapshot };
  });
}

export async function reopenReconciliation(
  id: number,
  motivo: string,
  actor: AuthUser
) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM bank_reconciliations WHERE id = ? FOR UPDATE",
      [id]
    );
    const reconciliation = rows[0];
    if (!reconciliation) throw new HttpError(404, "Conciliación no encontrada");
    if (reconciliation.estado === "abierta") {
      throw new HttpError(409, "La conciliación ya está abierta");
    }

    await conn.query(
      `UPDATE bank_reconciliations
       SET estado = 'abierta', reabierta_by = ?, reabierta_at = NOW(),
           motivo_reapertura = ?
       WHERE id = ?`,
      [actor.id, motivo, id]
    );

    await auditFinance(
      conn,
      actor.id,
      "bank_reconciliation",
      id,
      "reabrir",
      { estado: "cerrada" },
      { estado: "abierta", motivo }
    );

    return { id, estado: "abierta" };
  });
}
