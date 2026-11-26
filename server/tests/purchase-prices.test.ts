import type { RowDataPacket } from "mysql2";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

type Usuario = Awaited<ReturnType<typeof userWithToken>>;

async function setup() {
  await resetDb();
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const operador = await userWithToken("operador");

  const categoria = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });
  const producto = await request(app)
    .post("/api/products")
    .set(bearer(admin.token))
    .send({
      sku: "P-COMPRA",
      nombre: "Producto de compra",
      category_id: categoria.body.id,
      precio: 1000,
      costo: 400,
      stock_minimo: 0,
    });
  const productId = Number(producto.body.id);
  await pool.query("UPDATE products SET stock_actual = 10 WHERE id = ?", [productId]);
  return { admin, contador, operador, productId };
}

async function crearCompra(
  usuario: Usuario,
  productId: number,
  precio: number,
  contraparte = "Proveedor A"
) {
  const res = await request(app)
    .post("/api/invoices")
    .set(bearer(usuario.token))
    .send({
      tipo: "compra",
      fecha: "2024-01-15",
      contraparte,
      items: [
        {
          product_id: productId,
          cantidad: 1,
          precio_unitario: precio,
          impuesto_pct: 0,
        },
      ],
    });
  expect(res.status).toBe(201);
  return res.body as { id: number; numero: string };
}

const confirmar = (id: number, usuario: Usuario) =>
  request(app).post(`/api/invoices/${id}/confirmar`).set(bearer(usuario.token));

async function consultar(sql: string, params: unknown[] = []) {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows;
}

describe("MEJ-003 · Control de precios de compra", () => {
  let admin: Usuario;
  let contador: Usuario;
  let operador: Usuario;
  let productId: number;

  beforeEach(async () => {
    const ctx = await setup();
    admin = ctx.admin;
    contador = ctx.contador;
    operador = ctx.operador;
    productId = ctx.productId;
  });

  it("la migración deja requiere_adjunto=1 por defecto", async () => {
    const [columna] = await consultar(
      `SELECT COLUMN_DEFAULT AS valor FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_price_settings'
         AND COLUMN_NAME = 'requiere_adjunto'`
    );
    expect(columna.valor).toBe("1");
    const [settings] = await consultar("SELECT umbral_pct FROM purchase_price_settings WHERE id = 1");
    expect(Number(settings.umbral_pct)).toBe(10);
  });

  it("la última compra actualiza el historial sin tocar products.costo", async () => {
    const primera = await crearCompra(admin, productId, 100);
    expect((await confirmar(primera.id, admin)).status).toBe(200);

    const [producto] = await consultar("SELECT costo FROM products WHERE id = ?", [productId]);
    expect(Number(producto.costo)).toBe(400);

    const [ultimo] = await consultar("SELECT * FROM product_supplier_prices");
    expect(ultimo).toMatchObject({
      product_id: productId,
      supplier_key: "nom:proveedor a",
      precio_unitario: 100,
    });
    expect((await consultar("SELECT id FROM product_supplier_price_history")).length).toBe(1);

    // Exactamente el 10 % no exige aprobación (la comparación es `>`).
    const segunda = await crearCompra(admin, productId, 110);
    expect((await confirmar(segunda.id, admin)).status).toBe(200);
    const [actualizado] = await consultar("SELECT precio_unitario FROM product_supplier_prices");
    expect(Number(actualizado.precio_unitario)).toBe(110);
    expect((await consultar("SELECT id FROM product_supplier_price_history")).length).toBe(2);
    const [productoFinal] = await consultar("SELECT costo FROM products WHERE id = ?", [productId]);
    expect(Number(productoFinal.costo)).toBe(400);
  });

  it("una variación mayor del 10 % bloquea la confirmación", async () => {
    const primera = await crearCompra(admin, productId, 100);
    await confirmar(primera.id, admin);

    const [stockInicial] = await consultar("SELECT stock_actual FROM products WHERE id = ?", [productId]);
    const segunda = await crearCompra(admin, productId, 130);
    const bloqueada = await confirmar(segunda.id, admin);
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.body.errors.code).toBe("APROBACION_REQUERIDA");

    const [factura] = await consultar("SELECT estado FROM invoices WHERE id = ?", [segunda.id]);
    expect(factura.estado).toBe("borrador");
    const [stock] = await consultar("SELECT stock_actual FROM products WHERE id = ?", [productId]);
    expect(Number(stock.stock_actual)).toBe(Number(stockInicial.stock_actual));
    expect(
      (await consultar("SELECT id FROM product_supplier_price_history WHERE invoice_id = ?", [segunda.id])).length
    ).toBe(0);
  });

  it("el contador aprueba la variación y el operador puede confirmar", async () => {
    const primera = await crearCompra(admin, productId, 100);
    await confirmar(primera.id, admin);
    const segunda = await crearCompra(operador, productId, 130);
    expect((await confirmar(segunda.id, operador)).status).toBe(409);

    const solicitud = await request(app)
      .post(`/api/invoices/${segunda.id}/solicitar-aprobacion`)
      .set(bearer(operador.token));
    expect(solicitud.status).toBe(201);
    expect(solicitud.body.estado).toBe("pendiente");

    const aprobada = await request(app)
      .post(`/api/purchase-prices/approvals/${solicitud.body.id}/aprobar`)
      .set(bearer(contador.token))
      .send({ motivo: "Precio de mercado verificado" });
    expect(aprobada.status).toBe(200);
    expect(aprobada.body.estado).toBe("aprobada");

    expect((await confirmar(segunda.id, operador)).status).toBe(200);
    const [historia] = await consultar(
      "SELECT precio_anterior, precio_unitario, variacion_pct FROM product_supplier_price_history WHERE invoice_id = ?",
      [segunda.id]
    );
    expect(historia).toMatchObject({ precio_anterior: 100, precio_unitario: 130 });
    expect(Number(historia.variacion_pct)).toBe(30);
  });

  it("editar el borrador invalida la aprobación", async () => {
    const primera = await crearCompra(admin, productId, 100);
    await confirmar(primera.id, admin);
    const segunda = await crearCompra(admin, productId, 130);

    const solicitud = await request(app)
      .post(`/api/invoices/${segunda.id}/solicitar-aprobacion`)
      .set(bearer(admin.token));
    const aprobada = await request(app)
      .post(`/api/purchase-prices/approvals/${solicitud.body.id}/aprobar`)
      .set(bearer(contador.token))
      .send({});
    expect(aprobada.status).toBe(200);

    const edicion = await request(app)
      .put(`/api/invoices/${segunda.id}`)
      .set(bearer(admin.token))
      .send({ notas: "Se corrige la descripción" });
    expect(edicion.status).toBe(200);

    const estado = await request(app)
      .get(`/api/invoices/${segunda.id}/aprobacion`)
      .set(bearer(admin.token));
    expect(estado.body.aprobacion.estado).toBe("invalida");
    const bloqueada = await confirmar(segunda.id, admin);
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.body.errors.code).toBe("APROBACION_REQUERIDA");
  });

  it("un duplicado por proveedor, prefijo y número bloquea la confirmación", async () => {
    const primera = await crearCompra(admin, productId, 100);
    await confirmar(primera.id, admin);
    const segunda = await crearCompra(admin, productId, 110);

    // Simula un índice heredado con el mismo documento de proveedor.
    await pool.query("UPDATE purchase_invoice_index SET numero = ? WHERE invoice_id = ?", [
      segunda.numero,
      primera.id,
    ]);
    const bloqueada = await confirmar(segunda.id, admin);
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.body.errors.code).toBe("FACTURA_DUPLICADA");
  });

  it("el operador no aprueba ni ve precios ni variaciones", async () => {
    const primera = await crearCompra(admin, productId, 100);
    await confirmar(primera.id, admin);
    const segunda = await crearCompra(admin, productId, 130);

    expect((await request(app).get("/api/purchase-prices/last").set(bearer(operador.token))).status).toBe(403);
    expect((await request(app).get("/api/purchase-prices/history").set(bearer(operador.token))).status).toBe(403);

    const validacion = await request(app)
      .get(`/api/invoices/${segunda.id}/validacion-compra`)
      .set(bearer(operador.token));
    expect(validacion.status).toBe(200);
    expect(validacion.body.puede_confirmar).toBe(false);
    expect(validacion.body.bloqueos[0].codigo).toBe("APROBACION_REQUERIDA");
    expect(JSON.stringify(validacion.body)).not.toMatch(/precio_unitario|variacion_pct|umbral_pct/);

    const solicitud = await request(app)
      .post(`/api/invoices/${segunda.id}/solicitar-aprobacion`)
      .set(bearer(admin.token));
    const intento = await request(app)
      .post(`/api/purchase-prices/approvals/${solicitud.body.id}/aprobar`)
      .set(bearer(operador.token))
      .send({});
    expect(intento.status).toBe(403);
  });

  it("exige adjunto PDF válido y audita sin guardar base64", async () => {
    const setting = await request(app)
      .put("/api/purchase-prices/settings")
      .set(bearer(admin.token))
      .send({ umbral_pct: 10, requiere_adjunto: true });
    expect(setting.status).toBe(200);

    const factura = await crearCompra(admin, productId, 100);
    const sinAdjunto = await confirmar(factura.id, admin);
    expect(sinAdjunto.status).toBe(409);
    expect(sinAdjunto.body.errors.code).toBe("ADJUNTO_REQUERIDO");

    const falsoPdf = await request(app)
      .post(`/api/invoices/${factura.id}/adjuntos`)
      .set(bearer(admin.token))
      .send({ nombre: "factura.pdf", contenido_base64: Buffer.from("hola").toString("base64") });
    expect(falsoPdf.status).toBe(400);

    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
    const subido = await request(app)
      .post(`/api/invoices/${factura.id}/adjuntos`)
      .set(bearer(admin.token))
      .send({ nombre: "factura.pdf", contenido_base64: pdf.toString("base64") });
    expect(subido.status).toBe(201);
    expect(subido.body.mime).toBe("application/pdf");

    const listado = await request(app)
      .get(`/api/invoices/${factura.id}/adjuntos`)
      .set(bearer(admin.token));
    expect(listado.status).toBe(200);
    expect(listado.body[0]).toMatchObject({ nombre: "factura.pdf", tamano_bytes: pdf.length });
    expect(JSON.stringify(listado.body)).not.toContain(pdf.toString("base64"));

    expect((await confirmar(factura.id, admin)).status).toBe(200);
    const auditorias = await consultar(
      `SELECT accion, entidad, despues FROM audit_log
       WHERE entidad = 'invoice' AND accion IN ('adjunto_alta', 'confirmar_compra')
       ORDER BY id`
    );
    expect(auditorias.map((a) => a.accion)).toEqual(["adjunto_alta", "confirmar_compra"]);
    expect(JSON.stringify(auditorias)).not.toContain(pdf.toString("base64"));
  });

  it("rechaza XML con DTD y comprueba el total declarado", async () => {
    const setting = await request(app)
      .put("/api/purchase-prices/settings")
      .set(bearer(admin.token))
      .send({ umbral_pct: 10, requiere_adjunto: true });
    expect(setting.status).toBe(200);
    const factura = await crearCompra(admin, productId, 100);

    const conDtd = Buffer.from(`<!DOCTYPE f [<!ENTITY x SYSTEM "file:///etc/passwd">]><f><Total>100</Total></f>`);
    const rechazado = await request(app)
      .post(`/api/invoices/${factura.id}/adjuntos`)
      .set(bearer(admin.token))
      .send({ nombre: "factura.xml", contenido_base64: conDtd.toString("base64") });
    expect(rechazado.status).toBe(400);

    const xml = Buffer.from('<?xml version="1.0"?><factura><Total>999.00</Total></factura>');
    const subido = await request(app)
      .post(`/api/invoices/${factura.id}/adjuntos`)
      .set(bearer(admin.token))
      .send({ nombre: "factura.xml", contenido_base64: xml.toString("base64") });
    expect(subido.status).toBe(201);

    const bloqueada = await confirmar(factura.id, admin);
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.body.errors.code).toBe("TOTAL_XML_NO_COINCIDE");

    const borrado = await request(app)
      .delete(`/api/invoices/${factura.id}/adjuntos/${subido.body.id}`)
      .set(bearer(admin.token));
    expect(borrado.status).toBe(200);

    const xmlCorrecto = Buffer.from('<?xml version="1.0"?><factura><Total>100.00</Total></factura>');
    const reemplazo = await request(app)
      .post(`/api/invoices/${factura.id}/adjuntos`)
      .set(bearer(admin.token))
      .send({ nombre: "correcto.xml", contenido_base64: xmlCorrecto.toString("base64") });
    expect(reemplazo.status).toBe(201);
    expect((await confirmar(factura.id, admin)).status).toBe(200);
  });
});
