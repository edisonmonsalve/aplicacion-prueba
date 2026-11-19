import { Breadcrumb } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";

export interface BreadcrumbEntry {
  label: string;
  /** Si se omite, el elemento representa la página actual. */
  to?: string;
}

/**
 * Única fuente de etiquetas de la navegación. La clave es el prefijo acumulado
 * de la ruta: añadir una sección no exige tocar condicionales en cada página.
 */
const ROUTE_LABELS: Record<string, string> = {
  "/products": "Productos",
  "/movements": "Movimientos",
  "/categories": "Categorías",
  "/cotizaciones": "Cotizaciones",
  "/cotizaciones/nuevo": "Nueva cotización",
  "/facturas": "Facturas",
  "/facturas/nuevo": "Nueva factura",
  "/terceros": "Terceros",
  "/finanzas": "Finanzas",
  "/finanzas/cartera": "Cartera",
  "/finanzas/conciliaciones": "Conciliación bancaria",
  "/finanzas/cierres": "Cierres",
  "/finanzas/resultados": "Resultados",
  "/finanzas/flujo-caja": "Flujo de caja",
  "/finanzas/balance": "Balance",
  "/finanzas/rentabilidad": "Rentabilidad",
  "/finanzas/inventario": "Rotación",
  "/finanzas/embudo": "Embudo",
  "/finanzas/tendencias": "Tendencias",
  "/finanzas/auditoria": "Auditoría",
  "/finanzas/salud": "Salud de datos",
  "/finanzas/presupuestos": "Presupuestos",
  "/finanzas/transacciones": "Transacciones",
  "/users": "Usuarios",
  "/perfil": "Mi perfil",
  "/empresa": "Empresa",
};

const EDIT_LABELS: Record<string, string> = {
  "/facturas": "Editar factura",
  "/cotizaciones": "Editar cotización",
};

/**
 * Deriva el breadcrumb de la URL. `leaf` reemplaza la migaja final con un dato
 * de la página (número de documento, nombre del presupuesto) y convierte la
 * sección padre en enlace.
 */
export function useRouteBreadcrumb(leaf?: string): BreadcrumbEntry[] | null {
  const { pathname } = useLocation();
  if (pathname === "/") return null;

  const crumbs: BreadcrumbEntry[] = [];
  let prefix = "";
  const segments = pathname.split("/").filter(Boolean);

  for (const [index, segment] of segments.entries()) {
    prefix += `/${segment}`;
    const label = ROUTE_LABELS[prefix];
    if (label) {
      crumbs.push({ label, to: prefix });
    } else if (index === segments.length - 1 && segment === "editar") {
      const parent = [...crumbs].reverse().find((crumb) => crumb.to);
      crumbs.push({ label: parent?.to ? (EDIT_LABELS[parent.to] ?? "Editar") : "Editar" });
    }
  }
  if (!crumbs.length) return null;

  if (leaf) {
    crumbs.push({ label: leaf });
  } else {
    delete crumbs[crumbs.length - 1].to;
  }
  return crumbs;
}

/** Ruta de navegación común, con «Inicio» como primer elemento. */
export default function PageBreadcrumb({ items }: { items: BreadcrumbEntry[] }) {
  return (
    <Breadcrumb
      style={{ marginBottom: 8 }}
      items={[
        {
          title: (
            <Link to="/">
              <HomeOutlined /> Inicio
            </Link>
          ),
        },
        ...items.map((item) => ({
          title: item.to ? <Link to={item.to}>{item.label}</Link> : item.label,
        })),
      ]}
    />
  );
}
