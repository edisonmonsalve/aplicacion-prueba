import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import { companySchema, getCompany, updateCompany } from "./company.service.js";

export const companyRouter = Router();

companyRouter.use(authenticate);

// Todos los roles autenticados leen los datos del emisor: los necesita la
// impresión de cotizaciones y facturas, incluso el rol de consulta.
companyRouter.get("/", async (_req, res) => {
  res.json(await getCompany());
});

// Solo el administrador cambia la identidad de la empresa.
companyRouter.put("/", requireRole("admin"), async (req, res) => {
  const input = companySchema.parse(req.body);
  res.json(await updateCompany(input, req.user!));
});
