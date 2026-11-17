import type { CSSProperties, ReactNode } from "react";
import { Card } from "antd";

/**
 * Tonos semánticos. `income` / `expense` / `outflow` son alias explícitos de
 * las señales de negocio (ingreso, egreso, salida) para que el significado se
 * lea en el código y no dependa de un color genérico.
 */
export type StatTone =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "income"
  | "warning"
  | "outflow"
  | "danger"
  | "expense"
  | "violet";

const TONE_VARS: Record<StatTone, { accent: string; ink: string }> = {
  neutral: { accent: "var(--ui-ink-2)", ink: "var(--ui-ink)" },
  primary: { accent: "var(--ui-brand)", ink: "var(--ui-brand-strong)" },
  info: { accent: "var(--ui-info)", ink: "var(--ui-info-ink)" },
  success: { accent: "var(--ui-success)", ink: "var(--ui-success-ink)" },
  income: { accent: "var(--ui-success)", ink: "var(--ui-success-ink)" },
  warning: { accent: "var(--ui-warning)", ink: "var(--ui-warning-ink)" },
  outflow: { accent: "var(--ui-warning)", ink: "var(--ui-warning-ink)" },
  danger: { accent: "var(--ui-danger)", ink: "var(--ui-danger-ink)" },
  expense: { accent: "var(--ui-danger)", ink: "var(--ui-danger-ink)" },
  violet: { accent: "var(--ui-violet)", ink: "var(--ui-violet-ink)" },
};

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
  /** Hueco opcional para una serie mínima; no ocupa espacio si no se aporta. */
  sparkline?: ReactNode;
  style?: CSSProperties;
}

/**
 * Tarjeta de indicador Signal.
 *
 * Barra de acento y escuadra superior, micro-label y cifra en Space Grotesk.
 * El tono tiñe la cifra, el icono, la barra y el glow del hover: ingreso, egreso
 * y salida vuelven a distinguirse de un vistazo. Con `onClick` es un atajo
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
  sparkline,
  style,
}: Props) {
  const { accent, ink } = TONE_VARS[tone];
  const toneVars = { "--stat-accent": accent, "--stat-ink": ink } as CSSProperties;

  return (
    <Card
      className={`stat-card ui-stat${loading ? " ui-scan-active" : ""}`}
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
      style={{ ...toneVars, height: "100%", ...style }}
    >
      <div className="ui-stat__top">
        <span className="ui-eyebrow">{label}</span>
        {icon && (
          <span className="ui-stat__icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="ui-stat__value">{value}</div>
      {sparkline && <div className="ui-stat__spark">{sparkline}</div>}
      {(delta || hint) && (
        <div className="ui-stat__foot">
          {delta}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </Card>
  );
}
