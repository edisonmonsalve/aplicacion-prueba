import express from "express";
import { env } from "./config/env.js";
import { pool } from "./config/Db.js";
import { HEALTH_PATH, apiMounts } from "./routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { corsMiddleware, securityHeaders } from "./middlewares/security.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { buildOpenApiDocument } from "./docs/openapi.js";
import { swaggerUiHtml } from "./docs/swagger-ui.js";
import { logger } from "./utils/logger.js";

export const app = express();

app.disable("x-powered-by");
if (env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(requestLogger);
// Los adjuntos de compra viajan en base64 dentro de JSON: 5 MB de archivo
// ocupan ~6,7 MB codificados, por lo que el límite se eleva de 1 MB a 7 MB.
app.use(express.json({ limit: "7mb" }));

app.get(HEALTH_PATH, async (_req, res) => {
  const start = process.hrtime.bigint();
  try {
    await pool.query("SELECT 1");
    const latency = Number(process.hrtime.bigint() - start) / 1_000_000;
    res.json({
      status: "ok",
      uptime_seconds: Math.round(process.uptime()),
      db: { status: "ok", latency_ms: Math.round(latency * 10) / 10 },
    });
  } catch (err) {
    logger.error("health_db_error", { error: err });
    res.status(503).json({
      status: "degraded",
      uptime_seconds: Math.round(process.uptime()),
      db: { status: "error" },
    });
  }
});

// Documentación: 404 en producción salvo override explícito. No se registra la
// ruta para no revelar su existencia; la spec se construye solo cuando aplica.
if (env.API_DOCS_ENABLED === "1") {
  const openApiDocument = buildOpenApiDocument();
  app.get("/api/openapi.json", (_req, res) => {
    res.set("Cache-Control", "public, max-age=300").json(openApiDocument);
  });
  app.get("/api/docs", (_req, res) => {
    res.type("html").send(swaggerUiHtml);
  });
}

for (const mount of apiMounts) app.use(mount.path, mount.router);

app.use(errorHandler); // siempre al final
