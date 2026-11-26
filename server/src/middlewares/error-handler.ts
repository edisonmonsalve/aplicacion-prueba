import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ message: "Datos inválidos", errors: err.issues });
  } else if (err instanceof HttpError) {
    res.status(err.status).json({
      message: err.message,
      ...(err.details !== undefined && { errors: err.details }),
    });
  } else if (err?.code === "ER_DUP_ENTRY") {
    const detail = String(err.sqlMessage ?? "");
    const message = detail.includes("uq_products_sku")
      ? "El SKU ya existe"
      : detail.includes("uq_categories_nombre")
        ? "La categoría ya existe"
        : detail.includes("uq_budgets_activo")
          ? "Ya existe un presupuesto activo para ese periodo"
          : detail.includes("uq_budget_lines")
            ? "La línea de presupuesto ya existe"
            : detail.includes("uq_transactions")
              ? "La transacción ya existe"
              : "El correo ya está registrado";
    res.status(409).json({ message });
  } else if (err?.code === "ER_NO_REFERENCED_ROW_2") {
    res.status(400).json({ message: "La categoría indicada no existe" });
  } else if (err?.code === "ER_ROW_IS_REFERENCED_2") {
    res.status(409).json({ message: "No se puede eliminar: tiene registros asociados" });
  } else if (err?.type === "entity.too.large") {
    res.status(413).json({ message: "La petición supera el tamaño máximo permitido" });
  } else if (err?.type === "entity.parse.failed") {
    res.status(400).json({ message: "El cuerpo de la petición no es JSON válido" });
  } else {
    logger.error("unhandled_error", {
      requestId: res.getHeader("X-Request-Id"),
      method: req.method,
      path: req.path,
      error: err,
    });
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
