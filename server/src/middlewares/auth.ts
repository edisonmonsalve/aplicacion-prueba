import type { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser } from "../types/express.js";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as AuthUser;
    req.user = { id: payload.id, rol: payload.rol };
    next();
  } catch {
    res.status(401).json({ message: "Token inválido o expirado" });
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

export const denyReadOnly: RequestHandler = (req, res, next) => {
  if (req.user?.rol === "consulta" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return res.status(403).json({ message: "Tu rol es de solo lectura" });
  }
  next();
};

export const operateOnly: RequestHandler = (req, res, next) => {
  const safe = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (!safe && req.user?.rol !== "admin" && req.user?.rol !== "operador") {
    return res.status(403).json({ message: "Tu rol no puede modificar esta información" });
  }
  next();
};
