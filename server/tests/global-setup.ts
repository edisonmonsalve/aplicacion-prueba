import { config } from "dotenv";
import { runMigrations } from "../src/db/migrator.js";

// Deja la base de pruebas al día antes de cualquier archivo de pruebas.
export default async function globalSetup() {
  config({ path: ".env.test", override: true });
  await runMigrations();
}
