import type { Rol } from "./roles.js";

export interface AuthUser {
  id: number;
  rol: Rol;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
