import { z } from "zod";

const rol = z.enum(["admin", "operador"]);

export const createUserSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150),
  password: z.string().min(8).max(72), // bcrypt solo usa los primeros 72 bytes
  rol,
});

export const updateUserSchema = createUserSchema.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().optional(),
  rol: rol.optional(),
  activo: z.enum(["0", "1"]).optional(),
});

export const activoSchema = z.object({ activo: z.boolean() });
export const idSchema = z.coerce.number().int().positive();