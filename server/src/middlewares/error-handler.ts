import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ message: "Datos inválidos", errors: err.issues });
  } else if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
  } else if (err?.code === "ER_DUP_ENTRY") {
    res.status(409).json({ message: "El correo ya está registrado" });
  } else {
    console.error(err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};