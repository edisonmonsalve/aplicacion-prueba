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

  it("rechaza contraseñas que no cumplen la política", async () => {
    const { token } = await userWithToken("operador");

    for (const newPassword of ["corta1", "sololetraslargas", "1234567890", "password123"]) {
      const res = await request(app)
        .put("/api/auth/password")
        .set(bearer(token))
        .send({ currentPassword: PASSWORD, newPassword });
      expect(res.status).toBe(400);
    }
  });

  it("rota el refresh token y rechaza el anterior", async () => {
    const { email } = await createUser("admin");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);

    const first = login.body.refreshToken as string;
    const rotated = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: first })
      .expect(200);

    expect(rotated.body.token).toBeTypeOf("string");
    expect(rotated.body.refreshToken).not.toBe(first);
    expect(rotated.body.user.email).toBe(email);

    // El token rotado sigue siendo válido una vez.
    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(200);

    // Reutilizar un token ya rotado cierra todas las sesiones.
    const reuse = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: first })
      .expect(401);
    expect(reuse.body.message).toContain("por seguridad");
  });

  it("logout revoca el refresh token", async () => {
    const { email } = await createUser("admin");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);

    await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);

    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it("bloquea la cuenta tras varios intentos fallidos y deja auditoría", async () => {
    const { id, email } = await createUser("admin");
    const intentoFallido = "ClaveIncorrecta123";

    for (let intento = 1; intento <= 5; intento += 1) {
      await request(app)
        .post("/api/auth/login")
        .send({ email, password: intentoFallido })
        .expect(401);
    }

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email, password: PASSWORD })
      .expect(429);
    expect(blocked.headers["retry-after"]).toBeDefined();

    const [users] = await pool.query<import("mysql2").RowDataPacket[]>(
      "SELECT failed_attempts, locked_until FROM users WHERE id = ?",
      [id]
    );
    expect(users[0].failed_attempts).toBe(5);
    expect(users[0].locked_until).not.toBeNull();

    const [audit] = await pool.query<import("mysql2").RowDataPacket[]>(
      "SELECT accion, entidad FROM audit_log WHERE user_id = ? ORDER BY id",
      [id]
    );
    expect(audit.map((row) => row.accion)).toEqual([
      "login_failed",
      "login_failed",
      "login_failed",
      "login_failed",
      "login_locked",
      "login_locked",
    ]);
    expect(audit.every((row) => row.entidad === "auth")).toBe(true);
  });
});