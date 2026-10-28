import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../config/Db.js";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Uso: npm run seed:admin -- correo@ejemplo.com MiClave123");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);

await pool.query(
  "INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, 'admin')",
  ["Administrador", email, hash]
);

console.log(`Admin creado: ${email}`);
await pool.end();