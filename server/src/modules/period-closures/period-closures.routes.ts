import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
  createClosure,
  getClosure,
  listClosures,
  reopenClosure,
} from "./period-closures.service.js";
import {
  createClosureSchema,
  idSchema,
  reopenClosureSchema,
} from "./period-closures.schema.js";

export const periodClosuresRouter = Router();

periodClosuresRouter.use(authenticate);

periodClosuresRouter.get("/", requireRole("admin", "contador", "consulta"), async (_req, res, next) => {
  try {
    res.json(await listClosures());
  } catch (err) { next(err); }
});

periodClosuresRouter.get("/:id", requireRole("admin", "contador", "consulta"), async (req, res, next) => {
  try {
    res.json(await getClosure(idSchema.parse(req.params).id));
  } catch (err) { next(err); }
});

periodClosuresRouter.post("/", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const input = createClosureSchema.parse(req.body);
    res.status(201).json(await createClosure(input, req.user!));
  } catch (err) { next(err); }
});

periodClosuresRouter.post("/:id/reabrir", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    const input = reopenClosureSchema.parse(req.body);
    res.json(await reopenClosure(id, input, req.user!));
  } catch (err) { next(err); }
});
