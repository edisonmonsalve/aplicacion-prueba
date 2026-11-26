import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../config/Db.js";
import { verifyToken } from "../config/jwt.js";
import type { AuthUser } from "../types/express.js";

interface SessionRow extends RowDataPacket {
  rol: AuthUser["rol"];
  activo: number;
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token requerido" });
  }

  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }

  try {
    // El token no basta: un usuario desactivado o degradado pierde el acceso.
    const [rows] = await pool.query<SessionRow[]>(
      "SELECT rol, activo FROM users WHERE id = ?",
      [payload.id]
    );
    const user = rows[0];
    if (!user || !user.activo) {
      return res.status(401).json({ message: "Sesión inválida" });
    }

    req.user = { id: payload.id, rol: user.rol };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: AuthUser["rol"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: "No tienes permiso" });
    }
    next();
  };
}

export const operateOnly: RequestHandler = (req, res, next) => {
  const safe = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (!safe && req.user?.rol !== "admin" && req.user?.rol !== "operador") {
    return res.status(403).json({ message: "Tu rol no puede modificar esta información" });
  }
  next();
};
