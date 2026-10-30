import { config } from "dotenv";

config({ path: ".env.test", override: true });

if (!process.env.DB_NAME?.endsWith("_test")) {
  throw new Error("Las pruebas solo pueden correr contra una base cuyo nombre termine en _test");
}