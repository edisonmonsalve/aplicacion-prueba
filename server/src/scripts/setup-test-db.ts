import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import mysql from "mysql2/promise";

config({ path: ".env.test", override: true });

const dbName = process.env.DB_NAME ?? "";
if (!dbName.endsWith("_test")) {
  console.error("DB_NAME debe terminar en _test");
  process.exit(1);
}

const schema = (await readFile("db/schema.sql", "utf8")).replace(/\binventario\b/g, dbName);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
});

await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
await conn.query(schema);
await conn.end();

console.log(`Base ${dbName} lista`);