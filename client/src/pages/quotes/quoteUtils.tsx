import type { ReactNode } from "react";
import { Tag } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  InboxOutlined,
  SendOutlined,
} from "@ant-design/icons";
import type { QuoteStatus } from "@/types";

const META: Record<QuoteStatus, { color: string; label: string; icon: ReactNode }> = {
  borrador: { color: "default", label: "Borrador", icon: <EditOutlined /> },
  enviado: { color: "blue", label: "Enviado", icon: <SendOutlined /> },
  aprobado: { color: "green", label: "Aprobado", icon: <CheckCircleOutlined /> },
  rechazado: { color: "red", label: "Rechazado", icon: <CloseCircleOutlined /> },
  entregado: { color: "purple", label: "Entregado", icon: <InboxOutlined /> },
  vencido: { color: "orange", label: "Vencido", icon: <ClockCircleOutlined /> },
};

export const STATUS_OPTIONS = (Object.keys(META) as QuoteStatus[]).map((e) => ({
  value: e,
  label: META[e].label,
}));

export const StatusTag = ({ estado }: { estado: QuoteStatus }) => (
  <Tag color={META[estado].color} icon={META[estado].icon}>
    {META[estado].label}
  </Tag>
);

export const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-CA");
export const fmtDateTime = (s: string) => new Date(s).toLocaleString("es-CO");
