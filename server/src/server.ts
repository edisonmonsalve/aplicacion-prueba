import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./config/Db.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { categoriesRouter } from "./modules/categories/categories.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { movementsRouter } from "./modules/movements/movements.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);

app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/movements", movementsRouter);

app.get("/api/health", async (_req, res) => {
  const [rows] = await pool.query("SELECT 1 AS ok");
  res.json({ status: "ok", db: rows });
});

// Siempre al final, después de todas las rutas
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API en http://localhost:${port}`));