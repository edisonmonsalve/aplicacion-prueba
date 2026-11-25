import express from "express";
import { env } from "./config/env.js";
import { pool } from "./config/Db.js";
import { HEALTH_PATH, apiMounts } from "./routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { corsMiddleware, securityHeaders } from "./middlewares/security.js";
import { buildOpenApiDocument } from "./docs/openapi.js";
import { swaggerUiHtml } from "./docs/swagger-ui.js";

export const app = express();

const openApiDocument = buildOpenApiDocument();

app.disable("x-powered-by");
if (env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));

app.get(HEALTH_PATH, async (_req, res) => {
  const [rows] = await pool.query("SELECT 1 AS ok");
  res.json({ status: "ok", db: rows });
});

// Documentación pública: la spec se construye desde los esquemas Zod y el router real.
app.get("/api/openapi.json", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300").json(openApiDocument);
});
app.get("/api/docs", (_req, res) => {
  res.type("html").send(swaggerUiHtml);
});

for (const mount of apiMounts) app.use(mount.path, mount.router);

app.use(errorHandler); // siempre al final