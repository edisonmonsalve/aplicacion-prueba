import bcrypt from "bcryptjs";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { pool } from "../../config/Db.js";
import { env } from "../../config/env.js";
import { signToken } from "../../config/jwt.js";
import type { Rol } from "../../types/roles.js";
import { HttpError } from "../../utils/http-error.js";
import { passwordSchema } from "./password.js";
import { issueRefreshToken, revokeUserSessions } from "./refresh-tokens.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});

interface UserRow extends RowDataPacket {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
  rol: Rol;
  activo: number;
  failed_attempts: number;
  locked_until: Date | null;
}

export interface SessionUser {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

export type LoginResult =
  | {
      status: "ok";
      token: string;
      refreshToken: string;
      user: SessionUser;
    }
  | { status: "invalid" }
  | { status: "locked"; retryAfter: number };

/**
 * Deja rastro de un intento fallido. No se guarda la contraseña ni el hash;
 * solo el correo intentado (para detectar ataques dirigidos) y el motivo.
 */
async function auditLoginAttempt(
  email: string,
  userId: number | null,
  accion: "login_failed" | "login_locked",
  detalle: Record<string, unknown>
) {
  await pool.query(
    `INSERT INTO audit_log (user_id, entidad, entidad_id, accion, antes, despues)
     VALUES (?, 'auth', ?, ?, NULL, ?)`,
    [userId, userId ?? 0, accion, JSON.stringify({ email: email.toLowerCase(), ...detalle })]
  );
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const [rows] = await pool.query<UserRow[]>(
    `SELECT id, nombre, email, password_hash, rol, activo, failed_attempts, locked_until
     FROM users WHERE email = ?`,
    [email]
  );
  const user = rows[0];

  if (user?.locked_until && user.locked_until.getTime() > Date.now()) {
    const retryAfter = Math.max(1, Math.ceil((user.locked_until.getTime() - Date.now()) / 1000));
    await auditLoginAttempt(email, user.id, "login_locked", { bloqueado: true });
    return { status: "locked", retryAfter };
  }

  // Si el bloqueo ya expiró se vuelve a contar desde cero: un intento fallido
  // aislado no debe rebloquear la cuenta de inmediato.
  if (user?.locked_until) {
    await pool.query(
      "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?",
      [user.id]
    );
    user.failed_attempts = 0;
    user.locked_until = null;
  }

  // Mismo mensaje en ambos casos: no revelar si el correo existe
  const valid =
    user !== undefined && user.activo === 1 && (await bcrypt.compare(password, user.password_hash));

  if (!valid) {
    if (user) {
      const attempts = user.failed_attempts + 1;
      const blocked = attempts >= env.MAX_LOGIN_ATTEMPTS;
      await pool.query(
        `UPDATE users
         SET failed_attempts = ?,
             locked_until = IF(?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NULL)
         WHERE id = ?`,
        [attempts, blocked, env.LOCKOUT_MINUTES, user.id]
      );
      await auditLoginAttempt(email, user.id, blocked ? "login_locked" : "login_failed", {
        intentos: attempts,
        bloqueado: blocked,
      });
    } else {
      await auditLoginAttempt(email, null, "login_failed", {});
    }
    return { status: "invalid" };
  }

  await pool.query(
    "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?",
    [user.id]
  );

  const token = signToken({ id: user.id, rol: user.rol });
  const refreshToken = await issueRefreshToken(user.id);

  return {
    status: "ok",
    token,
    refreshToken,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
    },
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

  // Cambiar la contraseña cierra las demás sesiones; el token de acceso actual
  // sigue vivo hasta que caduque (15 minutos por defecto).
  await revokeUserSessions(userId);
}
