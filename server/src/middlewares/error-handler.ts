import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ message: "Datos inválidos", errors: err.issues });
  } else if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
  } else if (err?.code === "ER_DUP_ENTRY") {
    const detail = String(err.sqlMessage ?? "");
    const message = detail.includes("uq_products_sku")
      ? "El SKU ya existe"
      : detail.includes("uq_categories_nombre")
        ? "La categoría ya existe"
        : "El correo ya está registrado";
    res.status(409).json({ message });
  } else if (err?.code === "ER_NO_REFERENCED_ROW_2") {
    res.status(400).json({ message: "La categoría indicada no existe" });
  } else if (err?.code === "ER_ROW_IS_REFERENCED_2") {
    res.status(409).json({ message: "No se puede eliminar: tiene registros asociados" });
  } else {
    console.error(err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};