import type { RequestHandler } from "express";
import { env } from "../config/env.js";

interface RateLimitOptions {
  /** Ventana en milisegundos. */
  windowMs?: number;
  /** Intentos permitidos por ventana e IP. */
  max?: number;
  message?: string;
  /** Permite desactivarlo en pruebas unitarias o entornos controlados. */
  enabled?: boolean;
}

interface Entry {
  count: number;
  resetAt: number;
}

/**
 * Límite de intentos en memoria, suficiente para una sola instancia.
 *
 * En un despliegue con varias réplicas hay que sustituirlo por un almacén
 * compartido (Redis) para que el límite sea global.
 */
export function rateLimit({
  windowMs = 15 * 60_000,
  max = 20,
  message = "Demasiados intentos. Inténtalo de nuevo más tarde.",
  enabled = env.RATE_LIMIT_DISABLED !== "1" && env.NODE_ENV !== "test",
}: RateLimitOptions = {}): RequestHandler {
  const hits = new Map<string, Entry>();

  return (req, res, next) => {
    if (!enabled) return next();

    const now = Date.now();
    const key = req.ip ?? req.socket.remoteAddress ?? "desconocido";
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ message });
    }

    // Limpieza oportunista para que el mapa no crezca sin límite.
    if (hits.size > 5_000) {
      for (const [ip, value] of hits) {
        if (value.resetAt <= now) hits.delete(ip);
      }
    }

    next();
  };
}

/** Protege el login frente a fuerza bruta. */
export const loginRateLimit = rateLimit({ max: 20 });

/** Protege el cambio de contraseña autenticado. */
export const passwordRateLimit = rateLimit({ max: 10 });

/** Limita la rotación de refresh tokens por IP. */
export const refreshRateLimit = rateLimit({ max: 60 });
