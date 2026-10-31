import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./config/Db.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { categoriesRouter } from "./modules/categories/categories.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { movementsRouter } from "./modules/movements/movements.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { quotesRouter } from "./modules/quotes/quotes.routes.js";


export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const [rows] = await pool.query("SELECT 1 AS ok");
  res.json({ status: "ok", db: rows });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/movements", movementsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/quotes", quotesRouter);

app.use(errorHandler); // siempre al final