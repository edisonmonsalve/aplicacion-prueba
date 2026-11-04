import { Tag } from "antd";
import type { QuoteStatus } from "../../types";

const COLORS: Record<QuoteStatus, string> = {
  borrador: "default",
  enviado: "blue",
  aprobado: "green",
  rechazado: "red",
  entregado: "purple",
  vencido: "orange",
};

export const StatusTag = ({ estado }: { estado: QuoteStatus }) => (
  <Tag color={COLORS[estado]}>{estado.toUpperCase()}</Tag>
);

export const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-CA");
export const fmtDateTime = (s: string) => new Date(s).toLocaleString("es-CO");
