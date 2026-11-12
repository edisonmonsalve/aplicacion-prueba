import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import { today } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import { auditFinance, roundMoney } from "../finance/finance.shared.js";
import { CARTERA_DERIVED } from "./invoice-payments.service.js";
import type { CarteraAlertQuery, FollowupInput } from "./invoice-payments.schema.js";

export type AlertSeveridad = "critica" | "alta" | "media" | "baja";
export type AlertRegla =
  | "mora_90"
  | "mora_31_90"
  | "mora_1_30"
  | "por_vencer_7d"
  | "sin_vencimiento";
export type FollowupEstado = "pendiente" | "recordado" | "promesa" | "escalado" | "resuelto";

const SEVERIDAD_RANK: Record<AlertSeveridad, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baja: 1,
};

type CarteraAlertRow = RowDataPacket & {
  id: number;
  tipo: "venta" | "compra";
  numero: string;
  fecha: string;
  contraparte: string;
  party_id: number | null;
  fecha_vencimiento: string | null;
  total_neto: number;
  pagado: number;
  ajuste_notas: number;
  saldo_pendiente: number;
  estado_cartera: string;
  dias_vencido: number;
  seg_estado: FollowupEstado | null;
  seg_nota: string | null;
  seg_proximo_contacto: string | null;
  seg_updated_at: Date | null;
  seg_usuario: string | null;
};

export type CarteraFollowup = {
  estado: FollowupEstado;
  nota: string | null;
  proximo_contacto: string | null;
  actualizado_at: string | null;
  usuario: string | null;
  /** La fecha de próximo contacto ya pasó y la gestión sigue abierta. */
  vencido: boolean;
};

export type CarteraAlert = {
  id: string;
  regla: AlertRegla;
  severidad: AlertSeveridad;
  tipo: "venta" | "compra";
  invoice_id: number;
  numero: string;
  contraparte: string;
  party_id: number | null;
  fecha: string;
  fecha_vencimiento: string | null;
  dias_vencido: number;
  saldo_pendiente: number;
  titulo: string;
  detalle: string;
  accion: string;
  seguimiento: CarteraFollowup | null;
};

export type CarteraAlertReport = {
  as_of: string;
  filtros: {
    tipo: "venta" | "compra";
    severidad: AlertSeveridad | null;
    incluir_resueltos: boolean;
    q: string | null;
  };
  resumen: {
    total: number;
    por_severidad: Record<AlertSeveridad, number>;
    monto_vencido: number;
    monto_por_vencer_7d: number;
    clientes_afectados: number;
    sin_gestion: number;
    gestion_vencida: number;
    promesas: number;
  };
  clientes: {
    contraparte: string;
    party_id: number | null;
    facturas: number;
    saldo: number;
    vencido: number;
    max_dias: number;
    severidad: AlertSeveridad;
    sin_gestion: number;
  }[];
  alertas: CarteraAlert[];
};

const REGLAS: Record<
  AlertRegla,
  { severidad: AlertSeveridad; accion: string }
> = {
  mora_90: {
    severidad: "critica",
    accion:
      "Escalar el cobro, negociar un acuerdo de pago por escrito y suspender nuevas ventas a crédito.",
  },
  mora_31_90: {
    severidad: "alta",
    accion: "Contactar al cliente, enviar estado de cuenta y acordar una fecha de pago.",
  },
  mora_1_30: {
    severidad: "media",
    accion: "Enviar recordatorio de pago y confirmar que el cliente recibió la factura.",
  },
  por_vencer_7d: {
    severidad: "baja",
    accion: "Enviar un recordatorio preventivo antes del vencimiento.",
  },
  sin_vencimiento: {
    severidad: "media",
    accion: "Completar la fecha de vencimiento de la factura para poder priorizar el cobro.",
  },
};

/** Clasifica una factura abierta en una alerta accionable, o null si aún no urge. */
function classify(row: CarteraAlertRow): { regla: AlertRegla; titulo: string } | null {
  const dias = Number(row.dias_vencido);
  if (!row.fecha_vencimiento) {
    return { regla: "sin_vencimiento", titulo: "Factura sin fecha de vencimiento" };
  }
  if (dias > 90) return { regla: "mora_90", titulo: `Mora crítica: ${dias} días` };
  if (dias > 30) return { regla: "mora_31_90", titulo: `Mora alta: ${dias} días` };
  if (dias > 0) return { regla: "mora_1_30", titulo: `Mora inicial: ${dias} días` };
  if (dias >= -7) {
    return {
      regla: "por_vencer_7d",
      titulo: dias === 0 ? "Vence hoy" : `Vence en ${Math.abs(dias)} día(s)`,
    };
  }
  return null;
}

function buildFollowup(row: CarteraAlertRow, asOf: string): CarteraFollowup | null {
  if (!row.seg_estado) return null;
  return {
    estado: row.seg_estado,
    nota: row.seg_nota,
    proximo_contacto: row.seg_proximo_contacto,
    actualizado_at: row.seg_updated_at ? new Date(row.seg_updated_at).toISOString() : null,
    usuario: row.seg_usuario,
    vencido:
      row.seg_estado !== "resuelto" &&
      !!row.seg_proximo_contacto &&
      row.seg_proximo_contacto < asOf,
  };
}

function buildAlert(row: CarteraAlertRow, asOf: string): CarteraAlert | null {
  const clasificacion = classify(row);
  if (!clasificacion) return null;
  const saldo = roundMoney(Number(row.saldo_pendiente));
  const dias = Number(row.dias_vencido);
  const vencimiento = row.fecha_vencimiento
    ? `Vencimiento: ${row.fecha_vencimiento}.`
    : "Sin fecha de vencimiento registrada.";
  return {
    id: `factura:${row.id}`,
    regla: clasificacion.regla,
    severidad: REGLAS[clasificacion.regla].severidad,
    tipo: row.tipo,
    invoice_id: row.id,
    numero: row.numero,
    contraparte: row.contraparte,
    party_id: row.party_id,
    fecha: row.fecha,
    fecha_vencimiento: row.fecha_vencimiento,
    dias_vencido: dias,
    saldo_pendiente: saldo,
    titulo: clasificacion.titulo,
    detalle: `${row.contraparte} · Factura ${row.numero} · Saldo ${saldo.toFixed(2)}. ${vencimiento}`,
    accion: REGLAS[clasificacion.regla].accion,
    seguimiento: buildFollowup(row, asOf),
  };
}

function isSinGestion(alert: CarteraAlert) {
  return !alert.seguimiento || alert.seguimiento.estado === "pendiente";
}

/**
 * Alertas de cartera priorizadas.
 *
 * Se calculan sobre la misma cartera derivada del aging, por lo que el saldo
 * vencido siempre coincide. La severidad depende de la mora: crítica (>90),
 * alta (31-90), media (1-30 y facturas sin vencimiento) y baja (vence en 7
 * días). El seguimiento es opcional y se conserva aparte; nunca altera la
 * factura ni la contabilidad.
 */
export async function carteraAlertas(query: CarteraAlertQuery): Promise<CarteraAlertReport> {
  const asOf = today();
  const [rows] = await pool.query<CarteraAlertRow[]>(
    `SELECT c.*,
            f.estado AS seg_estado,
            f.nota AS seg_nota,
            f.proximo_contacto AS seg_proximo_contacto,
            f.updated_at AS seg_updated_at,
            u.nombre AS seg_usuario
     FROM (${CARTERA_DERIVED}) c
     LEFT JOIN receivable_followups f ON f.invoice_id = c.id
     LEFT JOIN users u ON u.id = f.updated_by
     WHERE c.saldo_pendiente > 0 AND c.tipo = ?
     ORDER BY c.fecha_vencimiento, c.id DESC`,
    [query.tipo]
  );

  let alertas = rows
    .map((row) => buildAlert(row, asOf))
    .filter((a): a is CarteraAlert => a !== null);

  if (!query.incluir_resueltos) {
    alertas = alertas.filter((a) => a.seguimiento?.estado !== "resuelto");
  }
  if (query.q) {
    const needle = query.q.toLowerCase();
    alertas = alertas.filter(
      (a) =>
        a.numero.toLowerCase().includes(needle) ||
        a.contraparte.toLowerCase().includes(needle)
    );
  }

  const porSeveridad: Record<AlertSeveridad, number> = {
    critica: 0,
    alta: 0,
    media: 0,
    baja: 0,
  };
  let montoVencido = 0;
  let montoPorVencer = 0;
  let sinGestion = 0;
  let gestionVencida = 0;
  let promesas = 0;
  const clientesAfectados = new Set<string>();

  for (const alerta of alertas) {
    porSeveridad[alerta.severidad] += 1;
    if (alerta.dias_vencido > 0) montoVencido += alerta.saldo_pendiente;
    if (alerta.regla === "por_vencer_7d") montoPorVencer += alerta.saldo_pendiente;
    if (isSinGestion(alerta)) sinGestion += 1;
    if (alerta.seguimiento?.vencido) gestionVencida += 1;
    if (alerta.seguimiento?.estado === "promesa") promesas += 1;
    clientesAfectados.add(
      alerta.party_id !== null ? `p:${alerta.party_id}` : `n:${alerta.contraparte.toLowerCase()}`
    );
  }

  const porCliente = new Map<string, CarteraAlertReport["clientes"][number]>();
  for (const alerta of alertas) {
    const key =
      alerta.party_id !== null ? `p:${alerta.party_id}` : `n:${alerta.contraparte.toLowerCase()}`;
    const actual = porCliente.get(key);
    if (!actual) {
      porCliente.set(key, {
        contraparte: alerta.contraparte,
        party_id: alerta.party_id,
        facturas: 1,
        saldo: alerta.saldo_pendiente,
        vencido: alerta.dias_vencido > 0 ? alerta.saldo_pendiente : 0,
        max_dias: Math.max(0, alerta.dias_vencido),
        severidad: alerta.severidad,
        sin_gestion: isSinGestion(alerta) ? 1 : 0,
      });
      continue;
    }
    actual.facturas += 1;
    actual.saldo = roundMoney(actual.saldo + alerta.saldo_pendiente);
    if (alerta.dias_vencido > 0) {
      actual.vencido = roundMoney(actual.vencido + alerta.saldo_pendiente);
    }
    actual.max_dias = Math.max(actual.max_dias, alerta.dias_vencido);
    if (SEVERIDAD_RANK[alerta.severidad] > SEVERIDAD_RANK[actual.severidad]) {
      actual.severidad = alerta.severidad;
    }
    if (isSinGestion(alerta)) actual.sin_gestion += 1;
  }

  const clientes = [...porCliente.values()]
    .sort(
      (a, b) =>
        SEVERIDAD_RANK[b.severidad] - SEVERIDAD_RANK[a.severidad] ||
        b.vencido - a.vencido ||
        b.saldo - a.saldo
    )
    .slice(0, 8);

  if (query.severidad) {
    alertas = alertas.filter((a) => a.severidad === query.severidad);
  }

  alertas.sort(
    (a, b) =>
      SEVERIDAD_RANK[b.severidad] - SEVERIDAD_RANK[a.severidad] ||
      b.dias_vencido - a.dias_vencido ||
      b.saldo_pendiente - a.saldo_pendiente
  );

  return {
    as_of: asOf,
    filtros: {
      tipo: query.tipo,
      severidad: query.severidad ?? null,
      incluir_resueltos: query.incluir_resueltos,
      q: query.q ?? null,
    },
    resumen: {
      total:
        porSeveridad.critica + porSeveridad.alta + porSeveridad.media + porSeveridad.baja,
      por_severidad: porSeveridad,
      monto_vencido: roundMoney(montoVencido),
      monto_por_vencer_7d: roundMoney(montoPorVencer),
      clientes_afectados: clientesAfectados.size,
      sin_gestion: sinGestion,
      gestion_vencida: gestionVencida,
      promesas,
    },
    clientes,
    alertas,
  };
}

type InvoiceForFollowup = RowDataPacket & {
  id: number;
  numero: string;
  estado: string;
  condicion_pago: string;
  total_neto: number;
  pagado: number;
  ajuste: number;
};

/**
 * Crea o actualiza el seguimiento de una factura abierta.
 *
 * Es un registro de gestión, no un movimiento contable: no toca pagos,
 * facturas ni asientos. Cada cambio queda en `audit_log` con la entidad
 * `receivable_followup`, usando el id de la factura como entidad_id.
 */
export async function saveCarteraFollowup(
  invoiceId: number,
  input: FollowupInput,
  actor: { id: number }
) {
  return withTransaction(async (conn) => {
    const [invoiceRows] = await conn.query<InvoiceForFollowup[]>(
      `SELECT i.id, i.numero, i.estado, i.condicion_pago, i.total_neto,
              (SELECT COALESCE(SUM(monto), 0)
                 FROM invoice_payments p
                WHERE p.invoice_id = i.id AND p.estado = 'valido') AS pagado,
              (SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN -total_neto ELSE total_neto END), 0)
                 FROM invoice_adjustments a
                WHERE a.invoice_id = i.id AND a.estado = 'confirmada') AS ajuste
       FROM invoices i
       WHERE i.id = ?
       FOR UPDATE`,
      [invoiceId]
    );
    const invoice = invoiceRows[0];
    if (!invoice) throw new HttpError(404, "Factura no encontrada");
    if (invoice.estado !== "confirmada" || invoice.condicion_pago !== "credito") {
      throw new HttpError(409, "Solo se da seguimiento a facturas confirmadas a crédito");
    }
    const saldo = roundMoney(
      Number(invoice.total_neto) + Number(invoice.ajuste) - Number(invoice.pagado)
    );
    if (saldo <= 0) {
      throw new HttpError(409, "La factura ya no tiene saldo pendiente");
    }

    const [existingRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM receivable_followups WHERE invoice_id = ? FOR UPDATE",
      [invoiceId]
    );
    const existing = existingRows[0];
    const nota = input.nota?.trim() ? input.nota.trim() : null;
    const proximo = input.proximo_contacto ?? null;

    if (existing) {
      await conn.query(
        `UPDATE receivable_followups
            SET estado = ?, nota = ?, proximo_contacto = ?, updated_by = ?
          WHERE invoice_id = ?`,
        [input.estado, nota, proximo, actor.id, invoiceId]
      );
    } else {
      await conn.query<ResultSetHeader>(
        `INSERT INTO receivable_followups
           (invoice_id, estado, nota, proximo_contacto, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceId, input.estado, nota, proximo, actor.id, actor.id]
      );
    }

    const [savedRows] = await conn.query<RowDataPacket[]>(
      `SELECT f.*, u.nombre AS usuario
       FROM receivable_followups f
       JOIN users u ON u.id = f.updated_by
       WHERE f.invoice_id = ?`,
      [invoiceId]
    );
    const saved = savedRows[0];

    const antes = existing
      ? {
          estado: existing.estado,
          nota: existing.nota,
          proximo_contacto: existing.proximo_contacto,
        }
      : null;
    const despues = {
      invoice_id: invoiceId,
      numero: invoice.numero,
      estado: saved.estado,
      nota: saved.nota,
      proximo_contacto: saved.proximo_contacto,
    };
    await auditFinance(
      conn,
      actor.id,
      "receivable_followup",
      invoiceId,
      existing ? "actualizar" : "crear",
      antes,
      despues
    );

    return {
      invoice_id: invoiceId,
      estado: saved.estado as FollowupEstado,
      nota: saved.nota as string | null,
      proximo_contacto: saved.proximo_contacto as string | null,
      actualizado_at: saved.updated_at
        ? new Date(saved.updated_at as Date).toISOString()
        : null,
      usuario: saved.usuario as string,
      vencido:
        saved.estado !== "resuelto" &&
        !!saved.proximo_contacto &&
        String(saved.proximo_contacto) < today(),
    };
  });
}
