import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
  createThirdParty,
  deleteThirdParty,
  getThirdParty,
  listThirdParties,
  updateThirdParty,
} from "./third-parties.service.js";
import {
  createThirdPartySchema,
  idSchema,
  listThirdPartiesQuerySchema,
  updateThirdPartySchema,
} from "./third-parties.schema.js";

export const thirdPartiesRouter = Router();

thirdPartiesRouter.use(authenticate);

// Lectura: todos los roles que participan en documentos comerciales.
thirdPartiesRouter.get("/", requireRole("admin", "contador", "operador", "consulta"), async (req, res, next) => {
  try {
    res.json(await listThirdParties(listThirdPartiesQuerySchema.parse(req.query)));
  } catch (err) { next(err); }
});

thirdPartiesRouter.get("/:id", requireRole("admin", "contador", "operador", "consulta"), async (req, res, next) => {
  try {
    res.json(await getThirdParty(idSchema.parse(req.params).id));
  } catch (err) { next(err); }
});

// Escritura: administración y contabilidad.
thirdPartiesRouter.post("/", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const input = createThirdPartySchema.parse(req.body);
    res.status(201).json(await createThirdParty(input));
  } catch (err) { next(err); }
});

thirdPartiesRouter.put("/:id", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    const input = updateThirdPartySchema.parse(req.body);
    res.json(await updateThirdParty(id, input));
  } catch (err) { next(err); }
});

thirdPartiesRouter.delete("/:id", requireRole("admin", "contador"), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params).id;
    res.json(await deleteThirdParty(id));
  } catch (err) { next(err); }
});
