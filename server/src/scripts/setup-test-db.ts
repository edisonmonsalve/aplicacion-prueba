import { config } from "dotenv";
import mysql from "mysql2/promise";
import { runMigrations } from "../db/migrator.js";

config({ path: ".env.test", override: true });

const dbName = process.env.DB_NAME ?? "";
if (!dbName.endsWith("_test")) {
  console.error("DB_NAME debe terminar en _test");
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
await conn.end();

await runMigrations();
console.log(`Base ${dbName} lista`);