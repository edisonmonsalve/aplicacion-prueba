import { Router } from "express";
import { authenticate } from "../../middlewares/auth.js";
import {
  loginRateLimit,
  passwordRateLimit,
  refreshRateLimit,
} from "../../middlewares/rate-limit.js";
import {
  changePassword,
  changePasswordSchema,
  login,
  loginSchema,
  refreshTokenSchema,
} from "./auth.service.js";
import { revokeRefreshToken, rotateRefreshToken } from "./refresh-tokens.js";
import { logger } from "../../utils/logger.js";

export const authRouter = Router();

authRouter.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

authRouter.post("/login", loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos inválidos" });
  }

  const result = await login(parsed.data.email, parsed.data.password);
  if (result.status === "locked") {
    res.setHeader("Retry-After", String(result.retryAfter));
    return res.status(429).json({
      message: "Demasiados intentos fallidos. Espera antes de volver a intentarlo.",
    });
  }
  if (result.status === "invalid") {
    return res.status(401).json({ message: "Credenciales incorrectas" });
  }

  res.json({
    token: result.token,
    refreshToken: result.refreshToken,
    user: result.user,
  });
});

authRouter.post("/refresh", refreshRateLimit, async (req, res) => {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos inválidos" });
  }

  const result = await rotateRefreshToken(parsed.data.refreshToken);
  if (result.status === "reused") {
    logger.warn("refresh_token_reuse", { requestId: res.getHeader("X-Request-Id") });
    return res.status(401).json({
      message: "La sesión se cerró por seguridad. Inicia sesión de nuevo.",
    });
  }
  if (result.status !== "ok") {
    return res.status(401).json({ message: "Sesión expirada. Inicia sesión de nuevo." });
  }

  res.json({
    token: result.token,
    refreshToken: result.refreshToken,
    user: result.user,
  });
});

authRouter.post("/logout", refreshRateLimit, async (req, res) => {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (parsed.success) await revokeRefreshToken(parsed.data.refreshToken);
  // Idempotente: cerrar una sesión ya cerrada no es un error.
  res.status(204).end();
});

authRouter.put("/password", authenticate, passwordRateLimit, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await changePassword(req.user!.id, currentPassword, newPassword);
  res.json({ message: "Contraseña actualizada" });
});
