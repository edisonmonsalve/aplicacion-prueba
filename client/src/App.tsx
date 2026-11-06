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
import ProfilePage from "@/pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";
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
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
