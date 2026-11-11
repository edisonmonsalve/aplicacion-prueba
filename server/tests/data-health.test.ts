import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");
  const operador = await userWithToken("operador");

  const categorias = await request(app)
    .get("/api/finance/categories")
    .set(bearer(admin.token));
  const cuentas = await request(app)
    .get("/api/finance/accounts")
    .set(bearer(admin.token));

  const byCode = (codigo: string) =>
    categorias.body.find((c: { codigo: string | null }) => c.codigo === codigo)?.id as number;

  const categoriaProducto = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });

  const producto = await request(app)
    .post("/api/products")
    .set(bearer(admin.token))
    .send({
      sku: "P-SALUD",
      nombre: "Producto salud",
      category_id: categoriaProducto.body.id,
      precio: 100,
      costo: 40,
      stock_minimo: 0,
    });
  await pool.query("UPDATE products SET stock_actual = 10 WHERE id = ?", [producto.body.id]);

  return {
    admin,
    contador,
    consulta,
    operador,
    cajaId: cuentas.body[0].id as number,
    ventas: byCode("ventas"),
    productId: producto.body.id as number,
  };
}

describe("Salud de datos", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let cajaId: number;
  let ventas: number;
  let productId: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    consulta = s.consulta;
    operador = s.operador;
    cajaId = s.cajaId;
    ventas = s.ventas;
    productId = s.productId;
  });

  const health = (token: string) =>
    request(app).get("/api/finance/data-health").set(bearer(token));

  const sale = async (condicion: "contado" | "credito" = "contado") => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2026-03-05",
        contraparte: "Cliente salud",
        condicion_pago: condicion,
        items: [
          { product_id: productId, cantidad: 1, precio_unitario: 100, impuesto_pct: 0 },
        ],
      });
    expect(created.status).toBe(201);
    const confirmed = await request(app)
      .post(`/api/invoices/${created.body.id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);
    return created.body.id as number;
  };

  it("reporta un sistema sano cuando no hay anomalías", async () => {
    const res = await health(consulta.token);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("ok");
    expect(res.body.resumen).toEqual({
      checks: 4,
      con_problemas: 0,
      total_hallazgos: 0,
    });
    expect(res.body.checks.map((c: { codigo: string }) => c.codigo)).toEqual([
      "asientos_huerfanos",
      "pagos_huerfanos",
      "stock_negativo",
      "productos_sin_costo",
    ]);
    expect(res.body.checks.every((c: { hallazgos: number }) => c.hallazgos === 0)).toBe(true);
  });

  it("detecta asientos y pagos huérfanos, stock negativo y productos sin costo", async () => {
    // Producto con existencias y costo cero.
    const sinCosto = await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send({
        sku: "P-SIN-COSTO",
        nombre: "Sin costo",
        category_id: (
          await request(app).get("/api/categories").set(bearer(admin.token))
        ).body[0].id,
        precio: 50,
        costo: 0,
        stock_minimo: 0,
      });
    expect(sinCosto.status).toBe(201);
    await pool.query("UPDATE products SET stock_actual = 4 WHERE id = ?", [sinCosto.body.id]);

    // Asiento vigente colgado de una factura anulada.
    const anulada = await sale("contado");
    expect(
      (await request(app).post(`/api/invoices/${anulada}/anular`).set(bearer(admin.token))).status
    ).toBe(200);
    const huerfano = await pool.query(
      `INSERT INTO transactions
         (tipo, monto, fecha, finance_category_id, account_id, invoice_id, descripcion, created_by)
       VALUES ('ingreso', 10, '2026-03-06', ?, ?, ?, 'Asiento huérfano', ?)`,
      [ventas, cajaId, anulada, admin.id]
    );
    expect(huerfano).toBeTruthy();

    // Pago válido sin asiento de caja.
    const credito = await sale("credito");
    await pool.query(
      `INSERT INTO invoice_payments
         (invoice_id, fecha, monto, account_id, metodo, estado, created_by)
       VALUES (?, '2026-03-07', 50, ?, 'efectivo', 'valido', ?)`,
      [credito, cajaId, admin.id]
    );

    // Stock negativo: se relaja el CHECK solo durante la prueba.
    const [constraints] = await pool.query<RowDataPacket[]>(
      `SELECT CONSTRAINT_NAME FROM information_schema.CHECK_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
         AND CONSTRAINT_NAME = 'chk_products_stock'`
    );
    const tieneCheck = constraints.length > 0;
    if (tieneCheck) {
      await pool.query("ALTER TABLE products DROP CONSTRAINT chk_products_stock");
    }
    try {
      await pool.query("UPDATE products SET stock_actual = -3 WHERE id = ?", [productId]);

      const res = await health(admin.token);
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe("alerta");
      expect(res.body.resumen).toEqual({
        checks: 4,
        con_problemas: 4,
        total_hallazgos: 4,
      });

      const porCodigo = new Map(
        res.body.checks.map((c: { codigo: string; hallazgos: number }) => [c.codigo, c])
      );

      const asientos = porCodigo.get("asientos_huerfanos") as {
        hallazgos: number;
        detalle: Record<string, unknown>[];
      };
      expect(asientos.hallazgos).toBe(1);
      expect(asientos.detalle[0]).toMatchObject({
        tipo: "ingreso",
        monto: 10,
        invoice_id: anulada,
        estado_factura: "anulada",
      });

      const pagos = porCodigo.get("pagos_huerfanos") as {
        hallazgos: number;
        detalle: Record<string, unknown>[];
      };
      expect(pagos.hallazgos).toBe(1);
      expect(pagos.detalle[0]).toMatchObject({
        invoice_id: credito,
        monto: 50,
        transaction_id: null,
      });

      const stock = porCodigo.get("stock_negativo") as {
        hallazgos: number;
        detalle: Record<string, unknown>[];
      };
      expect(stock.hallazgos).toBe(1);
      expect(stock.detalle[0]).toMatchObject({
        id: productId,
        sku: "P-SALUD",
        stock_actual: -3,
      });

      const costos = porCodigo.get("productos_sin_costo") as {
        hallazgos: number;
        detalle: Record<string, unknown>[];
      };
      expect(costos.hallazgos).toBe(1);
      expect(costos.detalle[0]).toMatchObject({
        id: sinCosto.body.id,
        sku: "P-SIN-COSTO",
        stock_actual: 4,
        costo: 0,
      });
    } finally {
      await pool.query("UPDATE products SET stock_actual = 0 WHERE id = ?", [productId]);
      if (tieneCheck) {
        await pool.query(
          `ALTER TABLE products
           ADD CONSTRAINT chk_products_stock CHECK (stock_actual >= 0 AND stock_minimo >= 0)`
        );
      }
    }
  });

  it("respeta los permisos de lectura", async () => {
    expect((await health(admin.token)).status).toBe(200);
    expect((await health(contador.token)).status).toBe(200);
    expect((await health(consulta.token)).status).toBe(200);
    expect((await health(operador.token)).status).toBe(403);
  });
});
