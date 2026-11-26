import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import { idSchema } from "../invoices/invoices.schema.js";
import {
  attachmentParamsSchema,
  attachmentSchema,
  approvalDecisionSchema,
  lastPriceQuerySchema,
  priceHistoryQuerySchema,
  purchaseSettingsSchema,
} from "./purchase-prices.schema.js";
import {
  addAttachment,
  decideApproval,
  getApproval,
  getSettings,
  listAttachments,
  listLastPrices,
  listPriceHistory,
  removeAttachment,
  requestApproval,
  updateSettings,
  validarCompraFactura,
} from "./purchase-prices.service.js";

/** Configuración, histórico y aprobaciones; se monta en `/api/purchase-prices`. */
export const purchasePricesRouter = Router();
purchasePricesRouter.use(authenticate);

purchasePricesRouter.get(
  "/settings",
  requireRole("admin", "contador", "operador", "consulta"),
  async (_req, res, next) => {
    try {
      res.json(await getSettings());
    } catch (err) {
      next(err);
    }
  }
);

purchasePricesRouter.put("/settings", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    res.json(await updateSettings(purchaseSettingsSchema.parse(req.body), req.user!));
  } catch (err) { next(err); }
});

// Los precios y las variaciones son información sensible: solo admin y contador.
purchasePricesRouter.get("/last", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    res.json(await listLastPrices(lastPriceQuerySchema.parse(req.query)));
  } catch (err) { next(err); }
});

purchasePricesRouter.get("/history", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    res.json(await listPriceHistory(priceHistoryQuerySchema.parse(req.query)));
  } catch (err) { next(err); }
});

purchasePricesRouter.post("/approvals/:id/aprobar", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    const input = approvalDecisionSchema.parse(req.body ?? {});
    res.json(await decideApproval(id, input, req.user!, true));
  } catch (err) { next(err); }
});

purchasePricesRouter.post("/approvals/:id/rechazar", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    const input = approvalDecisionSchema.parse(req.body ?? {});
    res.json(await decideApproval(id, input, req.user!, false));
  } catch (err) { next(err); }
});

/**
 * Operaciones sobre una factura. Se montan en `/api/invoices` antes del router
 * de facturación; sus rutas son específicas y no capturan `/:id`.
 */
export const purchasePriceInvoiceRouter = Router();
purchasePriceInvoiceRouter.use(authenticate);

purchasePriceInvoiceRouter.get("/:id/validacion-compra", requireRole("admin", "contador", "operador", "consulta"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    res.json(await validarCompraFactura(id, req.user!));
  } catch (err) { next(err); }
});

purchasePriceInvoiceRouter.post("/:id/solicitar-aprobacion", requireRole("admin", "contador", "operador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    res.status(201).json(await requestApproval(id, req.user!));
  } catch (err) { next(err); }
});

purchasePriceInvoiceRouter.get("/:id/aprobacion", requireRole("admin", "contador", "operador", "consulta"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    res.json({ aprobacion: await getApproval(id) });
  } catch (err) { next(err); }
});

purchasePriceInvoiceRouter.post("/:id/adjuntos", requireRole("admin", "contador", "operador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    const input = attachmentSchema.parse(req.body);
    res.status(201).json(await addAttachment(id, input, req.user!));
  } catch (err) { next(err); }
});

purchasePriceInvoiceRouter.get("/:id/adjuntos", requireRole("admin", "contador", "operador", "consulta"), async (req, res, next) => {
  try {
    res.json(await listAttachments(idSchema.parse(req.params).id));
  } catch (err) { next(err); }
});

purchasePriceInvoiceRouter.delete("/:id/adjuntos/:adjuntoId", requireRole("admin", "contador", "operador"), async (req, res, next) => {
  try {
    const { id, adjuntoId } = attachmentParamsSchema.parse(req.params);
    res.json(await removeAttachment(id, adjuntoId, req.user!));
  } catch (err) { next(err); }
});
