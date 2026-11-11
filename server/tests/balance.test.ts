import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

async function setup() {
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
      sku: "P-BAL",
      nombre: "Producto balance",
      category_id: categoria.body.id,
      precio: 100,
      costo: 50,
      stock_minimo: 0,
    });
  const productId = producto.body.id as number;
  // Existencias iniciales: 10 × 50 = 500 de inventario.
  await pool.query("UPDATE products SET stock_actual = 10 WHERE id = ?", [productId]);

  const categorias = await request(app)
    .get("/api/finance/categories")
    .set(bearer(admin.token));
  const cuentas = await request(app)
    .get("/api/finance/accounts")
    .set(bearer(admin.token));
  const byCode = (codigo: string) =>
    categorias.body.find((c: { codigo: string | null }) => c.codigo === codigo)?.id as number;

  return {
    admin,
    contador,
    operador,
    productId,
    cajaId: cuentas.body[0].id as number,
    ventas: byCode("ventas"),
    retAFavor: byCode("retenciones_a_favor"),
    retPorPagar: byCode("retenciones_por_pagar"),
  };
}

describe("Balance simplificado", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let productId: number;
  let cajaId: number;
  let ventas: number;
  let retAFavor: number;
  let retPorPagar: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    operador = s.operador;
    productId = s.productId;
    cajaId = s.cajaId;
    ventas = s.ventas;
    retAFavor = s.retAFavor;
    retPorPagar = s.retPorPagar;
  });

  const movement = (
    tipo: "ingreso" | "gasto" | "activo" | "pasivo",
    monto: number,
    fecha: string,
    categoryId: number
  ) =>
    request(app)
      .post("/api/finance/transactions")
      .set(bearer(contador.token))
      .send({
        tipo,
        monto,
        fecha,
        finance_category_id: categoryId,
        account_id: cajaId,
        descripcion: "Movimiento de prueba",
      });

  const invoice = async (
    tipo: "venta" | "compra",
    fecha: string,
    cantidad: number,
    precio: number
  ) => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo,
        fecha,
        contraparte: tipo === "venta" ? "Cliente balance" : "Proveedor balance",
        condicion_pago: "credito",
        items: [{ product_id: productId, cantidad, precio_unitario: precio, impuesto_pct: 19 }],
      });
    expect(created.status).toBe(201);
    const confirmed = await request(app)
      .post(`/api/invoices/${created.body.id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);
  };

  async function seed() {
    // Venta a crédito: 2 × 100 + 19 % = 238; stock 10 → 8.
    await invoice("venta", "2026-03-10", 2, 100);
    // Compra a crédito: 1 × 200 + 19 % = 238; stock 8 → 9.
    await invoice("compra", "2026-03-11", 1, 200);
    // Entrada real de caja.
    expect((await movement("ingreso", 300, "2026-03-12", ventas)).status).toBe(201);
    // Saldos fiscales informativos (no mueven caja).
    expect((await movement("activo", 15, "2026-03-13", retAFavor)).status).toBe(201);
    expect((await movement("pasivo", 20, "2026-03-14", retPorPagar)).status).toBe(201);
  }

  it("cuadra caja, inventario, cartera, impuestos y patrimonio", async () => {
    await seed();

    const res = await request(app)
      .get("/api/finance/balance?hasta=2026-03-31")
      .set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.as_of).toBe("2026-03-31");

    expect(res.body.activo.caja_bancos).toBe(300);
    expect(res.body.activo.cuentas[0]).toMatchObject({ nombre: "Caja principal", saldo: 300 });
    // 9 unidades × costo 50.
    expect(res.body.activo.inventario).toBe(450);
    expect(res.body.activo.inventario_detalle).toMatchObject({ productos: 1, sin_costo: 0 });
    expect(res.body.activo.cartera_por_cobrar).toBe(238);
    expect(res.body.activo.cartera_detalle).toMatchObject({ facturas: 1 });
    // IVA por pagar de la venta (38) neto con el descontable de la compra (38).
    expect(res.body.activo.iva_a_favor).toBe(0);
    expect(res.body.activo.retenciones_a_favor).toBe(15);
    expect(res.body.activo.total).toBe(1003);

    expect(res.body.pasivo.cartera_por_pagar).toBe(238);
    expect(res.body.pasivo.cartera_detalle).toMatchObject({ facturas: 1 });
    expect(res.body.pasivo.iva_por_pagar).toBe(0);
    expect(res.body.pasivo.retenciones_por_pagar).toBe(20);
    expect(res.body.pasivo.total).toBe(258);

    expect(res.body.patrimonio).toBe(745);
    expect(res.body.ecuacion).toEqual({
      activo: 1003,
      pasivo_mas_patrimonio: 1003,
      cuadra: true,
    });
  });

  it("respeta la fecha de corte en caja y cartera", async () => {
    await seed();

    const res = await request(app)
      .get("/api/finance/balance?hasta=2026-03-01")
      .set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.as_of).toBe("2026-03-01");
    expect(res.body.activo.caja_bancos).toBe(0);
    expect(res.body.activo.cartera_por_cobrar).toBe(0);
    expect(res.body.activo.retenciones_a_favor).toBe(0);
    expect(res.body.pasivo.cartera_por_pagar).toBe(0);
    expect(res.body.pasivo.retenciones_por_pagar).toBe(0);
  });

  it("valida la fecha y respeta los permisos", async () => {
    const invalid = await request(app)
      .get("/api/finance/balance?hasta=no-es-fecha")
      .set(bearer(admin.token));
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .get("/api/finance/balance")
      .set(bearer(operador.token));
    expect(forbidden.status).toBe(403);
  });
});
