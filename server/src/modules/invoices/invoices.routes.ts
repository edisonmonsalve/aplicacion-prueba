import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
  cancelInvoice,
  confirmInvoice,
  createInvoice,
  deleteInvoice,
  getInvoice,
  listInvoices,
  updateInvoice,
} from "./invoices.service.js";
import {
  createInvoiceSchema,
  idSchema,
  listQuerySchema,
  updateInvoiceSchema,
} from "./invoices.schema.js";
import { z } from "zod";

export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

invoicesRouter.get("/", requireRole("admin", "contador", "operador", "consulta"), async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    res.json(await listInvoices(q));
  } catch (err) { next(err); }
});

invoicesRouter.get("/:id", requireRole("admin", "contador", "operador", "consulta"), async (req, res, next) => {
  try {
    res.json(await getInvoice(idSchema.parse(req.params).id));
  } catch (err) { next(err); }
});

invoicesRouter.post("/", requireRole("admin", "contador", "operador"), async (req, res, next) => {
  try {
    const input = createInvoiceSchema.parse(req.body);
    const result = await createInvoice(input, req.user!);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

invoicesRouter.put("/:id", requireRole("admin", "contador", "operador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    const input = updateInvoiceSchema.parse(req.body);
    res.json(await updateInvoice(id, input));
  } catch (err) { next(err); }
});

invoicesRouter.post("/:id/confirmar", requireRole("admin", "contador", "operador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    res.json(await confirmInvoice(id, req.user!));
  } catch (err) { next(err); }
});

invoicesRouter.post("/:id/anular", requireRole("admin", "contador", "operador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    res.json(await cancelInvoice(id, req.user!));
  } catch (err) { next(err); }
});

invoicesRouter.delete("/:id", requireRole("admin", "contador", "operador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    res.json(await deleteInvoice(id));
  } catch (err) { next(err); }
});