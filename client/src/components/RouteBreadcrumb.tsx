import type { BreadcrumbEntry } from "@/components/PageBreadcrumb";
import PageBreadcrumb from "@/components/PageBreadcrumb";

const SECTIONS: Record<string, { label: string; to: string }> = {
  products: { label: "Productos", to: "/products" },
  movements: { label: "Movimientos", to: "/movements" },
  categories: { label: "Categorías", to: "/categories" },
  cotizaciones: { label: "Cotizaciones", to: "/cotizaciones" },
  facturas: { label: "Facturas", to: "/facturas" },
  terceros: { label: "Terceros", to: "/terceros" },
  finanzas: { label: "Finanzas", to: "/finanzas" },
  users: { label: "Usuarios", to: "/users" },
  perfil: { label: "Mi perfil", to: "/perfil" },
};

/**
 * Construye la ruta de navegación a partir de la URL.
 *
 * Devuelve `null` cuando la página no debe mostrar breadcrumb: Inicio, la
 * impresión de cotizaciones y los detalles que ya pintan el suyo con el
 * número del documento.
 */
export function getRouteBreadcrumb(pathname: string): BreadcrumbEntry[] | null {
  if (pathname === "/") return null;

  const parts = pathname.split("/").filter(Boolean);
  const section = SECTIONS[parts[0]];
  if (!section) return null;

  const items: BreadcrumbEntry[] = [{ ...section }];
  const finish = () => {
    const last = items[items.length - 1];
    if (last.to) last.to = undefined;
    return items;
  };

  if (parts[0] === "cotizaciones" || parts[0] === "facturas") {
    const esCotizacion = parts[0] === "cotizaciones";
    const id = parts[1];
    const action = parts[2];

    if (id === "nuevo") {
      items.push({ label: esCotizacion ? "Nueva cotización" : "Nueva factura" });
      return finish();
    }

    if (id && /^\d+$/.test(id)) {
      // La impresión no lleva navegación; el detalle pinta su propio
      // breadcrumb con el número real del documento.
      if (!action || action === "imprimir") return null;
      if (action === "editar") {
        items.push({ label: esCotizacion ? "Editar cotización" : "Editar factura" });
        return finish();
      }
    }

    return finish();
  }

  if (parts[0] === "finanzas") {
    const sub = parts[1];
    if (sub === "cartera") {
      items.push({ label: "Cartera", to: "/finanzas/cartera" });
      return finish();
    }
    if (sub === "cierres") {
      items.push({ label: "Cierres", to: "/finanzas/cierres" });
      return finish();
    }
    if (sub === "resultados") {
      items.push({ label: "Resultados", to: "/finanzas/resultados" });
      return finish();
    }
    if (sub === "flujo-caja") {
      items.push({ label: "Flujo de caja", to: "/finanzas/flujo-caja" });
      return finish();
    }
    if (sub === "balance") {
      items.push({ label: "Balance", to: "/finanzas/balance" });
      return finish();
    }
    if (sub === "rentabilidad") {
      items.push({ label: "Rentabilidad", to: "/finanzas/rentabilidad" });
      return finish();
    }
    if (sub === "inventario") {
      items.push({ label: "Rotación", to: "/finanzas/inventario" });
      return finish();
    }
    if (sub === "embudo") {
      items.push({ label: "Embudo", to: "/finanzas/embudo" });
      return finish();
    }
    if (sub === "tendencias") {
      items.push({ label: "Tendencias", to: "/finanzas/tendencias" });
      return finish();
    }
    if (sub === "presupuestos") {
      // El detalle del presupuesto también pinta su breadcrumb con el nombre.
      if (parts[2]) return null;
      items.push({ label: "Presupuestos", to: "/finanzas/presupuestos" });
      return finish();
    }
    if (sub === "transacciones") {
      items.push({ label: "Transacciones", to: "/finanzas/transacciones" });
      return finish();
    }
    return finish();
  }

  return finish();
}

/** Breadcrumb automático para todas las rutas del layout. */
export default function RouteBreadcrumb({ pathname }: { pathname: string }) {
  const items = getRouteBreadcrumb(pathname);
  if (!items) return null;
  return <PageBreadcrumb items={items} />;
}
