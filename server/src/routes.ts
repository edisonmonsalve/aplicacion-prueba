import type { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { categoriesRouter } from "./modules/categories/categories.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { movementsRouter } from "./modules/movements/movements.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { quotesRouter } from "./modules/quotes/quotes.routes.js";
import { financeRouter } from "./modules/finance/finance.routes.js";
import { invoicesRouter } from "./modules/invoices/invoices.routes.js";
import { thirdPartiesRouter } from "./modules/third-parties/third-parties.routes.js";
import { periodClosuresRouter } from "./modules/period-closures/period-closures.routes.js";
import { auditRouter } from "./modules/audit/audit.routes.js";
import { companyRouter } from "./modules/company/company.routes.js";
import { opsRouter } from "./modules/ops/ops.routes.js";

/** Ruta de estado. Se comparte con la documentación para que no haya dos copias. */
export const HEALTH_PATH = "/api/health";

/** Prefijos y routers de la API. `app.ts` y la spec OpenAPI leen esta misma lista. */
export const apiMounts: ReadonlyArray<{ path: string; router: Router }> = [
  { path: "/api/auth", router: authRouter },
  { path: "/api/users", router: usersRouter },
  { path: "/api/categories", router: categoriesRouter },
  { path: "/api/products", router: productsRouter },
  { path: "/api/movements", router: movementsRouter },
  { path: "/api/dashboard", router: dashboardRouter },
  { path: "/api/quotes", router: quotesRouter },
  { path: "/api/finance", router: financeRouter },
  { path: "/api/invoices", router: invoicesRouter },
  { path: "/api/third-parties", router: thirdPartiesRouter },
  { path: "/api/period-closures", router: periodClosuresRouter },
  { path: "/api/audit", router: auditRouter },
  { path: "/api/company", router: companyRouter },
  { path: "/api", router: opsRouter },
];
