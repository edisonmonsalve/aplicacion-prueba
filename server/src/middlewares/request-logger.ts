import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../utils/logger.js";
import { recordRequest } from "../utils/metrics.js";

const requestIdPattern = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Asigna un identificador por petición, mide su latencia y emite una línea de
 * log al terminar. No registra cuerpos, tokens ni direcciones IP.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", requestId);

  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const route = req.route?.path
      ? `${req.baseUrl}${String(req.route.path)}`.replace(/:\w+/g, ":id")
      : req.path;

    recordRequest(route, res.statusCode, durationMs);
    logger.info("request", {
      requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
    });
  });

  next();
};
