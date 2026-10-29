import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
  categorySchema,
  createCategory,
  deleteCategory,
  idSchema,
  listCategories,
  updateCategory,
} from "./categories.service.js";

export const categoriesRouter = Router();

categoriesRouter.use(authenticate);

categoriesRouter.get("/", async (_req, res) => {
  res.json(await listCategories());
});

categoriesRouter.post("/", requireRole("admin"), async (req, res) => {
  const { nombre } = categorySchema.parse(req.body);
  res.status(201).json(await createCategory(nombre));
});

categoriesRouter.put("/:id", requireRole("admin"), async (req, res) => {
  const { nombre } = categorySchema.parse(req.body);
  await updateCategory(idSchema.parse(req.params.id), nombre);
  res.json({ message: "Categoría actualizada" });
});

categoriesRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  await deleteCategory(idSchema.parse(req.params.id));
  res.json({ message: "Categoría eliminada" });
});