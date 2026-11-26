import { app } from "./app.js";
import { pool } from "./config/Db.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info("server_started", { port: env.PORT, env: env.NODE_ENV });
});

/** Cierre ordenado: deja de aceptar peticiones y cierra el pool de MariaDB. */
function shutdown(signal: string) {
  logger.info("server_stopping", { signal });
  server.close(() => {
    pool
      .end()
      .catch((err) => logger.error("pool_close_error", { error: err }))
      .finally(() => process.exit(0));
  });
  // Si una conexión se queda abierta, no bloquear el contenedor indefinidamente.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
