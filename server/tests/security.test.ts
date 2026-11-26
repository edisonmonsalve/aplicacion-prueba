import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { rateLimit } from "../src/middlewares/rate-limit.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

describe("seguridad", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("añade cabeceras de seguridad y oculta X-Powered-By", async () => {
    const res = await request(app).get("/api/health").expect(200);

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("bloquea después del máximo de intentos y envía Retry-After", async () => {
    const limited = express();
    limited.get(
      "/recurso",
      rateLimit({ max: 2, windowMs: 60_000, enabled: true }),
      (_req, res) => res.json({ ok: true })
    );

    await request(limited).get("/recurso").expect(200);
    await request(limited).get("/recurso").expect(200);

    const blocked = await request(limited).get("/recurso").expect(429);
    expect(blocked.body.message).toContain("Demasiados intentos");
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.headers["ratelimit-remaining"]).toBe("0");
  });

  it("rechaza el token de un usuario desactivado", async () => {
    const user = await userWithToken("admin");
    await pool.query("UPDATE users SET activo = 0 WHERE id = ?", [user.id]);

    const res = await request(app).get("/api/auth/me").set(bearer(user.token));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Sesión inválida");
  });

  it("usa el rol actual de la base y no el del token", async () => {
    const user = await userWithToken("admin");
    await pool.query("UPDATE users SET rol = 'consulta' WHERE id = ?", [user.id]);

    const res = await request(app).get("/api/users").set(bearer(user.token));

    expect(res.status).toBe(403);
  });

  it("no emite CORS sin orígenes configurados", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "https://sitio-no-permitido.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("responde 400 ante un JSON mal formado", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("El cuerpo de la petición no es JSON válido");
  });

  it("expone salud con latencia y métricas solo para administradores", async () => {
    const health = await request(app).get("/api/health").expect(200);
    expect(health.body.status).toBe("ok");
    expect(health.body.db.latency_ms).toBeTypeOf("number");
    expect(health.headers["x-request-id"]).toBeDefined();

    const admin = await userWithToken("admin");
    const metrics = await request(app).get("/api/metrics").set(bearer(admin.token)).expect(200);
    expect(metrics.body.requests.total).toBeGreaterThan(0);
    expect(metrics.body.routes).toBeInstanceOf(Array);

    const operador = await userWithToken("operador");
    await request(app).get("/api/metrics").set(bearer(operador.token)).expect(403);
  });
});
