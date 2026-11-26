import { createHash, randomBytes } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import { env } from "../../config/env.js";
import { signToken } from "../../config/jwt.js";
import type { Rol } from "../../types/roles.js";

const TOKEN_BYTES = 48;
const TOKEN_HASH = "sha256";

const hashToken = (token: string) => createHash(TOKEN_HASH).update(token).digest("hex");

interface RefreshRow extends RowDataPacket {
  id: number;
  user_id: number;
  revoked_at: Date | null;
  expires_at: Date;
  nombre: string;
  email: string;
  rol: Rol;
  activo: number;
}

export interface SessionUser {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

export type RefreshResult =
  | { status: "ok"; token: string; refreshToken: string; user: SessionUser }
  | { status: "invalid" }
  /** El token ya se había usado: posible robo. Se cierran todas las sesiones. */
  | { status: "reused" };

async function insertRefreshToken(conn: PoolConnection, userId: number): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  await conn.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [userId, hashToken(token), env.REFRESH_TOKEN_DAYS]
  );
  return token;
}

/** Emite un refresh token nuevo para una sesión recién iniciada. */
export async function issueRefreshToken(userId: number): Promise<string> {
  const conn = await pool.getConnection();
  try {
    return await insertRefreshToken(conn, userId);
  } finally {
    conn.release();
  }
}

/**
 * Rota un refresh token: lo invalida y entrega uno nuevo junto con otro token
 * de acceso. La rotación se hace en una transacción para que dos peticiones
 * simultáneas no puedan reutilizar el mismo token.
 */
export async function rotateRefreshToken(rawToken: string): Promise<RefreshResult> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RefreshRow[]>(
      `SELECT rt.id, rt.user_id, rt.revoked_at, rt.expires_at,
              u.nombre, u.email, u.rol, u.activo
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ?
       FOR UPDATE`,
      [hashToken(rawToken)]
    );
    const row = rows[0];

    if (!row) {
      await conn.rollback();
      return { status: "invalid" };
    }

    // Un token revocado que vuelve a aparecer indica reutilización: se anulan
    // todas las sesiones del usuario y se obliga a iniciar sesión de nuevo.
    if (row.revoked_at) {
      await conn.query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
        [row.user_id]
      );
      await conn.commit();
      return { status: "reused" };
    }

    const expired = new Date(row.expires_at).getTime() <= Date.now();
    if (expired || !row.activo) {
      await conn.rollback();
      return { status: "invalid" };
    }

    await conn.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?", [row.id]);
    const refreshToken = await insertRefreshToken(conn, row.user_id);
    await conn.commit();

    const user: SessionUser = {
      id: row.user_id,
      nombre: row.nombre,
      email: row.email,
      rol: row.rol,
    };
    return {
      status: "ok",
      token: signToken({ id: user.id, rol: user.rol }),
      refreshToken,
      user,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Revoca un refresh token concreto. Es idempotente. */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
    [hashToken(rawToken)]
  );
}

/** Cierra todas las sesiones de un usuario (por ejemplo, al cambiar la contraseña). */
export async function revokeUserSessions(userId: number): Promise<void> {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
    [userId]
  );
}

/**
 * Limpieza oportunista de tokens caducados. No es crítica: el tamaño de la
 * tabla se mantiene pequeño incluso sin ejecutarla.
 */
export async function purgeExpiredRefreshTokens(): Promise<void> {
  await pool.query(
    "DELETE FROM refresh_tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)"
  );
}
