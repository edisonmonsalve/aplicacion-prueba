import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import { metricsSnapshot } from "../../utils/metrics.js";

export const opsRouter = Router();

/**
 * Métricas operativas en JSON. Se limitan a administradores porque revelan
 * rutas y volúmenes de uso. Para Prometheus, un colector puede leerlas y
 * convertirlas, o se puede añadir un exportador en el futuro.
 */
opsRouter.get("/metrics", authenticate, requireRole("admin"), (_req, res) => {
  res.set("Cache-Control", "no-store").json(metricsSnapshot());
});
