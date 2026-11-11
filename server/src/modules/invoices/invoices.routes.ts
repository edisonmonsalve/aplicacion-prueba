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
import {
  createPaymentSchema,
  agingQuerySchema,
  paymentParamsSchema,
  receivableQuerySchema,
} from "./invoice-payments.schema.js";
import {
  cancelPayment,
  carteraAging,
  createPayment,
  listInvoicePayments,
  listReceivables,
} from "./invoice-payments.service.js";
import {
  adjustmentParamsSchema,
  createAdjustmentSchema,
} from "./invoice-adjustments.schema.js";
import {
  cancelAdjustment,
  createAdjustment,
  listAdjustments,
} from "./invoice-adjustments.service.js";

export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

// Cartera CxC/CxP. Va antes de /:id para que "cartera" no se interprete como id.
invoicesRouter.get("/cartera", requireRole("admin", "contador", "consulta"), async (req, res, next) => {
  try {
    res.json(await listReceivables(receivableQuerySchema.parse(req.query)));
  } catch (err) { next(err); }
});

invoicesRouter.get("/cartera/aging", requireRole("admin", "contador", "consulta"), async (req, res, next) => {
  try {
    res.json(await carteraAging(agingQuerySchema.parse(req.query)));
  } catch (err) { next(err); }
});

invoicesRouter.get("/:id/payments", requireRole("admin", "contador", "consulta"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    res.json(await listInvoicePayments(id));
  } catch (err) { next(err); }
});

invoicesRouter.post("/:id/payments", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    const input = createPaymentSchema.parse(req.body);
    res.status(201).json(await createPayment(id, input, req.user!));
  } catch (err) { next(err); }
});

invoicesRouter.post("/:id/payments/:paymentId/anular", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const { id, paymentId } = paymentParamsSchema.parse(req.params);
    res.json(await cancelPayment(id, paymentId, req.user!));
  } catch (err) { next(err); }
});

// Notas crédito/débito sobre facturas confirmadas.
invoicesRouter.get("/:id/notas", requireRole("admin", "contador", "consulta", "operador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    res.json(await listAdjustments(id));
  } catch (err) { next(err); }
});

invoicesRouter.post("/:id/notas", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    const input = createAdjustmentSchema.parse(req.body);
    res.status(201).json(await createAdjustment(id, input, req.user!));
  } catch (err) { next(err); }
});

invoicesRouter.post("/:id/notas/:adjustmentId/anular", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const { id, adjustmentId } = adjustmentParamsSchema.parse(req.params);
    res.json(await cancelAdjustment(id, adjustmentId, req.user!));
  } catch (err) { next(err); }
});

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