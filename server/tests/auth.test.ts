import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { PASSWORD, bearer, createUser, resetDb, userWithToken } from "./helpers.js";

describe("Autenticación", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("el login correcto devuelve token y no expone el hash", async () => {
    const { email } = await createUser("admin");
    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.rol).toBe("admin");
    expect(JSON.stringify(res.body)).not.toContain("password_hash");
  });

  it("una contraseña incorrecta responde 401", async () => {
    const { email } = await createUser("admin");
    const res = await request(app).post("/api/auth/login").send({ email, password: "otra" });
    expect(res.status).toBe(401);
  });

  it("un usuario inactivo no puede iniciar sesión", async () => {
    const { id, email } = await createUser("operador");
    await pool.query("UPDATE users SET activo = 0 WHERE id = ?", [id]);

    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it("una ruta protegida sin token responde 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("un operador no puede listar usuarios (403)", async () => {
    const { token } = await userWithToken("operador");
    const res = await request(app).get("/api/users").set(bearer(token));
    expect(res.status).toBe(403);
  });

  it("RN-06: un admin no puede desactivarse a sí mismo", async () => {
    const { id, token } = await userWithToken("admin");
    const res = await request(app)
      .patch(`/api/users/${id}/activo`)
      .set(bearer(token))
      .send({ activo: false });
    expect(res.status).toBe(400);
  });

  it("cambiar contraseña con la actual incorrecta responde 400, no 401", async () => {
    const { token } = await userWithToken("operador");
    const res = await request(app)
      .put("/api/auth/password")
      .set(bearer(token))
      .send({ currentPassword: "incorrecta", newPassword: "NuevaClave123" });
    expect(res.status).toBe(400);
  });
});