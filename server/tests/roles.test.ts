import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

describe("Roles contador y consulta", () => {
  beforeEach(resetDb);

  it("consulta y contador leen pero no modifican inventario", async () => {
    const admin = await userWithToken("admin");
    for (const rol of ["consulta", "contador"] as const) {
      const u = await userWithToken(rol);
      expect((await request(app).get("/api/products").set(bearer(u.token))).status).toBe(200);
      const post = await request(app)
        .post("/api/categories")
        .set(bearer(u.token))
        .send({ nombre: `Cat ${rol}` });
      expect(post.status).toBe(403);
    }
    expect((await request(app).get("/api/products").set(bearer(admin.token))).status).toBe(200);
  });

  it("solo admin gestiona usuarios", async () => {
    for (const rol of ["contador", "consulta"] as const) {
      const u = await userWithToken(rol);
      expect((await request(app).get("/api/users").set(bearer(u.token))).status).toBe(403);
    }
  });

  it("acepta los roles nuevos y rechaza uno inválido", async () => {
    const admin = await userWithToken("admin");
    const body = (rol: string) => ({
      nombre: "Persona Prueba",
      email: `${rol}@x.com`,
      password: "Clave12345",
      rol,
    });
    const ok = await request(app).post("/api/users").set(bearer(admin.token)).send(body("contador"));
    const bad = await request(app).post("/api/users").set(bearer(admin.token)).send(body("jefe"));
    expect(ok.status).toBe(201);
    expect(bad.status).toBe(400);
  });

  it("consulta cambia su propia contraseña", async () => {
    const u = await userWithToken("consulta");
    const res = await request(app)
      .put("/api/auth/password")
      .set(bearer(u.token))
      .send({ currentPassword: "Clave12345", newPassword: "OtraClave123" });
    expect(res.status).toBe(200);
  });
});

afterAll(async () => {
  await pool.end();
});
