import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import UsersPage from "@/pages/UsersPage";
import CategoriesPage from "@/pages/CategoriesPage";
import ProductsPage from "@/pages/ProductsPage";
import MovementsPage from "@/pages/MovementsPage";
import QuotesPage from "@/pages/quotes/QuotesPage";
import QuoteDetailPage from "./pages/quotes/QuoteDetailPage";
import QuoteFormPage from "./pages/quotes/QuoteFormPage";
import QuotePrintPage from "./pages/quotes/QuotePrintPage";
import InvoicesPage from "@/pages/invoices/InvoicesPage";
import InvoiceDetailPage from "@/pages/invoices/InvoiceDetailPage";
import InvoiceFormPage from "@/pages/invoices/InvoiceFormPage";
import InvoicePrintPage from "@/pages/invoices/InvoicePrintPage";
import ThirdPartiesPage from "@/pages/ThirdPartiesPage";
import ProfilePage from "@/pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";
import FinanceOverviewPage from "@/pages/finance/FinanceOverviewPage";
import BudgetsPage from "@/pages/finance/BudgetsPage";
import BudgetDetailPage from "@/pages/finance/BudgetDetailPage";
import TransactionsPage from "@/pages/finance/TransactionsPage";
import ReceivablesPage from "@/pages/invoices/ReceivablesPage";
import RequireOperate from "./components/RequireOperate";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}
