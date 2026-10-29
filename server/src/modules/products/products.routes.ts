import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
  activoSchema,
  createProductSchema,
  idSchema,
  listQuerySchema,
  updateProductSchema,
} from "./products.schema.js";
import {
  createProduct,
  listProducts,
  setProductActivo,
  updateProduct,
} from "./products.service.js";

export const productsRouter = Router();

productsRouter.use(authenticate);

productsRouter.get("/", async (req, res) => {
  res.json(await listProducts(listQuerySchema.parse(req.query)));
});

productsRouter.post("/", async (req, res) => {
  res.status(201).json(await createProduct(createProductSchema.parse(req.body)));
});

productsRouter.put("/:id", async (req, res) => {
  await updateProduct(idSchema.parse(req.params.id), updateProductSchema.parse(req.body));
  res.json({ message: "Producto actualizado" });
});

productsRouter.patch("/:id/activo", requireRole("admin"), async (req, res) => {
  await setProductActivo(idSchema.parse(req.params.id), activoSchema.parse(req.body).activo);
  res.json({ message: "Estado actualizado" });
});