import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { getProducts } from "@/services/productsService";
import type { Product } from "@/types";
import { useAuth } from "./AuthContext";

interface StockAlertsValue {
  /** Productos activos con stock por debajo del mínimo. */
  count: number;
  items: Product[];
  loading: boolean;
  /** Vuelve a consultar tras guardar un producto o registrar un movimiento. */
  refresh: () => Promise<void>;
}

const StockAlertsContext = createContext<StockAlertsValue>({
  count: 0,
  items: [],
  loading: false,
  refresh: async () => {},
});

/**
 * Expone el aviso de stock a todo el layout. Usa el mismo filtro que el
 * dashboard (`activo=1` y `stock_actual < stock_minimo`) para que badge,
 * banner y KPI nunca difieran.
 */
export function StockAlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await getProducts({
        page: 1,
        pageSize: 5,
        bajoStock: "1",
        activo: "1",
        sort: "stock",
        order: "asc",
      });
      setCount(response.total);
      setItems(response.data);
    } catch {
      setCount(0);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh, location.pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const value = useMemo(() => ({ count, items, loading, refresh }), [count, items, loading, refresh]);

  return <StockAlertsContext.Provider value={value}>{children}</StockAlertsContext.Provider>;
}

export const useStockAlerts = () => useContext(StockAlertsContext);
