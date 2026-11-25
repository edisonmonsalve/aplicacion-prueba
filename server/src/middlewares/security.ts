import cors from "cors";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";

/** Cabeceras básicas para la API. La CSP se deja al servidor de estáticos. */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
};

const allowedOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Sin `CORS_ORIGINS` no se emiten cabeceras CORS: el cliente usa el proxy de
 * Vite o el mismo origen. En producción hay que enumerar los orígenes reales.
 */
export const corsMiddleware = cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
});
