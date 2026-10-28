import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
  activoSchema,
  createUserSchema,
  idSchema,
  listQuerySchema,
  updateUserSchema,
} from "./users.schema.js";
import { createUser, listUsers, setActivo, updateUser } from "./users.service.js";

export const usersRouter = Router();

// Todo este módulo es solo para admin
usersRouter.use(authenticate, requireRole("admin"));

usersRouter.get("/", async (req, res) => {
  res.json(await listUsers(listQuerySchema.parse(req.query)));
});

usersRouter.post("/", async (req, res) => {
  const result = await createUser(createUserSchema.parse(req.body));
  res.status(201).json(result);
});

usersRouter.put("/:id", async (req, res) => {
  await updateUser(
    idSchema.parse(req.params.id),
    updateUserSchema.parse(req.body),
    req.user!.id
  );
  res.json({ message: "Usuario actualizado" });
});

usersRouter.patch("/:id/activo", async (req, res) => {
  await setActivo(
    idSchema.parse(req.params.id),
    activoSchema.parse(req.body).activo,
    req.user!.id
  );
  res.json({ message: "Estado actualizado" });
});