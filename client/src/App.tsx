import { lazy, Suspense } from "react";
import { Spin } from "antd";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import RequireOperate from "./components/RequireOperate";

// Cada página se carga bajo demanda. El bundle inicial solo trae el layout,
// el login y las rutas protegidas; los módulos pesados (finanzas, gráficos,
// impresión) llegan cuando el usuario entra a su ruta.
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const MovementsPage = lazy(() => import("@/pages/MovementsPage"));
const QuotesPage = lazy(() => import("@/pages/quotes/QuotesPage"));
const QuoteDetailPage = lazy(() => import("./pages/quotes/QuoteDetailPage"));
const QuoteFormPage = lazy(() => import("./pages/quotes/QuoteFormPage"));
const QuotePrintPage = lazy(() => import("./pages/quotes/QuotePrintPage"));
const InvoicesPage = lazy(() => import("@/pages/invoices/InvoicesPage"));
const InvoiceDetailPage = lazy(() => import("@/pages/invoices/InvoiceDetailPage"));
const InvoiceFormPage = lazy(() => import("@/pages/invoices/InvoiceFormPage"));
const InvoicePrintPage = lazy(() => import("@/pages/invoices/InvoicePrintPage"));
const ThirdPartiesPage = lazy(() => import("@/pages/ThirdPartiesPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const FinanceOverviewPage = lazy(() => import("@/pages/finance/FinanceOverviewPage"));
const BudgetsPage = lazy(() => import("@/pages/finance/BudgetsPage"));
const BudgetDetailPage = lazy(() => import("@/pages/finance/BudgetDetailPage"));
const TransactionsPage = lazy(() => import("@/pages/finance/TransactionsPage"));
const PeriodClosuresPage = lazy(() => import("@/pages/finance/PeriodClosuresPage"));
const ReconciliationsPage = lazy(() => import("@/pages/finance/ReconciliationsPage"));
const ProfitLossPage = lazy(() => import("@/pages/finance/ProfitLossPage"));
const CashFlowPage = lazy(() => import("@/pages/finance/CashFlowPage"));
const BalancePage = lazy(() => import("@/pages/finance/BalancePage"));
const ProfitabilityPage = lazy(() => import("@/pages/finance/ProfitabilityPage"));
const InventoryAnalyticsPage = lazy(() => import("@/pages/finance/InventoryAnalyticsPage"));
const QuotesFunnelPage = lazy(() => import("@/pages/finance/QuotesFunnelPage"));
const TrendsPage = lazy(() => import("@/pages/finance/TrendsPage"));
const AuditPage = lazy(() => import("@/pages/finance/AuditPage"));
const DataHealthPage = lazy(() => import("@/pages/finance/DataHealthPage"));
const ReceivablesPage = lazy(() => import("@/pages/invoices/ReceivablesPage"));

const RouteFallback = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
    }}
  >
    <Spin size="large" />
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Todo lo que está dentro exige sesión y comparte el layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<HomePage />} />
              <Route
                path="/users"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/movements" element={<MovementsPage />} />
              <Route path="/cotizaciones" element={<QuotesPage />} />
              <Route path="/cotizaciones/:id" element={<QuoteDetailPage />} />
              <Route element={<RequireOperate />}>
                <Route path="cotizaciones/nuevo" element={<QuoteFormPage />} />
                <Route path="cotizaciones/:id/editar" element={<QuoteFormPage />} />
              </Route>
              <Route path="/cotizaciones/:id/imprimir" element={<QuotePrintPage />} />
              <Route path="/facturas" element={<InvoicesPage />} />
              <Route path="/facturas/:id" element={<InvoiceDetailPage />} />
              <Route path="/terceros" element={<ThirdPartiesPage />} />
              <Route path="/facturas/:id/imprimir" element={<InvoicePrintPage />} />
              <Route element={<RequireOperate />}>
                <Route path="facturas/nuevo" element={<InvoiceFormPage />} />
                <Route path="facturas/:id/editar" element={<InvoiceFormPage />} />
              </Route>
              <Route
                path="/finanzas"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <FinanceOverviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/presupuestos"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <BudgetsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/cartera"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <ReceivablesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/cierres"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <PeriodClosuresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/conciliaciones"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <ReconciliationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/resultados"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <ProfitLossPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/flujo-caja"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <CashFlowPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/balance"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <BalancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/rentabilidad"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <ProfitabilityPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/inventario"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <InventoryAnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/embudo"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <QuotesFunnelPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/tendencias"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <TrendsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/auditoria"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <AuditPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/salud"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <DataHealthPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/presupuestos/:id"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <BudgetDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finanzas/transacciones"
                element={
                  <ProtectedRoute roles={["admin", "contador", "consulta"]}>
                    <TransactionsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
