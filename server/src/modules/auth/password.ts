import { z } from "zod";

/** Longitud mínima de una contraseña. Debe coincidir con la ayuda del cliente. */
export const PASSWORD_MIN_LENGTH = 10;

/** Contraseñas habituales que no deben aceptarse aunque cumplan la longitud. */
const COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678910",
  "contrasena",
  "contraseña",
  "password10",
  "password123",
  "password1234",
  "qwerty1234",
  "admin12345",
  "inventario",
  "demo123456",
]);

/**
 * Política de contraseñas del sistema.
 *
 * Se exige longitud, al menos una letra y un número, y se rechazan valores
 * obvios. No se exige símbolo para no empujar a sustituciones predecibles
 * (`Password1!`); la longitud aporta más entropía.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(72, "La contraseña no puede superar 72 caracteres")
  .refine((value) => /[A-Za-z]/.test(value), "La contraseña debe incluir al menos una letra")
  .refine((value) => /\d/.test(value), "La contraseña debe incluir al menos un número")
  .refine(
    (value) => !COMMON_PASSWORDS.has(value.toLowerCase()),
    "Esa contraseña es demasiado común; elige otra"
  );
