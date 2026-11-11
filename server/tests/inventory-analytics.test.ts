import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

interface Product {
  id: number;
  nombre: string;
}

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");
  const operador = await userWithToken("operador");

  const categoria = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "Abarrotes" });

  const create = async (
    sku: string,
    nombre: string,
    costo: number,
    precio: number,
    stock: number
  ): Promise<Product> => {
    const res = await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send({
        sku,
        nombre,
        category_id: categoria.body.id,
        precio,
        costo,
        stock_minimo: 0,
      });
    expect(res.status).toBe(201);
    const id = res.body.id as number;
    await pool.query("UPDATE products SET stock_actual = ? WHERE id = ?", [stock, id]);
    return { id, nombre };
  };

  const a = await create("P-A", "Arroz", 40, 100, 10);
  const b = await create("P-B", "Frijol", 60, 100, 6);
  const c = await create("P-C", "Aceite", 10, 50, 10);
  const d = await create("P-D", "Sal", 20, 80, 5);
  const e = await create("P-E", "Azúcar", 20, 50, 4);
  const f = await create("P-F", "Café", 10, 30, 3);

  return { admin, contador, consulta, operador, a, b, c, d, e, f };
}

describe("Rotación y ABC de inventario", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let a: Product;
  let b: Product;
  let c: Product;
  let d: Product;
  let e: Product;
  let f: Product;

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
    d = s.d;
    e = s.e;
    f = s.f;
  });

  const sale = async (
    fecha: string,
    items: { product_id: number; cantidad: number; precio_unitario: number }[]
  ) => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha,
        contraparte: "Cliente inventario",
        condicion_pago: "contado",
        items: items.map((i) => ({ ...i, impuesto_pct: 0 })),
      });
    expect(created.status).toBe(201);
    const confirmed = await request(app)
      .post(`/api/invoices/${created.body.id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);
  };

  async function seed() {
    // Marzo 2026: ingresos 380 y costo histórico 170.
    await sale("2026-03-05", [
      { product_id: a.id, cantidad: 2, precio_unitario: 100 },
      { product_id: b.id, cantidad: 1, precio_unitario: 100 },
      { product_id: e.id, cantidad: 1, precio_unitario: 50 },
      { product_id: f.id, cantidad: 1, precio_unitario: 30 },
    ]);
    // Aceite solo se vendió en octubre de 2025: stock muerto al corte.
    await sale("2025-10-01", [{ product_id: c.id, cantidad: 2, precio_unitario: 50 }]);
    // Sal nunca se ha vendido: también es stock muerto.
  }

  const report = (params = "") =>
    request(app)
      .get(`/api/finance/inventory-analytics?desde=2026-03-01&hasta=2026-03-31${params}`)
      .set(bearer(consulta.token));

  it("calcula rotación, días de inventario y clasificación ABC", async () => {
    await seed();

    const res = await report();
    expect(res.status).toBe(200);
    expect(res.body.rango).toEqual({
      desde: "2026-03-01",
      hasta: "2026-03-31",
      dias: 31,
      dias_muerto: 90,
    });
    // Inventario actual: 320 + 300 + 80 + 100 + 60 + 20 = 880.
    expect(res.body.resumen).toMatchObject({
      valor_inventario: 880,
      costo_ventas: 170,
      ingresos: 380,
      productos: 6,
      productos_vendidos: 4,
      sin_costo: 0,
    });
    expect(res.body.resumen.rotacion).toBeCloseTo(0.19, 2);
    expect(res.body.resumen.dias_inventario).toBeCloseTo(160.47, 2);
    expect(res.body.resumen.stock_muerto).toEqual({ productos: 2, valor: 180 });

    expect(res.body.resumen.abc).toEqual([
      { clase: "A", productos: 2, ingresos: 300, participacion: 78.95 },
      { clase: "B", productos: 1, ingresos: 50, participacion: 13.16 },
      { clase: "C", productos: 3, ingresos: 30, participacion: 7.89 },
    ]);

    const arroz = res.body.data.find((r: { nombre: string }) => r.nombre === "Arroz");
    expect(arroz).toMatchObject({
      stock_actual: 8,
      costo_unitario: 40,
      valor_inventario: 320,
      unidades_vendidas: 2,
      ingresos: 200,
      costo_ventas: 80,
      margen: 120,
      margen_pct: 60,
      rotacion: 0.25,
      dias_inventario: 124,
      ultima_venta: "2026-03-05",
      dias_sin_venta: 26,
      stock_muerto: false,
      clase_abc: "A",
      participacion: 52.63,
      acumulado: 52.63,
    });

    const frijol = res.body.data.find((r: { nombre: string }) => r.nombre === "Frijol");
    expect(frijol).toMatchObject({ clase_abc: "A", participacion: 26.32, acumulado: 78.95 });

    const azucar = res.body.data.find((r: { nombre: string }) => r.nombre === "Azúcar");
    expect(azucar).toMatchObject({ clase_abc: "B", acumulado: 92.11 });

    const cafe = res.body.data.find((r: { nombre: string }) => r.nombre === "Café");
    expect(cafe).toMatchObject({ clase_abc: "C", acumulado: 100 });

    const aceite = res.body.data.find((r: { nombre: string }) => r.nombre === "Aceite");
    expect(aceite).toMatchObject({
      stock_actual: 8,
      valor_inventario: 80,
      unidades_vendidas: 0,
      ingresos: 0,
      rotacion: 0,
      dias_inventario: null,
      ultima_venta: "2025-10-01",
      dias_sin_venta: 181,
      stock_muerto: true,
      clase_abc: "C",
    });

    const sal = res.body.data.find((r: { nombre: string }) => r.nombre === "Sal");
    expect(sal).toMatchObject({
      stock_actual: 5,
      valor_inventario: 100,
      ultima_venta: null,
      dias_sin_venta: null,
      stock_muerto: true,
      clase_abc: "C",
    });
  });

  it("ajusta el umbral de stock muerto y respeta periodos sin ventas", async () => {
    await seed();

    const amplio = await report("&dias_muerto=400");
    expect(amplio.status).toBe(200);
    expect(amplio.body.rango.dias_muerto).toBe(400);
    expect(amplio.body.resumen.stock_muerto).toEqual({ productos: 1, valor: 100 });

    const febrero = await request(app)
      .get("/api/finance/inventory-analytics?desde=2026-02-01&hasta=2026-02-28")
      .set(bearer(consulta.token));
    expect(febrero.status).toBe(200);
    expect(febrero.body.resumen).toMatchObject({
      ingresos: 0,
      costo_ventas: 0,
      productos_vendidos: 0,
      rotacion: 0,
      dias_inventario: null,
    });
  });

  it("valida el rango y el umbral, y respeta los permisos", async () => {
    const invalidRange = await request(app)
      .get("/api/finance/inventory-analytics?desde=2026-03-31&hasta=2026-03-01")
      .set(bearer(consulta.token));
    expect(invalidRange.status).toBe(400);

    const invalidThreshold = await report("&dias_muerto=0");
    expect(invalidThreshold.status).toBe(400);

    const forbidden = await request(app)
      .get("/api/finance/inventory-analytics")
      .set(bearer(operador.token));
    expect(forbidden.status).toBe(403);
  });
});
