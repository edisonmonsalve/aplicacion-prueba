import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function RequireOperate() {
  const { canOperate } = useAuth();
  return canOperate ? <Outlet /> : <Navigate to="/cotizaciones" replace />;
}
