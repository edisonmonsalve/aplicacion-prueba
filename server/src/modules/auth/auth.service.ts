import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
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

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
) {
  const [rows] = await pool.query<UserRow[]>(
    "SELECT * FROM users WHERE id = ? AND activo = 1",
    [userId]
  );
  const user = rows[0];
  if (!user) throw new HttpError(401, "Sesión inválida");

  // Se exige la contraseña actual: un token robado no basta para cambiarla
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw new HttpError(400, "La contraseña actual es incorrecta");
  }
  if (currentPassword === newPassword) {
    throw new HttpError(400, "La nueva contraseña debe ser distinta a la actual");
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);
}