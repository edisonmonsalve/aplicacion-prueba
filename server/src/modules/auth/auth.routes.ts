import { Router } from "express";
// import { login, loginSchema } from "./auth.service.js";
import { authenticate } from "../../middlewares/auth.js";
import { changePassword, changePasswordSchema, login, loginSchema } from "./auth.service.js";

export const authRouter = Router();

authRouter.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Datos inválidos" });
  }

  const result = await login(parsed.data.email, parsed.data.password);
  if (!result) {
    return res.status(401).json({ message: "Credenciales incorrectas" });
  }

  res.json(result);
});

authRouter.put("/password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await changePassword(req.user!.id, currentPassword, newPassword);
  res.json({ message: "Contraseña actualizada" });
});