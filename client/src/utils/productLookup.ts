import { getProducts } from "@/services/productsService";
import type { Product } from "@/types";

/**
 * Carga productos por id con todos sus datos (incluido stock).
 *
 * Se usa para hidratar líneas que no pasaron por el buscador del formulario:
 * edición de documentos, autocompletado desde una cotización y reabastecimiento.
 * Evita pedir el catálogo completo (el endpoint limita pageSize a 100).
 */
export async function fetchProductsByIds(
  ids: number[]
): Promise<Record<number, Product>> {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (unique.length === 0) return {};

  const { data } = await getProducts({
    ids: unique.join(","),
    page: 1,
    pageSize: Math.min(unique.length, 100),
  });
  return Object.fromEntries(data.map((p) => [p.id, p]));
}

/** Etiqueta uniforme del select de productos, con stock cuando ya se conoce. */
export function productOptionLabel(p: {
  sku: string;
  nombre: string;
  stock_actual?: number;
  stock_minimo?: number;
}) {
  const stock =
    p.stock_actual === undefined
      ? ""
      : ` (stock: ${p.stock_actual}${
          p.stock_minimo !== undefined && p.stock_actual <= p.stock_minimo
            ? " · stock bajo"
            : ""
        })`;
  return `${p.sku} — ${p.nombre}${stock}`;
}
