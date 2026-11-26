import type { RowDataPacket } from "mysql2/promise";
import { roundMoney } from "../finance/finance.shared.js";
import { totalsFromRows } from "../invoices/invoices.shared.js";
import { MAX_ADJUNTO_BYTES, TOLERANCIA_TOTALES } from "./purchase-prices.shared.js";

const num = (valor: unknown) => Number(valor ?? 0);

/**
 * Decodifica un adjunto base64 con comprobación de canonicalidad. Los saltos de
 * línea se permiten porque es habitual que el contenido venga de un correo.
 */
export function decodificarBase64(contenido: string) {
  const limpio = contenido.replace(/\s/g, "");
  if (!limpio || limpio.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(limpio)) {
    throw new Error("El contenido base64 no es válido");
  }
  const bytes = Buffer.from(limpio, "base64");
  if (bytes.toString("base64") !== limpio) {
    throw new Error("El contenido base64 no es válido");
  }
  if (bytes.length > MAX_ADJUNTO_BYTES) {
    throw new Error(`El adjunto supera el límite de ${MAX_ADJUNTO_BYTES} bytes`);
  }
  return bytes;
}

/** Fase 1: sin parser XML nuevo. Se rechaza cualquier DTD o entidad externa. */
export function xmlSeguro(texto: string) {
  const xml = texto.replace(/^\uFEFF/, "").trim();
  if (!xml.startsWith("<") || /<!DOCTYPE|<!ENTITY|SYSTEM|PUBLIC/i.test(xml)) return false;
  return /<\/[A-Za-z_][\w:.-]*\s*>\s*$/.test(xml) || /\/>\s*$/.test(xml);
}

const ETIQUETAS_TOTAL = new Set([
  "total",
  "totalgeneral",
  "valortotal",
  "totalapagar",
  "grandtotal",
]);

/** Extrae el total declarado en un XML simple; devuelve null si no lo encuentra. */
export function extraerTotalXml(texto: string) {
  if (!xmlSeguro(texto)) return null;
  for (const match of texto.matchAll(/<([A-Za-z_][\w:.-]*)\s*[^>]*>\s*([\d]+(?:[.,]\d{1,2})?)\s*<\/\1>/gi)) {
    const etiqueta = match[1].split(":").pop()!.toLowerCase();
    if (ETIQUETAS_TOTAL.has(etiqueta)) {
      return Number(match[2].replace(",", "."));
    }
  }
  return null;
}

export type TipoAdjunto = "pdf" | "xml";

/** Detecta el tipo por magic bytes, no solo por la extensión declarada. */
export function detectarTipoAdjunto(bytes: Buffer): TipoAdjunto | null {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  const inicio = bytes.subarray(0, 512).toString("utf8").replace(/^\uFEFF/, "").trim();
  if (inicio.startsWith("<") && xmlSeguro(inicio)) return "xml";
  return null;
}

/** Devuelve el MIME canónico del adjunto o null si el tipo no está permitido. */
export function mimeAdjunto(tipo: TipoAdjunto) {
  return tipo === "pdf" ? "application/pdf" : "application/xml";
}

/**
 * Comprueba que las cifras de la cabecera cuadren con las líneas. Se usa la
 * misma función de cálculo que al crear la factura; la tolerancia evita
 * rechazar diferencias de un centavo por redondeo.
 */
export function totalesCuadran(inv: RowDataPacket, items: RowDataPacket[]) {
  const calculado = totalsFromRows(items);
  const retenciones = roundMoney(
    num(inv.retencion_fuente) + num(inv.retencion_iva) + num(inv.retencion_ica)
  );
  const esperado: Record<string, number> = {
    subtotal: calculado.subtotal,
    descuento_total: calculado.descuento_total,
    impuesto_total: calculado.impuesto_total,
    inc_total: calculado.inc_total,
    otros_impuestos_total: calculado.otros_impuestos_total,
    total: calculado.total,
    total_neto: roundMoney(calculado.total - retenciones),
  };
  const diferencias = Object.entries(esperado)
    .filter(([campo, valor]) => Math.abs(num(inv[campo]) - valor) > TOLERANCIA_TOTALES)
    .map(([campo, valor]) => ({ campo, esperado: valor, declarado: num(inv[campo]) }));
  return { cuadran: diferencias.length === 0, diferencias, esperado };
}
