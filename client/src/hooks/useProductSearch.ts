import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "antd";
import { getProducts } from "@/services/productsService";
import type { ProductOption } from "@/utils/productLookup";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 250;

/**
 * Búsqueda remota de productos compartida por cotizaciones y facturas.
 *
 * El servidor filtra por nombre O SKU (`q`). El resultado de cada búsqueda
 * reemplaza al anterior para que al escribir un nombre no aparezcan primero
 * los productos del listado inicial; el debounce evita lanzar una petición por
 * tecla y el contador de petición descarta respuestas desactualizadas.
 */
export function useProductSearch() {
  const { message } = App.useApp();
  const messageRef = useRef(message);
  messageRef.current = message;

  const [products, setProducts] = useState<Record<number, ProductOption>>({});
  const [resultIds, setResultIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  const run = useCallback(async (q: string, request: number) => {
    setLoading(true);
    try {
      const { data } = await getProducts({
        q: q || undefined,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      if (request !== latest.current) return;
      setProducts((prev) => ({
        ...prev,
        ...Object.fromEntries(data.map((p) => [p.id, p])),
      }));
      setResultIds(data.map((p) => p.id));
    } catch {
      if (request === latest.current) {
        messageRef.current.error("No se pudo buscar productos");
      }
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, []);

  const search = useCallback(
    (q: string) => {
      const request = ++latest.current;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(q, request), DEBOUNCE_MS);
    },
    [run]
  );

  useEffect(() => {
    // Primer listado para que el select no esté vacío antes de escribir.
    void run("", latest.current);
    return () => {
      latest.current += 1;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run]);

  /** Añade productos ya conocidos (edición, cotización -> factura, stock). */
  const addProducts = useCallback((list: ProductOption[]) => {
    if (list.length === 0) return;
    setProducts((prev) => ({
      ...prev,
      ...Object.fromEntries(list.map((p) => [p.id, p])),
    }));
  }, []);

  return { products, addProducts, resultIds, loading, search };
}
