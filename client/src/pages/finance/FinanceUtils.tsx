import type { ReactNode } from "react";
import { Tag } from "antd";
import { CheckCircleOutlined, EditOutlined, LockOutlined } from "@ant-design/icons";
import type { BudgetEstado, EjecucionEstado } from "@/types";
import { formatCurrency } from "@/utils/format";

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

export const BudgetEstadoTag = ({ estado }: { estado: BudgetEstado }) => (
  <Tag color={BUDGET_ESTADO_META[estado].color} icon={BUDGET_ESTADO_META[estado].icon}>
    {BUDGET_ESTADO_META[estado].label}
  </Tag>
);

export const EjecucionTag = ({ estado }: { estado: EjecucionEstado }) => (
  <Tag color={EJECUCION_META[estado].color}>{EJECUCION_META[estado].label}</Tag>
);

export const money = (n: number) => formatCurrency(n);
export const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-CA");
export const periodLabel = (p: "dia" | "semana" | "mes" | "anio") =>
  p === "dia" ? "Día" : p === "semana" ? "Semana" : p === "mes" ? "Mes" : "Año";
export const TIPO_LABEL = (t: "ingreso" | "gasto") => (t === "ingreso" ? "Ingreso" : "Gasto");
export const fmtPct = (n: number) => `${n.toFixed(0)}%`;
