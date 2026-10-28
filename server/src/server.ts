import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./config/Db.js";
import { authRouter } from "./modules/auth/auth.routes.js";


const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);

app.get("/api/health", async (_req, res) => {
  const [rows] = await pool.query("SELECT 1 AS ok");
  res.json({ status: "ok", db: rows });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API en http://localhost:${port}`));