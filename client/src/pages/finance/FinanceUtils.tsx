import { signal } from "@/styles/signal";
import type { ReactNode } from "react";
import { Tag } from "antd";
import { CheckCircleOutlined, EditOutlined, LockOutlined } from "@ant-design/icons";
import type { BudgetEstado, EjecucionEstado, FinanceCategoryTipo } from "@/types";
import { formatCurrency } from "@/utils/format";
import { formatDateDisplay } from "@/utils/dates";

export const BUDGET_PERIOD_LABELS: Record<BudgetEstado extends never ? never : string, string> = {
  dia: "Día",
  semana: "Semana",
  mes: "Mes",
  anio: "Año",
};

export const BUDGET_ESTADO_META: Record<BudgetEstado, { color: string; label: string; icon: ReactNode }> = {
  borrador: { color: "default", label: "Borrador", icon: <EditOutlined /> },
  activo: { color: "green", label: "Activo", icon: <CheckCircleOutlined /> },
  cerrado: { color: "blue", label: "Cerrado", icon: <LockOutlined /> },
};

export const EJECUCION_META: Record<EjecucionEstado, { color: string; label: string }> = {
  ok: { color: "green", label: "OK" },
  alerta: { color: "orange", label: "Alerta" },
  excedido: { color: "red", label: "Excedido" },
};

// Para las líneas de ingreso, superar el 100 % es una buena noticia (meta
// superada). Para gastos/activos/pasivos, superar el límite es una alerta.
const EJECUCION_INGRESO_META: Record<EjecucionEstado, { color: string; label: string }> = {
  ok: { color: "default", label: "En curso" },
  alerta: { color: "blue", label: "Cerca de la meta" },
  excedido: { color: "green", label: "Meta superada" },
};

export const ejecucionMeta = (estado: EjecucionEstado, tipo?: FinanceCategoryTipo) =>
  tipo === "ingreso" ? EJECUCION_INGRESO_META[estado] : EJECUCION_META[estado];

// Color del progreso: verde cuando el sobrecumplimiento de ingreso es positivo,
// rojo cuando un gasto excede su límite.
export const ejecucionColor = (estado: EjecucionEstado, tipo?: FinanceCategoryTipo) => {
  if (tipo === "ingreso") {
    return estado === "excedido" ? signal.positiveAccent : estado === "alerta" ? signal.infoAccent : signal.positiveAccent;
  }
  return estado === "excedido" ? signal.negativeAccent : estado === "alerta" ? signal.warningAccent : signal.positiveAccent;
};

export const BudgetEstadoTag = ({ estado }: { estado: BudgetEstado }) => (
  <Tag color={BUDGET_ESTADO_META[estado].color} icon={BUDGET_ESTADO_META[estado].icon}>
    {BUDGET_ESTADO_META[estado].label}
  </Tag>
);

export const EjecucionTag = ({
  estado,
  tipo,
}: {
  estado: EjecucionEstado;
  tipo?: FinanceCategoryTipo;
}) => {
  const meta = ejecucionMeta(estado, tipo);
  return <Tag color={meta.color}>{meta.label}</Tag>;
};

export const money = (n: number) => formatCurrency(n);
export const fmtDate = (s: string) => formatDateDisplay(s);
export const periodLabel = (p: "dia" | "semana" | "mes" | "anio") =>
  p === "dia" ? "Día" : p === "semana" ? "Semana" : p === "mes" ? "Mes" : "Año";
export const TIPO_LABEL = (t: FinanceCategoryTipo) =>
  t === "ingreso" ? "Ingreso" : t === "gasto" ? "Gasto" : t === "activo" ? "Activo" : "Pasivo";
export const fmtPct = (n: number) => `${n.toFixed(0)}%`;
