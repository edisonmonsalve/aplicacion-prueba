import jwt from "jsonwebtoken";
import { ROLES } from "../types/roles.js";
import type { Rol } from "../types/roles.js";
import { env } from "./env.js";

export const JWT_ISSUER = "inventario-api";
export const JWT_AUDIENCE = "inventario-client";

export interface TokenPayload {
  id: number;
  rol: Rol;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

export function verifyToken(token: string): TokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  if (
    typeof payload === "string" ||
    typeof payload.id !== "number" ||
    !ROLES.includes(payload.rol as Rol)
  ) {
    throw new Error("Token con contenido inválido");
  }

  return { id: payload.id, rol: payload.rol as Rol };
}
