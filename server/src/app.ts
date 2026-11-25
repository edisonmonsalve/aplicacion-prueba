import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./config/Db.js";
import { HEALTH_PATH, apiMounts } from "./routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { buildOpenApiDocument } from "./docs/openapi.js";
import { swaggerUiHtml } from "./docs/swagger-ui.js";

export const app = express();

const openApiDocument = buildOpenApiDocument();

app.use(cors());
app.use(express.json());

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