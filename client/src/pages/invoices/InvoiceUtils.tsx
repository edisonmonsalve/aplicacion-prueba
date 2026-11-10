import type { ReactNode } from "react";
import { Tag } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import type { InvoiceEstado, InvoiceTipo } from "@/types";
import { formatDateDisplay } from "@/utils/dates";

const ESTADO_META: Record<InvoiceEstado, { color: string; label: string; icon: ReactNode }> = {
  borrador: { color: "default", label: "Borrador", icon: <EditOutlined /> },
  confirmada: { color: "green", label: "Confirmada", icon: <CheckCircleOutlined /> },
  anulada: { color: "red", label: "Anulada", icon: <CloseCircleOutlined /> },
};

const TIPO_META: Record<InvoiceTipo, { color: string; label: string; icon: ReactNode }> = {
  venta: { color: "blue", label: "Venta", icon: <ShopOutlined /> },
  compra: { color: "orange", label: "Compra", icon: <ShoppingCartOutlined /> },
};

export const ESTADO_OPTIONS = (Object.keys(ESTADO_META) as InvoiceEstado[]).map((e) => ({
  value: e,
  label: ESTADO_META[e].label,
}));

export const TIPO_OPTIONS = (Object.keys(TIPO_META) as InvoiceTipo[]).map((t) => ({
  value: t,
  label: TIPO_META[t].label,
}));

export const InvoiceEstadoTag = ({ estado }: { estado: InvoiceEstado }) => (
  <Tag color={ESTADO_META[estado].color} icon={ESTADO_META[estado].icon}>
    {ESTADO_META[estado].label}
  </Tag>
);

export const InvoiceTipoTag = ({ tipo }: { tipo: InvoiceTipo }) => (
  <Tag color={TIPO_META[tipo].color} icon={TIPO_META[tipo].icon}>
    {TIPO_META[tipo].label}
  </Tag>
);

export const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (s: string) => formatDateDisplay(s);
export const fmtDateTime = (s: string) => new Date(s).toLocaleString("es-CO");
