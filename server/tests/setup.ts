import { config } from "dotenv";

config({ path: ".env.test", override: true });

// La suite hace muchos logins seguidos: el límite se prueba aparte.
process.env.RATE_LIMIT_DISABLED = "1";
// Los logs estructurados no aportan nada en la salida de las pruebas.
process.env.LOG_LEVEL = "silent";

if (!process.env.DB_NAME?.endsWith("_test")) {
  throw new Error("Las pruebas solo pueden correr contra una base cuyo nombre termine en _test");
}