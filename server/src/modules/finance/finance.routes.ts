import { Router } from "express";
import { authenticate, requireRole } from "../../middlewares/auth.js";
import {
  activateBudget,
  closeBudget,
  createBudget,
  deleteBudget,
  getAvailability,
  getBudget,
  listBudgets,
  updateBudget,
} from "./budgets.service.js";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  listFinanceCategories,
  updateAccount,
} from "./finance.service.js";
import {
  accountSchema,
  balanceQuerySchema,
  budgetSchema,
  cashFlowQuerySchema,
  idSchema,
  listBudgetsQuerySchema,
  listTransactionsQuerySchema,
  summaryQuerySchema,
  transactionSchema,
} from "./finance.schema.js";
import { getSuggestions } from "./suggestions.service.js";
import { getBalance, getCashFlow, getPnl } from "./reports.service.js";
import { createTransaction, getSummary, listTransactions, reverseTransaction } from "./transactions.service.js";

export const financeRouter = Router();

// El operador no participa del módulo financiero: no ve costos ni finanzas.
financeRouter.use(authenticate, requireRole("admin", "contador", "consulta"));

const canWrite = requireRole("admin", "contador");

financeRouter.get("/availability", async (req, res) => {
  const productId = idSchema.parse(req.query.product_id);
  res.json(await getAvailability(productId));
});

financeRouter.get("/accounts", async (_req, res) => {
  res.json(await listAccounts());
});

financeRouter.post("/accounts", canWrite, async (req, res) => {
  res.status(201).json(await createAccount(accountSchema.parse(req.body), req.user!));
});

financeRouter.put("/accounts/:id", canWrite, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  res.json(await updateAccount(id, accountSchema.parse(req.body), req.user!));
});

financeRouter.delete("/accounts/:id", canWrite, async (req, res) => {
  await deleteAccount(idSchema.parse(req.params.id), req.user!);
  res.json({ message: "Cuenta financiera eliminada" });
});

financeRouter.get("/categories", async (_req, res) => {
  res.json(await listFinanceCategories());
});

financeRouter.get("/budgets", async (req, res) => {
  res.json(await listBudgets(listBudgetsQuerySchema.parse(req.query)));
});

financeRouter.get("/budgets/:id", async (req, res) => {
  res.json(await getBudget(idSchema.parse(req.params.id)));
});

financeRouter.post("/budgets", canWrite, async (req, res) => {
  res.status(201).json(await createBudget(budgetSchema.parse(req.body), req.user!));
});

financeRouter.put("/budgets/:id", canWrite, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  res.json(await updateBudget(id, budgetSchema.parse(req.body), req.user!));
});

financeRouter.delete("/budgets/:id", canWrite, async (req, res) => {
  await deleteBudget(idSchema.parse(req.params.id), req.user!);
  res.json({ message: "Presupuesto eliminado" });
});

financeRouter.post("/budgets/:id/activate", canWrite, async (req, res) => {
  res.json(await activateBudget(idSchema.parse(req.params.id), req.user!));
});

financeRouter.post("/budgets/:id/close", canWrite, async (req, res) => {
  res.json(await closeBudget(idSchema.parse(req.params.id), req.user!));
});

financeRouter.get("/transactions", async (req, res) => {
  res.json(await listTransactions(listTransactionsQuerySchema.parse(req.query)));
});

financeRouter.post("/transactions", canWrite, async (req, res) => {
  res.status(201).json(await createTransaction(transactionSchema.parse(req.body), req.user!));
});

financeRouter.post("/transactions/:id/reverse", canWrite, async (req, res) => {
  res.json(await reverseTransaction(idSchema.parse(req.params.id), req.user!));
});

financeRouter.get("/suggestions", async (_req, res) => {
  res.json(await getSuggestions());
});

financeRouter.get("/summary", async (req, res) => {
  res.json(await getSummary(summaryQuerySchema.parse(req.query)));
});

financeRouter.get("/pnl", async (req, res) => {
  res.json(await getPnl(summaryQuerySchema.parse(req.query)));
});

financeRouter.get("/cash-flow", async (req, res) => {
  res.json(await getCashFlow(cashFlowQuerySchema.parse(req.query)));
});

financeRouter.get("/balance", async (req, res) => {
  res.json(await getBalance(balanceQuerySchema.parse(req.query)));
});
