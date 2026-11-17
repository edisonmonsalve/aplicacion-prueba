import type { CSSProperties, ReactNode } from "react";
import { Card, theme } from "antd";

export type StatTone = "neutral" | "primary" | "info" | "success" | "warning" | "danger";

const TONE_TOKEN = {
  neutral: "colorTextSecondary",
  primary: "colorPrimary",
  info: "colorInfo",
  success: "colorSuccess",
  warning: "colorWarning",
  danger: "colorError",
} as const;

interface Props {
  label: ReactNode;
  value: ReactNode;
  /** Texto corto bajo el valor (aclaración, comparación, rango). */
  hint?: ReactNode;
  /** Icono del indicador, teñido con el acento del tono. */
  icon?: ReactNode;
  /** Chip de variación u otro dato destacado bajo la cifra. */
  delta?: ReactNode;
  tone?: StatTone;
  /** Muestra el esqueleto de AntD mientras cargan los datos. */
  loading?: boolean;
  /** Convierte la tarjeta en un atajo navegable. */
  onClick?: () => void;
  style?: CSSProperties;
}

/**
 * Tarjeta de indicador Signal.
 *
 * Barra de acento y escuadra superior, micro-label, cifra en Space Grotesk y
 * zona de apoyo opcional. Usa tokens del tema (no colores fijos) para que el
 * modo claro y el oscuro mantengan el contraste. Con `onClick` es un atajo
 * accesible: foco por teclado, rol de botón y elevación al pasar el cursor.
 */
export default function StatCard({
  label,
  value,
  hint,
  icon,
  delta,
  tone = "neutral",
  loading,
  onClick,
  style,
}: Props) {
  const { token } = theme.useToken();
  const accent = token[TONE_TOKEN[tone]];
  const accentVar = { "--stat-accent": accent } as CSSProperties;

  return (
    <Card
      className={`stat-card ui-scan${loading ? " ui-scan-active" : ""}`}
      loading={loading}
      hoverable={!!onClick}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      styles={{ body: { padding: "16px 18px" } }}
      style={{ ...accentVar, height: "100%", ...style }}
    >
      <div className="ui-stat__top">
        <span className="ui-eyebrow">{label}</span>
        {icon && (
          <span className="ui-stat__icon" aria-hidden="true" style={{ color: accent }}>
            {icon}
          </span>
        )}
      </div>
      <div className="ui-stat__value">{value}</div>
      {(delta || hint) && (
        <div className="ui-stat__foot">
          {delta}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </Card>
  );
}
