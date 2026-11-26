import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { HttpError } from "../../utils/http-error.js";
import { auditFinance, roundMoney } from "../finance/finance.shared.js";
import {
  attachmentSchema,
  approvalDecisionSchema,
  purchaseSettingsSchema,
} from "./purchase-prices.schema.js";
import {
  CODIGOS_COMPRA,
  precioNetoLinea,
  supplierKey,
  superaUmbral,
  variacionPct,
  type BloqueoCompra,
  type LineaVariacion,
} from "./purchase-prices.shared.js";
import {
  decodificarBase64,
  detectarTipoAdjunto,
  extraerTotalXml,
  mimeAdjunto,
  totalesCuadran,
} from "./purchase-prices.validation.js";

type SettingsInput = z.infer<typeof purchaseSettingsSchema>;
type AttachmentInput = z.infer<typeof attachmentSchema>;
type DecisionInput = z.infer<typeof approvalDecisionSchema>;

const num = (valor: unknown) => Number(valor ?? 0);

export interface ResultadoValidacionCompra {
  tipo: string;
  estado: string;
  proveedor_key: string | null;
  bloqueos: BloqueoCompra[];
  lineas: LineaVariacion[];
  requiere_aprobacion: boolean;
  aprobacion: { id: number; estado: string } | null;
  umbral_pct: number;
  tiene_adjunto: boolean;
  total_xml: number | null;
  settingsId: number;
}

function filaSettings(fila: RowDataPacket) {
  return {
    id: Number(fila.id),
    umbral_pct: num(fila.umbral_pct),
    requiere_adjunto: Boolean(fila.requiere_adjunto),
    updated_by: fila.updated_by === null ? null : Number(fila.updated_by),
    updated_at: String(fila.updated_at),
  };
}

async function leerSettings(conn: PoolConnection) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, umbral_pct, requiere_adjunto, updated_by, updated_at FROM purchase_price_settings WHERE id = 1"
  );
  return filaSettings(rows[0]);
}

export async function getSettings() {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, umbral_pct, requiere_adjunto, updated_by, updated_at FROM purchase_price_settings WHERE id = 1"
  );
  return filaSettings(rows[0]);
}

export async function updateSettings(input: SettingsInput, actor: AuthUser) {
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE purchase_price_settings
     SET umbral_pct = ?, requiere_adjunto = ?, updated_by = ?
     WHERE id = 1`,
    [input.umbral_pct, input.requiere_adjunto ? 1 : 0, actor.id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "No existe la configuración de precios");
  const actualizado = await getSettings();
  const conn = await pool.getConnection();
  try {
    await auditFinance(
      conn,
      actor.id,
      "company_settings",
      1,
      "actualizar_precios",
      null,
      { umbral_pct: actualizado.umbral_pct, requiere_adjunto: actualizado.requiere_adjunto }
    );
  } finally {
    conn.release();
  }
  return actualizado;
}

export async function listLastPrices(query: {
  product_id?: number;
  supplier_key?: string;
}) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.product_id) { where.push("psp.product_id = ?"); params.push(query.product_id); }
  if (query.supplier_key) { where.push("psp.supplier_key = ?"); params.push(query.supplier_key); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT psp.product_id, p.sku, p.nombre AS producto, psp.supplier_key,
            psp.precio_unitario, psp.invoice_id, psp.confirmed_at
     FROM product_supplier_prices psp
     JOIN products p ON p.id = psp.product_id
     ${clause}
     ORDER BY psp.confirmed_at DESC, psp.product_id, psp.supplier_key`,
    params
  );
  return rows.map((r) => ({
    product_id: Number(r.product_id),
    sku: r.sku,
    producto: r.producto,
    supplier_key: r.supplier_key,
    precio_unitario: num(r.precio_unitario),
    invoice_id: r.invoice_id === null ? null : Number(r.invoice_id),
    confirmed_at: r.confirmed_at,
  }));
}

export async function listPriceHistory(query: {
  product_id?: number;
  supplier_key?: string;
  limite: number;
}) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.product_id) { where.push("h.product_id = ?"); params.push(query.product_id); }
  if (query.supplier_key) { where.push("h.supplier_key = ?"); params.push(query.supplier_key); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT h.id, h.product_id, h.supplier_key, h.precio_unitario, h.precio_anterior,
            h.variacion_pct, h.invoice_id, h.origen, h.created_at, h.created_by,
            p.sku, p.nombre AS producto
     FROM product_supplier_price_history h
     JOIN products p ON p.id = h.product_id
     ${clause}
     ORDER BY h.id DESC LIMIT ?`,
    [...params, query.limite]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    product_id: Number(r.product_id),
    sku: r.sku,
    producto: r.producto,
    supplier_key: r.supplier_key,
    precio_unitario: num(r.precio_unitario),
    precio_anterior: r.precio_anterior === null ? null : num(r.precio_anterior),
    variacion_pct: r.variacion_pct === null ? null : num(r.variacion_pct),
    invoice_id: r.invoice_id === null ? null : Number(r.invoice_id),
    origen: r.origen,
    created_at: r.created_at,
    created_by: r.created_by === null ? null : Number(r.created_by),
  }));
}

function filaAdjunto(r: RowDataPacket) {
  return {
    id: Number(r.id),
    nombre: String(r.nombre),
    mime: String(r.mime),
    tamano_bytes: Number(r.tamano_bytes),
    created_at: String(r.created_at),
  };
}

export async function listAttachments(invoiceId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, nombre, mime, tamano_bytes, created_at
     FROM purchase_invoice_attachments WHERE invoice_id = ? ORDER BY id`,
    [invoiceId]
  );
  // Nunca se devuelve el contenido: el adjunto se descarga por su identificador.
  return rows.map(filaAdjunto);
}

async function assertBorrador(conn: PoolConnection, invoiceId: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, estado FROM invoices WHERE id = ? FOR UPDATE",
    [invoiceId]
  );
  if (!rows[0]) throw new HttpError(404, "Factura no encontrada");
  if (rows[0].estado !== "borrador") {
    throw new HttpError(409, "Solo se pueden gestionar adjuntos de facturas en borrador");
  }
}

export async function addAttachment(invoiceId: number, input: AttachmentInput, actor: AuthUser) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await assertBorrador(conn, invoiceId);

    let bytes: Buffer;
    try {
      bytes = decodificarBase64(input.contenido_base64);
    } catch (err) {
      throw new HttpError(400, (err as Error).message, { code: CODIGOS_COMPRA.ADJUNTO_INVALIDO });
    }
    const tipo = detectarTipoAdjunto(bytes);
    if (!tipo) {
      throw new HttpError(400, "El adjunto debe ser un PDF o un XML válido", {
        code: CODIGOS_COMPRA.ADJUNTO_INVALIDO,
      });
    }
    const mime = mimeAdjunto(tipo);
    if (input.mime && input.mime !== mime) {
      throw new HttpError(400, "El tipo MIME no coincide con el contenido del adjunto", {
        code: CODIGOS_COMPRA.ADJUNTO_INVALIDO,
      });
    }

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO purchase_invoice_attachments
         (invoice_id, nombre, mime, tamano_bytes, contenido_base64, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoiceId, input.nombre, mime, bytes.length, bytes.toString("base64"), actor.id]
    );
    const adjunto = {
      id: Number(res.insertId),
      nombre: input.nombre,
      mime,
      tamano_bytes: bytes.length,
      created_at: new Date().toISOString(),
    };
    // La auditoría guarda solo metadatos: nunca el base64 del documento.
    await auditFinance(conn, actor.id, "invoice", invoiceId, "adjunto_alta", null, adjunto);
    await conn.commit();
    return adjunto;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function removeAttachment(invoiceId: number, attachmentId: number, actor: AuthUser) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await assertBorrador(conn, invoiceId);
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, nombre, mime, tamano_bytes FROM purchase_invoice_attachments
       WHERE id = ? AND invoice_id = ?`,
      [attachmentId, invoiceId]
    );
    if (!rows[0]) throw new HttpError(404, "Adjunto no encontrado");
    await conn.query("DELETE FROM purchase_invoice_attachments WHERE id = ?", [attachmentId]);
    const antes = {
      id: Number(rows[0].id),
      nombre: String(rows[0].nombre),
      mime: String(rows[0].mime),
      tamano_bytes: Number(rows[0].tamano_bytes),
    };
    await auditFinance(conn, actor.id, "invoice", invoiceId, "adjunto_baja", antes, null);
    await conn.commit();
    return { id: attachmentId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function filaAprobacion(r: RowDataPacket) {
  return {
    id: Number(r.id),
    invoice_id: Number(r.invoice_id),
    estado: String(r.estado),
    motivo: r.motivo === null ? null : String(r.motivo),
    solicitada_por: Number(r.solicitada_por),
    revisada_por: r.revisada_por === null ? null : Number(r.revisada_por),
    revisada_at: r.revisada_at === null ? null : String(r.revisada_at),
    created_at: String(r.created_at),
  };
}

export async function requestApproval(invoiceId: number, actor: AuthUser) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT estado FROM invoices WHERE id = ? FOR UPDATE",
      [invoiceId]
    );
    if (!rows[0]) throw new HttpError(404, "Factura no encontrada");
    if (rows[0].estado !== "borrador") {
      throw new HttpError(409, "Solo se solicita aprobación para facturas en borrador");
    }
    const [existentes] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM purchase_price_approvals
       WHERE invoice_id = ? AND estado = 'pendiente' ORDER BY id DESC LIMIT 1`,
      [invoiceId]
    );
    if (existentes[0]) {
      await conn.commit();
      return filaAprobacion(existentes[0]);
    }
    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO purchase_price_approvals (invoice_id, estado, solicitada_por)
       VALUES (?, 'pendiente', ?)`,
      [invoiceId, actor.id]
    );
    const aprobacion = filaAprobacion({
      id: res.insertId,
      invoice_id: invoiceId,
      estado: "pendiente",
      motivo: null,
      solicitada_por: actor.id,
      revisada_por: null,
      revisada_at: null,
      created_at: new Date().toISOString(),
    } as RowDataPacket);
    await auditFinance(conn, actor.id, "invoice", invoiceId, "solicitar_aprobacion", null, {
      id: aprobacion.id,
      estado: "pendiente",
    });
    await conn.commit();
    return aprobacion;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getApproval(invoiceId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM purchase_price_approvals WHERE invoice_id = ? ORDER BY id DESC LIMIT 1`,
    [invoiceId]
  );
  return rows[0] ? filaAprobacion(rows[0]) : null;
}

export async function decideApproval(
  approvalId: number,
  input: DecisionInput,
  actor: AuthUser,
  aprobar: boolean
) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT pa.*, i.estado AS invoice_estado
       FROM purchase_price_approvals pa
       JOIN invoices i ON i.id = pa.invoice_id
       WHERE pa.id = ? FOR UPDATE`,
      [approvalId]
    );
    const actual = rows[0];
    if (!actual) throw new HttpError(404, "Solicitud de aprobación no encontrada");
    if (actual.estado !== "pendiente") {
      throw new HttpError(409, "La solicitud ya fue resuelta");
    }
    if (actual.invoice_estado !== "borrador") {
      throw new HttpError(409, "La factura ya no está en borrador");
    }
    const estado = aprobar ? "aprobada" : "rechazada";
    await conn.query(
      `UPDATE purchase_price_approvals
       SET estado = ?, motivo = ?, revisada_por = ?, revisada_at = NOW()
       WHERE id = ?`,
      [estado, input.motivo ?? null, actor.id, approvalId]
    );
    await auditFinance(
      conn,
      actor.id,
      "invoice",
      Number(actual.invoice_id),
      aprobar ? "aprobar_precios" : "rechazar_aprobacion",
      { estado: "pendiente" },
      { id: approvalId, estado, motivo: input.motivo ?? null }
    );
    await conn.commit();
    return {
      id: approvalId,
      invoice_id: Number(actual.invoice_id),
      estado,
      motivo: input.motivo ?? null,
      solicitada_por: Number(actual.solicitada_por),
      revisada_por: actor.id,
      revisada_at: new Date().toISOString(),
      created_at: String(actual.created_at),
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Una edición del borrador deja sin efecto cualquier aprobación anterior. */
export async function invalidarAprobaciones(
  conn: PoolConnection,
  invoiceId: number,
  actorId: number
) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id, estado FROM purchase_price_approvals
     WHERE invoice_id = ? AND estado IN ('pendiente', 'aprobada')`,
    [invoiceId]
  );
  if (rows.length === 0) return;
  await conn.query(
    `UPDATE purchase_price_approvals SET estado = 'invalida', revisada_at = NOW()
     WHERE invoice_id = ? AND estado IN ('pendiente', 'aprobada')`,
    [invoiceId]
  );
  await auditFinance(
    conn,
    actorId,
    "invoice",
    invoiceId,
    "invalidar_aprobacion",
    rows.map((r) => ({ id: Number(r.id), estado: String(r.estado) })),
    { estado: "invalida" }
  );
}

/** Validación completa de una compra antes de mover stock o contabilizar. */
export async function validarCompraParaConfirmar(
  conn: PoolConnection,
  inv: RowDataPacket,
  items: RowDataPacket[]
): Promise<ResultadoValidacionCompra> {
  const settings = await leerSettings(conn);
  const bloqueos: BloqueoCompra[] = [];
  const proveedor_key = supplierKey({ contraparte: inv.contraparte, documento: inv.documento });
  const aprobacionFila = await conn.query<RowDataPacket[]>(
    `SELECT id, estado FROM purchase_price_approvals
     WHERE invoice_id = ? ORDER BY id DESC LIMIT 1`,
    [inv.id]
  );
  const fila = aprobacionFila[0][0];
  const aprobacion = fila ? { id: Number(fila.id), estado: String(fila.estado) } : null;

  const resultado: ResultadoValidacionCompra = {
    tipo: String(inv.tipo),
    estado: String(inv.estado),
    proveedor_key,
    bloqueos,
    lineas: [],
    requiere_aprobacion: false,
    aprobacion,
    umbral_pct: settings.umbral_pct,
    tiene_adjunto: false,
    total_xml: null,
    settingsId: settings.id,
  };
  if (inv.tipo !== "compra") return resultado;

  // 1. Proveedor identificable y no duplicado en el índice de compras.
  if (!proveedor_key) {
    bloqueos.push({
      codigo: CODIGOS_COMPRA.PROVEEDOR_NO_IDENTIFICABLE,
      mensaje: "La factura de compra necesita un proveedor identificable",
    });
  } else {
    const [duplicados] = await conn.query<RowDataPacket[]>(
      `SELECT invoice_id FROM purchase_invoice_index
       WHERE supplier_key = ? AND prefijo = ? AND numero = ? LIMIT 1`,
      [proveedor_key, inv.prefijo ?? "COM", inv.numero]
    );
    if (duplicados[0] && Number(duplicados[0].invoice_id) !== Number(inv.id)) {
      bloqueos.push({
        codigo: CODIGOS_COMPRA.FACTURA_DUPLICADA,
        mensaje: "Ya existe una compra registrada para este proveedor, prefijo y número",
        detalles: { invoice_id: Number(duplicados[0].invoice_id) },
      });
    }
  }

  // 2. La cabecera debe coincidir con las líneas (tolerancia de un centavo).
  const { cuadran, diferencias } = totalesCuadran(inv, items);
  if (!cuadran) {
    bloqueos.push({
      codigo: CODIGOS_COMPRA.TOTALES_NO_COINCIDEN,
      mensaje: "Los totales de la factura no coinciden con sus líneas",
      detalles: { diferencias },
    });
  }

  // 3. Adjunto obligatorio y total declarado en XML.
  const [adjuntos] = await conn.query<RowDataPacket[]>(
    `SELECT id, mime, contenido_base64 FROM purchase_invoice_attachments
     WHERE invoice_id = ? ORDER BY id`,
    [inv.id]
  );
  resultado.tiene_adjunto = adjuntos.length > 0;
  if (settings.requiere_adjunto && adjuntos.length === 0) {
    bloqueos.push({
      codigo: CODIGOS_COMPRA.ADJUNTO_REQUERIDO,
      mensaje: "La compra necesita un adjunto PDF o XML",
    });
  }
  const esperado = roundMoney(num(inv.total_neto) || num(inv.total));
  for (const adjunto of adjuntos) {
    if (!String(adjunto.mime).includes("xml")) continue;
    const total = extraerTotalXml(Buffer.from(String(adjunto.contenido_base64), "base64").toString("utf8"));
    if (total === null) continue;
    resultado.total_xml = total;
    if (Math.abs(total - esperado) > 0.01) {
      bloqueos.push({
        codigo: CODIGOS_COMPRA.TOTAL_XML_NO_COINCIDE,
        mensaje: "El total declarado en el XML no coincide con la factura",
        detalles: { total_xml: total, total_factura: esperado, adjunto_id: Number(adjunto.id) },
      });
    }
  }

  // 4. Variación neta frente al último precio del mismo proveedor.
  if (proveedor_key) {
    for (const item of items) {
      const actual = precioNetoLinea(item);
      const [ultimos] = await conn.query<RowDataPacket[]>(
        `SELECT precio_unitario FROM product_supplier_prices
         WHERE product_id = ? AND supplier_key = ?`,
        [item.product_id, proveedor_key]
      );
      const anterior = num(ultimos[0]?.precio_unitario);
      if (anterior > 0 && superaUmbral(actual, anterior, settings.umbral_pct)) {
        resultado.requiere_aprobacion = true;
        resultado.lineas.push({
          product_id: Number(item.product_id),
          precio_unitario: actual,
          precio_anterior: anterior,
          variacion_pct: variacionPct(actual, anterior),
        });
      }
    }
    if (resultado.requiere_aprobacion && aprobacion?.estado !== "aprobada") {
      bloqueos.push({
        codigo: CODIGOS_COMPRA.APROBACION_REQUERIDA,
        mensaje: "La variación de precios supera el umbral y requiere aprobación",
        detalles: { umbral_pct: settings.umbral_pct, lineas: resultado.lineas },
      });
    }
  }
  return resultado;
}

/** Convierte los bloqueos internos en una respuesta HTTP 409 con código estable. */
export function lanzarBloqueos(resultado: ResultadoValidacionCompra, actor: AuthUser) {
  if (resultado.bloqueos.length === 0) return;
  const primero = resultado.bloqueos[0];
  const detalles =
    actor.rol === "operador"
      ? { code: primero.codigo }
      : { code: primero.codigo, bloqueos: resultado.bloqueos };
  throw new HttpError(409, primero.mensaje, detalles);
}

/** Vista pública de la validación: el operador no ve precios ni variaciones. */
export function vistaValidacion(resultado: ResultadoValidacionCompra, actor: AuthUser) {
  const operador = actor.rol === "operador";
  return {
    tipo: resultado.tipo,
    estado: resultado.estado,
    puede_confirmar: resultado.bloqueos.length === 0,
    bloqueos: resultado.bloqueos.map((b) =>
      operador ? { codigo: b.codigo, mensaje: b.mensaje } : b
    ),
    ...(operador
      ? {}
      : {
          proveedor_key: resultado.proveedor_key,
          requiere_aprobacion: resultado.requiere_aprobacion,
          aprobacion: resultado.aprobacion,
          umbral_pct: resultado.umbral_pct,
          tiene_adjunto: resultado.tiene_adjunto,
          total_xml: resultado.total_xml,
          lineas: resultado.lineas,
        }),
  };
}

/** Vista previa de la validación para la interfaz; no modifica ningún dato. */
export async function validarCompraFactura(invoiceId: number, actor: AuthUser) {
  const conn = await pool.getConnection();
  try {
    const [facturas] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM invoices WHERE id = ?",
      [invoiceId]
    );
    if (!facturas[0]) throw new HttpError(404, "Factura no encontrada");
    const [items] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id",
      [invoiceId]
    );
    const resultado = await validarCompraParaConfirmar(conn, facturas[0], items);
    return vistaValidacion(resultado, actor);
  } finally {
    conn.release();
  }
}

/** Persiste el evento de precio, el índice y la auditoría dentro de la transacción. */
export async function persistirEventosCompra(
  conn: PoolConnection,
  inv: RowDataPacket,
  items: RowDataPacket[],
  resultado: ResultadoValidacionCompra,
  actor: AuthUser
) {
  const variaciones = new Map(
    resultado.lineas.map((linea) => [Number(linea.product_id), linea])
  );
  for (const item of items) {
    const precio = precioNetoLinea(item);
    const variacion = variaciones.get(Number(item.product_id));
    await conn.query(
      `INSERT INTO product_supplier_price_history
         (product_id, supplier_key, precio_unitario, precio_anterior, variacion_pct,
          invoice_id, invoice_item_id, origen, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'compra', ?)`,
      [
        item.product_id,
        resultado.proveedor_key,
        precio,
        variacion?.precio_anterior ?? null,
        variacion?.variacion_pct ?? null,
        inv.id,
        item.id,
        actor.id,
      ]
    );
    await conn.query(
      `INSERT INTO product_supplier_prices
         (product_id, supplier_key, precio_unitario, invoice_id, confirmed_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         precio_unitario = VALUES(precio_unitario),
         invoice_id = VALUES(invoice_id),
         confirmed_at = VALUES(confirmed_at)`,
      [item.product_id, resultado.proveedor_key, precio, inv.id, inv.fecha]
    );
  }
  await conn.query(
    `INSERT INTO purchase_invoice_index (invoice_id, supplier_key, prefijo, numero, total_neto)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE total_neto = VALUES(total_neto)`,
    [
      inv.id,
      resultado.proveedor_key,
      inv.prefijo ?? "COM",
      inv.numero,
      num(inv.total_neto) || num(inv.total),
    ]
  );
  await auditFinance(conn, actor.id, "invoice", Number(inv.id), "confirmar_compra", null, {
    numero: inv.numero,
    proveedor_key: resultado.proveedor_key,
    total_neto: num(inv.total_neto) || num(inv.total),
    lineas: items.length,
    aprobacion_id: resultado.aprobacion?.id ?? null,
  });
}
