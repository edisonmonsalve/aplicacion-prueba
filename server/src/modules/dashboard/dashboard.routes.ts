import { Router } from "express";
import { authenticate } from "../../middlewares/auth.js";
import { getDashboard } from "./dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get("/", async (_req, res) => {
  res.json(await getDashboard());
});