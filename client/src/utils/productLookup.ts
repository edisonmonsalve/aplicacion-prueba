import { getProducts } from "@/services/productsService";

/** Datos mínimos que necesita un select de producto (nombre, SKU, precio y stock). */
export interface ProductOption {
  id: number;
  sku: string;
  nombre: string;
  precio: number;
  costo?: number | null;
  stock_actual?: number;
  stock_minimo?: number;
}

/**
 * Carga productos por id con todos sus datos (incluido stock).
 *
 * Se usa para hidratar líneas que no pasaron por el buscador del formulario:
 * edición de documentos, autocompletado desde una cotización y reabastecimiento.
 * Evita pedir el catálogo completo (el endpoint limita pageSize a 100).
 */
export async function fetchProductsByIds(
  ids: number[]
): Promise<Record<number, ProductOption>> {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (unique.length === 0) return {};

  const { data } = await getProducts({
    ids: unique.join(","),
    page: 1,
    pageSize: Math.min(unique.length, 100),
  });
  return Object.fromEntries(data.map((p) => [p.id, p]));
}

/**
 * Etiqueta del select: nombre y SKU. El precio y el stock viven en la meta de
 * cada opción y en el semáforo de la fila, no en el valor seleccionado, que
 * también se imprime en la factura.
 */
export function productOptionLabel(p: ProductOption) {
  return p.sku ? `${p.nombre} — ${p.sku}` : p.nombre;
}
