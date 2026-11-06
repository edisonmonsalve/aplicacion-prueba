import { Router } from "express";
import { authenticate, operateOnly } from "../../middlewares/auth.js";
import { createMovementSchema, listQuerySchema } from "./movements.schema.js";
import { listMovements, registerMovement } from "./movements.service.js";

export const movementsRouter = Router();

movementsRouter.use(authenticate, operateOnly);

movementsRouter.get("/", async (req, res) => {
  res.json(await listMovements(listQuerySchema.parse(req.query), req.user!));
});

movementsRouter.post("/", async (req, res) => {
  const input = createMovementSchema.parse(req.body);
  res.status(201).json(await registerMovement(input, req.user!));
});
