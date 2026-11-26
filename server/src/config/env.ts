import "dotenv/config";
import { z } from "zod";

// Valores de ejemplo que nunca deben llegar a un entorno real.
const PLACEHOLDER_SECRET = /cambia|cambiar|secreto-solo-para|demo1234/i;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1, "DB_HOST es obligatorio"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1, "DB_USER es obligatorio"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1, "DB_NAME es obligatorio"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET debe tener al menos 32 caracteres")
    .refine((value) => !PLACEHOLDER_SECRET.test(value), {
      message: "JWT_SECRET no puede ser un valor de ejemplo; genera uno aleatorio",
    }),
  /** Orígenes permitidos para CORS, separados por coma. Vacío = sin CORS. */
  CORS_ORIGINS: z
    .string()
    .default("")
    .refine((value) => !value.split(",").map((item) => item.trim()).includes("*"), {
      message: "CORS_ORIGINS no admite '*': enumera los orígenes permitidos",
    }),
  /** 1 = confiar en el proxy de delante para obtener la IP real. */
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
  /** 1 = desactivar el límite de intentos (solo pruebas locales). */
  RATE_LIMIT_DISABLED: z.enum(["0", "1"]).default("0"),
  /** Minutos que dura un token de acceso. */
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  /** Días que dura un refresh token. */
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  /** Intentos fallidos antes de bloquear temporalmente la cuenta. */
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  /** Minutos de bloqueo tras superar los intentos. */
  LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  /** Nivel mínimo de log: debug, info, warn, error o silent. */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`Configuración de entorno inválida:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;
