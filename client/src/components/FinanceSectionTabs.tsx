import { Tabs } from "antd";
import { useLocation, useNavigate } from "react-router-dom";

export type FinanceSection = "resumen" | "reportes" | "gestion";

type Tab = { key: string; label: string };

/** Pestañas contextuales de Finanzas. Cada sección decide sus hojas; al cambiar
 *  se conserva la query para no perder el periodo ni los filtros activos. */
const SECTIONS: Record<FinanceSection, Tab[]> = {
  resumen: [
    { key: "/finanzas", label: "Resumen" },
    { key: "/finanzas/salud", label: "Salud de datos" },
  ],
  reportes: [
    { key: "/finanzas/resultados", label: "Resultados" },
    { key: "/finanzas/balance", label: "Balance" },
    { key: "/finanzas/flujo-caja", label: "Flujo de caja" },
    { key: "/finanzas/rentabilidad", label: "Rentabilidad" },
    { key: "/finanzas/tendencias", label: "Tendencias" },
    { key: "/finanzas/embudo", label: "Embudo" },
    { key: "/finanzas/inventario", label: "Rotación" },
  ],
  gestion: [
    { key: "/finanzas/transacciones", label: "Transacciones" },
    { key: "/finanzas/presupuestos", label: "Presupuestos" },
    { key: "/finanzas/conciliaciones", label: "Conciliación" },
    { key: "/finanzas/cierres", label: "Cierres" },
    { key: "/finanzas/cartera", label: "Cartera" },
    { key: "/finanzas/auditoria", label: "Auditoría" },
  ],
};

const LABELS: Record<FinanceSection, string> = {
  resumen: "Navegación del resumen financiero",
  reportes: "Navegación de reportes financieros",
  gestion: "Navegación de gestión financiera",
};

type Props = { section: FinanceSection };

export default function FinanceSectionTabs({ section }: Props) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  return (
    <nav aria-label={LABELS[section]}>
      <Tabs
        className="ui-finance-tabs"
        activeKey={pathname}
        onChange={(key) => navigate(`${key}${search}`)}
        items={SECTIONS[section]}
        size="small"
      />
    </nav>
  );
}
