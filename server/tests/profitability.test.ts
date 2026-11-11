import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

interface SetupProduct {
  id: number;
  nombre: string;
}

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");
  const operador = await userWithToken("operador");

  const bebidas = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "Bebidas" });
  const snacks = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "Snacks" });

  const createProduct = async (
    sku: string,
    nombre: string,
    categoryId: number,
    costo: number,
    precio: number
  ): Promise<SetupProduct> => {
    const res = await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send({
        sku,
        nombre,
        category_id: categoryId,
        precio,
        costo,
        stock_minimo: 0,
      });
    expect(res.status).toBe(201);
    return { id: res.body.id as number, nombre };
  };

  const a = await createProduct("P-AGUA", "Agua", bebidas.body.id, 40, 100);
  const b = await createProduct("P-JUGO", "Jugo", bebidas.body.id, 60, 100);
  const c = await createProduct("P-PAPA", "Papas", snacks.body.id, 10, 50);
  await pool.query("UPDATE products SET stock_actual = 500 WHERE id IN (?)", [
    [a.id, b.id, c.id],
  ]);

  const createParty = async (nombre: string, documento: string) => {
    const res = await request(app)
      .post("/api/third-parties")
      .set(bearer(admin.token))
      .send({
        tipo: "cliente",
        tipo_documento: "NIT",
        documento,
        nombre,
        condicion_pago: "contado",
        dias_credito: 0,
      });
    expect(res.status).toBe(201);
    return res.body.id as number;
  };

  const uno = await createParty("Cliente Uno SAS", "900111222");
  const dos = await createParty("Cliente Dos SAS", "900333444");

  return { admin, contador, consulta, operador, a, b, c, uno, dos };
}

describe("Rentabilidad por producto, categoría y cliente", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let a: SetupProduct;
  let b: SetupProduct;
  let c: SetupProduct;
  let uno: number;
  let dos: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    consulta = s.consulta;
    operador = s.operador;
    a = s.a;
    b = s.b;
    c = s.c;
    uno = s.uno;
    dos = s.dos;
  });

  const sale = async (
    partyId: number,
    contraparte: string,
    fecha: string,
    items: { product_id: number; cantidad: number; precio_unitario: number; impuesto_pct?: number }[]
  ) => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha,
        contraparte,
        party_id: partyId,
        condicion_pago: "contado",
        items,
      });
    expect(created.status).toBe(201);
    const confirmed = await request(app)
      .post(`/api/invoices/${created.body.id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);
    return created.body.id as number;
  };

  async function seed() {
    // Factura 1 (Cliente Uno): Agua 2 × 100 + Jugo 1 × 100.
    // Ingreso 300 y costo histórico 2 × 40 + 1 × 60 = 140.
    await sale(uno, "Cliente Uno SAS", "2026-03-05", [
      { product_id: a.id, cantidad: 2, precio_unitario: 100, impuesto_pct: 19 },
      { product_id: b.id, cantidad: 1, precio_unitario: 100, impuesto_pct: 19 },
    ]);
    // Factura 2 (Cliente Dos): Agua 1 × 100 + Papas 4 × 50.
    // Ingreso 300 y costo 1 × 40 + 4 × 10 = 80.
    await sale(dos, "Cliente Dos SAS", "2026-03-10", [
      { product_id: a.id, cantidad: 1, precio_unitario: 100, impuesto_pct: 19 },
      { product_id: c.id, cantidad: 4, precio_unitario: 50, impuesto_pct: 19 },
    ]);
    // Fuera del periodo consultado: no debe entrar.
    await sale(uno, "Cliente Uno SAS", "2026-02-20", [
      { product_id: a.id, cantidad: 5, precio_unitario: 100, impuesto_pct: 19 },
    ]);
  }

  const report = (grupo: "producto" | "categoria" | "cliente") =>
    request(app)
      .get(`/api/finance/profitability?desde=2026-03-01&hasta=2026-03-31&grupo=${grupo}`)
      .set(bearer(consulta.token));

  it("calcula margen por producto con el costo histórico y el total del periodo", async () => {
    await seed();

    const res = await report("producto");
    expect(res.status).toBe(200);
    expect(res.body.grupo).toBe("producto");
    expect(res.body.rango).toEqual({ desde: "2026-03-01", hasta: "2026-03-31" });
    expect(res.body.resumen).toMatchObject({
      ingresos: 600,
      costo: 220,
      margen: 380,
      margen_pct: 63.33,
      unidades: 8,
      facturas: 2,
    });

    expect(res.body.data).toHaveLength(3);
    const agua = res.body.data.find((r: { nombre: string }) => r.nombre === "Agua");
    expect(agua).toMatchObject({
      sku: "P-AGUA",
      categoria: "Bebidas",
      ingresos: 300,
      costo: 120,
      margen: 180,
      margen_pct: 60,
      participacion: 50,
      unidades: 3,
      facturas: 2,
    });
    expect(res.body.data.map((r: { nombre: string }) => r.nombre)).toEqual([
      "Agua",
      "Papas",
      "Jugo",
    ]);
  });

  it("agrupa por categoría y por cliente con la participación sobre ingresos", async () => {
    await seed();

    const porCategoria = await report("categoria");
    expect(porCategoria.status).toBe(200);
    expect(porCategoria.body.resumen).toMatchObject({
      ingresos: 600,
      costo: 220,
      margen: 380,
      unidades: 8,
      facturas: 2,
    });
    expect(porCategoria.body.data.map((r: { nombre: string }) => r.nombre)).toEqual([
      "Bebidas",
      "Snacks",
    ]);
    expect(porCategoria.body.data[0]).toMatchObject({
      ingresos: 400,
      costo: 180,
      margen: 220,
      margen_pct: 55,
      participacion: 66.67,
      unidades: 4,
      facturas: 2,
    });
    expect(porCategoria.body.data[1]).toMatchObject({
      ingresos: 200,
      costo: 40,
      margen: 160,
      margen_pct: 80,
      participacion: 33.33,
      unidades: 4,
      facturas: 1,
    });

    const porCliente = await report("cliente");
    expect(porCliente.status).toBe(200);
    expect(porCliente.body.resumen.facturas).toBe(2);
    expect(porCliente.body.data.map((r: { nombre: string }) => r.nombre)).toEqual([
      "Cliente Dos SAS",
      "Cliente Uno SAS",
    ]);
    const dosLine = porCliente.body.data.find(
      (r: { nombre: string }) => r.nombre === "Cliente Dos SAS"
    );
    expect(dosLine).toMatchObject({
      ingresos: 300,
      costo: 80,
      margen: 220,
      margen_pct: 73.33,
      participacion: 50,
      facturas: 1,
    });
  });

  it("excluye facturas anuladas y valida grupo, fecha y permisos", async () => {
    await seed();

    const anulada = await sale(uno, "Cliente Uno SAS", "2026-03-20", [
      { product_id: a.id, cantidad: 9, precio_unitario: 100, impuesto_pct: 19 },
    ]);
    const cancel = await request(app)
      .post(`/api/invoices/${anulada}/anular`)
      .set(bearer(admin.token));
    expect(cancel.status).toBe(200);

    const res = await report("producto");
    expect(res.body.resumen).toMatchObject({ ingresos: 600, costo: 220, margen: 380, facturas: 2 });
    expect(
      res.body.data.find((r: { nombre: string }) => r.nombre === "Agua").unidades
    ).toBe(3);

    const invalidGroup = await request(app)
      .get("/api/finance/profitability?grupo=proveedor")
      .set(bearer(consulta.token));
    expect(invalidGroup.status).toBe(400);

    const invalidRange = await request(app)
      .get("/api/finance/profitability?desde=2026-03-31&hasta=2026-03-01")
      .set(bearer(consulta.token));
    expect(invalidRange.status).toBe(400);

    const forbidden = await request(app)
      .get("/api/finance/profitability")
      .set(bearer(operador.token));
    expect(forbidden.status).toBe(403);
  });
});
