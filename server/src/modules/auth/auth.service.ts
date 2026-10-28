import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/Db.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface UserRow extends RowDataPacket {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
  rol: "admin" | "operador";
  activo: number;
}

export async function login(email: string, password: string) {
  const [rows] = await pool.query<UserRow[]>(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  const user = rows[0];

  // Mismo mensaje en ambos casos: no revelar si el correo existe
  if (!user || !user.activo || !(await bcrypt.compare(password, user.password_hash))) {
    return null;
  }

  const token = jwt.sign(
    { id: user.id, rol: user.rol },
    process.env.JWT_SECRET!,
    { expiresIn: "8h" }
  );

  return {
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  };
}