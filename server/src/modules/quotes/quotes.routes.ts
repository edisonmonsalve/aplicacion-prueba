import { Router } from "express";
import { authenticate } from "../../middlewares/auth.js";
import { getQuote, listQuotes } from "./quotes.queries.js";
import { idSchema, listQuerySchema, quoteSchema } from "./quotes.schema.js";
import { createQuote, deleteQuote, duplicateQuote, updateQuote, transitionQuote } from "./quotes.service.js";
import { getQuoteHistoryById } from "./quotes.service.js";

export const quotesRouter = Router();

quotesRouter.use(authenticate);

quotesRouter.get("/", async (req, res) => {
  res.json(await listQuotes(listQuerySchema.parse(req.query), req.user!));
});

quotesRouter.get("/:id", async (req, res) => {
  res.json(await getQuote(idSchema.parse(req.params.id), req.user!));
});

quotesRouter.post("/", async (req, res) => {
  const result = await createQuote(quoteSchema.parse(req.body), req.user!);
  res.status(201).json(result);
});

quotesRouter.post("/:id/duplicate", async (req, res) => {
  const result = await duplicateQuote(idSchema.parse(req.params.id), req.user!);
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

quotesRouter.post("/:id/send", async (req, res) => {
  const result = await transitionQuote(
    idSchema.parse(req.params.id),
    "enviado",
    req.user!
  );

  res.json(result);
});

// Aprobar presupuesto
quotesRouter.post("/:id/approve", async (req, res) => {
  const result = await transitionQuote(
    idSchema.parse(req.params.id),
    "aprobado",
    req.user!
  );

  res.json(result);
});

// Rechazar presupuesto
quotesRouter.post("/:id/reject", async (req, res) => {
  const result = await transitionQuote(
    idSchema.parse(req.params.id),
    "rechazado",
    req.user!
  );

  res.json(result);
});

quotesRouter.get("/:id/history", async (req, res) => {
  const result = await getQuoteHistoryById(
    idSchema.parse(req.params.id),
    req.user!
  );

  res.json(result);
});