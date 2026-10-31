import { Router } from "express";
import { authenticate } from "../../middlewares/auth.js";
import { idSchema, quoteSchema } from "./quotes.schema.js";
import { createQuote, deleteQuote, updateQuote } from "./quotes.service.js";

export const quotesRouter = Router();

quotesRouter.use(authenticate);

quotesRouter.post("/", async (req, res) => {
  const result = await createQuote(quoteSchema.parse(req.body), req.user!);
  res.status(201).json(result);
});

quotesRouter.put("/:id", async (req, res) => {
  const result = await updateQuote(idSchema.parse(req.params.id), quoteSchema.parse(req.body), req.user!);
  res.json(result);
});

quotesRouter.delete("/:id", async (req, res) => {
  await deleteQuote(idSchema.parse(req.params.id), req.user!);
  res.json({ message: "Presupuesto eliminado" });
});