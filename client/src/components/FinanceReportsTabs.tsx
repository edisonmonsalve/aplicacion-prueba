import { Tabs } from "antd";
import { useLocation, useNavigate } from "react-router-dom";

/** Pestañas de los reportes financieros. Navegan a las rutas existentes:
 *  no montan ni refactorizan la lógica de cada página. */
const REPORTS = [
  { key: "/finanzas/resultados", label: "Resultados" },
  { key: "/finanzas/balance", label: "Balance" },
  { key: "/finanzas/flujo-caja", label: "Flujo de caja" },
  { key: "/finanzas/rentabilidad", label: "Rentabilidad" },
  { key: "/finanzas/tendencias", label: "Tendencias" },
  { key: "/finanzas/embudo", label: "Embudo" },
  { key: "/finanzas/inventario", label: "Rotación" },
];

/** Barra de pestañas de Reportes, compartida por las 7 páginas del módulo. */
export default function FinanceReportsTabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Tabs
      className="ui-report-tabs"
      activeKey={pathname}
      onChange={(key) => navigate(key)}
      items={REPORTS.map((report) => ({ key: report.key, label: report.label }))}
      size="small"
    />
  );
}
