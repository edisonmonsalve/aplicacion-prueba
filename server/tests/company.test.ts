import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

const companyInput = {
  nombre: "Mi Empresa S.A.S.",
  eslogan: "Distribución de alimentos",
  nit: "NIT 900.123.456-7",
  regimen: "Régimen común",
  direccion: "Calle 10 # 20-30, Medellín",
  telefono: "+57 604 444 5566",
  celular: "+57 300 111 2233",
  email: "facturas@miempresa.co",
  web: "www.miempresa.co",
  logo_url: "https://miempresa.co/logo.png",
};

describe("Datos de la empresa emisora", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;

  beforeEach(async () => {
    await resetDb();
    admin = await userWithToken("admin");
    contador = await userWithToken("contador");
    operador = await userWithToken("operador");
    consulta = await userWithToken("consulta");
  });

  it("exige sesión para leer los datos", async () => {
    const res = await request(app).get("/api/company");
    expect(res.status).toBe(401);
  });

  it("devuelve los datos de ejemplo mientras no se configure", async () => {
    const res = await request(app).get("/api/company").set(bearer(consulta.token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      nombre: expect.any(String),
      nit: expect.any(String),
      logo_url: null,
    });
  });

  it("el administrador guarda los datos y los deja auditados", async () => {
    const res = await request(app)
      .put("/api/company")
      .set(bearer(admin.token))
      .send(companyInput);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      nombre: companyInput.nombre,
      email: companyInput.email,
      logo_url: companyInput.logo_url,
    });

    const lectura = await request(app).get("/api/company").set(bearer(consulta.token));
    expect(lectura.status).toBe(200);
    expect(lectura.body).toMatchObject(companyInput);

    const [audit] = await pool.query<RowDataPacket[]>(
      "SELECT accion, antes, despues FROM audit_log WHERE entidad = 'company_settings'"
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].accion).toBe("actualizar");
    expect(audit[0].antes).toBeNull();
    const despues =
      typeof audit[0].despues === "string" ? JSON.parse(audit[0].despues) : audit[0].despues;
    expect(despues).toMatchObject({ nombre: companyInput.nombre });
  });

  it("normaliza los campos vacíos a null", async () => {
    const res = await request(app)
      .put("/api/company")
      .set(bearer(admin.token))
      .send({ nombre: "Solo el nombre", email: "", eslogan: "   ", logo_url: "" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nombre: "Solo el nombre",
      email: null,
      eslogan: null,
      logo_url: null,
    });
  });

  it("rechaza un correo inválido", async () => {
    const res = await request(app)
      .put("/api/company")
      .set(bearer(admin.token))
      .send({ ...companyInput, email: "no-es-correo" });
    expect(res.status).toBe(400);
  });

  it("rechaza un logo que no es URL ni ruta interna", async () => {
    const res = await request(app)
      .put("/api/company")
      .set(bearer(admin.token))
      .send({ ...companyInput, logo_url: "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  it("solo el administrador puede guardar", async () => {
    for (const actor of [contador, operador, consulta]) {
      const res = await request(app)
        .put("/api/company")
        .set(bearer(actor.token))
        .send(companyInput);
      expect(res.status).toBe(403);
    }
  });
});
