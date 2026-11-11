import { Breadcrumb } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";

export interface BreadcrumbEntry {
  label: string;
  /** Si se omite, el elemento representa la página actual. */
  to?: string;
}

/** Ruta de navegación común para las páginas de detalle. */
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
