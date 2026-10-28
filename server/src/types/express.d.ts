export interface AuthUser {
  id: number;
  rol: "admin" | "operador";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}