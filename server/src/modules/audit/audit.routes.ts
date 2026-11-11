import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import { auditQuerySchema } from "./audit.schema.js";
import { listAudit } from "./audit.service.js";

export const auditRouter = Router();

auditRouter.use(authenticate, requireRole("admin", "contador", "consulta"));

auditRouter.get("/", async (req, res) => {
  res.json(await listAudit(auditQuerySchema.parse(req.query)));
});
