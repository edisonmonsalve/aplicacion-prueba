type Level = "debug" | "info" | "warn" | "error";

const PRIORITY: Record<Level | "silent", number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const configured = (process.env.LOG_LEVEL ?? "info") as Level | "silent";

const SENSITIVE = /password|passwd|token|authorization|secret|cookie|set-cookie/i;

/** Evita que un log accidental incluya credenciales o tokens. */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncado]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE.test(key) ? "[oculto]" : sanitize(item, depth + 1),
      ])
    );
  }
  return value;
}

function write(level: Level, message: string, context?: Record<string, unknown>) {
  if (PRIORITY[level] < PRIORITY[configured]) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? (sanitize(context) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Logs estructurados en una línea JSON, listos para que un colector los indexe.
 * En producción se envían a stdout/stderr; el orquestador decide su destino.
 */
export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};
